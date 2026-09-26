import React, { useRef } from 'react'
import { cn } from '../../lib/utils'

/**
 * Segmented tabs that filter the content below. Arrow keys move between
 * tabs (roving tabindex), as expected for a tablist.
 */
export function Tabs({ tabs, value, onChange, label, className }) {
  const refs = useRef([])
  const onKeyDown = (event, index) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + tabs.length) % tabs.length
    refs.current[next]?.focus()
    onChange(tabs[next].value)
  }
  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-control bg-subtle p-1 ring-1 ring-inset ring-line/60', className)}>
      {tabs.map((tab, index) => {
        const selected = tab.value === value
        return (
          <button
            key={tab.value}
            ref={(node) => { refs.current[index] = node }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [@media(pointer:coarse)]:h-10',
              selected ? 'bg-surface text-fg shadow-card' : 'text-fg-muted hover:text-fg',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className={cn('min-w-[20px] rounded-full px-1.5 text-center text-xs font-semibold tabular-nums', selected ? 'bg-brand text-brand-on' : 'bg-line/70 text-fg-muted')}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
