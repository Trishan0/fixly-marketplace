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

// What each job status means to the customer, in plain words.
export const JOB_STATUS = {
  posted: { label: 'Open', tone: 'neutral' },
  proposals_received: { label: 'Reviewing proposals', tone: 'info' },
  assigned: { label: 'Hired', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'info' },
  completed: { label: 'Awaiting payment', tone: 'warning' },
  payment_recorded: { label: 'Paid', tone: 'success' },
  reviewed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}
