/**
 * scoring.js — Deterministic scoring engine for Fixly agents.
 *
 * All factor scores are normalized to [0, 1].
 * The final total is a weighted sum, also in [0, 1].
 */

// ─── Match Agent: Score a worker for a job ───────────────────────────────────

// Price is deliberately not a factor: workers don't set fixed prices (the
// starting price is an optional guide) and the price is agreed per job.
// Ranking on it would push workers to post low guide prices to rank higher.
const MATCH_WEIGHTS = {
  skill_fit:        0.35,
  location_fit:     0.25,
  rating_score:     0.15,
  completion_score: 0.15,
  urgency_fit:      0.10,
};

// Unrated workers start at the platform average rather than a fixed low
// score; each real review then pulls them toward their own average. The
// prior counts as this many reviews.
const RATING_PRIOR_WEIGHT = 3;
const DEFAULT_PLATFORM_RATING = 4.0;

/**
 * Parse a starting_price VARCHAR like "LKR 2500" or "2500" → number or null.
 */
function parsePrice(raw) {
  if (!raw) return null;
  const match = String(raw).match(/[\d,]+(\.\d+)?/);
  if (!match) return null;
  return parseFloat(match[0].replace(/,/g, ''));
}

/**
 * Skill fit: fraction of job's required skills that the worker has.
 * Falls back to primary_skill text match if no structured skills available.
 */
function calcSkillFit(worker, job) {
  const jobCategoryId = job.category_id;
  const workerSkills = worker.skills || [];

  if (jobCategoryId && workerSkills.length > 0) {
    const hasSkill = workerSkills.some(s => s.category_id === jobCategoryId);
    if (hasSkill) {
      const isPrimary = workerSkills.some(s => s.category_id === jobCategoryId && s.is_primary);
      return isPrimary ? 1.0 : 0.7;
    }
    return 0.1;
  }

  // Fallback: text match on category name vs primary_skill
  if (job.category_name && worker.primary_skill) {
    const jobCat = job.category_name.toLowerCase();
    const workerSkill = worker.primary_skill.toLowerCase();
    if (workerSkill.includes(jobCat) || jobCat.includes(workerSkill)) return 0.75;
  }

  return 0.2; // unknown
}

/**
 * Location fit: exact match = 1.0, partial = 0.5, none = 0.
 */
function calcLocationFit(worker, job) {
  if (!worker.district || !job.district) return 0.3;
  const wd = worker.district.toLowerCase().trim();
  const jd = job.district.toLowerCase().trim();
  if (wd === jd) return 1.0;
  if (wd.includes(jd) || jd.includes(wd)) return 0.6;
  return 0.0;
}

/**
 * Rating score: a Bayesian average, normalized to [0, 1]. With no reviews
 * it's the platform average; with many it's the worker's own average.
 * @param {{ platformAvgRating?: number | null }} [context]
 */
function calcRatingScore(worker, context = {}) {
  const rating = parseFloat(worker.avg_rating) || 0;
  const prior = Number(context.platformAvgRating) || DEFAULT_PLATFORM_RATING;
  const reviews = worker.review_count != null
    ? Number(worker.review_count) || 0
    : (rating > 0 ? parseInt(worker.total_jobs_done) || 1 : 0);
  const blended = (RATING_PRIOR_WEIGHT * prior + reviews * rating) / (RATING_PRIOR_WEIGHT + reviews);
  return Math.min(blended / 5.0, 1.0);
}

/**
 * Completion score: log-scaled jobs done count.
 * 0 jobs → 0, 10+ jobs → near 1.
 */
function calcCompletionScore(worker) {
  const done = parseInt(worker.total_jobs_done) || 0;
  if (done === 0) return 0.1;
  return Math.min(Math.log10(done + 1) / Math.log10(51), 1.0); // saturates at ~50
}

// A starting price this many times the job's fixed budget earns a note
// on the recommendation. It's information for the customer, never a
// penalty: the final price is agreed per job.
const PRICE_NOTE_RATIO = 1.5;

/**
 * A short note when a worker's optional guide price is well above the
 * job's fixed budget, or null.
 */
function priceNote(worker, job) {
  const workerPrice = parsePrice(worker.starting_price);
  const jobBudget = job.pricing_mode === 'fixed' ? parseFloat(job.fixed_budget) || null : null;
  if (!workerPrice || !jobBudget || workerPrice <= jobBudget * PRICE_NOTE_RATIO) return null;
  return `Usually starts at LKR ${workerPrice.toLocaleString('en-LK')}. Your budget is LKR ${jobBudget.toLocaleString('en-LK')}.`;
}

