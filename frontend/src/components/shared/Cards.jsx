import React from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Star, Briefcase, Shield, Clock } from 'lucide-react'
import { Avatar, Badge, StarRating, Button } from './UI'
import { formatCurrency, formatRelativeTime, STATUS_LABELS, STATUS_COLORS, URGENCY_LABELS, cn } from '../../lib/utils'

export function WorkerCard({ worker, onInvite, jobId }) {
  return (
    <div className="fixly-card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <Avatar name={worker.full_name} src={worker.profile_photo} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 truncate">{worker.full_name}</h3>
            {worker.is_nic_verified && (
              <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                <Shield className="w-3 h-3" /> Verified
              </span>
            )}
          </div>
          <p className="text-sm text-sky-600 font-medium mt-0.5">{worker.primary_skill}</p>
          <div className="flex items-center flex-wrap gap-3 mt-2">
            {worker.district && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="w-3 h-3" />{worker.district}
              </span>
            )}
            <StarRating rating={worker.avg_rating || 0} />
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Briefcase className="w-3 h-3" />{worker.total_jobs_done || 0} jobs
            </span>
          </div>
          {worker.starting_price && (
            <p className="text-xs text-slate-500 mt-1">From {worker.starting_price}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50">
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
    <div className="fixly-card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge status={job.status} />
            {job.urgency && (
              <span className="text-xs text-slate-500">{URGENCY_LABELS[job.urgency]}</span>
            )}
          </div>
          <h3 className="font-semibold text-slate-900 truncate">{job.title}</h3>
          <div className="flex items-center flex-wrap gap-3 mt-2">
            {job.category_name && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{job.category_name}</span>
            )}
            {job.district && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="w-3 h-3" />{job.district}
              </span>
            )}
            {job.proposal_count !== undefined && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Briefcase className="w-3 h-3" />{job.proposal_count} proposal{job.proposal_count !== 1 ? 's' : ''}
              </span>
            )}
            {job.has_my_proposal && (
              <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Proposal sent</span>
            )}
          </div>
          {job.fixed_budget && job.pricing_mode === 'fixed' && (
            <p className="text-sm font-semibold text-sky-700 mt-2">Budget: {formatCurrency(job.fixed_budget)}</p>
          )}
          {job.pricing_mode === 'ask_quotes' && (
            <p className="text-xs text-violet-600 font-medium mt-1">💬 Open to quotes</p>
          )}
          {job.pricing_mode === 'inspection' && (
            <p className="text-xs text-amber-600 font-medium mt-1">🔍 Inspection required</p>
          )}
        </div>
        <p className="text-xs text-slate-400 flex-shrink-0">
          <Clock className="w-3 h-3 inline mr-1" />
          {formatRelativeTime(job.created_at)}
        </p>
      </div>

      {job.assigned_worker_name && (
        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
          <Avatar name={job.assigned_worker_name} src={job.assigned_worker_photo} size="sm" />
          <p className="text-xs text-slate-500">Assigned to <span className="font-medium text-slate-700">{job.assigned_worker_name}</span></p>
        </div>
      )}

      {!isWorker && job.status === 'proposals_received' && Number(job.proposal_count || 0) > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-50">
          <p className="text-sm font-medium text-violet-700">Review proposals from workers now</p>
        </div>
      )}

      {onAction && (
        <div className="mt-3 pt-3 border-t border-slate-50">
          {onAction(job)}
        </div>
      )}
    </div>
  )
}

export function ProposalCard({ proposal, isOwner, onAccept, onDecline, onWithdraw }) {
  return (
    <div className="fixly-card p-5">
      <div className="flex items-start gap-3">
        <Avatar name={proposal.worker_name} src={proposal.worker_photo} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{proposal.worker_name}</span>
            {proposal.is_nic_verified && (
              <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Shield className="w-3 h-3" /> Verified
              </span>
            )}
            <Badge status={proposal.status} className="ml-auto" />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <StarRating rating={proposal.avg_rating || 0} />
            <span className="text-xs text-slate-500">{proposal.total_jobs_done || 0} jobs done</span>
          </div>
          {proposal.proposed_price ? (
            <p className="text-lg font-bold text-sky-700 mt-2">{formatCurrency(proposal.proposed_price)}</p>
          ) : proposal.price_range ? (
            <p className="text-sm text-slate-500 mt-2">Range: {proposal.price_range}</p>
          ) : (
            <p className="text-sm text-amber-600 mt-2">Inspection required for price</p>
          )}
          {proposal.availability && (
            <p className="text-xs text-slate-500 mt-1">Available: {proposal.availability}</p>
          )}
          {proposal.message && (
            <p className="text-sm text-slate-600 mt-3 bg-slate-50 rounded-xl p-3 italic">"{proposal.message}"</p>
          )}
        </div>
      </div>

      {proposal.status === 'pending' && isOwner && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50">
          <Button variant="primary" size="sm" className="flex-1" onClick={() => onAccept(proposal.id)}>
            Accept
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onDecline(proposal.id)}>
            Decline
          </Button>
          <Link to={`/workers/${proposal.worker_id}`}>
            <Button variant="ghost" size="sm">Profile</Button>
          </Link>
        </div>
      )}
      {proposal.status === 'pending' && !isOwner && onWithdraw && (
        <div className="mt-4 pt-4 border-t border-slate-50">
          <Button variant="outline" size="sm" onClick={() => onWithdraw(proposal.id)}>Withdraw</Button>
        </div>
      )}
    </div>
  )
}
