import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Card, PageHeader } from '../../components/shared/UI'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, URGENCY_LABELS } from '../../lib/utils'
import api from '../../lib/api'

export default function SendProposal() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [form, setForm] = useState({
    proposed_price: '',
    inspection_needed: false,
    availability: '',
    message: '',
  })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.get(`/jobs/${jobId}`).then(r => r.data),
  })

  const { data: existing } = useQuery({
    queryKey: ['my-proposal', jobId],
    queryFn: () => api.get(`/jobs/${jobId}/proposals`).then(r => r.data[0] || null),
  })

  const submit = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/proposals`, {
      ...form,
      proposed_price: form.inspection_needed ? null : (form.proposed_price || null),
    }),
    onSuccess: () => {
      toast({ title: 'Proposal sent!', description: 'The customer will review it shortly.', variant: 'success' })
      navigate(`/jobs/${jobId}`)
    },
    onError: e => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  if (existing) {
    const proposalTitle =
      existing.status === 'declined'
        ? 'Proposal Rejected'
        : existing.status === 'accepted'
          ? 'Proposal Accepted'
          : 'Proposal Already Sent'
    const proposalDescription =
      existing.status === 'declined'
        ? 'The customer declined your proposal for this job.'
        : existing.status === 'accepted'
          ? 'Your proposal was accepted for this job.'
          : "You've already submitted a proposal for this job. The customer will review it."

    return (
      <AppShell>
        <div className="fixly-page max-w-2xl">
          <Card className="p-8 text-center">
            <div className="text-4xl mb-3">{existing.status === 'declined' ? '!' : existing.status === 'accepted' ? '+' : '*'}</div>
            <h2 className="font-bold text-slate-900 mb-2">{proposalTitle}</h2>
            <p className="text-slate-500 text-sm mb-6">{proposalDescription}</p>
            <Button variant="primary" onClick={() => navigate(`/jobs/${jobId}`)}>
              View Job Details
            </Button>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="fixly-page max-w-2xl space-y-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex min-h-11 items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="w-4 h-4" /> Back to job
        </button>

        {job && (
          <Card className="p-4 bg-slate-50">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
              Applying for
            </p>
            <h2 className="font-bold text-slate-900">{job.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              {job.district && <span>Location: {job.district}</span>}
              {job.urgency && <span>{URGENCY_LABELS[job.urgency]}</span>}
              {job.fixed_budget && job.pricing_mode === 'fixed' && (
                <span className="text-sky-600 font-semibold">
                  Budget: {formatCurrency(job.fixed_budget)}
                </span>
              )}
            </div>
          </Card>
        )}

        <PageHeader title="Send Proposal" description="Make a strong first impression" />

        <Card className="space-y-5 p-4 sm:p-6">
          <div>
            <button
              type="button"
              role="switch"
              aria-checked={form.inspection_needed}
              onClick={() => setForm(f => ({ ...f, inspection_needed: !f.inspection_needed, proposed_price: '' }))}
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left dark:border-slate-700"
            >
              <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${form.inspection_needed ? 'bg-sky-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.inspection_needed ? 'translate-x-6' : 'translate-x-1'}`} />
              </span>
              <div>
                <p className="font-medium text-slate-800 text-sm">Inspection needed before pricing</p>
                <p className="text-xs text-slate-400">I need to see the job first to give an accurate price</p>
              </div>
            </button>
          </div>

          {!form.inspection_needed && (
            <div className="space-y-1.5">
              <label htmlFor="proposal-price" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Your Price (LKR) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">LKR</span>
                <input
                  id="proposal-price"
                  type="number"
                  className="fixly-input pl-12"
                  placeholder="5000"
                  value={form.proposed_price}
                  onChange={set('proposed_price')}
                  min="0"
                />
              </div>
              <p className="text-xs text-slate-400">
                Your price is only visible to the job poster, not other workers
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="proposal-availability" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Your Availability *
            </label>
            <input
              id="proposal-availability"
              type="text"
              className="fixly-input"
              placeholder="e.g. Available tomorrow morning, or weekends"
              value={form.availability}
              onChange={set('availability')}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="proposal-message" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Message to Customer
            </label>
            <textarea
              id="proposal-message"
              className="fixly-input resize-none"
              rows={4}
              placeholder="Introduce yourself. Mention your experience with similar jobs, how you'd approach this work, and why you're the right person for the job..."
              value={form.message}
              onChange={set('message')}
            />
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => submit.mutate()}
            loading={submit.isPending}
            disabled={!form.inspection_needed && !form.proposed_price}
          >
            Submit Proposal
          </Button>
        </Card>
      </div>
    </AppShell>
  )
}
