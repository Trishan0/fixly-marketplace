import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bot, Zap, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Star, MapPin, Briefcase, Shield, TrendingUp, Clock, DollarSign,
  Loader2, AlertCircle, Send, UserCheck
} from 'lucide-react'
import { Button, Avatar } from '../shared/UI'
import { cn, formatCurrency } from '../../lib/utils'
import api from '../../lib/api'

// ─── Score Bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score }) {
  const pct = Math.round(score * 100)
  const color =
    pct >= 75 ? 'bg-emerald-500' :
    pct >= 50 ? 'bg-sky-500' :
    pct >= 30 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn(
        'text-xs font-bold tabular-nums min-w-[36px] text-right',
        pct >= 75 ? 'text-emerald-600 dark:text-emerald-400' :
        pct >= 50 ? 'text-sky-600 dark:text-sky-400' :
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

// ─── Worker Recommendation Card ───────────────────────────────────────────────
function WorkerRecCard({ rec, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const w = rec.worker

  return (
    <div className={cn(
      'rounded-2xl border-2 transition-all duration-200 overflow-hidden',
      selected
        ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/20 shadow-md shadow-sky-100 dark:shadow-sky-900/20'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-sky-200 dark:hover:border-sky-700'
    )}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Rank badge */}
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5',
            rec.rank === 1 ? 'bg-amber-400 text-amber-900' :
            rec.rank === 2 ? 'bg-slate-300 text-slate-700' :
            rec.rank === 3 ? 'bg-orange-300 text-orange-800' :
                             'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
          )}>
            #{rec.rank}
          </div>

          <Avatar name={w.full_name} src={w.profile_photo ? `/uploads/${w.profile_photo}` : null} size="md" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-white text-sm">{w.full_name}</span>
              {w.is_nic_verified && (
                <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 rounded-md font-medium">
                  <Shield className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
              {w.primary_skill && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{w.primary_skill}</span>}
              {w.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{w.district}</span>}
              {Number(w.avg_rating) > 0 && <span className="flex items-center gap-1 text-amber-500"><Star className="w-3 h-3 fill-current" />{Number(w.avg_rating).toFixed(1)}</span>}
              {Number(w.total_jobs_done) > 0 && <span>{w.total_jobs_done} jobs done</span>}
              {w.starting_price && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />From {w.starting_price}</span>}
            </div>
          </div>

          {/* Score */}
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-black text-slate-800 dark:text-white">{Math.round(rec.score * 100)}<span className="text-xs font-medium text-slate-400">%</span></div>
            <div className="text-xs text-slate-400">match</div>
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-3">
          <ScoreBar score={rec.score} />
        </div>

        {/* Rationale */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{rec.rationale}</p>

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
      </div>

      {/* Expanded factors */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Score Breakdown</p>
          <FactorPills factors={rec.factors} />
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/60 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700">
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Less detail' : 'Score breakdown'}
        </button>
        <button
          onClick={() => onToggle(w.id)}
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-150',
            selected
              ? 'bg-sky-500 text-white hover:bg-sky-600'
              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-sky-400 hover:text-sky-600'
          )}
        >
          {selected ? <><CheckCircle2 className="w-3.5 h-3.5" />Selected</> : <>Select to Invite</>}
        </button>
      </div>
    </div>
  )
}

// ─── Job Recommendation Card ──────────────────────────────────────────────────
function JobRecCard({ rec, selected, onToggle, onMessageChange }) {
  const [expanded, setExpanded] = useState(false)
  const [editingMessage, setEditingMessage] = useState(false)
  const [msg, setMsg] = useState(rec.proposal_draft || '')
  const j = rec.job

  const URGENCY_LABELS = { today: 'Today', tomorrow: 'Tomorrow', this_week: 'This Week', flexible: 'Flexible' }

  return (
    <div className={cn(
      'rounded-2xl border-2 transition-all duration-200 overflow-hidden',
      selected
        ? 'border-violet-500 bg-violet-50/60 dark:bg-violet-950/20 shadow-md shadow-violet-100 dark:shadow-violet-900/20'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-violet-200 dark:hover:border-violet-700'
    )}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5',
            rec.rank === 1 ? 'bg-amber-400 text-amber-900' :
            rec.rank === 2 ? 'bg-slate-300 text-slate-700' :
            rec.rank === 3 ? 'bg-orange-300 text-orange-800' :
                             'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
          )}>
            #{rec.rank}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{j.title}</p>
            <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
              {j.category_name && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{j.category_name}</span>}
              {j.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{j.district}</span>}
              {j.urgency && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{URGENCY_LABELS[j.urgency]}</span>}
              {j.fixed_budget && <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium"><DollarSign className="w-3 h-3" />LKR {Number(j.fixed_budget).toLocaleString()}</span>}
              {j.proposal_count > 0 && <span className="text-slate-400">{j.proposal_count} proposals</span>}
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-lg font-black text-slate-800 dark:text-white">{Math.round(rec.score * 100)}<span className="text-xs font-medium text-slate-400">%</span></div>
            <div className="text-xs text-slate-400">fit</div>
          </div>
        </div>

        <div className="mt-3">
          <ScoreBar score={rec.score} />
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{rec.rationale}</p>

        {/* Draft message preview */}
        {selected && (
          <div className="mt-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">Proposal Message</span>
              <button onClick={() => setEditingMessage(e => !e)} className="text-xs text-violet-600 hover:underline">
                {editingMessage ? 'Done' : 'Edit'}
              </button>
            </div>
            {editingMessage ? (
              <textarea
                className="w-full text-xs text-slate-700 dark:text-slate-200 bg-transparent border-0 outline-none resize-none min-h-[80px]"
                value={msg}
                onChange={e => { setMsg(e.target.value); onMessageChange(j.id, e.target.value) }}
              />
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{msg}</p>
            )}
          </div>
        )}
      </div>

      {/* Expanded */}
      {expanded && !selected && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Score Breakdown</p>
          <FactorPills factors={rec.factors} />
          {rec.proposal_draft && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Draft Message</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">{rec.proposal_draft}</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/60 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700">
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Less detail' : 'See breakdown'}
        </button>
        <button
          onClick={() => onToggle(j.id)}
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-150',
            selected
              ? 'bg-violet-500 text-white hover:bg-violet-600'
              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600'
          )}
        >
          {selected ? <><CheckCircle2 className="w-3.5 h-3.5" />Selected</> : <>Apply to Job</>}
        </button>
      </div>
    </div>
  )
}

