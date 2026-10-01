import React from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query'
import { BadgeCheck, Briefcase, Camera, CheckCircle2, MapPin, MessageSquare, Send, ShieldCheck, Star } from 'lucide-react'
import { Avatar, StarRating, Modal, Select, Textarea } from '../../components/shared/UI'
import { Button, Card, IconChip, Page, Skeleton, buttonClasses } from '../../components/ui'
import { OwnProfileBar, ProfileEmpty, ProfileHero, ProfileSectionCard, PublicPageChrome } from '../../components/shared/ProfileLayout'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { formatRelativeTime, formatStartingPrice, pluralize } from '../../lib/utils'
import { categoryStyle } from '../../lib/tones'
import api from '../../lib/api'
import { errorMessage, errorStatus, loadFailureHint } from '../../lib/errors'
import { usePageTitle } from '../../hooks/usePageTitle'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { ReportButton } from '../../components/shared/ReportDialog'
import { AppShell } from '../../components/layout/AppShell'
import { CompletedJobsSection } from '../../components/shared/CompletedJobs'
import { PublicFooter } from '../../components/shared/PublicFooter'

const REVIEW_PAGE_SIZE = 10

export default function WorkerProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const [inviteModal, setInviteModal] = React.useState(false)
  const [jobId, setJobId] = React.useState('')
  const [message, setMessage] = React.useState('')

  const { data: worker, isLoading, error, refetch } = useQuery({
    queryKey: ['worker', id],
    queryFn: () => api.get(`/workers/${id}`).then(r => r.data),
  })
  usePageTitle(worker ? `${worker.full_name}${worker.primary_skill ? `, ${worker.primary_skill}` : ''}` : 'Worker profile', {
    description: worker
      ? [
          `Hire ${worker.full_name}${worker.primary_skill ? ` for ${worker.primary_skill}` : ''}${worker.district ? ` in ${worker.district}` : ''} on Fixly.`,
          Number(worker.avg_rating) > 0 ? `Rated ${Number(worker.avg_rating).toFixed(1)} out of 5.` : '',
          worker.total_jobs_done ? `${worker.total_jobs_done} jobs completed.` : '',
          worker.is_nic_verified ? 'ID verified.' : '',
        ].filter(Boolean).join(' ')
      : undefined,
  })

  const reviewsQuery = useInfiniteQuery({
    queryKey: ['worker-reviews', id],
    queryFn: ({ pageParam }) => api.get(`/workers/${id}/reviews`, { params: { page: pageParam, limit: REVIEW_PAGE_SIZE } }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.length === REVIEW_PAGE_SIZE ? pages.length + 1 : undefined),
    enabled: Boolean(worker),
  })
  const reviews = reviewsQuery.data?.pages.flat() || []

  const { data: myJobs = [] } = useQuery({
    queryKey: ['my-jobs', 'invitable'],
    queryFn: () => api.get('/jobs/my', { params: { group: 'active', limit: 100 } }).then(r => r.data.filter(j => ['posted', 'proposals_received'].includes(j.status))),
    enabled: !!user && user.role === 'customer',
  })

  const sendInvite = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/invites`, { worker_id: id, message }),
    meta: { track: 'invite_sent', trackProps: () => ({ from: 'worker_profile' }) },
    onSuccess: () => {
      setInviteModal(false)
      setJobId('')
      setMessage('')
      toast({ title: `Invite sent to ${worker.full_name}`, description: 'We’ll notify you when they respond.', variant: 'success' })
    },
    onError: (e) => toast({ title: 'Invite not sent', description: errorMessage(e), variant: 'error' }),
  })

  const useShell = !!user
  const wrap = (children) => useShell
    ? <AppShell>{children}</AppShell>
    : <div className="min-h-[100dvh] bg-canvas">{children}<PublicFooter /></div>

  if (isLoading) {
    return wrap(
      <Page className="space-y-5" aria-busy="true">
        <Skeleton className="h-72 w-full rounded-card" />
        <Skeleton className="h-48 w-full rounded-card" />
      </Page>,
    )
  }

  if (!worker) {
    const notFound = errorStatus(error) === 404
    return wrap(
      <ErrorFallback
        title={notFound ? 'This worker profile isn’t available' : 'We couldn’t load this profile'}
        description={notFound ? 'The worker may have closed their account. Browse other workers nearby.' : loadFailureHint(error)}
        onRetry={notFound ? undefined : () => refetch()}
      />,
    )
  }

  const reviewCount = Number(worker.review_count ?? reviews.length)
  const isOwnProfile = !!user && user.role === 'worker' && String(user.id) === String(id)
  const body = <WorkerProfileBody worker={worker} reviews={reviews} reviewsQuery={reviewsQuery} reviewCount={reviewCount} user={user} isOwnProfile={isOwnProfile} onInvite={() => setInviteModal(true)} />

  return wrap(
    <>
      {!useShell && <PublicPageChrome crumbLabel="Workers" crumbTo="/workers" currentLabel={worker.full_name} />}
      <Page>
        {isOwnProfile && <OwnProfileBar audience="customers" />}
        {body}
      </Page>

      <Modal open={inviteModal} onClose={() => setInviteModal(false)} title={`Invite ${worker.full_name}`}>
        <div className="space-y-4">
          {myJobs.length === 0 ? (
            <div className="py-4 text-center">
              <p className="mb-4 text-sm text-fg-muted">You have no open jobs to invite this worker to.</p>
              <Button to={`/jobs/new?invite=${worker.id}`} onClick={() => setInviteModal(false)}>
                Post a job and invite {worker.full_name.split(' ')[0]}
              </Button>
            </div>
          ) : (
            <>
              <Select label="Job" value={jobId} onChange={e => setJobId(e.target.value)}>
                <option value="">Choose a job…</option>
                {myJobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}
              </Select>
              <Textarea
                label="Message (optional)"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell the worker why you’d like them on this job."
                rows={3}
              />
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setInviteModal(false)}>Cancel</Button>
                <Button onClick={() => sendInvite.mutate()} loading={sendInvite.isPending} disabled={!jobId}>Send invite</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>,
  )
}

function WorkerProfileBody({ worker, reviews, reviewsQuery, reviewCount, user, isOwnProfile, onInvite }) {
  const location = useLocation()
  const rating = Number(worker.avg_rating || 0)
  const price = formatStartingPrice(worker.starting_price)
  const firstName = worker.full_name.split(' ')[0]
  const { icon: skillIcon, tone: skillTone } = categoryStyle(worker.primary_skill)
  const photos = worker.portfolio_photos || []
  const otherSkills = (worker.skills || []).filter(skill => !skill.is_primary && (skill.category_name || skill.name))

  const primaryAction = user?.role === 'customer'
    ? <Button onClick={onInvite}><Send className="h-4 w-4" aria-hidden="true" /> Invite to a job</Button>
    : !user
      ? <Link to={`/auth?tab=register&role=customer&next=${encodeURIComponent(location.pathname)}`} className={buttonClasses()}><Send className="h-4 w-4" aria-hidden="true" /> Sign up to invite {firstName}</Link>
      : null

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-5">
        <ProfileHero
          avatarName={worker.full_name}
          avatarSrc={worker.profile_photo}
          title={worker.full_name}
          badges={worker.is_nic_verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> ID verified
            </span>
          )}
          actions={!isOwnProfile && primaryAction && <div className="lg:hidden">{primaryAction}</div>}
          meta={<>
            {worker.primary_skill && (
              <span className="inline-flex items-center gap-1.5 font-medium text-fg">
                <IconChip icon={skillIcon} tone={skillTone} size="sm" className="h-6 w-6 rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5" />
                {worker.primary_skill}
              </span>
            )}
            {worker.district && (
              <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-fg-subtle" aria-hidden="true" />{worker.district}{worker.area ? `, ${worker.area}` : ''}</span>
            )}
          </>}
          stats={[
            { label: 'Rating', value: rating ? rating.toFixed(1) : 'New', icon: rating ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" /> : null },
            { label: 'Jobs done', value: worker.total_jobs_done || 0 },
            { label: 'Reviews', value: reviewCount },
            { label: 'Starting from', value: price || 'On request' },
          ]}
        >
          {worker.bio && <p className="mt-4 max-w-3xl whitespace-pre-line text-[15px] leading-7 text-fg-muted">{worker.bio}</p>}
          {otherSkills.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-fg-subtle">Also does</span>
              {otherSkills.map(skill => (
                <span key={skill.id} className="rounded-full border border-line bg-subtle px-2.5 py-1 text-xs font-medium text-fg-muted">{skill.category_name || skill.name}</span>
              ))}
            </div>
          )}
        </ProfileHero>

        <ProfileSectionCard title="Portfolio" meta={pluralize(photos.length, 'photo')}>
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {photos.map((photo, index) => (
                <a key={photo.id} href={photo.path} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-control border border-line bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <img src={photo.path} alt={`Portfolio photo ${index + 1}`} className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </a>
              ))}
            </div>
          ) : (
            <ProfileEmpty icon={Camera}>{isOwnProfile ? <>No portfolio photos yet. <Link to="/profile/edit" className="font-semibold text-brand-text hover:underline">Add some</Link> to win more jobs.</> : 'No portfolio photos yet.'}</ProfileEmpty>
          )}
        </ProfileSectionCard>

        <CompletedJobsSection
          endpoint={`/workers/${worker.id}/jobs`}
          queryKey={['worker-completed-jobs', worker.id]}
          emptyText={isOwnProfile ? 'Jobs you finish on Fixly will show here.' : `${firstName} hasn’t finished a job on Fixly yet.`}
        />

        <ProfileSectionCard title="Reviews" meta={reviewCount > 0 ? `${rating.toFixed(1)} average · ${pluralize(reviewCount, 'review')}` : null} bodyClassName={reviewCount > 0 ? 'p-0' : undefined}>
          {reviewCount === 0 ? (
            <ProfileEmpty icon={MessageSquare}>No reviews yet.</ProfileEmpty>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {reviews.map(review => (
                  <li key={review.id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                    <Avatar name={review.customer_name} src={review.customer_photo} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="text-sm font-semibold text-fg">{review.customer_name}</p>
                        <span className="text-xs text-fg-subtle">{formatRelativeTime(review.created_at)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StarRating rating={review.rating} />
                        {review.job_title && <span className="truncate text-xs text-fg-subtle">· {review.job_title}</span>}
                      </div>
                      {review.feedback && <p className="mt-2 text-sm leading-6 text-fg-muted">{review.feedback}</p>}
                    </div>
                  </li>
                ))}
              </ul>
              {reviewsQuery.hasNextPage && (
                <div className="flex justify-center border-t border-line p-3">
                  <Button variant="secondary" size="sm" onClick={() => reviewsQuery.fetchNextPage()} loading={reviewsQuery.isFetchingNextPage}>Show more reviews</Button>
                </div>
              )}
            </>
          )}
        </ProfileSectionCard>
      </div>

      <aside className="space-y-5">
        {!isOwnProfile && (
          <Card className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Starting from</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-fg">{price || 'Quote on request'}</p>
            <p className="mt-1 text-[13px] text-fg-muted">Final price is agreed with {firstName} after they see the job.</p>
            {primaryAction && <div className="mt-4 hidden lg:block [&>*]:w-full">{primaryAction}</div>}
          </Card>
        )}
        <Card className="p-4 sm:p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Why customers trust {firstName}</p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2.5">
              <ShieldCheck className={worker.is_nic_verified ? 'mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400' : 'mt-0.5 h-4 w-4 shrink-0 text-fg-subtle'} aria-hidden="true" />
              <span className="text-fg-muted">{worker.is_nic_verified ? 'National ID checked by Fixly' : 'ID not verified yet'}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span className="text-fg-muted">{pluralize(worker.total_jobs_done || 0, 'job')} completed on Fixly</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              <span className="text-fg-muted">{rating > 0 ? `Rated ${rating.toFixed(1)} out of 5${reviewCount > 0 ? ` by ${pluralize(reviewCount, 'customer')}` : ''}` : 'No ratings yet'}</span>
            </li>
          </ul>
          {user && !isOwnProfile && (
            <div className="mt-4 border-t border-line pt-3">
              <ReportButton reportedUserId={worker.id} subject={worker.full_name} label="Report this worker" />
            </div>
          )}
        </Card>
      </aside>
    </div>
  )
}
