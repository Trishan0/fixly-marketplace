import React from 'react'
import { cn } from '../../lib/utils'

export function Card({ as: Tag = 'section', className, children, ...props }) {
  return (
    <Tag className={cn('rounded-card border border-line bg-surface', className)} {...props}>
      {children}
    </Tag>
  )
}

export function CardHeader({ title, description, actions, className, id }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5', className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
