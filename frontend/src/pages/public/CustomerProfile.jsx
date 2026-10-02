import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Calendar, ChevronRight, Clock, MapPin } from 'lucide-react'
import { Badge } from '../../components/shared/UI'
import { IconChip, Page, Skeleton } from '../../components/ui'
import { OwnProfileBar, ProfileEmpty, ProfileHero, ProfileSectionCard, PublicPageChrome } from '../../components/shared/ProfileLayout'
import { formatDate, formatRelativeTime, pluralize } from '../../lib/utils'
import { categoryStyle } from '../../lib/tones'
import api from '../../lib/api'
import { errorStatus, loadFailureHint } from '../../lib/errors'
import { usePageTitle } from '../../hooks/usePageTitle'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { ReportButton } from '../../components/shared/ReportDialog'
import { AppShell } from '../../components/layout/AppShell'
import { PublicFooter } from '../../components/shared/PublicFooter'
import { useAuth } from '../../context/AuthContext'
import { CompletedJobsSection } from '../../components/shared/CompletedJobs'

export default function CustomerProfile() {
  const { id } = useParams()
  const { user } = useAuth()

  const { data: customer, isLoading, error, refetch } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/customers/${id}`).then(r => r.data),
  })
  usePageTitle(customer?.full_name || 'Customer profile')

  const useShell = !!user
  const wrap = (children) => useShell
    ? <AppShell>{children}</AppShell>
    : <div className="min-h-[100dvh] bg-canvas">{children}<PublicFooter /></div>

  if (isLoading) {
    return wrap(
      <Page className="space-y-5" aria-busy="true">
        <Skeleton className="h-64 w-full rounded-card" />
        <Skeleton className="h-48 w-full rounded-card" />
      </Page>,
    )
  }

  if (!customer) {
    const notFound = errorStatus(error) === 404
    return wrap(
      <ErrorFallback
        title={notFound ? 'This customer profile isn’t available' : 'We couldn’t load this profile'}
        description={notFound ? 'The account may have been closed.' : loadFailureHint(error)}
        onRetry={notFound ? undefined : () => refetch()}
      />,
    )
  }

  const recentJobs = customer.recent_jobs || []
  const isOwnProfile = !!user && user.role === 'customer' && String(user.id) === String(id)
  const location = [customer.area, customer.district].filter(Boolean).join(', ')

  return wrap(
    <>
      {!useShell && <PublicPageChrome crumbLabel="Customers" currentLabel={customer.full_name} />}
      <Page width="default">
        {isOwnProfile && <OwnProfileBar audience="workers" />}
        <div className="space-y-5">
          <ProfileHero
            avatarName={customer.full_name}
            avatarSrc={customer.profile_photo}
            title={customer.full_name}
            badges={<span className="rounded-full border border-line bg-subtle px-2.5 py-0.5 text-xs font-semibold text-fg-muted">Customer</span>}
            meta={<>
              {location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-fg-subtle" aria-hidden="true" />{location}</span>}
              <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4 text-fg-subtle" aria-hidden="true" />Joined {formatDate(customer.created_at)}</span>
            </>}
            stats={[
              { label: 'Jobs posted', value: customer.jobs_posted || 0 },
              { label: 'Active now', value: customer.active_jobs || 0 },
              { label: 'Completed', value: customer.jobs_completed || 0 },
              { label: 'Reviews written', value: customer.reviews_given || 0 },
            ]}
          />

          <CompletedJobsSection
            endpoint={`/customers/${customer.id}/jobs`}
            queryKey={['customer-completed-jobs', customer.id]}
            showWorker
            emptyText="No completed jobs yet."
          />

          <ProfileSectionCard title="Open and recent requests" meta={recentJobs.length > 0 ? `${recentJobs.length} shown` : null} bodyClassName={recentJobs.length > 0 ? 'p-0' : undefined}>
            {recentJobs.length === 0 ? (
              <ProfileEmpty icon={Briefcase}>No open or recent requests.</ProfileEmpty>
            ) : (
              <ul className="divide-y divide-line">
                {recentJobs.map(job => {
                  const { icon, tone } = categoryStyle(job.category_name)
                  const canOpen = isOwnProfile || (user?.role === 'worker' && ['posted', 'proposals_received'].includes(job.status))
                  const inner = (
                    <>
                      <IconChip icon={icon} tone={tone} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-fg">{job.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-fg-muted">
                          {job.category_name && <span>{job.category_name}</span>}
                          <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />{pluralize(job.proposal_count, 'proposal')}</span>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />{formatRelativeTime(job.created_at)}</span>
                        </p>
                      </div>
                      <Badge status={job.status} className="hidden sm:inline-flex" />
                      {canOpen && <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />}
                    </>
                  )
                  return (
                    <li key={job.id}>
                      {canOpen
                        ? <Link to={`/jobs/${job.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-subtle sm:px-5">{inner}</Link>
                        : <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">{inner}</div>}
                    </li>
                  )
                })}
              </ul>
            )}
          </ProfileSectionCard>

          {user && !isOwnProfile && (
            <div className="flex justify-end">
              <ReportButton reportedUserId={customer.id} subject={customer.full_name} label="Report this customer" />
            </div>
          )}
        </div>
      </Page>
    </>,
  )
}
