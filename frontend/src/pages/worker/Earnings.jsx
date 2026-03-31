import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, CheckCircle, AlertCircle } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { StatCard, Card, Button, PageHeader, Spinner, EmptyState } from '../../components/shared/UI'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatDate } from '../../lib/utils'
import api from '../../lib/api'

export default function Earnings() {
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['earnings'],
    queryFn: () => api.get('/payments/my').then(r => r.data),
  })

  const confirm = useMutation({
    mutationFn: (id) => api.put(`/payments/${id}/confirm`),
    onSuccess: () => { toast({ title: 'Payment confirmed!', variant: 'success' }); qc.invalidateQueries(['earnings']) },
  })

  const dispute = useMutation({
    mutationFn: (id) => api.put(`/payments/${id}/dispute`),
    onSuccess: () => { toast({ title: 'Payment disputed' }); qc.invalidateQueries(['earnings']) },
  })

  const payments = data?.payments || []
  const total = data?.total || 0
  const confirmed = data?.confirmedTotal || 0
  const pending = data?.pendingTotal || 0

  return (
    <AppShell>
      <div className="fixly-page max-w-6xl space-y-5">
        <PageHeader title="Earnings" description="Track your payments and income" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={DollarSign} label="Total Recorded" value={formatCurrency(total)} color="emerald" />
          <StatCard icon={CheckCircle} label="Confirmed" value={formatCurrency(confirmed)} color="sky" />
          <StatCard icon={AlertCircle} label="Pending Confirmation" value={formatCurrency(pending)} color="amber" />
        </div>

        {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> :
          payments.length === 0 ? (
            <EmptyState icon={DollarSign} title="No payments yet" description="Payments will appear here after jobs are completed" />
          ) : (
            <Card>
              <div className="divide-y divide-slate-50">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center gap-4 p-5">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{p.job_title}</p>
                      <p className="text-xs text-slate-500">{p.customer_name} • {formatDate(p.created_at)} • {p.method}</p>
                      {p.note && <p className="text-xs text-slate-400 italic mt-0.5">"{p.note}"</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-emerald-600">{formatCurrency(p.amount)}</p>
                      {p.disputed ? (
                        <span className="text-xs text-red-500 font-medium">Disputed</span>
                      ) : p.worker_confirmed ? (
                        <span className="text-xs text-emerald-500 font-medium">✓ Confirmed</span>
                      ) : (
                        <div className="flex gap-1 mt-1">
                          <Button size="sm" variant="success" onClick={() => confirm.mutate(p.id)} loading={confirm.isPending}>
                            Confirm
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => dispute.mutate(p.id)}>
                            Dispute
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
      </div>
    </AppShell>
  )
}
