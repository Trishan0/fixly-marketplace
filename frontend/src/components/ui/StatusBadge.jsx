import React from 'react'
import { cn } from '../../lib/utils'
import { JOB_STATUS } from '../../lib/jobs'

// Five tones only. Colour is never the only signal: every badge has a label.
const TONES = {
  neutral: { wrap: 'bg-subtle text-fg-muted', dot: 'bg-fg-subtle' },
  info: { wrap: 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200', dot: 'bg-sky-500' },
  success: { wrap: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200', dot: 'bg-emerald-500' },
  warning: { wrap: 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200', dot: 'bg-amber-500' },
  danger: { wrap: 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-200', dot: 'bg-red-500' },
}

export function StatusBadge({ tone = 'neutral', children, className }) {
  const style = TONES[tone] || TONES.neutral
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', style.wrap, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} aria-hidden="true" />
      {children}
    </span>
  )
}

export function JobStatusBadge({ status, className }) {
  const meta = JOB_STATUS[status] || { label: status, tone: 'neutral' }
  return <StatusBadge tone={meta.tone} className={className}>{meta.label}</StatusBadge>
}
