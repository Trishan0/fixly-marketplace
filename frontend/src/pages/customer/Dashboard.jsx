import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Banknote, Briefcase, ChevronRight, ClipboardList, MessagesSquare, Plus } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Card, CardHeader, EmptyState, JobStatusBadge, Page, PageHeader, RowLink, Skeleton, Table, Td, Th } from '../../components/ui'
import { EmailVerificationNotice } from '../../components/shared/EmailVerificationNotice'
import { useAuth } from '../../context/AuthContext'
import { usePageTitle } from '../../hooks/usePageTitle'
import { cn, formatCurrency, formatRelativeTime, pluralize } from '../../lib/utils'
import { jobPriceLabel, shortDate } from '../../lib/jobs'
import { notificationTarget } from '../../lib/notifications'
import api from '../../lib/api'

function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function Stat({ label, value, hint, to }) {
  const body = (
    <>
      <p className="text-[13px] text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-fg tabular-nums">
        {value ?? <Skeleton className="mt-1 h-7 w-16" />}
      </p>
      {hint && <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>}
    </>
  )
  return to
    ? <Link to={to} className="block bg-surface px-4 py-4 transition-colors hover:bg-subtle sm:px-5">{body}</Link>
    : <div className="bg-surface px-4 py-4 sm:px-5">{body}</div>
}

function AttentionItem({ icon: Icon, title, detail, to, action }) {
  return (
    <li>
      <Link to={to} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle/60 sm:px-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-brand-subtle text-brand-text">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{title}</span>
          <span className="block truncate text-[13px] text-fg-muted">{detail}</span>
        </span>
        <span className="hidden shrink-0 text-[13px] font-medium text-brand-text group-hover:underline sm:inline">{action}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle sm:hidden" aria-hidden="true" />
      </Link>
    </li>
  )
}

