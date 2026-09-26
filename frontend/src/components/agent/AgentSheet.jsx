import React from 'react'
import AgentPanel from './AgentPanel'

/** Side sheet (bottom sheet on phones) that hosts the AI assistant. */
export function AgentSheet({ open, mode, jobId, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={mode === 'match' ? 'Find matching workers' : 'Find jobs for me'}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className="relative mt-auto flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-overlay border border-line bg-surface shadow-overlay animate-slide-in-right sm:ml-auto sm:mt-0 sm:h-full sm:max-w-lg sm:rounded-none sm:border-y-0 sm:border-r-0">
        <AgentPanel mode={mode} jobId={jobId} onClose={onClose} />
      </div>
    </div>
  )
}
