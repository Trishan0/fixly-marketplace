import React from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Briefcase, Shield, Clock } from 'lucide-react'
import { Avatar, Badge, StarRating, Button } from './UI'
import { formatCurrency, formatRelativeTime, URGENCY_LABELS } from '../../lib/utils'

export function WorkerCard({ worker, onInvite }) {
  return (
    <div className="fixly-card p-4 transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-start gap-4">
        <Avatar name={worker.full_name} src={worker.profile_photo} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 font-semibold text-slate-900">{worker.full_name}</h3>
            {worker.is_nic_verified && (
              <span className="fixly-pill-sky">
                <Shield className="h-3 w-3" /> Verified
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-medium text-sky-600 dark:text-sky-300">{worker.primary_skill}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {worker.district && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3 w-3" />{worker.district}
              </span>
            )}
            <StarRating rating={worker.avg_rating || 0} />
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Briefcase className="h-3 w-3" />{worker.total_jobs_done || 0} jobs
            </span>
          </div>
          {worker.starting_price && (
            <p className="mt-1 text-xs text-slate-500">From {worker.starting_price}</p>
          )}
        </div>
      </div>
      <div className={`mt-4 grid grid-cols-1 gap-2 border-t border-slate-50 pt-4 dark:border-slate-800 ${onInvite ? 'min-[360px]:grid-cols-2' : ''}`}>
        <Link to={`/workers/${worker.id}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full">View Profile</Button>
        </Link>
        {onInvite && (
          <Button variant="primary" size="sm" onClick={() => onInvite(worker)} className="flex-1">
            Invite to Job
          </Button>
        )}
      </div>
    </div>
  )
}

export function JobCard({ job, role, onAction }) {
  const isWorker = role === 'worker'
  return (
    <div className="fixly-card p-4 transition-shadow hover:shadow-md sm:p-5">
      <div className="sm:flex sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge status={job.status} />
            {job.urgency && <span className="text-xs text-slate-500">{URGENCY_LABELS[job.urgency]}</span>}
          </div>
          <h3 className="line-clamp-2-mobile font-semibold leading-6 text-slate-900">{job.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {job.category_name && <span className="fixly-pill-sky">{job.category_name}</span>}
            {job.district && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3 w-3" />{job.district}
              </span>
            )}
            {job.proposal_count !== undefined && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Briefcase className="h-3 w-3" />{job.proposal_count} proposal{job.proposal_count !== 1 ? 's' : ''}
              </span>
            )}
            {job.has_my_proposal && <span className="fixly-pill-emerald">Proposal sent</span>}
          </div>
          {job.fixed_budget && job.pricing_mode === 'fixed' && (
            <p className="mt-2 text-sm font-semibold text-sky-700 dark:text-sky-300">Budget: {formatCurrency(job.fixed_budget)}</p>
          )}
          {job.pricing_mode === 'ask_quotes' && (
            <p className="mt-1 text-xs font-medium text-violet-600 dark:text-violet-300">Open to quotes</p>
          )}
          {job.pricing_mode === 'inspection' && (
            <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-300">Inspection required</p>
          )}
        </div>
        <p className="mt-3 shrink-0 text-xs text-slate-400 sm:mt-0">
          <Clock className="mr-1 inline h-3 w-3" />
          {formatRelativeTime(job.created_at)}
        </p>
      </div>

      {job.assigned_worker_name && (
        <div className="mt-3 flex items-center gap-2 border-t border-slate-50 pt-3 dark:border-slate-800">
          <Avatar name={job.assigned_worker_name} src={job.assigned_worker_photo} size="sm" />
          <p className="text-xs text-slate-500">Assigned to <span className="font-medium text-slate-700 dark:text-slate-200">{job.assigned_worker_name}</span></p>
        </div>
      )}

      {!isWorker && job.status === 'proposals_received' && Number(job.proposal_count || 0) > 0 && (
        <div className="mt-3 border-t border-slate-50 pt-3 dark:border-slate-800">
          <p className="text-sm font-medium text-violet-700 dark:text-violet-300">Review proposals from workers now</p>
        </div>
      )}

      {onAction && (
        <div className="mt-3 border-t border-slate-50 pt-3 dark:border-slate-800">
          {onAction(job)}
        </div>
      )}
    </div>
  )
}

export function ProposalCard({ proposal, isOwner, onAccept, onDecline, onWithdraw }) {
  return (
    <div className="fixly-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={proposal.worker_name} src={proposal.worker_photo} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 font-semibold text-slate-900">{proposal.worker_name}</span>
            {proposal.is_nic_verified && (
              <span className="fixly-pill-sky">
                <Shield className="h-3 w-3" /> Verified
              </span>
            )}
            <Badge status={proposal.status} className="sm:ml-auto" />
          </div>
          <div className="mt-1 flex items-center gap-3">
            <StarRating rating={proposal.avg_rating || 0} />
            <span className="text-xs text-slate-500">{proposal.total_jobs_done || 0} jobs done</span>
          </div>
          {proposal.proposed_price ? (
            <p className="mt-2 text-lg font-bold text-sky-700 dark:text-sky-300">{formatCurrency(proposal.proposed_price)}</p>
          ) : proposal.price_range ? (
            <p className="mt-2 text-sm text-slate-500">Range: {proposal.price_range}</p>
          ) : (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-300">Inspection required for price</p>
          )}
          {proposal.availability && (
            <p className="mt-1 text-xs text-slate-500">Available: {proposal.availability}</p>
          )}
          {proposal.message && (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm italic text-slate-600 dark:bg-slate-900/70">"{proposal.message}"</p>
          )}
        </div>
      </div>

      {proposal.status === 'pending' && isOwner && (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-50 pt-4 dark:border-slate-800 sm:flex">
          <Button variant="primary" size="sm" className="flex-1" onClick={() => onAccept(proposal.id)}>Accept</Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onDecline(proposal.id)}>Decline</Button>
          <Link to={`/workers/${proposal.worker_id}`} className="col-span-2 sm:col-span-1">
            <Button variant="ghost" size="sm" className="w-full">Profile</Button>
          </Link>
        </div>
      )}
      {proposal.status === 'pending' && !isOwner && onWithdraw && (
        <div className="mt-4 border-t border-slate-50 pt-4 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={() => onWithdraw(proposal.id)}>Withdraw</Button>
        </div>
      )}
    </div>
  )
}
