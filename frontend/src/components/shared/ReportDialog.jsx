import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Flag } from 'lucide-react'
import { Button, Modal, Select, Textarea } from './UI'
import { useToast } from '../../hooks/useToast'
import { errorMessage } from '../../lib/errors'
import api from '../../lib/api'

const JOB_REASONS = [
  ['fake_job', 'It looks fake or like a scam'],
  ['inappropriate_job', 'It’s inappropriate or not a real service job'],
  ['price_dispute', 'There’s a problem with the price or payment'],
  ['other', 'Something else'],
]

const USER_REASONS = [
  ['abusive_behavior', 'Rude, threatening or abusive behaviour'],
  ['no_show', 'Didn’t turn up or stopped responding'],
  ['fake_review', 'Fake reviews or misleading profile'],
  ['price_dispute', 'Payment or price dispute'],
  ['other', 'Something else'],
]

function ReportForm({ jobId, reportedUserId, subject, onDone, onCancel }) {
  const { toast } = useToast()
  const reasons = reportedUserId ? USER_REASONS : JOB_REASONS
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState({})

  const send = useMutation({
    mutationFn: () => api.post('/reports', {
      job_id: jobId || null,
      reported_user_id: reportedUserId || null,
      report_type: type,
      description: description.trim(),
    }),
    meta: { track: 'report_submitted', trackProps: () => ({ type, about: reportedUserId ? 'user' : 'job' }) },
    onSuccess: () => {
      toast({ title: 'Report sent', description: 'Thanks for telling us. Our team reviews every report and will follow up by notification.', variant: 'success' })
      onDone()
    },
    onError: (e) => toast({ title: 'Report not sent', description: errorMessage(e), variant: 'error' }),
  })

  const submit = (event) => {
    event.preventDefault()
    const next = {}
    if (!type) next.type = 'Choose what’s wrong.'
    if (description.trim().length < 10) next.description = 'Tell us a bit more (at least 10 characters).'
    setErrors(next)
    if (Object.keys(next).length === 0) send.mutate()
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-sm leading-6 text-fg-muted">
        Reports go to the Fixly team, not to {subject}. If anyone is in danger, call the police on <a href="tel:119" className="font-semibold underline">119</a> first.
      </p>
      <Select label="What’s wrong?" value={type} onChange={e => { setType(e.target.value); setErrors(v => ({ ...v, type: '' })) }} error={errors.type}>
        <option value="">Choose a reason</option>
        {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
      <Textarea
        label="What happened?"
        rows={4}
        maxLength={2000}
        value={description}
        onChange={e => { setDescription(e.target.value); setErrors(v => ({ ...v, description: '' })) }}
        placeholder="Include dates, amounts and anything that helps us understand."
        error={errors.description}
      />
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={send.isPending}>Cancel</Button>
        <Button type="submit" variant="danger" loading={send.isPending}>Send report</Button>
      </div>
    </form>
  )
}

/** "Report" link that opens a report form about a job or a user. */
export function ReportButton({ jobId, reportedUserId, subject, label = 'Report', className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-fg-subtle transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-300 [@media(pointer:coarse)]:h-11 ${className}`}
      >
        <Flag className="h-4 w-4" aria-hidden="true" /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={reportedUserId ? `Report ${subject}` : 'Report this job'}>
        <ReportForm jobId={jobId} reportedUserId={reportedUserId} subject={subject} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </Modal>
    </>
  )
}
