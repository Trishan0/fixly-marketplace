import React, { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, MapPin, Clock } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Badge, Button, Card, Spinner, Toggle } from '../../components/shared/UI'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import { formatCurrency, URGENCY_LABELS } from '../../lib/utils'
import { errorMessage, errorStatus } from '../../lib/errors'
import api from '../../lib/api'

const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/

function formFromProposal(proposal) {
  return {
    proposed_price: proposal?.proposed_price ? String(Number(proposal.proposed_price)) : '',
    inspection_needed: Boolean(proposal?.inspection_needed),
    availability: proposal?.availability || '',
    message: proposal?.message && proposal.message !== 'Accepted via invite' ? proposal.message : '',
  }
}

function JobSummary({ job }) {
  const [expanded, setExpanded] = useState(false)
  const long = (job.description || '').length > 280
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Applying for</p>
      <h2 className="mt-1 text-lg font-bold text-fg">{job.title}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-muted">
        {job.district && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{[job.town, job.district].filter(Boolean).join(', ')}</span>}
        {job.urgency && <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden="true" />{URGENCY_LABELS[job.urgency]}</span>}
        {job.pricing_mode === 'fixed' && job.fixed_budget && <span className="font-semibold text-brand-text">Budget {formatCurrency(job.fixed_budget)}</span>}
        {job.pricing_mode === 'ask_quotes' && <span>Customer wants quotes</span>}
        {job.pricing_mode === 'inspection' && <span>Customer expects an inspection first</span>}
      </div>
      {job.description && (
        <div className="mt-3 rounded-control bg-subtle p-3 text-sm leading-6 text-fg-muted">
          <p className={expanded || !long ? 'whitespace-pre-line' : 'line-clamp-4 whitespace-pre-line'}>{job.description}</p>
          {long && (
            <button type="button" onClick={() => setExpanded(v => !v)} className="mt-1 min-h-11 text-sm font-semibold text-brand-text">
              {expanded ? 'Show less' : 'Read the full description'}
            </button>
          )}
        </div>
      )}
      {job.photos?.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {job.photos.map((photo, index) => (
            <a key={photo.id} href={photo.path} target="_blank" rel="noreferrer" className="shrink-0">
              <img src={photo.path} alt={`Job photo ${index + 1} of ${job.photos.length}`} className="h-20 w-20 rounded-xl object-cover" />
            </a>
          ))}
        </div>
      )}
    </Card>
  )
}

