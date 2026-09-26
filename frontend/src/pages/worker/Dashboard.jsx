import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, BadgeCheck, Banknote, Briefcase, Camera, CheckCircle2, Circle, FileText, Image as Images, Mail,
  MapPin, MessagesSquare, Play, Search, User as UserRound, Wallet, Wrench,
} from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import {
  AttentionItem, Button, Card, CardHeader, EmptyState, IconChip, JobStatusBadge, Page, Skeleton, StatTile, WelcomeBanner,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useJobStatusAction } from '../../components/worker/useJobStatusAction'
import { cn, formatCurrency, formatRelativeTime, joinWithAnd, pluralize } from '../../lib/utils'
import { jobPriceLabel } from '../../lib/jobs'
import { categoryStyle } from '../../lib/tones'
import api from '../../lib/api'

function useWorkerData() {
  const assigned = useQuery({ queryKey: ['assigned-jobs'], queryFn: () => api.get('/jobs/assigned').then(r => r.data), refetchInterval: 30000 })
  const invites = useQuery({ queryKey: ['invites'], queryFn: () => api.get('/invites/received').then(r => r.data), refetchInterval: 30000 })
  const earnings = useQuery({ queryKey: ['earnings'], queryFn: () => api.get('/payments/my').then(r => r.data) })
  const proposals = useQuery({ queryKey: ['my-proposals', 'counts'], queryFn: () => api.get('/proposals/mine', { params: { limit: 1 } }).then(r => r.data.counts) })
  const messages = useQuery({ queryKey: ['messages-unread'], queryFn: () => api.get('/messages/unread-count').then(r => r.data) })
  const jobs = assigned.data || []
  return {
    assignedLoading: assigned.isLoading,
    active: jobs.filter(j => ['assigned', 'in_progress'].includes(j.status)),
    toStart: jobs.filter(j => j.status === 'assigned'),
    toConfirm: jobs.filter(j => j.status === 'payment_recorded'),
    completedCount: jobs.filter(j => ['completed', 'payment_recorded', 'reviewed'].includes(j.status)).length,
    pendingInvites: (invites.data || []).filter(i => i.status === 'pending'),
    earnings: earnings.data,
    proposalCounts: proposals.data,
    unreadMessages: messages.data?.unread || 0,
  }
}

function ActiveJobRow({ job, statusAction }) {
  const { icon, tone } = categoryStyle(job.category_name)
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <IconChip icon={icon} tone={tone} size="sm" />
        <div className="min-w-0">
          <Link to={`/jobs/${job.id}`} className="block truncate text-sm font-semibold text-fg hover:text-brand-text">{job.title}</Link>
          <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-fg-muted">
            <span>{job.customer_name}</span>
            {job.district && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" />{job.town || job.district}</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 pl-11 sm:pl-0">
        <JobStatusBadge status={job.status} />
        {job.status === 'assigned' && (
          <Button size="sm" onClick={() => statusAction.start(job)} loading={statusAction.isPending(job)}>
            <Play className="h-3.5 w-3.5" aria-hidden="true" /> Start
          </Button>
        )}
        {job.status === 'in_progress' && (
          <Button size="sm" variant="success" onClick={() => statusAction.requestComplete(job)} loading={statusAction.isPending(job)}>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Complete
          </Button>
        )}
      </div>
    </li>
  )
}

function NewJobCard({ job }) {
  const { icon, tone } = categoryStyle(job.category_name)
  return (
    <Link to={`/jobs/${job.id}`} className="group flex flex-col rounded-card border border-line/80 bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="flex items-center justify-between gap-2">
        <IconChip icon={icon} tone={tone} size="sm" />
        <span className="text-xs text-fg-subtle">{formatRelativeTime(job.created_at)}</span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-semibold text-fg group-hover:text-brand-text">{job.title}</p>
      <p className="mt-1 text-[13px] text-fg-muted">{[job.category_name, job.town || job.district].filter(Boolean).join(' · ')}</p>
      <p className="mt-auto pt-3 text-sm font-semibold text-fg">{jobPriceLabel(job)}</p>
    </Link>
  )
}

