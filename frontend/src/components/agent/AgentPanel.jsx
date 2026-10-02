import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot, Zap, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Star, MapPin, Briefcase, Shield, TrendingUp, Clock, DollarSign,
  AlertCircle, Send, UserCheck, RotateCcw, Square, ExternalLink, Sparkles
} from 'lucide-react'
import { Button, Avatar } from '../shared/UI'
import { cn, formatStartingPrice, pluralize } from '../../lib/utils'
import api from '../../lib/api'
import { errorMessage, errorStatus } from '../../lib/errors'
import { planProgress } from '../../lib/agentProgress'
import { RunProgress, StepList } from './AgentProgress'

// ─── Score Bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score }) {
  const pct = Math.round(score * 100)
  const color =
    pct >= 75 ? 'bg-emerald-500' :
    pct >= 50 ? 'bg-sky-500' :
    pct >= 30 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-subtle rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn(
        'text-xs font-bold tabular-nums min-w-[36px] text-right',
        pct >= 75 ? 'text-emerald-600 dark:text-emerald-400' :
        pct >= 50 ? 'text-brand-text' :
        pct >= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'
      )}>
        {pct}%
      </span>
    </div>
  )
}

// ─── Factor Pills ─────────────────────────────────────────────────────────────
function FactorPills({ factors }) {
  const factorLabels = {
    skill_fit:        'Skill',
    location_fit:     'Location',
    rating_score:     'Rating',
    completion_score: 'Experience',
    price_fit:        'Price',
    urgency_fit:      'Urgency',
    skill_overlap:    'Skill',
    budget_quality:   'Budget',
    urgency:          'Urgency',
    win_probability:  'Win Chance',
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {Object.entries(factors).map(([key, val]) => {
        const pct = Math.round(val * 100)
        const color =
          pct >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' :
          pct >= 40 ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800' :
                      'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800'
        return (
          <span key={key} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border', color)}>
            {factorLabels[key] || key}: {pct}%
          </span>
        )
      })}
    </div>
  )
}

function NewOnFixlyBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 px-1.5 py-0.5 rounded-md font-medium">
      <Sparkles className="w-3 h-3" aria-hidden="true" /> New on Fixly
    </span>
  )
}

