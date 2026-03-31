import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { MapPin, Briefcase, Shield, Send, Star, Sparkles, BadgeCheck, Camera } from 'lucide-react'
import { Button, Card, Avatar, Badge, StarRating, Spinner, Modal, Select, Textarea } from '../../components/shared/UI'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { formatRelativeTime } from '../../lib/utils'
import api from '../../lib/api'
import { Wrench } from 'lucide-react'

export default function WorkerProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
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
    queryFn: () => api.get('/jobs/my').then(r => r.data.filter(j => ['posted', 'proposals_received'].includes(j.status))),
    enabled: !!user && user.role === 'customer',
  })

  const sendInvite = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/invites`, { worker_id: id, message }),
    onSuccess: () => { setInviteModal(false); toast({ title: 'Invite sent!', variant: 'success' }) },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    )
  }

  if (!worker) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Worker not found</p>
      </div>
    )
  }

  const reviewCount = reviews.length
  const topHighlights = [
    worker.is_nic_verified ? 'Identity verified on Fixly' : 'Identity not yet verified',
    `${worker.total_jobs_done || 0} jobs completed`,
    `${reviewCount} public review${reviewCount !== 1 ? 's' : ''}`,
  ]

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

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <Card className="p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-950 via-sky-700 to-cyan-500 h-32" />
          <div className="px-6 pb-6 -mt-14">
            <div className="flex flex-col xl:flex-row gap-6 items-start">
              <Avatar name={worker.full_name} src={worker.profile_photo} size="xl" className="ring-4 ring-white shadow-xl" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-3xl font-black text-slate-900">{worker.full_name}</h1>
                  {worker.is_nic_verified && (
                    <span className="flex items-center gap-1 bg-sky-50 text-sky-600 px-2.5 py-1 rounded-full text-sm font-semibold">
                      <Shield className="w-3.5 h-3.5" /> Verified
                    </span>
                  )}
                </div>
                <p className="text-sky-700 font-semibold mt-1 text-lg">{worker.primary_skill}</p>
                <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-500">
                  {worker.district && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{worker.district}{worker.area ? `, ${worker.area}` : ''}</span>}
                  <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" />{worker.total_jobs_done || 0} jobs done</span>
                  <span className="flex items-center gap-1"><BadgeCheck className="w-4 h-4 text-emerald-600" />{reviewCount} review{reviewCount !== 1 ? 's' : ''}</span>
                </div>
                {worker.bio && <p className="mt-4 text-sm text-slate-600 leading-7 max-w-3xl">{worker.bio}</p>}
                {worker.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {worker.skills.map(s => (
                      <span key={s.id} className={`${s.is_primary ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'} text-xs px-3 py-1 rounded-full font-medium`}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="w-full xl:w-80 space-y-4">
                <Card className="p-5 bg-slate-950 text-white">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Rating Spotlight</p>
                  <div className="flex items-end gap-3">
                    <span className="text-5xl font-black">{Number(worker.avg_rating || 0).toFixed(1)}</span>
                    <div className="pb-2">
                      <StarRating rating={worker.avg_rating || 0} />
                      <p className="text-sm text-slate-300 mt-2">{reviewCount} review{reviewCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Why Customers Trust This Worker</p>
                  <div className="space-y-3">
                    {topHighlights.map(item => (
                      <div key={item} className="flex items-start gap-2 text-sm text-slate-600">
                        <Sparkles className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  {worker.starting_price && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Starting Price</p>
                      <p className="text-xl font-black text-slate-900 mt-2">{worker.starting_price}</p>
                    </div>
                  )}
                </Card>
                {user?.role === 'customer' && (
                  <Button variant="primary" className="w-full" onClick={() => setInviteModal(true)}>
                    <Send className="w-4 h-4" /> Invite to Job
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Overall Rating</p>
            <p className="text-3xl font-black text-slate-900">{Number(worker.avg_rating || 0).toFixed(1)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Jobs Completed</p>
            <p className="text-3xl font-black text-slate-900">{worker.total_jobs_done || 0}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Public Reviews</p>
            <p className="text-3xl font-black text-slate-900">{reviewCount}</p>
          </Card>
        </div>

        {worker.portfolio_photos?.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900 text-xl">Portfolio</h2>
              <span className="text-sm text-slate-400 flex items-center gap-1"><Camera className="w-4 h-4" /> {worker.portfolio_photos.length} photo{worker.portfolio_photos.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {worker.portfolio_photos.map(p => (
                <img key={p.id} src={p.path} alt="" className="aspect-square rounded-2xl object-cover w-full" />
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 text-xl">Reviews</h2>
            <span className="text-sm text-slate-400">{reviewCount} total</span>
          </div>
          {reviewCount === 0 ? (
            <p className="text-sm text-slate-500">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map(r => (
                <div key={r.id} className="rounded-3xl border border-slate-100 p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={r.customer_name} src={r.customer_photo} size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <span className="font-semibold text-slate-900 text-sm">{r.customer_name}</span>
                          {r.job_title && <p className="text-xs text-slate-400 mt-1">Job: {r.job_title}</p>}
                        </div>
                        <span className="text-xs text-slate-400">{formatRelativeTime(r.created_at)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <StarRating rating={r.rating} />
                        <span className="text-sm text-slate-500">{Number(r.rating || 0).toFixed(1)}</span>
                      </div>
                      {r.feedback && <p className="text-sm text-slate-600 mt-3 leading-6">{r.feedback}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

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
