// Turns an agent run's live tool calls into a phase checklist the user can
// follow. The AI decides the order and repeats some tools (reviews), so a
// phase counts as done once a later phase has started.

const PHASES = {
  match: [
    { key: 'job', label: 'Load job details', tools: ['get_job_details'] },
    { key: 'memory', label: 'Recall your preferences', tools: ['recall_customer_memory'] },
    { key: 'pool', label: 'Review eligible workers', tools: ['get_candidate_workers'] },
    { key: 'reviews', label: 'Read reviews for top candidates', tools: ['get_worker_reviews'] },
    { key: 'rank', label: 'Rank and explain the best matches', tools: [] },
  ],
  proposal: [
    { key: 'profile', label: 'Load your profile', tools: ['get_worker_profile'] },
    { key: 'memory', label: 'Recall your preferences', tools: ['recall_worker_memory'] },
    { key: 'reviews', label: 'Read your review history', tools: ['get_my_reviews'] },
    { key: 'jobs', label: 'Find open jobs that fit you', tools: ['get_open_jobs'] },
    { key: 'rank', label: 'Rank jobs and draft proposals', tools: [] },
  ],
}

const USER_STEPS = {
  match: ['Your confirmation', 'Send invites'],
  proposal: ['Your confirmation', 'Submit proposals'],
}

// Once the agent has gone quiet for this long after its last tool call, it
// is almost certainly writing up the ranking.
export const RANKING_AFTER_IDLE_MS = 4000

/**
 * @param {'match' | 'proposal'} mode
 * @param {{ status?: string, steps?: { step_name?: string }[] } | undefined} run
 * @param {{ idleMs?: number }} [options]
 * @returns {{ items: { label: string, state: 'done' | 'active' | 'pending' }[], percent: number, activity: string }}
 */
export function liveProgress(mode, run, { idleMs = 0 } = {}) {
  const phases = PHASES[mode]
  const steps = run?.steps || []
  const phaseOf = name => phases.findIndex(phase => phase.tools.includes(name))
  const seen = steps.map(step => phaseOf(step.step_name)).filter(index => index >= 0)
  const rankIndex = phases.length - 1

  let active
  if (!run || run.status === 'pending' || seen.length === 0) active = 0
  else {
    active = seen[seen.length - 1]
    // The latest tool finished a while ago: the model is composing its answer.
    if (idleMs >= RANKING_AFTER_IDLE_MS) active = rankIndex
  }
  const reached = Math.max(active, ...seen)

  const items = [
    ...phases.map((phase, index) => ({
      label: phase.label,
      // Phases before the furthest one reached read as done, including any
      // the agent skipped (e.g. no saved preferences).
      state: index === active ? 'active' : index < Math.max(active, reached) ? 'done' : 'pending',
    })),
    ...USER_STEPS[mode].map(label => ({ label, state: 'pending' })),
  ]

  const reviewsRead = steps.filter(step => step.step_name === 'get_worker_reviews').length
  const activity = !run || run.status === 'pending'
    ? 'Waiting to start…'
    : active === rankIndex
      ? (mode === 'match' ? 'Comparing candidates and writing up the best matches…' : 'Ranking jobs and drafting your proposals…')
      : mode === 'match' && phases[active].key === 'reviews' && reviewsRead > 0
        ? `Read reviews for ${reviewsRead} ${reviewsRead === 1 ? 'candidate' : 'candidates'} so far…`
        : `${phases[active].label}…`

  // Never reaches 100% until the results actually arrive.
  const percent = run?.status === 'pending' || !run ? 4 : Math.min(92, Math.round(((active + 0.5) / phases.length) * 100))

  return { items, percent, activity }
}

/**
 * Checklist for a finished run's saved plan: agent steps are done, the step
 * that waits on the user is current, and anything after it is still to come.
 * @param {string[]} plan
 * @param {string | undefined} status
 */
export function planProgress(plan, status) {
  const waitIndex = plan.findIndex(step => /^await/i.test(step))
  return plan.map((label, index) => {
    if (status === 'completed' || status === 'confirmed') return { label, state: 'done' }
    if (status === 'awaiting_confirmation' && waitIndex >= 0) {
      return { label, state: index < waitIndex ? 'done' : index === waitIndex ? 'waiting' : 'pending' }
    }
    return { label, state: 'done' }
  })
}
