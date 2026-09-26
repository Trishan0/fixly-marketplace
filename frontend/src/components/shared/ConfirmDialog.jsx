import React, { useId, useState } from 'react'
import { Button, Modal } from './UI'

/**
 * Asks before an action that is hard to undo.
 *
 * reason: when set, collects a reason before confirming.
 *   { label, placeholder, required, minLength, options: [{ value, label }] }
 *   With `options`, the person picks one; choosing "other" (or when there are
 *   no options) shows a text field. onConfirm receives the final reason text.
 */
export function ConfirmDialog({ open, onClose, loading = false, title, ...props }) {
  // The body only mounts while open, so its reason fields start empty every time.
  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title={title}>
      <ConfirmBody onClose={onClose} loading={loading} {...props} />
    </Modal>
  )
}

function ConfirmBody({
  onClose,
  onConfirm,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading,
  reason,
}) {
  const [choice, setChoice] = useState('')
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const fieldId = useId()

  const options = reason?.options || []
  const needsText = reason && (options.length === 0 || choice === 'other')
  const optionLabel = options.find(option => option.value === choice)?.label || ''
  const finalReason = !reason
    ? undefined
    : needsText
      ? [choice === 'other' ? '' : optionLabel, text.trim()].filter(Boolean).join(': ')
      : [optionLabel, text.trim()].filter(Boolean).join(': ')
  const minLength = reason?.minLength ?? 3
  const reasonError = reason?.required && touched && (
    (options.length > 0 && !choice)
      ? 'Choose a reason'
      : needsText && text.trim().length < minLength
        ? `Add a few words (at least ${minLength} characters)`
        : ''
  )
  const canConfirm = !reason?.required || (
    (options.length === 0 || choice) && (!needsText || text.trim().length >= minLength)
  )

  const submit = (event) => {
    event.preventDefault()
    setTouched(true)
    if (!canConfirm || loading) return
    onConfirm(finalReason)
  }

  return (
      <form onSubmit={submit} className="space-y-4">
        {description && <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>}
        {children}
        {reason && options.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{reason.label}</legend>
            <div className="grid gap-2">
              {options.map(option => (
                <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 has-[:checked]:border-sky-500 has-[:checked]:bg-sky-50 dark:border-slate-700 dark:text-slate-200 dark:has-[:checked]:bg-sky-950/40">
                  <input type="radio" name={`${fieldId}-choice`} value={option.value} checked={choice === option.value} onChange={() => setChoice(option.value)} className="h-4 w-4" />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {reason && (needsText || options.length > 0) && (
          <div className="space-y-1.5">
            <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {options.length === 0 ? reason.label : needsText ? 'Tell us more' : 'Add a note (optional)'}
            </label>
            <textarea
              id={fieldId}
              className="fixly-input resize-none"
              rows={3}
              maxLength={500}
              value={text}
              onChange={event => setText(event.target.value)}
              placeholder={reason.placeholder}
              aria-invalid={Boolean(reasonError)}
              aria-describedby={reasonError ? `${fieldId}-error` : undefined}
            />
          </div>
        )}
        {reasonError && <p id={`${fieldId}-error`} role="alert" className="text-xs text-red-600">{reasonError}</p>}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button type="submit" variant={tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : 'primary'} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </form>
  )
}
