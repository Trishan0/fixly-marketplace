import React, { useEffect, useState } from 'react'
import { Bot, Check, Hand } from 'lucide-react'
import { cn } from '../../lib/utils'
import { liveProgress } from '../../lib/agentProgress'

const ACCENTS = {
  match: { bar: 'from-sky-400 to-sky-600', spin: 'border-t-sky-500', text: 'text-sky-600 dark:text-sky-300', chip: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300' },
  proposal: { bar: 'from-violet-400 to-violet-600', spin: 'border-t-violet-500', text: 'text-violet-600 dark:text-violet-300', chip: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300' },
}

/** @param {{ items: { label: string, state: 'done' | 'active' | 'waiting' | 'pending' }[], mode: 'match' | 'proposal' }} props */
export function StepList({ items, mode }) {
  const accent = ACCENTS[mode]
  return (
    <ol className="space-y-2.5">
      {items.map((item, index) => (
        <li key={item.label} className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
              item.state === 'done' && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
              item.state === 'active' && cn('animate-spin border-2 border-line', accent.spin),
              item.state === 'waiting' && 'bg-amber-100 text-amber-700 ring-4 ring-amber-50 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/10',
              item.state === 'pending' && 'border border-line bg-surface text-fg-subtle',
            )}
            aria-hidden="true"
          >
            {item.state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} />
              : item.state === 'waiting' ? <Hand className="h-3.5 w-3.5" />
                : item.state === 'pending' ? index + 1 : null}
          </span>
          <span className={cn(
            'text-sm',
            item.state === 'done' && 'text-fg-muted',
            item.state === 'active' && 'font-semibold text-fg',
            item.state === 'waiting' && 'font-semibold text-fg',
            item.state === 'pending' && 'text-fg-subtle',
          )}>
            {item.label}
            {item.state === 'waiting' && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Your turn</span>}
          </span>
          <span className="sr-only">{{ done: '(done)', active: '(in progress)', waiting: '(waiting for you)', pending: '(not started)' }[item.state]}</span>
        </li>
      ))}
    </ol>
  )
}

function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * Live view while the agent works: a progress bar, what it is doing right
 * now, and the checklist of phases driven by the run's real tool calls.
 * @param {{ mode: 'match' | 'proposal', run?: { status?: string, steps?: { step_name?: string }[], queue_position?: number | null } }} props
 */
export function RunProgress({ mode, run }) {
  const accent = ACCENTS[mode]
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [])

  const lastStep = run?.steps?.[run.steps.length - 1]
  const idleMs = lastStep?.created_at ? Math.max(0, now - Date.parse(lastStep.created_at)) : 0
  const { items, percent, activity } = liveProgress(mode, run, { idleMs })
  const queued = run?.status === 'pending' && Number.isInteger(run?.queue_position) && run.queue_position > 0

  return (
    <div className="py-2" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', accent.chip)}>
          <Bot className="h-5 w-5 animate-pulse" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-fg">{mode === 'match' ? 'Finding the best workers' : 'Finding the best jobs'}</p>
          <p className="truncate text-[13px] text-fg-muted">{queued ? `${run.queue_position} ${run.queue_position === 1 ? 'run' : 'runs'} ahead of you…` : activity}</p>
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-fg-subtle" aria-label="Time elapsed">{formatElapsed(now - startedAt)}</span>
      </div>

      <div
        className="relative mt-4 h-2 overflow-hidden rounded-full bg-subtle"
        role="progressbar"
        aria-label="Agent progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className={cn('relative h-full overflow-hidden rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out', accent.bar)} style={{ width: `${percent}%` }}>
          <span className="agent-progress-shimmer absolute inset-0" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-5 rounded-control border border-line bg-surface p-4">
        <StepList items={items} mode={mode} />
      </div>
      <p className="mt-3 text-center text-xs text-fg-subtle">Nothing is sent until you review the results and confirm.</p>
    </div>
  )
}
