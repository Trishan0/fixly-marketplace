/**
 * scoring.js — Deterministic scoring engine for Fixly agents.
 *
 * All factor scores are normalized to [0, 1].
 * The final total is a weighted sum, also in [0, 1].
 */

// ─── Match Agent: Score a worker for a job ───────────────────────────────────

const MATCH_WEIGHTS = {
  skill_fit:        0.30,
  location_fit:     0.20,
  rating_score:     0.15,
  completion_score: 0.15,
  price_fit:        0.10,
  urgency_fit:      0.10,
};

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
 * Rating score: normalize avg_rating (0–5) to [0, 1].
 * Workers with no rating get 0.4 (benefit of the doubt).
 */
function calcRatingScore(worker) {
  const rating = parseFloat(worker.avg_rating) || 0;
  if (rating === 0) return 0.4;
  return Math.min(rating / 5.0, 1.0);
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

/**
 * Price fit: compare worker's starting_price vs job's fixed_budget.
 * If worker is cheaper or equal → good. If much more expensive → low score.
 * Unknown budget → 0.5.
 */
function calcPriceFit(worker, job) {
  const workerPrice = parsePrice(worker.starting_price);
  const jobBudget = parseFloat(job.fixed_budget) || null;

  if (!workerPrice || !jobBudget) return 0.5;

  const ratio = workerPrice / jobBudget;
  if (ratio <= 0.8) return 1.0;   // well under budget
  if (ratio <= 1.0) return 0.85;  // at or just under
  if (ratio <= 1.2) return 0.5;   // slightly over
  if (ratio <= 1.5) return 0.25;  // noticeably over
  return 0.0;                      // way over
}

/**
 * Urgency fit: can the worker respond quickly?
 * Using NIC verification and rating as proxies for reliability.
 */
function calcUrgencyFit(worker, job) {
  const urgency = job.urgency;
  if (!urgency || urgency === 'flexible') return 0.8;

  const isVerified = worker.is_nic_verified;
  const hasExperience = (parseInt(worker.total_jobs_done) || 0) > 3;

  if (urgency === 'today') {
    if (isVerified && hasExperience) return 1.0;
    if (isVerified || hasExperience) return 0.65;
    return 0.3;
  }
  if (urgency === 'tomorrow') {
    if (isVerified) return 0.9;
    return 0.6;
  }
  if (urgency === 'this_week') return 0.85;
  return 0.8;
}

/**
 * Main: score a worker for a job.
 * Returns { total: Number, factors: Object, rationale: String }
 */
function scoreWorkerForJob(worker, job) {
  const factors = {
    skill_fit:        calcSkillFit(worker, job),
    location_fit:     calcLocationFit(worker, job),
    rating_score:     calcRatingScore(worker),
    completion_score: calcCompletionScore(worker),
    price_fit:        calcPriceFit(worker, job),
    urgency_fit:      calcUrgencyFit(worker, job),
  };

  const total = Object.entries(MATCH_WEIGHTS).reduce(
    (sum, [key, weight]) => sum + (factors[key] * weight), 0
  );

  const rationale = buildMatchRationale(worker, job, factors, total);

  return { total: parseFloat(total.toFixed(4)), factors, rationale };
}

function buildMatchRationale(worker, job, factors, total) {
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

  if (factors.rating_score >= 0.8) {
    lines.push(`✓ Highly rated (${worker.avg_rating}/5)`);
  } else if (factors.rating_score >= 0.6) {
    lines.push(`~ Good rating (${worker.avg_rating}/5)`);
  } else if (!parseFloat(worker.avg_rating)) {
    lines.push(`~ No reviews yet`);
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

function buildProposalRationale(job, worker, factors, total) {
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
function draftProposalMessage(job, worker) {
  const skill = worker.primary_skill || 'my services';
  const district = worker.district || 'your area';
  const urgencyLine =
    job.urgency === 'today' ? "I'm available today and can start immediately." :
    job.urgency === 'tomorrow' ? "I can be there tomorrow." :
    "I can work around your schedule.";

  return (
    `Hi, I'm ${worker.full_name} — a ${skill} specialist based in ${district}. ` +
    `I noticed your job posting for "${job.title}" and I'd love to help. ` +
    urgencyLine +
    ` I have ${worker.total_jobs_done || 0} completed jobs on Fixly` +
    (worker.avg_rating > 0 ? ` with an average rating of ${worker.avg_rating}/5` : '') +
    `. Please feel free to reach out if you have any questions.`
  );
}

module.exports = { scoreWorkerForJob, scoreJobForWorker, draftProposalMessage, parsePrice };
