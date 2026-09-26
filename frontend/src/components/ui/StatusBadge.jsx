import React from 'react'
import { cn } from '../../lib/utils'
import { TONES } from '../../lib/tones'
import { JOB_STATUS } from '../../lib/jobs'

// Legacy tone names map onto the palette.
const ALIASES = { neutral: 'slate', info: 'sky', success: 'emerald', warning: 'amber', danger: 'rose' }

export function StatusBadge({ tone = 'slate', children, className }) {
  const style = TONES[ALIASES[tone] || tone] || TONES.slate
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', style.pill, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} aria-hidden="true" />
      {children}
    </span>
  )
}

export function JobStatusBadge({ status, className }) {
  const meta = JOB_STATUS[status] || { label: status, tone: 'slate' }
  return <StatusBadge tone={meta.tone} className={className}>{meta.label}</StatusBadge>
}