/**
 * Urgency fit: can the worker be trusted to turn up quickly? Uses ID
 * verification only - experience is already scored by completion_score,
 * so counting it again here would penalize new workers twice.
 */
function calcUrgencyFit(worker, job) {
  const urgency = job.urgency;
  if (!urgency || urgency === 'flexible') return 0.8;
  const isVerified = worker.is_nic_verified;
  if (urgency === 'today') return isVerified ? 1.0 : 0.6;
  if (urgency === 'tomorrow') return isVerified ? 0.9 : 0.7;
  if (urgency === 'this_week') return 0.85;
  return 0.8;
}

/**
 * Main: score a worker for a job.
 * Returns { total: Number, factors: Object, rationale: String }
 */
function scoreWorkerForJob(worker, job, context = {}) {
  const factors = {
    skill_fit:        calcSkillFit(worker, job),
    location_fit:     calcLocationFit(worker, job),
    rating_score:     calcRatingScore(worker, context),
    completion_score: calcCompletionScore(worker),
    urgency_fit:      calcUrgencyFit(worker, job),
  };

  const total = Object.entries(MATCH_WEIGHTS).reduce(
    (sum, [key, weight]) => sum + (factors[key] * weight), 0
  );

  const rationale = buildMatchRationale(worker, job, factors, total);

  return { total: parseFloat(total.toFixed(4)), factors, rationale };
}

function buildMatchRationale(worker, job, factors, _total) {
  const lines = [];

  if (factors.skill_fit >= 0.7) {
    lines.push(`✓ Strong skill match for ${job.category_name || 'this job type'}`);
  } else if (factors.skill_fit >= 0.4) {
    lines.push(`~ Partial skill overlap with ${job.category_name || 'this job type'}`);
  } else {
    lines.push(`✗ Limited skill match`);
  }

  if (factors.location_fit === 1.0) {
    lines.push(`✓ Works in ${worker.district} — same district as job`);
  } else if (factors.location_fit >= 0.5) {
    lines.push(`~ Nearby district (${worker.district})`);
  } else {
    lines.push(`✗ Different district (${worker.district} vs ${job.district})`);
  }

  if (!parseFloat(worker.avg_rating)) {
    lines.push(`~ No reviews yet`);
  } else if (factors.rating_score >= 0.8) {
    lines.push(`✓ Highly rated (${worker.avg_rating}/5)`);
  } else if (factors.rating_score >= 0.6) {
    lines.push(`~ Good rating (${worker.avg_rating}/5)`);
  } else {
    lines.push(`✗ Lower rating (${worker.avg_rating}/5)`);
  }

  const done = parseInt(worker.total_jobs_done) || 0;
  if (done >= 10) lines.push(`✓ ${done} jobs completed`);
  else if (done > 0) lines.push(`~ ${done} job${done === 1 ? '' : 's'} completed`);
  else lines.push(`~ New worker on platform`);

  if (worker.is_nic_verified) lines.push(`✓ NIC verified`);

  return lines.join(' · ');
}

/**
 * Score every candidate for a job — no sort, no cut. The formula's
 * objective_score is handed to the agent as one input signal, not used to
 * exclude anyone before it reasons over the pool: a hard top-N cut by this
 * same shallow formula would defeat the point of reading actual reviews
 * (it can't see that a worker's flat average is hiding, say, 200 bad
 * reviews diluted by 20 good ones — only the text can tell you that).
 * @param {Object[]} workers
 * @param {Object} job
 * @returns {{ worker: Object, total: number, factors: Object, rationale: string }[]}
 */
function scoreAllWorkersForJob(workers, job, context = {}) {
  return workers.map(worker => ({ worker, ...scoreWorkerForJob(worker, job, context) }));
}

// ─── Match Agent: newcomer fit (new-talent lane) ─────────────────────────────

// No rating or experience terms: a newcomer has neither, and judging them
// on it is exactly what keeps them invisible. Fit is about the job and how
// much effort they've put into showing their work.
const NEWCOMER_WEIGHTS = {
  skill_fit:      0.40,
  location_fit:   0.25,
  profile:        0.20,
  responsiveness: 0.15,
};

