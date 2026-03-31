import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, MapPin, Clock, DollarSign, Star, Phone, Trash2, CreditCard, Send } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Badge, Card, Avatar, Modal, Input, Select, Textarea, Spinner, StarRating } from '../../components/shared/UI'
import { ProposalCard } from '../../components/shared/Cards'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatDate, URGENCY_LABELS, STATUS_LABELS } from '../../lib/utils'
import api from '../../lib/api'

export default function JobDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [payModal, setPayModal] = useState(false)
  const [reviewModal, setReviewModal] = useState(false)
  const [payment, setPayment] = useState({ amount: '', method: 'cash', note: '' })
  const [review, setReview] = useState({ rating: 5, feedback: '' })

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get(`/jobs/${id}`).then(r => r.data),
  })

  const { data: proposals = [] } = useQuery({
    queryKey: ['proposals', id],
    queryFn: () => api.get(`/jobs/${id}/proposals`).then(r => r.data),
    enabled: !!job,
  })

  const isOwner = user?.id === job?.customer_id
  const isAssignedWorker = user?.id === job?.assigned_worker_id
  const isWorker = user?.role === 'worker'
  const myProposal = isWorker ? proposals[0] : null

  const refetch = () => {
    qc.invalidateQueries(['job', id])
    qc.invalidateQueries(['proposals', id])
    qc.invalidateQueries(['my-jobs'])
  }

  const acceptProposal = useMutation({
    mutationFn: (pid) => api.put(`/proposals/${pid}/accept`),
    onSuccess: () => { toast({ title: 'Proposal accepted!', variant: 'success' }); refetch() },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  const declineProposal = useMutation({
    mutationFn: (pid) => api.put(`/proposals/${pid}/decline`),
    onSuccess: () => { toast({ title: 'Proposal declined' }); refetch() },
  })

  const updateStatus = useMutation({
    mutationFn: (status) => api.put(`/jobs/${id}/status`, { status }),
    onSuccess: () => { toast({ title: 'Status updated', variant: 'success' }); refetch() },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  const recordPayment = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/payment`, payment),
    onSuccess: () => { setPayModal(false); toast({ title: 'Payment recorded!', variant: 'success' }); refetch() },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  const submitReview = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/review`, review),
    onSuccess: () => { setReviewModal(false); toast({ title: 'Review submitted!', variant: 'success' }); refetch() },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  const cancelJob = useMutation({
    mutationFn: () => api.delete(`/jobs/${id}`),
    onSuccess: () => { toast({ title: 'Job cancelled' }); navigate('/jobs') },
  })

  if (isLoading) return <AppShell><div className="flex items-center justify-center h-full"><Spinner /></div></AppShell>
  if (!job) return <AppShell><div className="p-6 text-center text-slate-500">Job not found</div></AppShell>

  const canCancel = isOwner && !['in_progress','completed','payment_recorded','reviewed','cancelled'].includes(job.status)
  const canRecordPayment = isOwner && job.status === 'completed'
  const canReview = isOwner && ['completed','payment_recorded'].includes(job.status)
  const canMarkStarted = isAssignedWorker && job.status === 'assigned'
  const canMarkDone = isAssignedWorker && job.status === 'in_progress'
  const canSendProposal = isWorker && !isAssignedWorker && ['posted', 'proposals_received'].includes(job.status) && !myProposal

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {/* Job header */}
        <Card className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge status={job.status} />
                {job.urgency && <span className="text-sm text-slate-500">{URGENCY_LABELS[job.urgency]}</span>}
                {job.category_name && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{job.category_name}</span>}
              </div>
              <h1 className="text-xl font-bold text-slate-900">{job.title}</h1>
              <div className="flex items-center flex-wrap gap-4 mt-3 text-sm text-slate-500">
                {job.district && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.district}{job.town ? `, ${job.town}` : ''}</span>}
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{formatDate(job.created_at)}</span>
                {job.final_price && <span className="flex items-center gap-1 font-semibold text-emerald-600"><DollarSign className="w-4 h-4" />{formatCurrency(job.final_price)}</span>}
              </div>
            </div>
            {job.pricing_mode === 'fixed' && job.fixed_budget && (
              <div className="text-right">
                <p className="text-xs text-slate-400">Fixed Budget</p>
                <p className="text-xl font-bold text-sky-700">{formatCurrency(job.fixed_budget)}</p>
              </div>
            )}
          </div>

          {job.description && (
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl">
              <p className="text-sm text-slate-700 leading-relaxed">{job.description}</p>
            </div>
          )}

          {job.address && <p className="mt-3 text-sm text-slate-500">📍 {job.address}</p>}

          {/* Photos */}
          {job.photos?.length > 0 && (
            <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
              {job.photos.map(p => (
                <img key={p.id} src={p.path} alt="" className="w-24 h-24 rounded-xl object-cover flex-shrink-0" />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-100">
            {canSendProposal && (
              <Link to={`/jobs/${job.id}/propose`}>
                <Button variant="primary">
                  <Send className="w-4 h-4" /> Send Proposal
                </Button>
              </Link>
            )}
            {myProposal && (
              <Link to={`/jobs/${job.id}/propose`}>
                <Button variant="outline">Proposal Sent</Button>
              </Link>
            )}
            {canMarkStarted && (
              <Button variant="primary" onClick={() => updateStatus.mutate('in_progress')} loading={updateStatus.isPending}>
                ▶ Mark Started
              </Button>
            )}
            {canMarkDone && (
              <Button variant="success" onClick={() => updateStatus.mutate('completed')} loading={updateStatus.isPending}>
                ✓ Mark Completed
              </Button>
            )}
            {canRecordPayment && (
              <Button variant="primary" onClick={() => setPayModal(true)}>
                <CreditCard className="w-4 h-4" /> Record Payment
              </Button>
            )}
            {canReview && (
              <Button variant="secondary" onClick={() => setReviewModal(true)}>
                <Star className="w-4 h-4" /> Leave Review
              </Button>
            )}
            {canCancel && (
              <Button variant="danger" onClick={() => { if(confirm('Cancel this job?')) cancelJob.mutate() }}>
                <Trash2 className="w-4 h-4" /> Cancel Job
              </Button>
            )}
          </div>
        </Card>

        {job.customer_id && (
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Posted By</h3>
            <div className="flex items-center gap-3">
              <Avatar name={job.customer_name} src={job.customer_photo} size="lg" />
              <div>
                <p className="font-semibold text-slate-900">{job.customer_name}</p>
                {(job.district || job.town) && (
                  <p className="text-sm text-slate-500">
                    {[job.district, job.town].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <Link to={`/customers/${job.customer_id}`} className="ml-auto">
                <Button variant="outline" size="sm">View Profile</Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Assigned worker contact reveal */}
        {job.assigned_worker_id && (
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Assigned Worker</h3>
            <div className="flex items-center gap-3">
              <Avatar name={job.assigned_worker_name} src={job.assigned_worker_photo} size="lg" />
              <div>
                <p className="font-semibold text-slate-900">{job.assigned_worker_name}</p>
                <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3.5 h-3.5" /> {job.assigned_worker_phone || '—'}
                </p>
              </div>
              <Link to={`/workers/${job.assigned_worker_id}`} className="ml-auto">
                <Button variant="outline" size="sm">View Profile</Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Proposals */}
        {(isOwner || isAssignedWorker) && (
          <div>
            <h2 className="font-bold text-slate-900 mb-4">
              Proposals ({proposals.length})
            </h2>
            {proposals.length === 0 ? (
              <Card className="p-6 text-center text-slate-500 text-sm">
                No proposals yet. Workers will send proposals soon.
              </Card>
            ) : (
              <div className="space-y-4">
                {proposals.map(p => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    isOwner={isOwner}
                    onAccept={(pid) => acceptProposal.mutate(pid)}
                    onDecline={(pid) => declineProposal.mutate(pid)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Payment">
        <div className="space-y-4">
          <Input label="Amount (LKR) *" type="number" value={payment.amount} onChange={e => setPayment(p => ({ ...p, amount: e.target.value }))} placeholder="5000" />
          <Select label="Payment Method" value={payment.method} onChange={e => setPayment(p => ({ ...p, method: e.target.value }))}>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="other">Other</option>
          </Select>
          <Textarea label="Note (optional)" value={payment.note} onChange={e => setPayment(p => ({ ...p, note: e.target.value }))} placeholder="Any additional details..." rows={2} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setPayModal(false)} className="flex-1">Cancel</Button>
            <Button variant="primary" onClick={() => recordPayment.mutate()} loading={recordPayment.isPending} className="flex-1">Record Payment</Button>
          </div>
        </div>
      </Modal>

      {/* Review Modal */}
      <Modal open={reviewModal} onClose={() => setReviewModal(false)} title="Leave a Review">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Rating</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setReview(r => ({ ...r, rating: n }))}
                  className={`text-3xl transition-transform hover:scale-110 ${n <= review.rating ? 'text-amber-400' : 'text-slate-200'}`}>
                  ★
                </button>
              ))}
            </div>
          </div>
          <Textarea label="Feedback" value={review.feedback} onChange={e => setReview(r => ({ ...r, feedback: e.target.value }))} placeholder="Share your experience with this worker..." rows={3} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setReviewModal(false)} className="flex-1">Cancel</Button>
            <Button variant="primary" onClick={() => submitReview.mutate()} loading={submitReview.isPending} className="flex-1">Submit Review</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
