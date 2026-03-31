import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount) {
  if (!amount && amount !== 0) return '—'
  return `LKR ${Number(amount).toLocaleString('en-LK')}`
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-LK', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

export function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(dateStr)
}

export const STATUS_LABELS = {
  posted: 'Posted',
  proposals_received: 'Proposals Received',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  payment_recorded: 'Payment Recorded',
  reviewed: 'Reviewed',
  cancelled: 'Cancelled',
}

export const STATUS_COLORS = {
  posted: 'bg-blue-100 text-blue-700',
  proposals_received: 'bg-violet-100 text-violet-700',
  assigned: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  payment_recorded: 'bg-teal-100 text-teal-700',
  reviewed: 'bg-sky-100 text-sky-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

export const URGENCY_LABELS = {
  today: '🔥 Today',
  tomorrow: '📅 Tomorrow',
  this_week: '📆 This Week',
  flexible: '🕐 Flexible',
}

export const DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar',
  'Mullaitivu', 'Vavuniya', 'Puttalam', 'Kurunegala', 'Anuradhapura',
  'Polonnaruwa', 'Badulla', 'Monaragala', 'Ratnapura', 'Kegalle',
  'Trincomalee', 'Batticaloa', 'Ampara'
]

export function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
