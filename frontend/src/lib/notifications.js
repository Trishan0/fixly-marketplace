import {
  AlertTriangle, BadgeCheck, Banknote, Bell, CheckCircle2, ClipboardList, Flag, Mail,
  Lightbulb, MessageSquare, Play, ShieldAlert, Star, ThumbsUp, XCircle,
} from 'lucide-react'
import { threadPath } from './messages'

// Icon and tone for each notification type the backend sends.
export const NOTIFICATION_STYLES = {
  new_proposal: { icon: ClipboardList, tone: 'sky' },
  new_message: { icon: MessageSquare, tone: 'sky' },
  proposal_accepted: { icon: CheckCircle2, tone: 'emerald' },
  proposal_declined: { icon: XCircle, tone: 'rose' },
  proposal_withdrawn: { icon: XCircle, tone: 'slate' },
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
  job_flagged: { icon: ShieldAlert, tone: 'rose' },
  job_restored: { icon: CheckCircle2, tone: 'emerald' },
  dispute_resolved: { icon: Banknote, tone: 'slate' },
  matching_tip: { icon: Lightbulb, tone: 'amber' },
}

export const DEFAULT_NOTIFICATION_STYLE = { icon: Bell, tone: 'slate' }

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
    case 'new_message':
      return meta.job_id && meta.worker_id ? threadPath(meta.job_id, meta.worker_id) : '/messages'
    case 'nic_verified':
    case 'nic_rejected':
      return '/profile/edit#identity'
    case 'matching_tip':
      return '/profile/edit'
    case 'report_updated':
      return null
    default:
      return meta.job_id ? `/jobs/${meta.job_id}` : null
  }
}
