import {
  AlertTriangle, BadgeCheck, Banknote, Bell, CheckCircle2, ClipboardList, Flag, Mail,
  MessageSquare, Play, ShieldAlert, Star, ThumbsUp, XCircle,
} from 'lucide-react'

// Icon and tone for each notification type the backend sends.
export const NOTIFICATION_STYLES = {
  new_proposal: { icon: MessageSquare, tone: 'sky' },
  proposal_accepted: { icon: CheckCircle2, tone: 'emerald' },
  proposal_declined: { icon: XCircle, tone: 'rose' },
  new_invite: { icon: Mail, tone: 'violet' },
  invite_accepted: { icon: ThumbsUp, tone: 'emerald' },
  job_started: { icon: Play, tone: 'sky' },
  job_completed: { icon: ClipboardList, tone: 'emerald' },
  payment_recorded: { icon: Banknote, tone: 'emerald' },
  payment_confirmed: { icon: Banknote, tone: 'emerald' },
  payment_disputed: { icon: AlertTriangle, tone: 'amber' },
  review_received: { icon: Star, tone: 'amber' },
  report_updated: { icon: Flag, tone: 'slate' },
  nic_verified: { icon: BadgeCheck, tone: 'emerald' },
  nic_rejected: { icon: ShieldAlert, tone: 'amber' },
}

export const DEFAULT_NOTIFICATION_STYLE = { icon: Bell, tone: 'slate' }

export const TONE_CLASSES = {
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

function parseMeta(meta) {
  if (!meta) return {}
  if (typeof meta === 'string') {
    try { return JSON.parse(meta) || {} } catch { return {} }
  }
  return meta
}

/** Where tapping a notification should take the user, or null if nowhere. */
export function notificationTarget(notification) {
  const meta = parseMeta(notification?.meta)
  switch (notification?.type) {
    case 'new_invite':
      return '/invites'
    case 'nic_verified':
    case 'nic_rejected':
      return '/profile/edit#identity'
    case 'report_updated':
      return null
    default:
      return meta.job_id ? `/jobs/${meta.job_id}` : null
  }
}
