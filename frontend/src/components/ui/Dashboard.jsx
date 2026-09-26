import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { IconChip } from './IconChip'
import { Skeleton } from './Skeleton'

function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Logo-gradient welcome with the day, a plain summary and main actions. */
export function WelcomeBanner({ name, summary, actions }) {
  const today = new Date().toLocaleDateString('en-LK', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <section className="relative overflow-hidden rounded-card bg-gradient-to-br from-sky-500 via-sky-600 to-sky-700 px-5 py-6 text-white shadow-brand sm:px-7 sm:py-7">
      {/* Quiet brand shapes echoing the logo's rounded square. */}
      <span className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rotate-12 rounded-[3rem] border border-white/15" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-20 right-24 h-44 w-44 -rotate-6 rounded-[2.5rem] bg-white/[0.07]" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[13px] font-medium text-sky-100">{today}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">{greeting()}, {name}</h1>
          {summary && <p className="mt-2 max-w-xl text-sm leading-6 text-sky-50/90">{summary}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  )
}

export function StatTile({ icon, tone, label, value, note, to }) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <IconChip icon={icon} tone={tone} />
        {to && <ArrowRight className="h-4 w-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true" />}
      </div>
      <p className="mt-4 text-[13px] font-medium text-fg-muted">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-[22px] font-bold leading-tight tracking-tight text-fg tabular-nums sm:text-[28px]">
        {value ?? <Skeleton className="mt-1 h-8 w-20" />}
      </p>
      {note && <p className="mt-1 text-xs text-fg-subtle">{note}</p>}
    </>
  )
  const classes = 'group block rounded-card border border-line/80 bg-surface p-4 shadow-card transition-all sm:p-5'
  return to
    ? <Link to={to} className={cn(classes, 'hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand')}>{content}</Link>
    : <div className={classes}>{content}</div>
}

export function AttentionItem({ icon, tone, title, detail, to, action }) {
  return (
    <li>
      <Link to={to} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-brand-subtle/50 sm:px-5">
        <IconChip icon={icon} tone={tone} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-fg">{title}</span>
          <span className="block truncate text-[13px] text-fg-muted">{detail}</span>
        </span>
        {action && <span className="hidden shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-semibold text-brand-text ring-1 ring-inset ring-sky-600/20 transition-colors group-hover:bg-brand group-hover:text-brand-on sm:inline">{action}</span>}
        <ChevronRight className={cn('h-4 w-4 shrink-0 text-fg-subtle', action && 'sm:hidden')} aria-hidden="true" />
      </Link>
    </li>
  )
}
