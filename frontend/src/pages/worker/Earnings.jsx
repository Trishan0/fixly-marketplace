import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Banknote, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { StatCard, Card, Button, PageHeader, Spinner, EmptyState } from '../../components/shared/UI'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import { formatCurrency, formatDate } from '../../lib/utils'
import { errorMessage } from '../../lib/errors'
import api from '../../lib/api'

const METHOD_LABELS = { cash: 'Cash', bank_transfer: 'Bank transfer', other: 'Other' }

const DISPUTE_REASONS = [
  { value: 'not_received', label: 'I haven’t received this payment' },
  { value: 'wrong_amount', label: 'The amount is different from what I received' },
  { value: 'other', label: 'Something else' },
]

export default function Earnings() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [disputing, setDisputing] = useState(null)
  usePageTitle('Earnings')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['earnings'],
    queryFn: () => api.get('/payments/my').then(r => r.data),
  })

  const refresh = (payment) => {
    qc.invalidateQueries({ queryKey: ['earnings'] })
    qc.invalidateQueries({ queryKey: ['assigned-jobs'] })
    qc.invalidateQueries({ queryKey: ['job', payment.job_id] })
  }

  const confirm = useMutation({
    mutationFn: (payment) => api.put(`/payments/${payment.id}/confirm`),
    onSuccess: (_data, payment) => {
      toast({ title: 'Payment confirmed', description: `${formatCurrency(payment.amount)} for “${payment.job_title}”.`, variant: 'success' })
      refresh(payment)
    },
    onError: (e) => toast({ title: 'Couldn’t confirm the payment', description: errorMessage(e), variant: 'error' }),
  })

  const dispute = useMutation({
    mutationFn: ({ payment, reason }) => api.put(`/payments/${payment.id}/dispute`, { reason }),
    onSuccess: (_data, { payment }) => {
      setDisputing(null)
      toast({ title: 'Payment disputed', description: 'We’ve shared your reason with the customer. Try to resolve it with them directly.' })
      refresh(payment)
    },
    onError: (e) => toast({ title: 'Couldn’t dispute the payment', description: errorMessage(e), variant: 'error' }),
  })

  const payments = data?.payments || []
  const total = data?.total || 0
  const confirmed = data?.confirmedTotal || 0
  const pending = data?.pendingTotal || 0

  return (
    <AppShell>
      <div className="fixly-page max-w-6xl space-y-5">
        <PageHeader title="Earnings" description="Payments customers have recorded for your jobs" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <StatCard icon={Banknote} label="Total recorded" value={formatCurrency(total)} color="emerald" />
          <StatCard icon={CheckCircle} label="Confirmed" value={formatCurrency(confirmed)} color="sky" />
          <StatCard icon={AlertCircle} label="Waiting for you" value={formatCurrency(pending)} sub="Confirm or dispute below" color="amber" />
        </div>

        {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> :
          isError ? <ErrorFallback title="We couldn’t load your earnings" description="Check your connection and try again." onRetry={() => refetch()} /> :
          payments.length === 0 ? (
            <EmptyState icon={Banknote} title="No payments yet" description="When a customer records a payment for a finished job, it appears here for you to confirm." />
          ) : (
            <Card>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map(p => {
                  const confirming = confirm.isPending && confirm.variables?.id === p.id
                  return (
                    <li key={p.id} className="grid gap-3 p-4 sm:flex sm:items-center sm:gap-4 sm:p-5">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                        <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link to={`/jobs/${p.job_id}`} className="line-clamp-2-mobile font-semibold text-slate-900 hover:text-sky-700 dark:hover:text-sky-300">{p.job_title}</Link>
                        <p className="text-xs leading-5 text-slate-500">{p.customer_name} · {formatDate(p.created_at)} · {METHOD_LABELS[p.method] || p.method}</p>
                        {p.note && <p className="mt-0.5 text-xs italic text-slate-500">“{p.note}”</p>}
                        {p.disputed && p.dispute_reason && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Your reason: {p.dispute_reason}</p>}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 sm:block sm:flex-shrink-0 sm:text-right">
                        <p className="font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(p.amount)}</p>
                        {p.disputed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Disputed</span>
                        ) : p.worker_confirmed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Confirmed</span>
                        ) : (
                          <div className="mt-1 flex gap-1">
                            <Button size="sm" variant="success" onClick={() => confirm.mutate(p)} loading={confirming} disabled={confirm.isPending}>
                              Confirm received
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDisputing(p)} disabled={confirming}>
                              Dispute
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
      </div>

      <ConfirmDialog
        open={Boolean(disputing)}
        onClose={() => setDisputing(null)}
        onConfirm={(reason) => dispute.mutate({ payment: disputing, reason })}
        loading={dispute.isPending}
        title="Dispute this payment?"
        description={disputing ? `${disputing.customer_name} recorded ${formatCurrency(disputing.amount)} by ${(METHOD_LABELS[disputing.method] || disputing.method).toLowerCase()} for “${disputing.job_title}”. Tell them what’s wrong so you can sort it out.` : ''}
        confirmLabel="Dispute payment"
        tone="danger"
        reason={{ label: 'What’s the problem?', placeholder: 'For example: I received LKR 3,000, not LKR 4,000.', required: true, options: DISPUTE_REASONS }}
      />
    </AppShell>
  )
}