/** Bio depth and portfolio photos, in [0, 1]. */
function calcProfileCompleteness(worker) {
  const bioLength = String(worker.bio || '').trim().length;
  const bio = bioLength >= 120 ? 1.0 : bioLength >= 60 ? 0.75 : 0.5;
  const photos = Number(worker.portfolio_count) || 0;
  const portfolio = photos >= 3 ? 1.0 : photos >= 1 ? 0.6 : 0.0;
  return (bio + portfolio) / 2;
}

/**
 * Share of recent invites the worker accepted. Neutral until they've had
 * any, so the first customer to try them isn't held against them.
 */
function calcResponsiveness(worker) {
  const accepted = Number(worker.invites_accepted) || 0;
  const unanswered = Number(worker.invites_unanswered) || 0;
  if (accepted + unanswered === 0) return 0.7;
  return accepted / (accepted + unanswered);
}

function scoreNewcomerForJob(worker, job) {
  const factors = {
    skill_fit:      calcSkillFit(worker, job),
    location_fit:   calcLocationFit(worker, job),
    profile:        calcProfileCompleteness(worker),
    responsiveness: calcResponsiveness(worker),
  };
  const total = Object.entries(NEWCOMER_WEIGHTS).reduce((sum, [key, weight]) => sum + factors[key] * weight, 0);
  return { total: parseFloat(total.toFixed(4)), factors, rationale: buildNewcomerRationale(worker, job, factors) };
}

/** Plain facts for a newcomer card - never phrased as model reasoning. */
function buildNewcomerRationale(worker, job, factors) {
  const lines = [];
  if (factors.skill_fit >= 1.0) lines.push(`${job.category_name || 'This trade'} is their main skill`);
  else if (factors.skill_fit >= 0.7) lines.push(`Also does ${job.category_name || 'this kind of work'}`);
  if (worker.district) lines.push(factors.location_fit === 1.0 ? `Based in ${worker.district}` : `Based in ${worker.district} (outside ${job.district || 'your district'})`);
  lines.push('ID verified');
  const photos = Number(worker.portfolio_count) || 0;
  if (photos > 0) lines.push(`${photos} portfolio photo${photos === 1 ? '' : 's'}`);
  const done = parseInt(worker.total_jobs_done) || 0;
  lines.push(done > 0 ? `${done} job${done === 1 ? '' : 's'} done on Fixly` : 'New on Fixly');
  return lines.join(' · ');
}

// ─── Proposal Agent: Score a job for a worker ────────────────────────────────

const PROPOSAL_WEIGHTS = {
  skill_overlap:    0.30,
  location_fit:     0.20,
  budget_quality:   0.20,
  urgency:          0.15,
  win_probability:  0.15,
};

/**
 * Skill overlap: same logic from the other direction.
 */
function calcJobSkillOverlap(job, worker) {
  const jobCategoryId = job.category_id;
  const workerSkills = worker.skills || [];

  if (jobCategoryId && workerSkills.length > 0) {
    const hasSkill = workerSkills.some(s => s.category_id === jobCategoryId);
    if (hasSkill) {
      const isPrimary = workerSkills.some(s => s.category_id === jobCategoryId && s.is_primary);
      return isPrimary ? 1.0 : 0.7;
    }
    return 0.1;
  }

  if (job.category_name && worker.primary_skill) {
    const jobCat = job.category_name.toLowerCase();
    const ws = worker.primary_skill.toLowerCase();
    if (ws.includes(jobCat) || jobCat.includes(ws)) return 0.75;
  }

  return 0.2;
}

/**
 * Budget quality: higher fixed budget = better opportunity.
 * Relative to worker's starting price.
 */
function calcBudgetQuality(job, worker) {
  if (job.pricing_mode === 'ask_quotes' || job.pricing_mode === 'inspection') return 0.65;
  const budget = parseFloat(job.fixed_budget) || null;
  const workerPrice = parsePrice(worker.starting_price);
  if (!budget) return 0.5;
  if (!workerPrice) return 0.6;

  const ratio = budget / workerPrice;
  if (ratio >= 2.0) return 1.0;
  if (ratio >= 1.3) return 0.85;
  if (ratio >= 1.0) return 0.7;
  if (ratio >= 0.7) return 0.4;
  return 0.2;
}

/**
 * Urgency: urgent jobs pay faster and close sooner.
 */
