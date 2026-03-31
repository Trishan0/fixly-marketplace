import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { MapPin, Briefcase, Shield, ArrowLeft, Send, Star } from 'lucide-react'
import { Button, Card, Avatar, Badge, StarRating, Spinner, Modal, Select, Textarea } from '../../components/shared/UI'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { formatDate, formatRelativeTime } from '../../lib/utils'
import api from '../../lib/api'
import { Wrench } from 'lucide-react'

export default function WorkerProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [inviteModal, setInviteModal] = useState(false)
  const [jobId, setJobId] = useState('')
  const [message, setMessage] = useState('')

  const { data: worker, isLoading } = useQuery({
    queryKey: ['worker', id],
    queryFn: () => api.get(`/workers/${id}`).then(r => r.data),
  })

  const { data: reviews = [] } = useQuery({
    queryKey: ['worker-reviews', id],
    queryFn: () => api.get(`/workers/${id}/reviews`).then(r => r.data),
  })

  const { data: myJobs = [] } = useQuery({
    queryKey: ['my-jobs-simple'],
    queryFn: () => api.get('/jobs/my').then(r => r.data.filter(j => ['posted','proposals_received'].includes(j.status))),
    enabled: !!user && user.role === 'customer',
  })

  const sendInvite = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/invites`, { worker_id: id, message }),
    onSuccess: () => { setInviteModal(false); toast({ title: 'Invite sent!', variant: 'success' }) },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Spinner />
    </div>
  )
  if (!worker) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500">Worker not found</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-sky-600 rounded-lg flex items-center justify-center">
            <Wrench className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-black text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>Fixly</span>
        </Link>
        <span className="text-slate-300">/</span>
        <Link to="/workers" className="text-sm text-slate-500 hover:text-sky-600">Workers</Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-700 font-medium">{worker.full_name}</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Profile header */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <Avatar name={worker.full_name} src={worker.profile_photo} size="xl" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{worker.full_name}</h1>
                {worker.is_nic_verified && (
                  <span className="flex items-center gap-1 bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full text-sm font-semibold">
                    <Shield className="w-3.5 h-3.5" /> Verified
                  </span>
                )}
              </div>
              <p className="text-sky-600 font-semibold mt-1">{worker.primary_skill}</p>
              <div className="flex items-center flex-wrap gap-4 mt-3 text-sm text-slate-500">
                {worker.district && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{worker.district}{worker.area ? `, ${worker.area}` : ''}</span>}
                <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" />{worker.total_jobs_done || 0} jobs done</span>
                <span className="flex items-center gap-1"><Star className="w-4 h-4 text-amber-400" />{Number(worker.avg_rating || 0).toFixed(1)} rating</span>
              </div>
              {worker.starting_price && (
                <p className="mt-2 text-sm font-medium text-slate-700">Starting from {worker.starting_price}</p>
              )}
              {worker.bio && <p className="mt-3 text-sm text-slate-600 leading-relaxed">{worker.bio}</p>}

              {/* Skills */}
              {worker.skills?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {worker.skills.map(s => (
                    <span key={s.id} className={`text-xs px-2 py-0.5 rounded-full ${s.is_primary ? 'bg-sky-100 text-sky-700 font-semibold' : 'bg-slate-100 text-slate-600'}`}>
                      {s.category_name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {user?.role === 'customer' && (
              <div>
                <Button variant="primary" onClick={() => setInviteModal(true)}>
                  <Send className="w-4 h-4" /> Invite to Job
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Portfolio */}
        {worker.portfolio_photos?.length > 0 && (
          <div>
            <h2 className="font-bold text-slate-900 mb-4">Portfolio</h2>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {worker.portfolio_photos.map(p => (
                <img key={p.id} src={p.path} alt="" className="aspect-square rounded-2xl object-cover w-full" />
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div>
          <h2 className="font-bold text-slate-900 mb-4">Reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <Card className="p-6 text-center text-slate-500 text-sm">No reviews yet</Card>
          ) : (
            <div className="space-y-4">
              {reviews.map(r => (
                <Card key={r.id} className="p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={r.customer_name} src={r.customer_photo} size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 text-sm">{r.customer_name}</span>
                        <span className="text-xs text-slate-400">{formatRelativeTime(r.created_at)}</span>
                      </div>
                      <StarRating rating={r.rating} />
                      {r.job_title && <p className="text-xs text-slate-400 mt-1">Job: {r.job_title}</p>}
                      {r.feedback && <p className="text-sm text-slate-600 mt-2">{r.feedback}</p>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <Modal open={inviteModal} onClose={() => setInviteModal(false)} title={`Invite ${worker.full_name}`}>
        <div className="space-y-4">
          {myJobs.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-slate-500 text-sm mb-4">You have no active jobs to invite this worker to.</p>
              <Link to="/jobs/new" onClick={() => setInviteModal(false)}>
                <Button variant="primary">Post a Job First</Button>
              </Link>
            </div>
          ) : (
            <>
              <Select label="Select Job" value={jobId} onChange={e => setJobId(e.target.value)}>
                <option value="">Select a job...</option>
                {myJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </Select>
              <Textarea label="Message (optional)" value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell the worker why you'd like them..." rows={3} />
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setInviteModal(false)} className="flex-1">Cancel</Button>
                <Button variant="primary" onClick={() => sendInvite.mutate()} loading={sendInvite.isPending} disabled={!jobId} className="flex-1">
                  Send Invite
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
