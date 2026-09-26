import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Banknote, Briefcase, CheckCircle2, ChevronRight, Inbox, MessagesSquare, Plus, Search, Wallet } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Card, CardHeader, EmptyState, IconChip, JobStatusBadge, Page, RowLink, Skeleton, Table, Td, Th } from '../../components/ui'
import { EmailVerificationNotice } from '../../components/shared/EmailVerificationNotice'
import { useAuth } from '../../context/AuthContext'
import { usePageTitle } from '../../hooks/usePageTitle'
import { cn, formatCurrency, formatRelativeTime, pluralize } from '../../lib/utils'
import { jobPriceLabel, shortDate } from '../../lib/jobs'
import { categoryStyle } from '../../lib/tones'
import { notificationTarget, NOTIFICATION_STYLES, DEFAULT_NOTIFICATION_STYLE } from '../../lib/notifications'
import api from '../../lib/api'

function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function Welcome({ name, summaryLine }) {
  const today = new Date().toLocaleDateString('en-LK', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <section className="relative overflow-hidden rounded-card bg-gradient-to-br from-sky-500 via-sky-600 to-sky-700 px-5 py-6 text-white shadow-brand sm:px-7 sm:py-7">
      {/* Quiet brand shapes echoing the logo's rounded square. */}
      <span className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rotate-12 rounded-[3rem] border border-white/15" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-20 right-24 h-44 w-44 -rotate-6 rounded-[2.5rem] bg-white/[0.07]" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[13px] font-medium text-sky-100">{today}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">{greeting()}, {name}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-sky-50/90">
            {summaryLine || 'You’re all caught up. Post a new job whenever you need a hand.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button to="/jobs/new" variant="on-brand"><Plus className="h-4 w-4" aria-hidden="true" /> Post a job</Button>
          <Button to="/find-workers" variant="on-brand-ghost"><Search className="h-4 w-4" aria-hidden="true" /> Find workers</Button>
        </div>
      </div>
    </section>
  )
}

function StatCard({ icon, tone, label, value, note, to }) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <IconChip icon={icon} tone={tone} />
        {to && <ArrowRight className="h-4 w-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true" />}
      </div>
      <p className="mt-4 text-[13px] font-medium text-fg-muted">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-[22px] font-bold leading-tight tracking-tight text-fg tabular-nums sm:text-[28px]">
        {value ?? <Skeleton className="mt-1 h-8 w-20" />}
      </p>
      {note && <p className="mt-1 text-xs text-fg-subtle">{note}</p>}
    </>
  )
  const classes = 'group block rounded-card border border-line/80 bg-surface p-4 shadow-card transition-all sm:p-5'
  return to
    ? <Link to={to} className={cn(classes, 'hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand')}>{content}</Link>
    : <div className={classes}>{content}</div>
}

function AttentionItem({ icon, tone, title, detail, to, action }) {
  return (
    <li>
      <Link to={to} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-brand-subtle/50 sm:px-5">
        <IconChip icon={icon} tone={tone} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-fg">{title}</span>
          <span className="block truncate text-[13px] text-fg-muted">{detail}</span>
        </span>
        <span className="hidden shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-semibold text-brand-text ring-1 ring-inset ring-sky-600/20 transition-colors group-hover:bg-brand group-hover:text-brand-on sm:inline">{action}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle sm:hidden" aria-hidden="true" />
      </Link>
    </li>
  )
}

function JobTitleCell({ job }) {
  const { icon, tone } = categoryStyle(job.category_name)
  return (
    <div className="flex min-w-0 items-center gap-3">
      <IconChip icon={icon} tone={tone} size="sm" />
      <div className="min-w-0">
        <Link to={`/jobs/${job.id}`} className="block truncate font-semibold text-fg after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand">
          {job.title}
        </Link>
        <span className="block truncate text-[13px] text-fg-muted">
          {[job.category_name, job.town || job.district].filter(Boolean).join(' · ')}
          {Number(job.pending_proposal_count) > 0 && <span className="font-semibold text-indigo-600 dark:text-indigo-300"> · {pluralize(job.pending_proposal_count, 'new proposal')}</span>}
        </span>
      </div>
    </div>
  )
}

