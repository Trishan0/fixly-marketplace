import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BadgeCheck, Calendar, CheckCircle2, MapPin, MessageSquare, Star, Wallet } from 'lucide-react'
import { Avatar, StarRating } from '../../components/shared/UI'
import { Card, CardHeader, IconChip, Page, Skeleton, StatusBadge, buttonClasses } from '../../components/ui'
import { ProfileEmpty, PublicPageChrome } from '../../components/shared/ProfileLayout'
import { AppShell } from '../../components/layout/AppShell'
import { PublicFooter } from '../../components/shared/PublicFooter'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { useAuth } from '../../context/AuthContext'
import { usePageTitle } from '../../hooks/usePageTitle'
import { categoryStyle } from '../../lib/tones'
import { formatCurrency, formatDate } from '../../lib/utils'
import { errorStatus, loadFailureHint } from '../../lib/errors'
import api from '../../lib/api'

// A finished job as anyone sees it from a worker's or customer's job
// history. The parties themselves can jump to the full job page.
export default function CompletedJob() {
  const { id } = useParams()
  const { user } = useAuth()

  const { data: job, isLoading, error, refetch } = useQuery({
    queryKey: ['completed-job', id],
    queryFn: () => api.get(`/jobs/${id}/public`).then(r => r.data),
  })
  usePageTitle(job ? job.title : 'Completed job', {
    description: job ? `${job.title}${job.district ? ` in ${job.district}` : ''}, completed by ${job.worker_name} on Fixly.` : undefined,
  })

  const useShell = !!user
  const wrap = (children) => useShell
    ? <AppShell>{children}</AppShell>
    : <div className="min-h-[100dvh] bg-canvas">{children}<PublicFooter /></div>

  if (isLoading) {
    return wrap(
      <Page className="space-y-5" aria-busy="true">
        <Skeleton className="h-56 w-full rounded-card" />
        <Skeleton className="h-40 w-full rounded-card" />
      </Page>,
    )
  }

  if (!job) {
    const notFound = errorStatus(error) === 404
    return wrap(
      <ErrorFallback
        title={notFound ? 'This job isn’t available' : 'We couldn’t load this job'}
        description={notFound ? 'It may not be finished yet, or it’s no longer public.' : loadFailureHint(error)}
        onRetry={notFound ? undefined : () => refetch()}
      />,
    )
  }

  const { icon, tone } = categoryStyle(job.category_name)
  const place = [job.town, job.district].filter(Boolean).join(', ')
  const photos = job.photos || []
  const isParty = !!user && (user.role === 'admin' || String(user.id) === String(job.customer_id) || String(user.id) === String(job.worker_id))
  const workerRating = Number(job.worker_avg_rating || 0)

  return wrap(
    <>
      {!useShell && <PublicPageChrome crumbLabel={job.worker_name} crumbTo={`/workers/${job.worker_id}`} currentLabel={job.title} />}
      <Page>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-5">
            <Card className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <IconChip icon={icon} tone={tone} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {job.category_name && <span className="text-[13px] font-medium text-fg-muted">{job.category_name}</span>}
                    <StatusBadge tone="emerald">Completed</StatusBadge>
                  </div>
                  <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-fg sm:text-[28px]">{job.title}</h1>
                </div>
              </div>
              <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-muted">
                {place && <Meta icon={MapPin} label="Location">{place}</Meta>}
                <Meta icon={Calendar} label="Posted">{formatDate(job.created_at)}</Meta>
                <Meta icon={CheckCircle2} label="Completed">{formatDate(job.completed_at)}</Meta>
                {job.final_price && <Meta icon={Wallet} label="Final price">{formatCurrency(job.final_price)}</Meta>}
              </dl>
              {job.description && <p className="mt-5 whitespace-pre-line text-[15px] leading-7 text-fg-muted">{job.description}</p>}
              {isParty && (
                <div className="mt-5 border-t border-line pt-4">
                  <Link to={`/jobs/${job.id}`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                    Open full job details <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </Card>

            {photos.length > 0 && (
              <Card>
                <CardHeader title="Photos" />
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5">
                  {photos.map((photo, index) => (
                    <a key={photo.id} href={photo.path} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-control border border-line bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                      <img src={photo.path} alt={`Job photo ${index + 1} of ${photos.length}`} className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    </a>
                  ))}
                </div>
              </Card>
            )}

            <Card>
              <CardHeader title="Customer review" />
              <div className="p-4 sm:p-5">
                {job.review_rating ? (
                  <div className="flex items-start gap-3">
                    <Avatar name={job.customer_name} src={job.customer_photo} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="text-sm font-semibold text-fg">{job.customer_name}</p>
                        <span className="text-xs text-fg-subtle">{formatDate(job.reviewed_at)}</span>
                      </div>
                      <div className="mt-1"><StarRating rating={job.review_rating} /></div>
                      {job.review_feedback && <p className="mt-2 text-sm leading-6 text-fg-muted">{job.review_feedback}</p>}
                    </div>
                  </div>
                ) : (
                  <ProfileEmpty icon={MessageSquare}>The customer hasn’t left a review for this job.</ProfileEmpty>
                )}
              </div>
            </Card>
          </div>

          <aside className="space-y-5">
            <Card className="p-4 sm:p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Done by</p>
              <div className="flex items-center gap-3">
                <Avatar name={job.worker_name} src={job.worker_photo} size="lg" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-fg">
                    {job.worker_name}
                    {job.worker_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-label="ID verified" />}
                  </p>
                  {job.worker_primary_skill && <p className="truncate text-[13px] text-fg-muted">{job.worker_primary_skill}</p>}
                  <p className="mt-0.5 flex items-center gap-1 text-[13px] text-fg-muted">
                    {workerRating > 0 ? <><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />{workerRating.toFixed(1)} · </> : null}
                    {job.worker_jobs_done || 0} jobs done
                  </p>
                </div>
              </div>
              <Link to={`/workers/${job.worker_id}`} className={buttonClasses({ variant: 'secondary', className: 'mt-4 w-full' })}>View profile</Link>
            </Card>

            <Card className="p-4 sm:p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Posted by</p>
              <div className="flex items-center gap-3">
                <Avatar name={job.customer_name} src={job.customer_photo} size="md" />
                <p className="min-w-0 truncate font-semibold text-fg">{job.customer_name}</p>
              </div>
              {/* Customer profiles are for signed-in users only. */}
              {user && (
                <Link to={`/customers/${job.customer_id}`} className={buttonClasses({ variant: 'secondary', className: 'mt-4 w-full' })}>View profile</Link>
              )}
            </Card>
          </aside>
        </div>
      </Page>
    </>,
  )
}

function Meta({ icon: Icon, label, children }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <Icon className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
      <dt className="sr-only">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