// ─── Worker Recommendation Card ───────────────────────────────────────────────
function WorkerRecCard({ rec, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const w = rec.worker
  // New workers have no track record, so a match percentage would mislead;
  // their card shows plain reasons instead.
  const isNewTalent = rec.lane === 'new_talent'
  // New tab, so the recommendations and selections here aren't lost.
  const profileLinkProps = { href: `/workers/${w.id}`, target: '_blank', rel: 'noopener noreferrer' }

  return (
    <div className={cn(
      'rounded-card border-2 transition-all duration-200 overflow-hidden',
      selected
        ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/20 shadow-md shadow-sky-100 dark:shadow-sky-900/20'
        : 'border-line bg-surface hover:border-sky-200 dark:hover:border-sky-700'
    )}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Rank badge */}
          {isNewTalent ? (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" aria-hidden="true">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          ) : (
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
            rec.rank === 1 ? 'bg-amber-400 text-amber-900' :
            rec.rank === 2 ? 'bg-slate-300 text-fg-muted' :
            rec.rank === 3 ? 'bg-orange-300 text-orange-800' :
                             'bg-subtle text-fg-subtle'
          )}>
            #{rec.rank}
          </div>
          )}

          <Avatar name={w.full_name} src={w.profile_photo || null} size="md" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <a {...profileLinkProps} className="font-bold text-fg text-sm hover:text-sky-600 hover:underline dark:hover:text-sky-400">{w.full_name}</a>
              {w.is_nic_verified && (
                <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 rounded-md font-medium">
                  <Shield className="w-3 h-3" /> Verified
                </span>
              )}
              {isNewTalent && <NewOnFixlyBadge />}
            </div>
            <div className="flex flex-wrap gap-2 mt-1 text-xs text-fg-subtle">
              {w.primary_skill && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{w.primary_skill}</span>}
              {w.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{w.district}</span>}
              {Number(w.avg_rating) > 0 && <span className="flex items-center gap-1 text-amber-500"><Star className="w-3 h-3 fill-current" />{Number(w.avg_rating).toFixed(1)}</span>}
              {Number(w.total_jobs_done) > 0 && <span>{w.total_jobs_done} jobs done</span>}
              {w.starting_price && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />From {formatStartingPrice(w.starting_price)}</span>}
            </div>
          </div>

          {/* Score */}
          {!isNewTalent && (
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-bold text-fg">{Math.round(rec.score * 100)}<span className="text-xs font-medium text-fg-subtle">%</span></div>
              <div className="text-xs text-fg-subtle">match</div>
            </div>
          )}
        </div>

        {/* Score bar */}
        {!isNewTalent && (
          <div className="mt-3">
            <ScoreBar score={rec.score} />
          </div>
        )}

        {/* Rationale */}
        <p className="text-xs text-fg-subtle mt-2 leading-relaxed">{rec.rationale}</p>

        {/* Gemini key strengths */}
        {rec.key_strengths?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {rec.key_strengths.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 px-2 py-0.5 rounded-full font-medium">
                ✦ {s}
              </span>
            ))}
          </div>
        )}

        {/* Guide price well above a fixed budget: information, not a ranking factor */}
        {rec.price_note && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <DollarSign className="w-3.5 h-3.5 flex-shrink-0 mt-px" aria-hidden="true" />
            {rec.price_note}
          </p>
        )}
      </div>

      {/* Expanded factors */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-line">
          <p className="text-xs font-semibold text-fg-subtle mb-2">Score Breakdown</p>
          <FactorPills factors={rec.factors} />
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 px-4 py-2.5 bg-subtle border-t border-line">
        {isNewTalent ? <span /> : (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="flex min-h-11 items-center gap-1 text-xs text-fg-subtle transition-colors hover:text-fg-muted"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Less detail' : 'Score breakdown'}
          </button>
        )}
        <div className="flex items-center gap-2">
          <a
            {...profileLinkProps}
            className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-fg-muted transition-colors hover:text-sky-600 dark:hover:text-sky-400"
            aria-label={`View ${w.full_name}'s profile (opens in a new tab)`}
          >
            View profile <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => onToggle(w.id)}
            className={cn(
              'flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150',
              selected
                ? 'bg-sky-500 text-white hover:bg-sky-600'
                : 'bg-surface border border-line text-fg-muted hover:border-sky-400 hover:text-sky-600'
            )}
          >
            {selected ? <><CheckCircle2 className="w-3.5 h-3.5" />Selected</> : <>Select to Invite</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Worker results, split into lanes ────────────────────────────────────────
// Best matches first, then new workers in their own clearly labeled group.
// Runs from before lanes existed have no lane and render as one list.
function WorkerLaneGroups({ recommendations, selectedIds, onToggle }) {
  const card = rec => (
    <WorkerRecCard key={rec.recommendation_id} rec={rec} selected={selectedIds.has(rec.worker.id)} onToggle={onToggle} />
  )
  const newTalent = recommendations.filter(rec => rec.lane === 'new_talent')
  if (newTalent.length === 0) return recommendations.map(card)
  const best = recommendations.filter(rec => rec.lane !== 'new_talent')

  return (
    <>
      {best.length > 0 && (
        <section aria-label="Best matches" className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Best matches</h4>
          {best.map(card)}
        </section>
      )}
      <section aria-label="New on Fixly" className="space-y-3 pt-2">
        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> New on Fixly
          </h4>
          <p className="mt-1 text-xs text-fg-subtle">
            ID-verified workers who are new to Fixly and do this kind of work. They have few or no reviews yet, so we show why their profile fits instead of a match score.
          </p>
        </div>
        {newTalent.map(card)}
      </section>
    </>
  )
}

// ─── Job Recommendation Card ──────────────────────────────────────────────────
// Same rules as the manual proposal form (and enforced by the server): a
// price or "inspection needed", and when the worker can come.
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/
const MAX_PROPOSALS_PER_CONFIRM = 3

function proposalDetailsValid(details) {
  if (!details) return false
  const priced = details.inspection_needed || (PRICE_PATTERN.test(details.proposed_price || '') && Number(details.proposed_price) > 0)
  return priced && (details.availability || '').trim().length >= 3
}

/** Starting values from the job itself: its fixed budget, or inspection-first pricing. */
function defaultProposalDetails(job) {
  return {
    proposed_price: job.pricing_mode === 'fixed' && job.fixed_budget ? String(Number(job.fixed_budget)) : '',
    inspection_needed: job.pricing_mode === 'inspection',
    availability: '',
  }
}

function JobRecCard({ rec, selected, onToggle, onMessageChange, details, onDetailsChange }) {
  const [expanded, setExpanded] = useState(false)
  const [editingMessage, setEditingMessage] = useState(false)
  const [msg, setMsg] = useState(rec.proposal_draft || '')
  const j = rec.job

  const URGENCY_LABELS = { today: 'Today', tomorrow: 'Tomorrow', this_week: 'This Week', flexible: 'Flexible' }

  return (
    <div className={cn(
      'rounded-card border-2 transition-all duration-200 overflow-hidden',
      selected
        ? 'border-violet-500 bg-violet-50/60 dark:bg-violet-950/20 shadow-md shadow-violet-100 dark:shadow-violet-900/20'
        : 'border-line bg-surface hover:border-violet-200 dark:hover:border-violet-700'
    )}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
            rec.rank === 1 ? 'bg-amber-400 text-amber-900' :
            rec.rank === 2 ? 'bg-slate-300 text-fg-muted' :
            rec.rank === 3 ? 'bg-orange-300 text-orange-800' :
                             'bg-subtle text-fg-subtle'
          )}>
            #{rec.rank}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-fg text-sm leading-tight">{j.title}</p>
            <div className="flex flex-wrap gap-2 mt-1 text-xs text-fg-subtle">
              {j.category_name && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{j.category_name}</span>}
              {j.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{j.district}</span>}
              {j.urgency && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{URGENCY_LABELS[j.urgency]}</span>}
              {j.fixed_budget && <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium"><DollarSign className="w-3 h-3" />LKR {Number(j.fixed_budget).toLocaleString()}</span>}
              {j.proposal_count > 0 && <span className="text-fg-subtle">{pluralize(j.proposal_count, 'proposal')}</span>}
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-fg">{Math.round(rec.score * 100)}<span className="text-xs font-medium text-fg-subtle">%</span></div>
            <div className="text-xs text-fg-subtle">fit</div>
          </div>
        </div>

        <div className="mt-3">
          <ScoreBar score={rec.score} />
        </div>

        <p className="text-xs text-fg-subtle mt-2 leading-relaxed">{rec.rationale}</p>

        {/* Your price and availability: the worker's own facts, never the AI's */}
        {selected && details && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor={`price-${j.id}`} className="text-xs font-semibold text-fg">Your price (LKR)</label>
              <input
                id={`price-${j.id}`}
                inputMode="decimal"
                value={details.inspection_needed ? '' : details.proposed_price}
                disabled={details.inspection_needed}
                onChange={e => onDetailsChange(j.id, { proposed_price: e.target.value })}
                placeholder={details.inspection_needed ? 'After inspection' : 'e.g. 4500'}
                className="mt-1 h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-fg disabled:opacity-60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <label className="mt-1.5 flex min-h-8 items-center gap-2 text-xs text-fg-muted">
                <input type="checkbox" checked={details.inspection_needed} onChange={e => onDetailsChange(j.id, { inspection_needed: e.target.checked })} className="h-4 w-4 accent-violet-600" />
                Inspection needed before I can price it
              </label>
            </div>
            <div>
              <label htmlFor={`availability-${j.id}`} className="text-xs font-semibold text-fg">When can you come?</label>
              <input
                id={`availability-${j.id}`}
                value={details.availability}
                maxLength={255}
                onChange={e => onDetailsChange(j.id, { availability: e.target.value })}
                placeholder="e.g. Tomorrow morning"
                className="mt-1 h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>
        )}

        {/* Draft message preview */}
        {selected && (
          <div className="mt-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">Message (AI draft: check it’s all true)</span>
              <button type="button" onClick={() => setEditingMessage(e => !e)} className="min-h-11 px-2 text-xs font-semibold text-violet-600 hover:underline">
                {editingMessage ? 'Done' : 'Edit'}
              </button>
            </div>
            {editingMessage ? (
              <textarea
                className="w-full text-xs text-fg-muted bg-transparent border-0 outline-none resize-none min-h-[80px]"
                value={msg}
                onChange={e => { setMsg(e.target.value); onMessageChange(j.id, e.target.value) }}
              />
            ) : (
              <p className="text-xs text-fg-muted leading-relaxed">{msg}</p>
            )}
          </div>
        )}
      </div>

      {/* Expanded */}
      {expanded && !selected && (
        <div className="px-4 pb-3 pt-1 border-t border-line">
          <p className="text-xs font-semibold text-fg-subtle mb-2">Score Breakdown</p>
          <FactorPills factors={rec.factors} />
          {rec.proposal_draft && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-fg-subtle mb-1">Draft Message</p>
              <p className="text-xs text-fg-muted leading-relaxed italic">{rec.proposal_draft}</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-subtle border-t border-line">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex min-h-11 items-center gap-1 text-xs text-fg-subtle transition-colors hover:text-fg-muted"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Less detail' : 'See breakdown'}
        </button>
        <button
          type="button"
          onClick={() => onToggle(j.id)}
          className={cn(
            'flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150',
            selected
              ? 'bg-violet-500 text-white hover:bg-violet-600'
              : 'bg-surface border border-line text-fg-muted hover:border-violet-400 hover:text-violet-600'
          )}
        >
          {selected ? <><CheckCircle2 className="w-3.5 h-3.5" />Selected</> : <>Apply to Job</>}
        </button>
      </div>
    </div>
  )
}

// ─── Main AgentPanel Component ────────────────────────────────────────────────
/**
 * Props:
 *  mode: 'match' | 'proposal'
 *  jobId: string (required for match mode)
 *  onClose: () => void
 */
export default function AgentPanel({ mode, jobId, onClose }) {
  const qc = useQueryClient()
  const [runId, setRunId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [customMessages, setCustomMessages] = useState({}) // jobId → message
  const [proposalDetails, setProposalDetails] = useState({}) // jobId → { proposed_price, inspection_needed, availability }
  const [limitReached, setLimitReached] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const [confirmDone, setConfirmDone] = useState(null)
  // True when the panel picked up a run that was already going.
  const [resumed, setResumed] = useState(false)

  const isMatch = mode === 'match'

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  // ── Run agent ──────────────────────────────────────────────────────────────
  // Creating a run returns immediately (202 pending) - the agent worker
  // executes it off the request path, so the actual result is polled below.
  // `restart` stops a run that's still working and starts a fresh one.
  const runMutation = useMutation({
    mutationFn: ({ restart = false } = {}) =>
      isMatch
        ? api.post('/agent/match/run', { job_id: jobId, restart }).then(r => r.data)
        : api.post('/agent/proposal/run', { restart }).then(r => r.data),
    // Errors are shown inside the panel.
    meta: { silentError: true, track: 'ai_run_started', trackProps: () => ({ mode }) },
    onSuccess: data => {
      setRunId(data.run_id)
      setResumed(false)
      setSelectedIds(new Set())
    },
    // A run is already going (e.g. started before the panel was closed):
    // show it rather than an error, so the user can watch or stop it.
    onError: error => {
      const existingRunId = error.response?.data?.run_id
      if (errorStatus(error) === 409 && existingRunId) {
        setRunId(existingRunId)
        setResumed(true)
        setSelectedIds(new Set())
      }
    },
  })
  const startRun = (options) => runMutation.mutate(options)

  // ── Stop the current run, or discard its results ─────────────────────────
  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/agent/run/${runId}/cancel`),
    meta: { silentError: true },
    // A 404 means the run already ended; either way the panel goes back
    // to the start so the user can run again.
    onSettled: () => {
      setRunId(null)
      setResumed(false)
      setSelectedIds(new Set())
      qc.invalidateQueries({ queryKey: ['agent-history'] })
    },
  })

  // ── Poll for the run's outcome ───────────────────────────────────────────
  const runQuery = useQuery({
    queryKey: ['agent-run', runId],
    queryFn: () => api.get(`/agent/run/${runId}`).then(r => r.data),
    enabled: Boolean(runId) && !confirmDone,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return !status || status === 'pending' || status === 'running' ? 1500 : false
    },
  })
  const runData = runQuery.data
  const isRunInProgress = Boolean(runId) && (!runData || runData.status === 'pending' || runData.status === 'running')
  const runFailed = runData?.status === 'error'

  // ── Confirm action ─────────────────────────────────────────────────────────
  const confirmMutation = useMutation({
    mutationFn: () => {
      if (isMatch) {
        return api.post(`/agent/run/${runData.run_id}/confirm`, {
          action_type: 'invite',
          selections: [...selectedIds],
        }).then(r => r.data)
      } else {
        const selections = [...selectedIds].map(jobId => {
          const details = proposalDetails[jobId]
          return {
            job_id: jobId,
            message: customMessages[jobId] ||
              runData.recommendations.find(r => r.job.id === jobId)?.proposal_draft || '',
            proposed_price: details.inspection_needed ? null : details.proposed_price,
            inspection_needed: details.inspection_needed,
            availability: details.availability.trim(),
          }
        })
        return api.post(`/agent/run/${runData.run_id}/confirm`, {
          action_type: 'proposal',
          selections,
        }).then(r => r.data)
      }
    },
    meta: { track: 'ai_recommendations_confirmed', trackProps: () => ({ mode, selected: selectedIds.size }) },
    onSuccess: data => {
      setConfirmDone(data)
      qc.invalidateQueries({ queryKey: ['job-feed'] })
      qc.invalidateQueries({ queryKey: ['agent-history'] })
    },
  })

  const toggleSelect = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else if (!isMatch && next.size >= MAX_PROPOSALS_PER_CONFIRM) {
      // Each proposal notifies a customer, so a few at a time.
      setLimitReached(true)
      return
    } else {
      next.add(id)
    }
    setSelectedIds(next)
    setLimitReached(false)
    if (!isMatch && !proposalDetails[id]) {
      const job = runData?.recommendations?.find(r => r.job?.id === id)?.job
      if (job) setProposalDetails(prev => ({ ...prev, [id]: defaultProposalDetails(job) }))
    }
  }
  const updateProposalDetails = (jobId, change) =>
    setProposalDetails(prev => ({ ...prev, [jobId]: { ...prev[jobId], ...change } }))
  const proposalsReady = isMatch || [...selectedIds].every(id => proposalDetailsValid(proposalDetails[id]))

  return (
    <div className="flex h-full max-h-full flex-col">
      {/* ── Header ── */}
      <div className={cn(
        'flex flex-shrink-0 items-center gap-3 border-b border-line px-4 py-3 sm:px-5 sm:py-4',
        isMatch ? 'bg-sky-50/80 dark:bg-sky-950/20' : 'bg-violet-50/80 dark:bg-violet-950/20'
      )}>
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center',
          isMatch ? 'bg-sky-100 dark:bg-sky-900/40' : 'bg-violet-100 dark:bg-violet-900/40'
        )}>
          <Bot className={cn('w-5 h-5', isMatch ? 'text-sky-600' : 'text-violet-600')} />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-fg text-sm">
            {isMatch ? 'Job Match Agent' : 'Proposal Agent'}
          </h2>
          <p className="text-xs text-fg-subtle">
            {isMatch ? 'AI-ranked workers for this job' : 'Best jobs matched to your profile'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-fg-subtle transition-colors hover:bg-subtle"
          aria-label="Close agent panel"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">

        {/* Success state */}
        {confirmDone && (
          <div className="rounded-card bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-5 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h3 className="font-bold text-emerald-800 dark:text-emerald-300 mb-1">Done!</h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {isMatch
                ? `${confirmDone.results?.filter(r => r.status === 'invited').length || 0} invite(s) sent successfully.`
                : `${confirmDone.results?.filter(r => r.status === 'submitted').length || 0} proposal(s) submitted.`
              }
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>Close</Button>
          </div>
        )}

        {/* Idle state — run button */}
        {!runId && !confirmDone && (
          <div className="text-center py-8">
            <div className={cn(
              'w-16 h-16 rounded-card mx-auto mb-4 flex items-center justify-center',
              isMatch ? 'bg-sky-100 dark:bg-sky-900/30' : 'bg-violet-100 dark:bg-violet-900/30'
            )}>
              {isMatch ? <UserCheck className="w-8 h-8 text-sky-500" /> : <TrendingUp className="w-8 h-8 text-violet-500" />}
            </div>
            <h3 className="font-bold text-fg mb-1">
              {isMatch ? 'Find the Best Workers' : 'Find the Best Jobs'}
            </h3>
            <p className="text-sm text-fg-subtle mb-6 max-w-xs mx-auto">
              {isMatch
                ? 'The agent will rank all available workers by skill, location, rating, and price fit.'
                : 'The agent will rank open jobs by how well they match your skills and location.'}
            </p>
            <Button
              onClick={() => startRun()}
              loading={runMutation.isPending}
              variant="primary"
              size="lg"
              className={cn(isMatch ? '' : 'bg-violet-600 hover:bg-violet-700')}
            >
              <Zap className="w-4 h-4" />
              {isMatch ? 'Run Match Agent' : 'Run Proposal Agent'}
            </Button>
            {runMutation.isError && (
              <div className="mt-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 justify-center">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMessage(runMutation.error)}
              </div>
            )}
          </div>
        )}

        {/* In progress: live checklist driven by the agent's real tool calls */}
        {isRunInProgress && !confirmDone && (
          <>
            {resumed && (
              <p className="rounded-xl border border-line bg-subtle px-3 py-2 text-xs text-fg-muted">
                This agent was already running, so we picked it up where it is. Stop it or start over if you want a fresh run.
              </p>
            )}
            <RunProgress mode={mode} run={runData} />
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-center">
              <Button variant="outline" size="sm" onClick={() => cancelMutation.mutate()} loading={cancelMutation.isPending} disabled={runMutation.isPending}>
                <Square className="w-3.5 h-3.5" /> Stop
              </Button>
              <Button variant="outline" size="sm" onClick={() => startRun({ restart: true })} loading={runMutation.isPending} disabled={cancelMutation.isPending}>
                <RotateCcw className="w-3.5 h-3.5" /> Start over
              </Button>
            </div>
          </>
        )}

        {/* Restarting from a run that's open failed (e.g. rate limit) */}
        {runId && !confirmDone && runMutation.isError && errorStatus(runMutation.error) !== 409 && (
          <p className="flex items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {errorMessage(runMutation.error)}
          </p>
        )}

        {/* Run failed */}
        {runFailed && !confirmDone && (
          <div className="text-center py-8">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
            <h3 className="font-bold text-fg mb-1">Something went wrong</h3>
            <p className="text-sm text-fg-subtle mb-4 max-w-xs mx-auto">
              The agent run failed. You can try again.
            </p>
            <Button variant="outline" size="sm" onClick={() => setRunId(null)}>Try again</Button>
          </div>
        )}

        {/* Results state */}
        {runData && !isRunInProgress && !runFailed && !confirmDone && (
          <>
            {/* Plan trace toggle */}
            <div className="rounded-xl border border-line overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPlan(p => !p)}
                className="flex min-h-11 w-full items-center justify-between bg-subtle px-4 py-3 text-sm font-semibold text-fg-muted transition-colors hover:bg-subtle"
              >
                <span className="flex items-center gap-2"><Bot className="w-4 h-4 text-fg-subtle" />Agent Execution Plan</span>
                {showPlan ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showPlan && (
                <div className="px-4 py-3 border-t border-line">
                  <StepList mode={mode} items={planProgress(runData.plan || [], runData.status)} />
                </div>
              )}
            </div>

            {/* Results count + Gemini reasoning */}
            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <h3 className="font-bold text-fg text-sm">
                  {isMatch
                    ? `${pluralize(runData.recommendations?.length || 0, 'Worker')} Suggested`
                    : `${pluralize(runData.recommendations?.length || 0, 'Best Job')} Found`}
                </h3>
                {/* Starting again replaces these results. */}
                <Button variant="ghost" size="sm" onClick={() => startRun()} loading={runMutation.isPending}>
                  <RotateCcw className="w-3.5 h-3.5" /> Run again
                </Button>
              </div>
              {/* Collapsed by default: the cards carry the per-worker reasons. */}
              {runData.overall_reasoning && (
                <details className={cn(
                  'group mt-2 rounded-xl border text-xs leading-relaxed',
                  isMatch
                    ? 'bg-sky-50/80 border-sky-200 text-sky-800 dark:bg-sky-950/30 dark:border-sky-800 dark:text-sky-300'
                    : 'bg-violet-50/80 border-violet-200 text-violet-800 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-300'
                )}>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-3 py-2 [&::-webkit-details-marker]:hidden">
                    {runData.engine === 'degraded' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Rating-based (AI unavailable)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {runData.model_used || 'Gemini'}
                      </span>
                    )}
                    <span className="font-semibold">{runData.engine === 'degraded' ? 'How these were chosen' : isMatch ? 'Why these workers' : 'Why these jobs'}</span>
                    <ChevronDown className="ml-auto w-4 h-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="px-3 pb-3">{runData.overall_reasoning}</p>
                </details>
              )}
              <p className="text-xs text-fg-subtle mt-2">
                {isMatch
                  ? 'Select workers to invite. You must confirm before any invites are sent.'
                  : 'Select jobs to apply to. You can edit the proposal message before confirming.'}
              </p>
            </div>

            {/* Recommendation cards */}
            <div className="space-y-3">
              {isMatch && <WorkerLaneGroups recommendations={runData.recommendations || []} selectedIds={selectedIds} onToggle={toggleSelect} />}
              {!isMatch && (runData.recommendations || []).map(rec => (
                  <JobRecCard
                    key={rec.recommendation_id}
                    rec={rec}
                    selected={selectedIds.has(rec.job.id)}
                    onToggle={toggleSelect}
                    onMessageChange={(jobId, msg) => setCustomMessages(prev => ({ ...prev, [jobId]: msg }))}
                    details={proposalDetails[rec.job.id]}
                    onDetailsChange={updateProposalDetails}
                  />
              ))}
              {(!runData.recommendations || runData.recommendations.length === 0) && (
                <div className="text-center py-8 text-fg-subtle">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No results found. Try again later.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Footer — Confirm bar ── */}
      {runData && !isRunInProgress && !runFailed && !confirmDone && selectedIds.size > 0 && (
        <div className={cn(
          'grid flex-shrink-0 gap-3 border-t border-line px-4 py-3 sm:flex sm:items-center sm:justify-between sm:px-5 sm:py-4',
          isMatch ? 'bg-sky-50/80 dark:bg-sky-950/20' : 'bg-violet-50/80 dark:bg-violet-950/20'
        )}>
          <div>
            <p className="font-semibold text-sm text-fg">
              {selectedIds.size} {isMatch ? `worker${selectedIds.size > 1 ? 's' : ''} selected` : `job${selectedIds.size > 1 ? 's' : ''} selected`}
            </p>
            <p className={cn('text-xs', !proposalsReady || limitReached ? 'text-amber-700 dark:text-amber-300' : 'text-fg-subtle')} aria-live="polite">
              {isMatch
                ? 'Confirm to send invites'
                : limitReached
                  ? `You can send up to ${MAX_PROPOSALS_PER_CONFIRM} proposals at a time`
                  : proposalsReady
                    ? 'Confirm to submit proposals'
                    : 'Add your price (or inspection) and when you can come for each job'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button variant="outline" size="sm" onClick={() => { setSelectedIds(new Set()); setLimitReached(false) }}>
              Deselect all
            </Button>
            <Button
              size="sm"
              loading={confirmMutation.isPending}
              disabled={!proposalsReady}
              onClick={() => confirmMutation.mutate()}
              className={cn(isMatch ? '' : 'bg-violet-600 hover:bg-violet-700 text-white')}
            >
              <Send className="w-3.5 h-3.5" />
              {isMatch ? 'Send Invites' : 'Submit Proposals'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
