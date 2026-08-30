import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, CheckCircle2, XCircle, AlertCircle, Bot, ChevronRight } from 'lucide-react'
import { cn, formatRelativeTime } from '../../lib/utils'
import api from '../../lib/api'

const STATUS_CONFIG = {
  awaiting_confirmation: { label: 'Awaiting Confirmation', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400', icon: Clock },
  completed:             { label: 'Completed',             color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400', icon: CheckCircle2 },
  cancelled:             { label: 'Cancelled',             color: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400', icon: XCircle },
  error:                 { label: 'Error',                 color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400', icon: AlertCircle },
  running:               { label: 'Running',               color: 'text-sky-600 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400', icon: Bot },
}

function RunRow({ run, onSelect }) {
  const cfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.running
  const Icon = cfg.icon

  return (
    <button
      type="button"
      onClick={() => onSelect?.(run)}
      className="group flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
    >
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 dark:text-white capitalize">
            {run.agent_type === 'match' ? 'Match Agent' : 'Proposal Agent'}
          </span>
          <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
          {run.job_title && <span className="truncate max-w-[160px]">Job: {run.job_title}</span>}
          <span>{formatRelativeTime(run.created_at)}</span>
          {Number(run.recommendation_count) > 0 && (
            <span>{run.recommendation_count} results</span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400 flex-shrink-0 transition-colors" />
    </button>
  )
}

/**
 * AgentRunHistory
 * Props:
 *  agentType: 'match' | 'proposal' | undefined (both)
 *  limit: number
 *  onSelectRun: (run) => void
 */
export default function AgentRunHistory({ agentType, limit = 5, onSelectRun }) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['agent-history', agentType],
    queryFn: () =>
      api.get(`/agent/history?limit=${limit}${agentType ? `&agent_type=${agentType}` : ''}`)
         .then(r => r.data),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-sm animate-pulse">
        Loading history…
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-sm">
        <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
        No agent runs yet
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-4 mb-2">
        Recent Runs
      </p>
      {runs.map(run => (
        <RunRow key={run.id} run={run} onSelect={onSelectRun} />
      ))}
    </div>
  )
}
