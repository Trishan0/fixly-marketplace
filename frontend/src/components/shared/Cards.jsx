import React from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Briefcase, CalendarClock, MapPin, MessagesSquare, Star } from 'lucide-react'
import { Avatar, Badge } from './UI'
import { buttonClasses } from '../ui/buttonClasses'
import { IconChip } from '../ui/IconChip'
import { categoryStyle } from '../../lib/tones'
import { cn, formatCurrency, formatStartingPrice, pluralize } from '../../lib/utils'

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20">
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified
    </span>
  )
}

function Rating({ value, count }) {
  const rating = Number(value) || 0
  if (!rating) return <span className="text-xs font-medium text-fg-subtle">New on Fixly</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-fg">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
      {rating.toFixed(1)}
      {typeof count === 'number' && <span className="font-normal text-fg-subtle">({count})</span>}
    </span>
  )
}

export function WorkerCard({ worker, onInvite }) {
  const { icon, tone } = categoryStyle(worker.primary_skill)
  const price = formatStartingPrice(worker.starting_price)
  return (
    <article className="group relative flex flex-col rounded-card border border-line/80 bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover sm:p-5">
      <div className="flex items-start gap-3.5">
        <Avatar name={worker.full_name} src={worker.profile_photo} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="min-w-0 truncate text-[15px] font-semibold text-fg">
              <Link to={`/workers/${worker.id}`} className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand">
                {worker.full_name}
              </Link>
            </h3>
            {worker.is_nic_verified && <VerifiedBadge />}
          </div>
          {worker.primary_skill && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted">
              <IconChip icon={icon} tone={tone} size="sm" className="h-6 w-6 rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5" />
              {worker.primary_skill}
            </p>
          )}
        </div>
      </div>
      {worker.bio && <p className="mt-3 line-clamp-2 text-[13px] leading-5 text-fg-muted">{worker.bio}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-muted">
        <Rating value={worker.avg_rating} />
        <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />{pluralize(worker.total_jobs_done || 0, 'job')} done</span>
        {worker.district && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />{worker.district}</span>}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-[13px] text-fg-muted">{price ? <>From <span className="font-semibold text-fg">{price}</span></> : 'Quote on request'}</p>
        {onInvite && (
          <button type="button" onClick={() => onInvite(worker)} className={buttonClasses({ size: 'sm', className: 'relative z-10' })}>
            Invite to job
          </button>
        )}
      </div>
    </article>
  )
}

export function ProposalCard({ proposal, isOwner, onAccept, onDecline, onWithdraw, messageTo }) {
  const quote = proposal.proposed_price
    ? <span className="text-xl font-bold tracking-tight text-fg">{formatCurrency(proposal.proposed_price)}</span>
    : proposal.inspection_needed
      ? <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">Quote after inspection</span>
      : <span className="text-sm font-medium text-fg-muted">Accepted your invite — no quote yet</span>
  return (
    <article className={cn('rounded-card border bg-surface p-4 shadow-card sm:p-5', proposal.status === 'accepted' ? 'border-emerald-300 dark:border-emerald-500/40' : 'border-line/80')}>
      <div className="flex items-start gap-3">
        <Avatar name={proposal.worker_name} src={proposal.worker_photo} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/workers/${proposal.worker_id}`} className="min-w-0 truncate font-semibold text-fg hover:text-brand-text">{proposal.worker_name}</Link>
            {proposal.is_nic_verified && <VerifiedBadge />}
            <Badge status={proposal.status} className="ml-auto" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
            <Rating value={proposal.avg_rating} />
            <span>{pluralize(proposal.total_jobs_done || 0, 'job')} done</span>
            {proposal.primary_skill && <span>{proposal.primary_skill}</span>}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-2 rounded-control bg-subtle px-3.5 py-3">
        <div>
          <p className="text-[11px] font-medium text-fg-subtle">Quote</p>
          {quote}
        </div>
        {proposal.availability && (
          <p className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted">
            <CalendarClock className="h-4 w-4 text-fg-subtle" aria-hidden="true" /> {proposal.availability}
          </p>
        )}
      </div>

      {proposal.message && proposal.message !== 'Accepted via invite' && (
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-fg-muted">{proposal.message}</p>
      )}

      {isOwner && proposal.status !== 'withdrawn' && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          {proposal.status === 'pending' && (
            <>
              <button type="button" onClick={() => onAccept(proposal.id)} className={buttonClasses({ size: 'sm' })}>Hire</button>
              <button type="button" onClick={() => onDecline(proposal.id)} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>Decline</button>
            </>
          )}
          {messageTo && (
            <Link to={messageTo} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              <MessagesSquare className="h-4 w-4" aria-hidden="true" /> Message
            </Link>
          )}
          <Link to={`/workers/${proposal.worker_id}`} className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'ml-auto' })}>View profile</Link>
        </div>
      )}
      {proposal.status === 'pending' && !isOwner && onWithdraw && (
        <div className="mt-4 border-t border-line pt-4">
          <button type="button" onClick={() => onWithdraw(proposal.id)} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>Withdraw</button>
        </div>
      )}
    </article>
  )
}
