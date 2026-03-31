import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  MapPin, Briefcase, Shield, Send, Star, Camera, ArrowUpRight,
  BadgeCheck, Sparkles, CheckCircle2
} from 'lucide-react'
import { Button, Card, Avatar, StarRating, Spinner, Modal, Select, Textarea } from '../../components/shared/UI'
import {
  ProfileHeroCard,
  ProfilePageIntro,
  ProfileSectionCard,
  ProfileStatPanel,
  PublicPageChrome,
} from '../../components/shared/ProfileLayout'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { formatRelativeTime } from '../../lib/utils'
import api from '../../lib/api'
import { AppShell } from '../../components/layout/AppShell'

export default function WorkerProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const [inviteModal, setInviteModal] = React.useState(false)
  const [jobId, setJobId] = React.useState('')
  const [message, setMessage] = React.useState('')

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
  const useShell = !!user

  const content = (
    <>
      {useShell ? (
        <div className="p-6">
          <ProfilePageIntro
            ownView={isOwnProfile}
            title={isOwnProfile ? 'Public Profile' : worker.full_name}
            subtitle={isOwnProfile ? 'This is how customers see your profile across Fixly.' : 'Worker profile inside your Fixly workspace.'}
          />
          <WorkerProfileBody worker={worker} reviews={reviews} reviewCount={reviewCount} averageRating={averageRating} user={user} onInvite={() => setInviteModal(true)} />
        </div>
      ) : (
        <>
          <PublicPageChrome crumbLabel="Workers" crumbTo="/workers" currentLabel={worker.full_name} />
          <div className="fixly-page max-w-7xl">
            <WorkerProfileBody worker={worker} reviews={reviews} reviewCount={reviewCount} averageRating={averageRating} user={user} onInvite={() => setInviteModal(true)} />
          </div>
        </>
      )}

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

  if (useShell) {
    return (
      <AppShell>
        <div className="min-h-full bg-slate-50">{content}</div>
      </AppShell>
    )
  }

  return <div className="min-h-screen bg-slate-50">{content}</div>
}

function WorkerProfileBody({ worker, reviews, reviewCount, averageRating, user, onInvite }) {
  return (
    <>
      <ProfileHeroCard
        avatarName={worker.full_name}
        avatarSrc={worker.profile_photo}
        header={(
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{worker.full_name}</h1>
              {worker.is_nic_verified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
                  <Shield className="h-3.5 w-3.5" /> Verified
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              {worker.primary_skill && (
                <span className="rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-700">
                  {worker.primary_skill}
                </span>
              )}
              {worker.district && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-slate-400" /> {worker.district}{worker.area ? `, ${worker.area}` : ''}
                </span>
              )}
            </div>
          </div>
        )}
        summary={(
          <>
            <div className="flex flex-wrap gap-6 text-sm text-slate-600">
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
              <p className="max-w-3xl text-[15px] leading-8 text-slate-600">
                {worker.bio}
              </p>
            )}

            {worker.skills?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {worker.skills.map(skill => (
                  <span
                    key={skill.id}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      skill.is_primary ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        stats={(
          <>
            <ProfileStatPanel label="Overall Rating" value={averageRating} hint="Based on completed jobs and customer feedback" accent="sky" />
            <ProfileStatPanel label="Completed Jobs" value={worker.total_jobs_done || 0} hint="Work successfully finished on the platform" accent="emerald" />
            <ProfileStatPanel label="Public Reviews" value={reviewCount} hint="Visible social proof for new customers" accent="amber" />
          </>
        )}
        asideTitle="Professional Snapshot"
        asideContent={(
          <>
            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
              <div className="flex items-end gap-4">
                <span className="text-5xl font-black leading-none text-slate-950">{averageRating}</span>
                <div className="pb-1">
                  <StarRating rating={worker.avg_rating || 0} />
                  <p className="mt-2 text-sm text-slate-500">{reviewCount} review{reviewCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-sky-100 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Starting Price</p>
              <p className="mt-3 text-2xl font-black text-slate-950">{worker.starting_price || 'Ask for quote'}</p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
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

            {user?.role === 'customer' && (
              <Button variant="primary" className="w-full justify-center" onClick={onInvite}>
                <Send className="h-4 w-4" /> Invite to Job
              </Button>
            )}
          </>
        )}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <ProfileSectionCard title="Portfolio" meta={`${worker.portfolio_photos?.length || 0} image${worker.portfolio_photos?.length === 1 ? '' : 's'}`}>
          {worker.portfolio_photos?.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {worker.portfolio_photos.map(photo => (
                <div key={photo.id} className="group overflow-hidden rounded-[1.5rem] bg-slate-100">
                  <img src={photo.path} alt="" className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              <Camera className="mx-auto mb-3 h-5 w-5 text-slate-300" />
              No portfolio photos yet.
            </div>
          )}
        </ProfileSectionCard>

        <ProfileSectionCard title="Customer Reviews" meta={`${reviewCount} total`}>
          {reviewCount === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              No reviews yet.
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <Card key={review.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-5 shadow-none">
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
                        <p className="mt-4 text-sm leading-7 text-slate-600">{review.feedback}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ProfileSectionCard>
      </div>
    </>
  )
}