function joinWithAnd(parts) {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
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

  const proposalJobs = reviewJobs.filter(job => Number(job.pending_proposal_count) > 0)
  const unreadMessages = messages?.unread || 0
  const attention = [
    ...proposalJobs.map(job => ({
      key: `review-${job.id}`, icon: Inbox, tone: 'indigo',
      title: `${pluralize(job.pending_proposal_count, 'proposal')} to review`,
      detail: job.title, to: `/jobs/${job.id}`, action: 'Review',
    })),
    ...unpaidJobs.map(job => ({
      key: `pay-${job.id}`, icon: Banknote, tone: 'amber',
      title: 'Record the payment',
      detail: `${job.title}${job.assigned_worker_name ? ` · ${job.assigned_worker_name}` : ''}`,
      to: `/jobs/${job.id}`, action: 'Record',
    })),
    ...(unreadMessages > 0 ? [{
      key: 'messages', icon: MessagesSquare, tone: 'sky',
      title: pluralize(unreadMessages, 'unread message'),
      detail: 'Reply to keep your jobs moving', to: '/messages', action: 'Open',
    }] : []),
  ]

  const pendingProposals = proposalJobs.reduce((sum, job) => sum + Number(job.pending_proposal_count), 0)
  const summaryParts = [
    pendingProposals > 0 && `${pluralize(pendingProposals, 'proposal')} to review`,
    unpaidJobs.length > 0 && `${pluralize(unpaidJobs.length, 'payment')} to record`,
    unreadMessages > 0 && pluralize(unreadMessages, 'unread message'),
  ].filter(Boolean)
  const summaryLine = summaryParts.length ? `You have ${joinWithAnd(summaryParts)}.` : ''
  const activity = (notifs?.notifications || []).slice(0, 5)

  return (
    <AppShell>
      <Page>
        <div className="space-y-6">
          <Welcome name={user?.full_name?.split(' ')[0] || 'there'} summaryLine={summaryLine} />
          <EmailVerificationNotice />

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard icon={Briefcase} tone="sky" label="Active jobs" value={summary?.active} note="Open or in progress" to="/jobs" />
            <StatCard icon={Inbox} tone="indigo" label="Proposals to review" value={summary?.awaiting_review} note={summary?.awaiting_review ? 'Waiting for your decision' : 'Nothing waiting'} />
            <StatCard icon={CheckCircle2} tone="emerald" label="Completed" value={summary?.completed} note="All time" />
            <StatCard icon={Wallet} tone="amber" label="Total paid" value={summary ? formatCurrency(Number(summary.total_spent)) : undefined} note="Payments you recorded" />
          </div>

          {/* Phones read top to bottom: what needs attention, then recent jobs.
              On desktop, jobs sit on the left with attention and activity on the right. */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr]">
            <Card aria-labelledby="attention-heading" className="self-start lg:col-start-2 lg:row-start-1">
              <CardHeader
                id="attention-heading"
                title="Needs your attention"
                actions={attention.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{attention.length}</span>}
              />
              {attention.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-8 text-center">
                  <IconChip icon={CheckCircle2} tone="emerald" />
                  <p className="mt-3 text-sm font-semibold text-fg">You’re all caught up</p>
                  <p className="mt-0.5 text-[13px] text-fg-muted">Anything that needs you will show up here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {attention.map(({ key, ...item }) => <AttentionItem key={key} {...item} />)}
                </ul>
              )}
            </Card>

            <Card aria-labelledby="recent-jobs-heading" className="self-start lg:col-start-1 lg:row-span-2 lg:row-start-1">
              <CardHeader
                id="recent-jobs-heading"
                title="Recent jobs"
                actions={<Link to="/jobs" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-text hover:underline">View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
              />
              {jobsLoading ? (
                <div className="space-y-3 p-5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
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
                            <Td className="w-full max-w-0"><JobTitleCell job={job} /></Td>
                            <Td><JobStatusBadge status={job.status} /></Td>
                            <Td align="right" className="whitespace-nowrap font-medium">{jobPriceLabel(job)}</Td>
                            <Td align="right" className="whitespace-nowrap text-fg-muted" title={new Date(job.created_at).toLocaleString('en-LK')}>{shortDate(job.created_at)}</Td>
                          </RowLink>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                  <ul className="divide-y divide-line sm:hidden">
                    {jobs.map(job => {
                      const { icon, tone } = categoryStyle(job.category_name)
                      return (
                        <li key={job.id}>
                          <Link to={`/jobs/${job.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-brand-subtle/50">
                            <IconChip icon={icon} tone={tone} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-fg">{job.title}</span>
                              <span className="mt-1 flex items-center gap-2 text-[13px] text-fg-muted">
                                <JobStatusBadge status={job.status} />
                                <span className="truncate">{jobPriceLabel(job)}</span>
                              </span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </Card>

            <Card aria-labelledby="activity-heading" className="self-start lg:col-start-2 lg:row-start-2">
              <CardHeader
                id="activity-heading"
                title="Recent activity"
                actions={<Link to="/notifications" className="text-[13px] font-semibold text-brand-text hover:underline">View all</Link>}
              />
              {activity.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-fg-muted">Updates about your jobs will appear here.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {activity.map(n => {
                    const { icon, tone } = NOTIFICATION_STYLES[n.type] || DEFAULT_NOTIFICATION_STYLE
                    return (
                      <li key={n.id}>
                        <Link to={notificationTarget(n) || '/notifications'} className="flex items-start gap-3 px-4 py-3 hover:bg-brand-subtle/50 sm:px-5">
                          <IconChip icon={icon} tone={tone} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className={cn('block truncate text-sm', n.is_read ? 'text-fg-muted' : 'font-semibold text-fg')}>{n.title}</span>
                            <span className="block text-xs text-fg-subtle">{formatRelativeTime(n.created_at)}</span>
                          </span>
                          {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </Page>
    </AppShell>
  )
}