export default function CustomerDashboard() {
  const { user } = useAuth()
  usePageTitle('Dashboard')

  const { data: summary } = useQuery({
    queryKey: ['my-jobs', 'summary'],
    queryFn: () => api.get('/jobs/my/summary').then(r => r.data),
  })
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['my-jobs', 'recent'],
    queryFn: () => api.get('/jobs/my', { params: { limit: 6 } }).then(r => r.data),
  })
  const { data: reviewJobs = [] } = useQuery({
    queryKey: ['my-jobs', 'awaiting-review'],
    queryFn: () => api.get('/jobs/my', { params: { status: 'proposals_received', limit: 5 } }).then(r => r.data),
  })
  const { data: unpaidJobs = [] } = useQuery({
    queryKey: ['my-jobs', 'awaiting-payment'],
    queryFn: () => api.get('/jobs/my', { params: { status: 'completed', limit: 5 } }).then(r => r.data),
  })
  const { data: messages } = useQuery({
    queryKey: ['messages-unread'],
    queryFn: () => api.get('/messages/unread-count').then(r => r.data),
  })
  const { data: notifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 30000,
  })

  const attention = [
    ...reviewJobs
      .filter(job => Number(job.pending_proposal_count) > 0)
      .map(job => ({
        key: `review-${job.id}`,
        icon: ClipboardList,
        title: `${pluralize(job.pending_proposal_count, 'proposal')} to review`,
        detail: job.title,
        to: `/jobs/${job.id}`,
        action: 'Review',
      })),
    ...unpaidJobs.map(job => ({
      key: `pay-${job.id}`,
      icon: Banknote,
      title: 'Record the payment',
      detail: `${job.title}${job.assigned_worker_name ? ` · ${job.assigned_worker_name}` : ''}`,
      to: `/jobs/${job.id}`,
      action: 'Record payment',
    })),
    ...(messages?.unread > 0 ? [{
      key: 'messages',
      icon: MessagesSquare,
      title: `${pluralize(messages.unread, 'unread message')}`,
      detail: 'Reply to keep your jobs moving',
      to: '/messages',
      action: 'Open messages',
    }] : []),
  ]
  const activity = (notifs?.notifications || []).slice(0, 5)

  return (
    <AppShell>
      <Page>
        <PageHeader
          title={`${greeting()}, ${user?.full_name?.split(' ')[0] || 'there'}`}
          description="Here’s what’s happening with your jobs."
          actions={<Button to="/jobs/new"><Plus className="h-4 w-4" aria-hidden="true" /> Post a job</Button>}
        />

        <div className="space-y-6">
          <EmailVerificationNotice />

          {/* 1px gaps over the border colour draw the dividers between stats. */}
          <Card as="div" className="grid grid-cols-2 gap-px overflow-hidden bg-line lg:grid-cols-4">
            <Stat label="Active jobs" value={summary?.active} to="/jobs" />
            <Stat label="Proposals to review" value={summary?.awaiting_review} />
            <Stat label="Completed" value={summary?.completed} />
            <Stat label="Total paid" value={summary ? formatCurrency(Number(summary.total_spent)) : undefined} hint="Payments you recorded" />
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Card aria-labelledby="recent-jobs-heading">
              <CardHeader
                id="recent-jobs-heading"
                title="Recent jobs"
                actions={<Link to="/jobs" className="text-[13px] font-medium text-brand-text hover:underline">View all</Link>}
              />
              {jobsLoading ? (
                <div className="space-y-3 p-5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : jobs.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title="No jobs yet"
                  description="Post your first job and local workers will start sending proposals."
                  action={<Button to="/jobs/new" size="sm"><Plus className="h-4 w-4" aria-hidden="true" /> Post a job</Button>}
                />
              ) : (
                <>
                  <div className="hidden sm:block">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Job</Th>
                          <Th>Status</Th>
                          <Th align="right">Price</Th>
                          <Th align="right">Posted</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map(job => (
                          <RowLink key={job.id}>
                            <Td className="max-w-0 w-full">
                              <Link to={`/jobs/${job.id}`} className="block truncate font-medium text-fg after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand">
                                {job.title}
                              </Link>
                              <span className="block truncate text-[13px] text-fg-muted">
                                {[job.category_name, job.town || job.district].filter(Boolean).join(' · ')}
                                {Number(job.pending_proposal_count) > 0 && <span className="font-medium text-brand-text"> · {pluralize(job.pending_proposal_count, 'new proposal')}</span>}
                              </span>
                            </Td>
                            <Td><JobStatusBadge status={job.status} /></Td>
                            <Td align="right" className="whitespace-nowrap text-fg-muted">{jobPriceLabel(job)}</Td>
                            <Td align="right" className="whitespace-nowrap text-fg-muted" title={new Date(job.created_at).toLocaleString('en-LK')}>{shortDate(job.created_at)}</Td>
                          </RowLink>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                  <ul className="divide-y divide-line sm:hidden">
                    {jobs.map(job => (
                      <li key={job.id}>
                        <Link to={`/jobs/${job.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle/60">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-fg">{job.title}</span>
                            <span className="mt-1 flex items-center gap-2 text-[13px] text-fg-muted">
                              <JobStatusBadge status={job.status} />
                              <span className="truncate">{jobPriceLabel(job)}</span>
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <div className="space-y-6">
              <Card aria-labelledby="attention-heading">
                <CardHeader id="attention-heading" title="Needs your attention" />
                {attention.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-fg-muted sm:px-5">You’re all caught up.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {attention.map(({ key, ...item }) => <AttentionItem key={key} {...item} />)}
                  </ul>
                )}
              </Card>

              <Card aria-labelledby="activity-heading">
                <CardHeader
                  id="activity-heading"
                  title="Recent activity"
                  actions={<Link to="/notifications" className="text-[13px] font-medium text-brand-text hover:underline">View all</Link>}
                />
                {activity.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-fg-muted sm:px-5">Updates about your jobs will appear here.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {activity.map(n => (
                      <li key={n.id}>
                        <Link to={notificationTarget(n) || '/notifications'} className="flex gap-3 px-4 py-3 hover:bg-subtle/60 sm:px-5">
                          <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-brand')} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className={cn('block truncate text-sm', n.is_read ? 'text-fg-muted' : 'font-medium text-fg')}>{n.title}</span>
                            <span className="block text-xs text-fg-subtle">{formatRelativeTime(n.created_at)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      </Page>
    </AppShell>
  )
}
