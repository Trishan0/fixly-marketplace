import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, Sparkles, Undo2, X } from 'lucide-react'
import { Button } from '../shared/UI'
import { cn } from '../../lib/utils'
import { errorMessage } from '../../lib/errors'
import { appendDetails, detailLines, MAX_ANSWER_LENGTH } from '../../lib/jobDetails'
import api from '../../lib/api'

const GENERAL_QUESTIONS = ['What exactly needs doing?', 'Where in the house is it?', 'Will you supply the materials?']

/**
 * "Help me add details": suggests questions about what's missing from the
 * description, and adds the customer's answers under it. The AI only
 * suggests questions and answer choices; it never writes description text
 * (see lib/jobDetails.js and the backend's agents/jobClarifier.js).
 *
 * Returns two pieces so the form can place them apart: `trigger`, the
 * button (beside the field's label), and `panel`, the questions and status
 * (under the text box, where the answers are added).
 *
 * @param {{ title: string, description: string, categoryId: string, urgency: string, hints: string[] | null, onChange: (description: string) => void }} props
 * @returns {{ trigger: React.ReactNode, panel: React.ReactNode }}
 */
export function useDescriptionHelper({ title, description, categoryId, urgency, hints, onChange }) {
  const [round, setRound] = useState(null) // { source, busy, questions }
  const [answers, setAnswers] = useState({})
  const [applied, setApplied] = useState(null) // { previous, result, added }

  const suggest = useMutation({
    mutationFn: () => api.post('/jobs/clarify', {
      title, description, category_id: categoryId || null, urgency: urgency || null,
    }).then(r => r.data),
    meta: { silentError: true, track: 'job_details_suggested' },
    onSuccess: data => {
      const fromAi = data.source === 'ai' && data.questions?.length > 0
      // No AI (or nothing usable): the same helpful questions the form
      // already shows for this kind of job, as free-text questions.
      const questions = fromAi
        ? data.questions
        : (hints || GENERAL_QUESTIONS).map((question, index) => ({ id: `g${index + 1}`, question, options: [] }))
      setRound({ source: fromAi ? 'ai' : 'guide', busy: !fromAi && data.reason === 'ai_unavailable', questions })
      setAnswers({})
      setApplied(null)
    },
  })

  const answered = round ? round.questions.map(q => ({ question: q.question, answer: answers[q.id] || '' })) : []
  const preview = detailLines(answered)
  const setAnswer = (id, value) => setAnswers(current => ({ ...current, [id]: value }))
  const close = () => { setRound(null); setAnswers({}) }

  const apply = () => {
    const { text, added } = appendDetails(description, answered)
    if (added > 0) {
      setApplied({ previous: description, result: text, added })
      onChange(text)
    }
    close()
  }

  const undo = () => {
    onChange(applied.previous)
    setApplied(null)
  }

  const tooShort = description.trim().length < 10

  const trigger = round ? null : (
    <Button variant="secondary" size="sm" onClick={() => suggest.mutate()} loading={suggest.isPending} disabled={tooShort} title={tooShort ? 'Write a sentence first, then we’ll suggest questions.' : undefined}>
      <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" /> Help me add details
    </Button>
  )

  if (!round) {
    const showUndo = applied && applied.result === description
    if (!showUndo && !suggest.isError && !tooShort) return { trigger, panel: null }
    return { trigger, panel: (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {tooShort && !showUndo && (
          <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" aria-hidden="true" />
            Write a sentence, then use “Help me add details” for questions workers would ask.
          </span>
        )}
        {/* Undo only while the text is untouched since, so it can't discard later edits. */}
        {showUndo && (
          <span className="flex items-center gap-2 text-xs text-fg-muted" role="status">
            <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            Added {applied.added} {applied.added === 1 ? 'detail' : 'details'}
            <button type="button" onClick={undo} className="inline-flex min-h-8 items-center gap-1 font-semibold text-brand-text hover:underline">
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Undo
            </button>
          </span>
        )}
        {suggest.isError && <span className="text-xs text-red-600 dark:text-red-400" role="alert">{errorMessage(suggest.error)}</span>}
      </div>
    ) }
  }

  return { trigger, panel: (
    <section aria-label="Add details to your description" className="rounded-control border border-violet-200 bg-violet-50/60 p-3.5 dark:border-violet-500/25 dark:bg-violet-500/10 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
            A few questions workers would ask
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            Answer any you like and skip the rest. Only your answers are added. Nothing is written for you.
          </p>
        </div>
        <button type="button" onClick={close} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fg-subtle hover:bg-subtle" aria-label="Close questions">
          <X className="h-4 w-4" />
        </button>
      </div>

      <ol className="mt-3 space-y-3.5">
        {round.questions.map(q => {
          const value = answers[q.id] || ''
          return (
            <li key={q.id}>
              <label htmlFor={`detail-${q.id}`} className="text-sm font-medium text-fg">{q.question}</label>
              {q.options.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {q.options.map(option => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={value === option}
                      onClick={() => setAnswer(q.id, value === option ? '' : option)}
                      className={cn(
                        'min-h-9 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                        value === option ? 'border-violet-500 bg-violet-600 text-white' : 'border-line bg-surface text-fg-muted hover:border-violet-300 hover:text-fg',
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
              <input
                id={`detail-${q.id}`}
                value={value}
                onChange={event => setAnswer(q.id, event.target.value)}
                maxLength={MAX_ANSWER_LENGTH}
                placeholder={q.options.length > 0 ? 'Or type your own answer' : 'Your answer (optional)'}
                className="mt-1.5 h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </li>
          )
        })}
      </ol>

      {preview.length > 0 && (
        <div className="mt-3.5 rounded-control border border-line bg-surface p-3">
          <p className="text-xs font-semibold text-fg-subtle">Will be added under your description</p>
          <p className="mt-1 whitespace-pre-line text-[13px] text-fg">{preview.join('\n')}</p>
        </div>
      )}

      <div className="mt-3.5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-fg-subtle">
          {round.source === 'ai'
            ? 'Questions suggested by AI from what you wrote.'
            : round.busy
              ? 'AI is busy right now, so these are standard questions for this kind of job. Close and try again in a minute.'
              : 'Suggested questions for this kind of job.'}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={close}>Cancel</Button>
          <Button size="sm" onClick={apply} disabled={preview.length === 0}>Add to description</Button>
        </div>
      </div>
    </section>
  ) }
}