function ProposalForm({ job, existing }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()
  const editing = Boolean(existing)
  const firstQuote = editing && !existing.proposed_price && !existing.inspection_needed
  const [form, setForm] = useState(() => formFromProposal(existing))
  const [errors, setErrors] = useState({})
  const set = key => event => {
    setForm(current => ({ ...current, [key]: event.target.value }))
    setErrors(current => ({ ...current, [key]: '' }))
  }

  const save = useMutation({
    mutationFn: (payload) => (editing
      ? api.put(`/proposals/${existing.id}`, payload)
      : api.post(`/jobs/${job.id}/proposals`, payload)),
    meta: { track: editing ? (firstQuote ? 'quote_sent_after_invite' : 'proposal_updated') : 'proposal_sent', trackProps: (payload) => ({ inspection_needed: payload.inspection_needed }) },
    onSuccess: () => {
      toast({
        title: firstQuote ? 'Quote sent' : editing ? 'Proposal updated' : 'Proposal sent',
        description: 'We’ve let the customer know. We’ll notify you when they respond.',
        variant: 'success',
      })
      qc.invalidateQueries({ queryKey: ['job-feed'] })
      qc.invalidateQueries({ queryKey: ['proposals', job.id] })
      qc.invalidateQueries({ queryKey: ['my-proposal', job.id] })
      qc.invalidateQueries({ queryKey: ['my-proposals'] })
      navigate(`/jobs/${job.id}`)
    },
    onError: e => toast({ title: editing ? 'Changes not saved' : 'Proposal not sent', description: errorMessage(e), variant: 'error' }),
  })

  const submit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.inspection_needed) {
      if (!form.proposed_price) nextErrors.proposed_price = 'Enter your price, or turn on “Inspection needed”.'
      else if (!PRICE_PATTERN.test(form.proposed_price) || Number(form.proposed_price) <= 0) nextErrors.proposed_price = 'Enter a price in rupees, for example 4500.'
    }
    if (form.availability.trim().length < 3) nextErrors.availability = 'Tell the customer when you could do the job.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(nextErrors.proposed_price ? 'proposal-price' : 'proposal-availability')?.focus()
      return
    }
    save.mutate({
      proposed_price: form.inspection_needed ? null : form.proposed_price,
      inspection_needed: form.inspection_needed,
      availability: form.availability.trim(),
      message: form.message.trim() || null,
    })
  }

  const heading = firstQuote ? 'Send your quote' : editing ? 'Edit your proposal' : 'Send a proposal'
  const intro = firstQuote
    ? 'You accepted this invite. Add your price and availability so the customer can hire you.'
    : editing
      ? 'You can change your proposal until the customer decides. They’ll be told it was updated.'
      : 'Customers compare price, availability and how clearly you explain the work.'

  return (
    <form onSubmit={submit} noValidate>
      <Card className="space-y-5 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">{heading}</h1>
          <p className="mt-1 text-sm text-fg-muted">{intro}</p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-card border border-line p-3">
          <div>
            <p id="inspection-label" className="text-sm font-medium text-fg">Inspection needed before pricing</p>
            <p className="text-xs text-fg-subtle">Turn on if you need to see the job before you can give a price.</p>
          </div>
          <Toggle
            checked={form.inspection_needed}
            onChange={(next) => { setForm(f => ({ ...f, inspection_needed: next })); setErrors(e => ({ ...e, proposed_price: '' })) }}
            label="Inspection needed before pricing"
          />
        </div>

        {!form.inspection_needed && (
          <div className="space-y-1.5">
            <label htmlFor="proposal-price" className="block text-sm font-medium text-fg-muted">Your price (LKR)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-fg-subtle">LKR</span>
              <input
                id="proposal-price"
                inputMode="decimal"
                className={`fixly-input pl-12 ${errors.proposed_price ? 'fixly-input-error' : ''}`}
                placeholder="4500"
                value={form.proposed_price}
                onChange={set('proposed_price')}
                aria-invalid={Boolean(errors.proposed_price)}
                aria-describedby={errors.proposed_price ? 'proposal-price-error' : 'proposal-price-help'}
              />
            </div>
            {errors.proposed_price
              ? <p id="proposal-price-error" role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">{errors.proposed_price}</p>
              : <p id="proposal-price-help" className="text-xs text-fg-subtle">Only the customer sees your price.{job.pricing_mode === 'fixed' && job.fixed_budget ? ` Their budget is ${formatCurrency(job.fixed_budget)}.` : ''}</p>}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="proposal-availability" className="block text-sm font-medium text-fg-muted">When can you do it?</label>
          <input
            id="proposal-availability"
            className={`fixly-input ${errors.availability ? 'fixly-input-error' : ''}`}
            placeholder="e.g. Tomorrow morning, or any weekday after 4pm"
            maxLength={255}
            value={form.availability}
            onChange={set('availability')}
            aria-invalid={Boolean(errors.availability)}
            aria-describedby={errors.availability ? 'proposal-availability-error' : undefined}
          />
          {errors.availability && <p id="proposal-availability-error" role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">{errors.availability}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="proposal-message" className="block text-sm font-medium text-fg-muted">Message to the customer <span className="font-normal text-fg-subtle">(recommended)</span></label>
          <textarea
            id="proposal-message"
            className="fixly-input resize-y"
            rows={5}
            maxLength={2000}
            placeholder="Explain how you’d do the job, similar work you’ve done, and anything included in your price (parts, cleanup, warranty)."
            value={form.message}
            onChange={set('message')}
          />
          <p className="text-right text-xs text-fg-subtle">{form.message.length}/2000</p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Link to={`/jobs/${job.id}`} className="fixly-btn-secondary text-sm">Cancel</Link>
          <Button type="submit" size="lg" loading={save.isPending}>
            {firstQuote ? 'Send quote' : editing ? 'Save changes' : 'Send proposal'}
          </Button>
        </div>
      </Card>
    </form>
  )
}

export default function SendProposal() {
  const { jobId } = useParams()
  const navigate = useNavigate()

  const { data: job, isLoading: jobLoading, error: jobError, refetch } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.get(`/jobs/${jobId}`).then(r => r.data),
  })
  const { data: existing, isLoading: proposalLoading } = useQuery({
    queryKey: ['my-proposal', jobId],
    queryFn: () => api.get(`/jobs/${jobId}/proposals`).then(r => r.data[0] || null),
    enabled: Boolean(job),
  })
  usePageTitle(existing ? 'Edit proposal' : 'Send a proposal')

  const accepting = job && job.is_active !== false && ['posted', 'proposals_received'].includes(job.status)

  let body
  if (jobLoading || (job && proposalLoading)) {
    body = <div className="flex justify-center py-12"><Spinner /></div>
  } else if (!job) {
    const status = errorStatus(jobError)
    body = (
      <ErrorFallback
        title={status === 404 ? 'This job doesn’t exist' : status === 403 ? 'You can’t apply to this job' : 'We couldn’t load this job'}
        description={status === 403 || status === 404 ? 'It may have been removed or given to someone else.' : 'Check your connection and try again.'}
        onRetry={status === 403 || status === 404 ? undefined : () => refetch()}
      />
    )
  } else if (existing && existing.status !== 'pending') {
    const copy = {
      accepted: ['You were hired for this job', 'Head to the job to agree a start time with the customer.'],
      declined: ['Your proposal wasn’t chosen', 'The customer went with another option. Keep an eye on new jobs nearby.'],
      withdrawn: ['You withdrew this proposal', 'Proposals can’t be re-sent after they’re withdrawn.'],
    }[existing.status]
    body = (
      <Card className="p-8 text-center">
        <Badge status={existing.status} />
        <h1 className="mt-3 text-xl font-bold text-fg">{copy[0]}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">{copy[1]}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link to={`/jobs/${jobId}`} className="fixly-btn-primary text-sm">View job</Link>
          <Link to="/proposals" className="fixly-btn-secondary text-sm">My proposals</Link>
        </div>
      </Card>
    )
  } else if (!accepting) {
    body = (
      <Card className="p-8 text-center">
        <h1 className="text-xl font-bold text-fg">This job isn’t taking proposals any more</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">The customer may have hired someone or cancelled the job.</p>
        <Link to="/jobs/feed" className="fixly-btn-primary mt-6 text-sm">Browse open jobs</Link>
      </Card>
    )
  } else {
    body = (
      <div className="space-y-5">
        <JobSummary job={job} />
        <ProposalForm key={existing?.id || 'new'} job={job} existing={existing} />
      </div>
    )
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6 lg:py-8">
        <button type="button" onClick={() => navigate(-1)} className="flex min-h-11 items-center gap-1 text-sm font-semibold -ml-1 text-fg-muted hover:text-fg">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
        </button>
        {body}
      </div>
    </AppShell>
  )
}