// ─── Plan Steps ────────────────────────────────────────────────────────────────
function PlanSteps({ plan, steps }) {
  const completedNames = new Set((steps || []).map(s => s.stepName))
  return (
    <div className="space-y-1.5">
      {(plan || []).map((step, i) => {
        const isCompleted = completedNames.has(
          ['load_job','load_worker_profile','load_candidates','load_open_jobs','score_and_rank','save_recommendations','draft_proposals'][i]
        ) || i < (steps?.length || 0)
        return (
          <div key={i} className="flex items-center gap-2.5">
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs',
              isCompleted
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
            )}>
              {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
            </div>
            <span className={cn(
              'text-xs',
              isCompleted ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400 dark:text-slate-500'
            )}>{step}</span>
          </div>
        )
      })}
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
  const [runData, setRunData] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [customMessages, setCustomMessages] = useState({}) // jobId → message
  const [showPlan, setShowPlan] = useState(false)
  const [confirmDone, setConfirmDone] = useState(null)

  const isMatch = mode === 'match'

  // ── Run agent ──────────────────────────────────────────────────────────────
  const runMutation = useMutation({
    mutationFn: () =>
      isMatch
        ? api.post('/agent/match/run', { job_id: jobId }).then(r => r.data)
        : api.post('/agent/proposal/run').then(r => r.data),
    onSuccess: data => {
      setRunData(data)
      setSelectedIds(new Set())
    },
  })

  // ── Confirm action ─────────────────────────────────────────────────────────
  const confirmMutation = useMutation({
    mutationFn: () => {
      if (isMatch) {
        return api.post(`/agent/run/${runData.run_id}/confirm`, {
          action_type: 'invite',
          selections: [...selectedIds],
        }).then(r => r.data)
      } else {
        const selections = [...selectedIds].map(jobId => ({
          job_id: jobId,
          message: customMessages[jobId] ||
            runData.recommendations.find(r => r.job.id === jobId)?.proposal_draft || '',
        }))
        return api.post(`/agent/run/${runData.run_id}/confirm`, {
          action_type: 'proposal',
          selections,
        }).then(r => r.data)
      }
    },
    onSuccess: data => {
      setConfirmDone(data)
      qc.invalidateQueries({ queryKey: ['job-feed'] })
      qc.invalidateQueries({ queryKey: ['agent-history'] })
    },
  })

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const accentColor = isMatch ? 'sky' : 'violet'

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      {/* ── Header ── */}
      <div className={cn(
        'flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0',
        isMatch ? 'bg-sky-50/80 dark:bg-sky-950/20' : 'bg-violet-50/80 dark:bg-violet-950/20'
      )}>
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center',
          isMatch ? 'bg-sky-100 dark:bg-sky-900/40' : 'bg-violet-100 dark:bg-violet-900/40'
        )}>
          <Bot className={cn('w-5 h-5', isMatch ? 'text-sky-600' : 'text-violet-600')} />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-slate-900 dark:text-white text-sm">
            {isMatch ? 'Job Match Agent' : 'Proposal Agent'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isMatch ? 'AI-ranked workers for this job' : 'Best jobs matched to your profile'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Success state */}
        {confirmDone && (
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-5 text-center">
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
        {!runData && !confirmDone && (
          <div className="text-center py-8">
            <div className={cn(
              'w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center',
              isMatch ? 'bg-sky-100 dark:bg-sky-900/30' : 'bg-violet-100 dark:bg-violet-900/30'
            )}>
              {isMatch ? <UserCheck className="w-8 h-8 text-sky-500" /> : <TrendingUp className="w-8 h-8 text-violet-500" />}
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white mb-1">
              {isMatch ? 'Find the Best Workers' : 'Find the Best Jobs'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
              {isMatch
                ? 'The agent will rank all available workers by skill, location, rating, and price fit.'
                : 'The agent will rank open jobs by how well they match your skills and location.'}
            </p>
            <Button
              onClick={() => runMutation.mutate()}
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
                {runMutation.error?.response?.data?.error || 'Something went wrong. Try again.'}
              </div>
            )}
          </div>
        )}

        {/* Results state */}
        {runData && !confirmDone && (
          <>
            {/* Plan trace toggle */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setShowPlan(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
              >
                <span className="flex items-center gap-2"><Bot className="w-4 h-4 text-slate-400" />Agent Execution Plan</span>
                {showPlan ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showPlan && (
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                  <PlanSteps plan={runData.plan} steps={runData.steps} />
                </div>
              )}
            </div>

            {/* Results count + Gemini reasoning */}
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">
                {isMatch
                  ? `${runData.recommendations?.length || 0} Top Workers Found`
                  : `${runData.recommendations?.length || 0} Best Jobs Found`}
              </h3>
              {runData.overall_reasoning && (
                <div className={cn(
                  'mt-2 p-3 rounded-xl border text-xs leading-relaxed',
                  isMatch
                    ? 'bg-sky-50/80 border-sky-200 text-sky-800 dark:bg-sky-950/30 dark:border-sky-800 dark:text-sky-300'
                    : 'bg-violet-50/80 border-violet-200 text-violet-800 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-300'
                )}>
                  <span className="font-semibold">Gemini's reasoning: </span>
                  {runData.overall_reasoning}
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {isMatch
                  ? 'Select workers to invite. You must confirm before any invites are sent.'
                  : 'Select jobs to apply to. You can edit the proposal message before confirming.'}
              </p>
            </div>

            {/* Recommendation cards */}
            <div className="space-y-3">
              {(runData.recommendations || []).map(rec =>
                isMatch ? (
                  <WorkerRecCard
                    key={rec.recommendation_id}
                    rec={rec}
                    selected={selectedIds.has(rec.worker.id)}
                    onToggle={toggleSelect}
                  />
                ) : (
                  <JobRecCard
                    key={rec.recommendation_id}
                    rec={rec}
                    selected={selectedIds.has(rec.job.id)}
                    onToggle={toggleSelect}
                    onMessageChange={(jobId, msg) => setCustomMessages(prev => ({ ...prev, [jobId]: msg }))}
                  />
                )
              )}
              {(!runData.recommendations || runData.recommendations.length === 0) && (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No results found. Try again later.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Footer — Confirm bar ── */}
      {runData && !confirmDone && selectedIds.size > 0 && (
        <div className={cn(
          'flex items-center justify-between px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0',
          isMatch ? 'bg-sky-50/80 dark:bg-sky-950/20' : 'bg-violet-50/80 dark:bg-violet-950/20'
        )}>
          <div>
            <p className="font-semibold text-sm text-slate-800 dark:text-white">
              {selectedIds.size} {isMatch ? `worker${selectedIds.size > 1 ? 's' : ''} selected` : `job${selectedIds.size > 1 ? 's' : ''} selected`}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isMatch ? 'Confirm to send invites' : 'Confirm to submit proposals'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              Deselect all
            </Button>
            <Button
              size="sm"
              loading={confirmMutation.isPending}
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
