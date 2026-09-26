import { formatCurrency } from './utils'

/** The price to show for a job in lists: agreed price, budget, or pricing mode. */
export function jobPriceLabel(job) {
  if (job.final_price) return formatCurrency(job.final_price)
  if (job.pricing_mode === 'fixed' && job.fixed_budget) return formatCurrency(job.fixed_budget)
  if (job.pricing_mode === 'inspection') return 'After inspection'
  return 'Quotes'
}

export function shortDate(value) {
  if (!value) return ''
  const date = new Date(value)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' })
}

// What each job status means to the customer, in plain words, with a
// colour from the shared palette: blue family while the job is moving,
// amber when it needs the customer, green when it's done.
export const JOB_STATUS = {
  posted: { label: 'Open', tone: 'sky' },
  proposals_received: { label: 'Reviewing proposals', tone: 'indigo' },
  assigned: { label: 'Hired', tone: 'violet' },
  in_progress: { label: 'In progress', tone: 'teal' },
  completed: { label: 'Awaiting payment', tone: 'amber' },
  payment_recorded: { label: 'Paid', tone: 'emerald' },
  reviewed: { label: 'Completed', tone: 'emerald' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
}

// Proposals and invites share these statuses.
export const RESPONSE_STATUS = {
  pending: { label: 'Pending', tone: 'amber' },
  accepted: { label: 'Accepted', tone: 'emerald' },
  declined: { label: 'Declined', tone: 'rose' },
  withdrawn: { label: 'Withdrawn', tone: 'slate' },
}

/** Colour for how soon a job is needed: today is urgent, tomorrow is soon. */
export function urgencyTone(urgency) {
  return urgency === 'today' ? 'rose' : urgency === 'tomorrow' ? 'amber' : 'slate'
}