function ProfileStrength() {
  const { data: profile } = useQuery({ queryKey: ['my-profile'], queryFn: () => api.get('/profile/me').then(r => r.data) })
  if (!profile) return null
  const steps = [
    { label: 'Add a profile photo', done: Boolean(profile.profile_photo), icon: Camera },
    { label: 'Write a short bio', done: (profile.bio || '').trim().length >= 40, icon: UserRound },
    { label: 'Verify your NIC', done: profile.nic_status === 'verified' || profile.is_nic_verified, icon: BadgeCheck },
    { label: 'Add portfolio photos', done: (profile.portfolio_photos || []).length > 0, icon: Images },
  ]
  const done = steps.filter(s => s.done).length
  if (done === steps.length) return null
  const percent = Math.round((done / steps.length) * 100)
  return (
    <Card aria-labelledby="profile-strength-heading">
      <CardHeader id="profile-strength-heading" title="Profile strength" actions={<span className="text-[13px] font-semibold text-brand-text">{percent}%</span>} />
      <div className="px-4 pb-4 pt-3 sm:px-5">
        <div className="h-2 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-[13px] text-fg-muted">Complete profiles get hired more often.</p>
        <ul className="mt-3 space-y-1">
          {steps.map(step => (
            <li key={step.label}>
              <Link to="/profile/edit" className={cn('flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-subtle', step.done ? 'text-fg-subtle' : 'font-medium text-fg')}>
                {step.done
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                  : <Circle className="h-4 w-4 text-line-strong" aria-hidden="true" />}
                <span className={step.done ? 'line-through' : undefined}>{step.label}</span>
                <span className="sr-only">{step.done ? '(done)' : '(to do)'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

function StandardDashboard() {
  const { user } = useAuth()
  const statusAction = useJobStatusAction()
  const data = useWorkerData()
  const { data: feed = [], isLoading: feedLoading } = useQuery({
    queryKey: ['job-feed', 'dashboard'],
    queryFn: () => api.get('/jobs/feed', { params: { limit: 4, proposal: 'open' } }).then(r => r.data),
  })

  const attention = [
    ...data.pendingInvites.map(invite => ({
      key: `invite-${invite.id}`, icon: Mail, tone: 'violet', title: 'New invite', detail: `${invite.job_title} · ${invite.customer_name}`, to: '/invites', action: 'View',
    })),
    ...data.toStart.map(job => ({
      key: `start-${job.id}`, icon: Play, tone: 'teal', title: 'Ready to start', detail: job.title, to: `/jobs/${job.id}`, action: 'Open',
    })),
    ...data.toConfirm.map(job => ({
      key: `pay-${job.id}`, icon: Banknote, tone: 'amber', title: 'Confirm your payment', detail: job.title, to: `/jobs/${job.id}`, action: 'Confirm',
    })),
    ...(data.unreadMessages > 0 ? [{
      key: 'messages', icon: MessagesSquare, tone: 'sky', title: pluralize(data.unreadMessages, 'unread message'), detail: 'Customers are waiting for your reply', to: '/messages', action: 'Open',
    }] : []),
  ]
  const summaryParts = [
    data.pendingInvites.length > 0 && `${pluralize(data.pendingInvites.length, 'invite')} waiting`,
    data.toStart.length > 0 && `${pluralize(data.toStart.length, 'job')} to start`,
    data.toConfirm.length > 0 && `${pluralize(data.toConfirm.length, 'payment')} to confirm`,
  ].filter(Boolean)
  const pendingEarnings = Number(data.earnings?.pendingTotal || 0)

  return (
    <Page>
      {statusAction.dialog}
      <div className="space-y-6">
        <WelcomeBanner
          name={user?.full_name?.split(' ')[0] || 'there'}
          summary={summaryParts.length ? `You have ${joinWithAnd(summaryParts)}.` : 'You’re all caught up. New jobs near you are waiting.'}
          actions={<>
            <Button to="/jobs/feed" variant="on-brand"><Search className="h-4 w-4" aria-hidden="true" /> Browse jobs</Button>
            <Button to="/proposals" variant="on-brand-ghost"><FileText className="h-4 w-4" aria-hidden="true" /> My proposals</Button>
          </>}
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile icon={Wrench} tone="teal" label="Active jobs" value={data.assignedLoading ? undefined : data.active.length} note="Hired or in progress" to="/jobs/assigned" />
          <StatTile icon={FileText} tone="indigo" label="Proposals waiting" value={data.proposalCounts?.pending} note="Customer hasn’t decided yet" to="/proposals" />
          <StatTile icon={Mail} tone="violet" label="Invites" value={data.pendingInvites.length} note={data.pendingInvites.length ? 'Customers asked for you' : 'None right now'} to="/invites" />
          <StatTile icon={Wallet} tone="amber" label="Total earned" value={data.earnings ? formatCurrency(Number(data.earnings.total)) : undefined} note={pendingEarnings > 0 ? `${formatCurrency(pendingEarnings)} to confirm` : 'Recorded by customers'} to="/earnings" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-6">
            <Card aria-labelledby="work-heading">
              <CardHeader
                id="work-heading"
                title="Your work"
                actions={<Link to="/jobs/assigned" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-text hover:underline">View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
              />
              {data.assignedLoading ? (
                <div className="space-y-3 p-5">{[0, 1].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : data.active.length === 0 ? (
                <EmptyState icon={Briefcase} title="No active jobs" description="When a customer hires you, the job appears here with its next step." action={<Button to="/jobs/feed" size="sm">Browse open jobs</Button>} />
              ) : (
                <ul className="divide-y divide-line">
                  {data.active.map(job => <ActiveJobRow key={job.id} job={job} statusAction={statusAction} />)}
                </ul>
              )}
            </Card>

            <section aria-labelledby="new-jobs-heading">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="new-jobs-heading" className="text-[15px] font-semibold text-fg">New jobs for you</h2>
                <Link to="/jobs/feed" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-text hover:underline">Browse all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
              </div>
              {feedLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map(i => <Skeleton key={i} className="h-36 w-full rounded-card" />)}</div>
              ) : feed.length === 0 ? (
                <Card><EmptyState icon={Search} title="No new jobs right now" description="We’ll show new jobs here as customers post them." /></Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">{feed.map(job => <NewJobCard key={job.id} job={job} />)}</div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <Card aria-labelledby="worker-attention-heading">
              <CardHeader
                id="worker-attention-heading"
                title="Needs your attention"
                actions={attention.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{attention.length}</span>}
              />
              {attention.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-8 text-center">
                  <IconChip icon={CheckCircle2} tone="emerald" />
                  <p className="mt-3 text-sm font-semibold text-fg">You’re all caught up</p>
                  <p className="mt-0.5 text-[13px] text-fg-muted">Invites, payments and messages will show up here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {attention.map(({ key, ...item }) => <AttentionItem key={key} {...item} />)}
                </ul>
              )}
            </Card>
            <ProfileStrength />
          </div>
        </div>
      </div>
    </Page>
  )
}

function SimpleTile({ to, icon: Icon, tone, label, count }) {
  const tones = {
    sky: 'from-sky-500 to-sky-600',
    violet: 'from-violet-500 to-violet-600',
    teal: 'from-teal-500 to-teal-600',
    amber: 'from-amber-500 to-amber-600',
  }
  return (
    <Link to={to} className={cn('flex min-h-32 flex-col justify-between rounded-card bg-gradient-to-br p-5 text-white shadow-card transition-transform hover:-translate-y-0.5', tones[tone])}>
      <span className="flex items-center justify-between">
        <Icon className="h-7 w-7" aria-hidden="true" />
        {count > 0 && <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-sm font-bold">{count}</span>}
      </span>
      <span className="text-lg font-bold">{label}</span>
    </Link>
  )
}

function SimpleDashboard() {
  const { user } = useAuth()
  const statusAction = useJobStatusAction()
  const data = useWorkerData()

  return (
    <Page width="narrow">
      {statusAction.dialog}
      <div className="space-y-6">
        <WelcomeBanner
          name={user?.full_name?.split(' ')[0] || 'there'}
          summary="Pick what you want to do."
          actions={<Button to="/settings" variant="on-brand-ghost" size="sm">Switch to full dashboard</Button>}
        />
        <div className="grid grid-cols-2 gap-3">
          <SimpleTile to="/jobs/feed" icon={Search} tone="sky" label="Find jobs" />
          <SimpleTile to="/invites" icon={Mail} tone="violet" label="Invites" count={data.pendingInvites.length} />
          <SimpleTile to="/jobs/assigned" icon={Wrench} tone="teal" label="My jobs" count={data.active.length} />
          <SimpleTile to="/earnings" icon={Wallet} tone="amber" label="Earnings" />
        </div>
        {data.active.length > 0 && (
          <section aria-labelledby="simple-active-heading" className="space-y-3">
            <h2 id="simple-active-heading" className="text-lg font-bold text-fg">Your active jobs</h2>
            {data.active.map(job => (
              <Card key={job.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/jobs/${job.id}`} className="text-lg font-bold text-fg hover:text-brand-text">{job.title}</Link>
                    <p className="mt-0.5 text-sm text-fg-muted">{job.customer_name} · {job.town || job.district}</p>
                  </div>
                  <JobStatusBadge status={job.status} />
                </div>
                {job.status === 'assigned' && (
                  <Button size="lg" className="mt-4 w-full text-base" onClick={() => statusAction.start(job)} loading={statusAction.isPending(job)}>
                    <Play className="h-5 w-5" aria-hidden="true" /> Mark as started
                  </Button>
                )}
                {job.status === 'in_progress' && (
                  <Button size="lg" variant="success" className="mt-4 w-full text-base" onClick={() => statusAction.requestComplete(job)} loading={statusAction.isPending(job)}>
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Mark as complete
                  </Button>
                )}
              </Card>
            ))}
          </section>
        )}
      </div>
    </Page>
  )
}

export default function WorkerDashboard() {
  const { user } = useAuth()
  usePageTitle('Dashboard')
  return (
    <AppShell>
      {user?.dashboard_mode === 'simplified' ? <SimpleDashboard /> : <StandardDashboard />}
    </AppShell>
  )
}
