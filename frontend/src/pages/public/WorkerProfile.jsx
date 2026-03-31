import React, { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  MapPin, Briefcase, Shield, Send, Star, Camera, ArrowUpRight,
  BadgeCheck, Sparkles, CheckCircle2, MoreHorizontal, Settings, Pencil, LogOut
} from 'lucide-react'
import { Button, Card, Avatar, Badge, StarRating, Spinner, Modal, Select, Textarea } from '../../components/shared/UI'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { formatRelativeTime } from '../../lib/utils'
import api from '../../lib/api'
import { Wrench } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'

function StatPanel({ label, value, hint, accent = 'sky' }) {
  const accents = {
    sky: 'bg-[linear-gradient(180deg,#f8fdff_0%,#eef8ff_100%)] border-sky-100/80',
    amber: 'bg-[linear-gradient(180deg,#fffdf7_0%,#fff7e6_100%)] border-amber-100/80',
    emerald: 'bg-[linear-gradient(180deg,#f7fffb_0%,#ecfdf3_100%)] border-emerald-100/80',
  }

  return (
    <div className={`rounded-[1.75rem] border p-5 ${accents[accent]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
      {hint && <p className="mt-2 text-sm text-slate-500">{hint}</p>}
    </div>
  )
}

export default function WorkerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const [inviteModal, setInviteModal] = useState(false)
  const [jobId, setJobId] = useState('')
  const [message, setMessage] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

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
    onSuccess: () => {
      setInviteModal(false)
      toast({ title: 'Invite sent!', variant: 'success' })
    },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  useEffect(() => {
    if (!menuOpen) return undefined
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    )
  }

  if (!worker) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Worker not found</p>
      </div>
    )
  }

  const reviewCount = reviews.length
  const averageRating = Number(worker.avg_rating || 0).toFixed(1)
  const isOwnProfile = !!user && user.role === 'worker' && String(user.id) === String(id)

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  const content = (
    <>
      {isOwnProfile ? (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Profile</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Public Profile</h1>
            <p className="mt-1 text-sm text-slate-500">This is how customers see your profile across Fixly.</p>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-14 z-20 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                <Link
                  to="/profile/edit"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <Pencil className="h-4 w-4" /> Edit Profile
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <nav className="border-b border-white/70 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600">
                <Wrench className="h-4 w-4 text-white" />
              </div>
              <span className="font-black text-slate-950" style={{ fontFamily: 'Syne, sans-serif' }}>Fixly</span>
            </Link>
            <span className="text-slate-300">/</span>
            <Link to="/workers" className="text-sm text-slate-500 hover:text-slate-900">Workers</Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-800">{worker.full_name}</span>
          </div>
        </nav>
      )}

      <div className={isOwnProfile ? 'p-6' : 'mx-auto max-w-6xl px-6 py-8'}>
        <Card className="overflow-hidden border-white/90 bg-white/90 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="grid gap-0 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="relative p-8 lg:p-10">
              <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(120deg,rgba(228,244,255,0.95)_0%,rgba(117,214,255,0.78)_44%,rgba(191,243,233,0.75)_100%)]" />
              <div className="relative">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                  <Avatar
                    name={worker.full_name}
                    src={worker.profile_photo}
                    size="xl"
                    className="ring-4 ring-white shadow-[0_20px_40px_rgba(15,23,42,0.15)]"
                  />

                  <div className="min-w-0 flex-1 pt-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-4xl font-black tracking-tight text-slate-950">{worker.full_name}</h1>
                      {worker.is_nic_verified && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
                          <Shield className="h-3.5 w-3.5" /> Verified
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      {worker.primary_skill && (
                        <span className="rounded-full border border-sky-200 bg-white/90 px-3 py-1 font-semibold text-sky-700 shadow-sm">
                          {worker.primary_skill}
                        </span>
                      )}
                      {worker.district && (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <MapPin className="h-4 w-4" /> {worker.district}{worker.area ? `, ${worker.area}` : ''}
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-6 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-slate-400" />
                        <strong className="font-semibold text-slate-900">{worker.total_jobs_done || 0}</strong> jobs completed
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <BadgeCheck className="h-4 w-4 text-emerald-600" />
                        <strong className="font-semibold text-slate-900">{reviewCount}</strong> public review{reviewCount !== 1 ? 's' : ''}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <strong className="font-semibold text-slate-900">{averageRating}</strong> overall rating
                      </span>
                    </div>

                    {worker.bio && (
                      <p className="mt-6 max-w-3xl text-[15px] leading-8 text-slate-600">
                        {worker.bio}
                      </p>
                    )}

                    {worker.skills?.length > 0 && (
                      <div className="mt-6 flex flex-wrap gap-2">
                        {worker.skills.map(skill => (
                          <span
                            key={skill.id}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              skill.is_primary
                                ? 'bg-sky-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {skill.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-[linear-gradient(180deg,#fbfdff_0%,#f3f9ff_100%)] p-8 xl:border-l xl:border-t-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-500">Professional Snapshot</p>

              <div className="mt-6">
                <div className="flex items-end gap-4">
                  <span className="text-6xl font-black leading-none text-slate-950">{averageRating}</span>
                  <div className="pb-1">
                    <StarRating rating={worker.avg_rating || 0} />
                    <p className="mt-2 text-sm text-slate-500">{reviewCount} review{reviewCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="rounded-[1.5rem] border border-sky-100 bg-white p-5 shadow-[0_14px_30px_rgba(14,165,233,0.08)]">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Starting Price</p>
                  <p className="mt-3 text-2xl font-black text-slate-950">{worker.starting_price || 'Ask for quote'}</p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-100 bg-white/90 p-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Trust Signals</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" />
                      <span>{worker.is_nic_verified ? 'Identity verified on Fixly' : 'Profile active on Fixly'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                      <span>{worker.total_jobs_done || 0} completed job{worker.total_jobs_done === 1 ? '' : 's'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ArrowUpRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-500" />
                      <span>{reviewCount} review-based rating footprint</span>
                    </div>
                  </div>
                </div>
              </div>

              {user?.role === 'customer' && (
                <Button variant="primary" className="mt-8 w-full justify-center shadow-[0_12px_24px_rgba(14,165,233,0.22)]" onClick={() => setInviteModal(true)}>
                  <Send className="h-4 w-4" /> Invite to Job
                </Button>
              )}
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatPanel label="Overall Rating" value={averageRating} hint="Based on completed jobs and customer feedback" accent="sky" />
          <StatPanel label="Completed Jobs" value={worker.total_jobs_done || 0} hint="Work successfully finished on the platform" accent="emerald" />
          <StatPanel label="Public Reviews" value={reviewCount} hint="Visible social proof for new customers" accent="amber" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="overflow-hidden border-white/80 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">Portfolio</h2>
              <span className="inline-flex items-center gap-1 text-sm text-slate-400">
                <Camera className="h-4 w-4" /> {worker.portfolio_photos?.length || 0} image{worker.portfolio_photos?.length === 1 ? '' : 's'}
              </span>
            </div>

            {worker.portfolio_photos?.length > 0 ? (
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                {worker.portfolio_photos.map(photo => (
                  <div key={photo.id} className="group overflow-hidden rounded-[1.75rem] bg-slate-100">
                    <img
                      src={photo.path}
                      alt=""
                      className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                No portfolio photos yet.
              </div>
            )}
          </Card>

          <Card className="border-white/80 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">Customer Reviews</h2>
              <span className="text-sm text-slate-400">{reviewCount} total</span>
            </div>

            {reviewCount === 0 ? (
              <div className="mt-5 rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                No reviews yet.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {reviews.map(review => (
                  <div key={review.id} className="rounded-[1.75rem] border border-slate-100 bg-slate-50/70 p-5">
                    <div className="flex items-start gap-3">
                      <Avatar name={review.customer_name} src={review.customer_photo} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{review.customer_name}</p>
                            {review.job_title && <p className="mt-1 text-xs text-slate-400">Job: {review.job_title}</p>}
                          </div>
                          <span className="text-xs text-slate-400">{formatRelativeTime(review.created_at)}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <StarRating rating={review.rating} />
                          <span className="text-sm font-medium text-slate-500">{Number(review.rating || 0).toFixed(1)}</span>
                        </div>
                        {review.feedback && (
                          <p className="mt-4 text-sm leading-7 text-slate-600">
                            {review.feedback}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal open={inviteModal} onClose={() => setInviteModal(false)} title={`Invite ${worker.full_name}`}>
        <div className="space-y-4">
          {myJobs.length === 0 ? (
            <div className="py-4 text-center">
              <p className="mb-4 text-sm text-slate-500">You have no active jobs to invite this worker to.</p>
              <Link to="/jobs/new" onClick={() => setInviteModal(false)}>
                <Button variant="primary">Post a Job First</Button>
              </Link>
            </div>
          ) : (
            <>
              <Select label="Select Job" value={jobId} onChange={e => setJobId(e.target.value)}>
                <option value="">Select a job...</option>
                {myJobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}
              </Select>
              <Textarea
                label="Message (optional)"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell the worker why you'd like them on this job..."
                rows={3}
              />
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
    </>
  )

  if (isOwnProfile) {
    return (
      <AppShell>
        <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.10),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(45,212,191,0.09),_transparent_24%),linear-gradient(180deg,#f8fbff_0%,#f6f9fc_100%)]">
          {content}
        </div>
      </AppShell>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.10),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(45,212,191,0.09),_transparent_24%),linear-gradient(180deg,#f8fbff_0%,#f6f9fc_100%)]">
      {content}
    </div>
  )
}
