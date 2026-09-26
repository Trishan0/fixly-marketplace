import React, { useRef } from 'react'
import { cn } from '../../lib/utils'

/**
 * Underline tabs that filter the content below. Arrow keys move between
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
    <div role="tablist" aria-label={label} className={cn('-mb-px flex gap-5 overflow-x-auto border-b border-line', className)}>
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
              'flex h-10 shrink-0 items-center gap-2 border-b-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:text-fg [@media(pointer:coarse)]:h-11',
              selected ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', selected ? 'bg-brand-subtle text-brand-text' : 'bg-subtle text-fg-muted')}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