function calcJobUrgency(job) {
  const map = { today: 1.0, tomorrow: 0.85, this_week: 0.65, flexible: 0.4 };
  return map[job.urgency] || 0.4;
}

/**
 * Win probability: fewer proposals = better chance.
 * Proxy: use proposal_count if available, else 0.5.
 */
function calcWinProbability(job, worker) {
  const proposalCount = parseInt(job.proposal_count) || 0;
  let base;
  if (proposalCount === 0) base = 0.9;
  else if (proposalCount <= 2) base = 0.7;
  else if (proposalCount <= 5) base = 0.5;
  else if (proposalCount <= 10) base = 0.3;
  else base = 0.15;

  // Boost if worker is NIC verified
  if (worker.is_nic_verified) base = Math.min(base + 0.1, 1.0);
  return base;
}

/**
 * Main: score a job for a worker.
 */
function scoreJobForWorker(job, worker) {
  const factors = {
    skill_overlap:   calcJobSkillOverlap(job, worker),
    location_fit:    calcLocationFit(worker, job),
    budget_quality:  calcBudgetQuality(job, worker),
    urgency:         calcJobUrgency(job),
    win_probability: calcWinProbability(job, worker),
  };

  const total = Object.entries(PROPOSAL_WEIGHTS).reduce(
    (sum, [key, weight]) => sum + (factors[key] * weight), 0
  );

  const rationale = buildProposalRationale(job, worker, factors, total);

  return { total: parseFloat(total.toFixed(4)), factors, rationale };
}

function buildProposalRationale(job, worker, factors, _total) {
  const lines = [];

  if (factors.skill_overlap >= 0.7) {
    lines.push(`✓ Great match for your ${worker.primary_skill || 'skills'}`);
  } else if (factors.skill_overlap >= 0.4) {
    lines.push(`~ Partial skill match`);
  } else {
    lines.push(`✗ Low skill overlap`);
  }

  if (factors.location_fit === 1.0) {
    lines.push(`✓ Job is in your district (${worker.district})`);
  } else if (factors.location_fit >= 0.5) {
    lines.push(`~ Nearby location`);
  } else {
    lines.push(`✗ Different district`);
  }

  if (factors.budget_quality >= 0.8) {
    lines.push(`✓ Strong budget (${job.fixed_budget ? 'LKR ' + Number(job.fixed_budget).toLocaleString() : 'open quote'})`);
  } else if (factors.budget_quality >= 0.5) {
    lines.push(`~ Fair budget`);
  } else {
    lines.push(`✗ Low budget relative to your rate`);
  }

  if (factors.urgency >= 0.8) lines.push(`✓ Urgent — fast closure`);
  else if (factors.urgency >= 0.6) lines.push(`~ Moderate urgency`);
  else lines.push(`~ Flexible timeline`);

  const pc = parseInt(job.proposal_count) || 0;
  if (pc === 0) lines.push(`✓ No proposals yet — be first!`);
  else lines.push(`~ ${pc} proposal${pc === 1 ? '' : 's'} already sent`);

  return lines.join(' · ');
}

/**
 * Draft a proposal message using templated text.
 */
/**
 * The plain, factual draft: used when the AI is unavailable or its own
 * draft fails the checks in proposalDrafts.js. States only profile facts.
 * No promises about timing: the worker sets availability themselves.
 */
function draftProposalMessage(job, worker) {
  const skill = worker.primary_skill || 'my services';
  const district = worker.district || 'your area';
  const done = parseInt(worker.total_jobs_done) || 0;
  const record = done > 0
    ? `I have ${done} completed job${done === 1 ? '' : 's'} on Fixly` + (Number(worker.avg_rating) > 0 ? ` with an average rating of ${worker.avg_rating}/5.` : '.')
    : 'I’m new on Fixly.';
  const verified = worker.is_nic_verified ? ' My ID is verified by Fixly.' : '';

  return (
    `Hi, I'm ${worker.full_name}, a ${skill} worker based in ${district}. ` +
    `I saw your job "${job.title}" and I'd like to help. ` +
    `${record}${verified} ` +
    `My price and when I can come are in this proposal. Please message me if you have any questions.`
  );
}

module.exports = { scoreWorkerForJob, scoreJobForWorker, scoreAllWorkersForJob, scoreNewcomerForJob, draftProposalMessage, parsePrice, priceNote };
