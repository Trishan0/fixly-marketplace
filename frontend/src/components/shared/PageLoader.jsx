import React from 'react'

// Neutral skeleton used while the session or a route chunk loads, so the
// screen never flashes blank.
export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 dark:bg-slate-950" role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      <div className="h-16 border-b border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60" />
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8">
        <div className="h-8 w-1/3 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-1/2 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="grid gap-4 pt-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map(item => (
            <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800/80" />
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
        <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
      ))}
    </div>
  )
}
