import React from 'react'

// Neutral skeleton used while the session or a route chunk loads, so the
// screen never flashes blank.
export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas" role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      <div className="h-14 border-b border-line bg-surface" />
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8">
        <div className="h-8 w-1/3 animate-pulse rounded-control bg-subtle" />
        <div className="h-4 w-1/2 animate-pulse rounded-lg bg-subtle" />
        <div className="grid gap-4 pt-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map(item => (
            <div key={item} className="h-32 animate-pulse rounded-card bg-subtle" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SectionLoader({ label = 'Loading', rows = 3 }) {
  return (
    <div className="space-y-3 py-2" role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-card bg-subtle" />
      ))}
    </div>
  )
}
