import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import {
  Banknote, Briefcase, CheckCircle2, Clock, Mail, MapPin, MessagesSquare, Play, Search, SlidersHorizontal, Sparkles, Users, Wrench, X,
} from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Card, EmptyState, IconChip, JobStatusBadge, Page, PageHeader, Skeleton, StatusBadge, Tabs } from '../../components/ui'
import { Select } from '../../components/shared/UI'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { AgentSheet } from '../../components/agent/AgentSheet'
import { useJobStatusAction } from '../../components/worker/useJobStatusAction'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useCategories } from '../../hooks/useCategories'
import { cn, formatCurrency, formatRelativeTime, pluralize, DISTRICTS, URGENCY_LABELS } from '../../lib/utils'
import { jobPriceLabel, urgencyTone } from '../../lib/jobs'
import { categoryStyle } from '../../lib/tones'
import { threadPath } from '../../lib/messages'
import { errorMessage } from '../../lib/errors'
import api from '../../lib/api'

const FEED_PAGE_SIZE = 20

function Meta({ children }) {
  return <span className="inline-flex items-center gap-1">{children}</span>
}

function FeedCard({ job }) {
  const { icon, tone } = categoryStyle(job.category_name)
  const declined = job.my_proposal_status === 'declined'
  return (
    <article className="group relative flex flex-col rounded-card border border-line/80 bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover sm:p-5">
      <div className="flex items-start gap-3">
        <IconChip icon={icon} tone={tone} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {job.urgency && <StatusBadge tone={urgencyTone(job.urgency)}>{URGENCY_LABELS[job.urgency]}</StatusBadge>}
            {job.has_my_proposal && !declined && <StatusBadge tone="indigo">Proposal sent</StatusBadge>}
            {declined && <StatusBadge tone="rose">Not chosen</StatusBadge>}
          </div>
          <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-fg">
            <Link to={`/jobs/${job.id}`} className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand">
              {job.title}
            </Link>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-muted">
            {job.category_name && <span>{job.category_name}</span>}
            {job.district && <Meta><MapPin className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />{job.town || job.district}</Meta>}
            <Meta><Clock className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />{formatRelativeTime(job.created_at)}</Meta>
          </p>
        </div>
      </div>
      {job.description && <p className="mt-3 line-clamp-2 text-[13px] leading-5 text-fg-muted">{job.description}</p>}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <div>
          <p className="text-[15px] font-bold text-fg">{jobPriceLabel(job)}</p>
          <p className="text-xs text-fg-subtle">{pluralize(job.proposal_count || 0, 'proposal')} so far · {job.customer_name}</p>
        </div>
        {job.has_my_proposal ? (
          <Button to={`/jobs/${job.id}`} variant="secondary" size="sm" className="relative z-10">View proposal</Button>
        ) : (
          <Button to={`/jobs/${job.id}/propose`} size="sm" className="relative z-10">Send proposal</Button>
        )}
      </div>
    </article>
  )
}

export function OpenJobs() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [district, setDistrict] = useState('')
  const [tab, setTab] = useState('open')
  const [agentOpen, setAgentOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const debouncedSearch = useDebouncedValue(search.trim())
  const { categories } = useCategories()
  usePageTitle('Open jobs')

  const proposalFilter = { open: 'open', sent: 'sent', rejected: 'declined' }[tab]
  const {
    data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching,
  } = useInfiniteQuery({
    queryKey: ['job-feed', { category, district, search: debouncedSearch, proposal: proposalFilter }],
    queryFn: ({ pageParam }) => api.get('/jobs/feed', {
      params: { category: category || undefined, district: district || undefined, search: debouncedSearch || undefined, proposal: proposalFilter, page: pageParam, limit: FEED_PAGE_SIZE },
    }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.length === FEED_PAGE_SIZE ? pages.length + 1 : undefined),
    placeholderData: previous => previous,
  })
  const jobs = data?.pages.flat() || []
  const activeFilters = Number(Boolean(category)) + Number(Boolean(district))
  const emptyCopy = {
    open: debouncedSearch || activeFilters
      ? { title: 'No matching jobs', description: 'Try a different search, category or district.' }
      : { title: 'No new jobs right now', description: 'New jobs appear here as customers post them. Check back soon.' },
    sent: { title: 'No proposals waiting', description: 'Jobs you’ve sent a proposal for show here until the customer decides.' },
    rejected: { title: 'No declined proposals', description: 'If a customer chooses someone else, the job shows here.' },
  }[tab]

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Open jobs"
          description="Jobs near you that are looking for a worker."
          actions={<Button variant="secondary" onClick={() => setAgentOpen(true)}><Sparkles className="h-4 w-4 text-violet-500" aria-hidden="true" /> Find jobs for me</Button>}
        />

        <Card as="div" className="mb-5 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Tabs label="Filter jobs" value={tab} onChange={setTab} tabs={[{ value: 'open', label: 'New' }, { value: 'sent', label: 'Proposal sent' }, { value: 'rejected', label: 'Not chosen' }]} />
            <div className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                <input type="search" aria-label="Search jobs" className="fixly-input pl-9" placeholder="Search jobs" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button variant="secondary" className="lg:hidden" onClick={() => setFiltersOpen(v => !v)} aria-expanded={filtersOpen} aria-controls="feed-filters">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                {activeFilters > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] text-brand-on">{activeFilters}</span>}
                <span className="sr-only">Filters</span>
              </Button>
            </div>
            <div id="feed-filters" className={cn('grid gap-2 sm:grid-cols-2 lg:flex lg:w-auto', !filtersOpen && 'hidden lg:flex')}>
              <Select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} className="lg:w-44">
                <option value="">All categories</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </Select>
              <Select aria-label="District" value={district} onChange={e => setDistrict(e.target.value)} className="lg:w-40">
                <option value="">All districts</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
              {activeFilters > 0 && (
                <Button variant="ghost" onClick={() => { setCategory(''); setDistrict('') }}><X className="h-4 w-4" aria-hidden="true" /> Clear</Button>
              )}
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-52 w-full rounded-card" />)}</div>
        ) : isError ? (
          <ErrorFallback title="We couldn’t load jobs" description="Check your connection and try again." onRetry={() => refetch()} />
        ) : jobs.length === 0 ? (
          <Card><EmptyState icon={Briefcase} title={emptyCopy.title} description={emptyCopy.description} /></Card>
        ) : (
          <div className={cn('space-y-5', isFetching && !isFetchingNextPage && 'opacity-60 transition-opacity')}>
            <div className="grid gap-4 md:grid-cols-2">{jobs.map(job => <FeedCard key={job.id} job={job} />)}</div>
            <div className="flex flex-col items-center gap-3 text-[13px] text-fg-muted">
              <span aria-live="polite">{pluralize(jobs.length, 'job')}</span>
              {hasNextPage && <Button variant="secondary" size="sm" onClick={() => fetchNextPage()} loading={isFetchingNextPage}>Load more</Button>}
            </div>
          </div>
        )}
      </Page>
      <AgentSheet open={agentOpen} mode="proposal" onClose={() => setAgentOpen(false)} />
    </AppShell>
  )
}

function InviteCard({ invite, onRespond, pendingAction }) {
  const { user } = useAuth()
  const { icon, tone } = categoryStyle(invite.category_name)
  const pending = invite.status === 'pending'
  return (
    <Card as="article" className={cn('p-4 sm:p-5', pending && 'border-violet-200 dark:border-violet-500/30')}>
      <div className="flex items-start gap-3">
        <IconChip icon={pending ? Mail : icon} tone={pending ? 'violet' : tone} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link to={`/jobs/${invite.job_id}`} className="text-[15px] font-semibold text-fg hover:text-brand-text">{invite.job_title}</Link>
            <StatusBadge tone={{ pending: 'violet', accepted: 'emerald', declined: 'slate' }[invite.status] || 'slate'}>
              {{ pending: 'Waiting for you', accepted: 'Accepted', declined: 'Declined' }[invite.status] || invite.status}
            </StatusBadge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-muted">
            <span>From {invite.customer_name}</span>
            {invite.district && <Meta><MapPin className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />{invite.district}</Meta>}
            {invite.urgency && <span>{URGENCY_LABELS[invite.urgency]}</span>}
            <Meta><Clock className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />{formatRelativeTime(invite.created_at)}</Meta>
          </p>
        </div>
      </div>
      {invite.message && (
        <blockquote className="mt-3 rounded-control border-l-2 border-violet-300 bg-subtle px-3.5 py-2.5 text-sm leading-6 text-fg-muted dark:border-violet-500/50">
          {invite.message}
        </blockquote>
      )}
      {pending && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <Button size="sm" onClick={() => onRespond('accept')} loading={pendingAction === 'accept'} disabled={Boolean(pendingAction)}>Accept and quote</Button>
          <Button size="sm" variant="secondary" onClick={() => onRespond('decline')} loading={pendingAction === 'decline'} disabled={Boolean(pendingAction)}>Decline</Button>
          <Button size="sm" variant="ghost" to={threadPath(invite.job_id, user.id)}><MessagesSquare className="h-4 w-4" aria-hidden="true" /> Ask a question</Button>
          <Button size="sm" variant="ghost" to={`/jobs/${invite.job_id}`} className="sm:ml-auto">View job</Button>
        </div>
      )}
    </Card>
  )
}

export function Invites() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()
  usePageTitle('Invites')
  const { data: invites = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['invites'],
    queryFn: () => api.get('/invites/received').then(r => r.data),
  })

  const respond = useMutation({
    mutationFn: ({ id, action }) => api.put(`/invites/${id}/${action}`),
    meta: { track: 'invite_responded', trackProps: ({ action }) => ({ action }) },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['invites'] })
      qc.invalidateQueries({ queryKey: ['job-feed'] })
      qc.invalidateQueries({ queryKey: ['my-proposals'] })
      if (vars.action === 'accept') {
        toast({ title: 'Invite accepted', description: 'Now add your price and availability so the customer can hire you.', variant: 'success' })
        navigate(`/jobs/${vars.jobId}/propose`)
      } else {
        toast({ title: 'Invite declined', description: 'We’ve let the customer know.' })
      }
    },
    onError: (e) => toast({ title: 'Couldn’t respond to the invite', description: errorMessage(e), variant: 'error' }),
  })
  const pendingAction = (invite) => (respond.isPending && respond.variables?.id === invite.id ? respond.variables.action : null)
  const pending = invites.filter(i => i.status === 'pending')
  const past = invites.filter(i => i.status !== 'pending')

  return (
    <AppShell>
      <Page width="default">
        <PageHeader title="Invites" description="Customers who asked for you personally." />
        {isLoading ? (
          <div className="space-y-4">{[0, 1].map(i => <Skeleton key={i} className="h-40 w-full rounded-card" />)}</div>
        ) : isError ? (
          <ErrorFallback title="We couldn’t load your invites" description="Check your connection and try again." onRetry={() => refetch()} />
        ) : invites.length === 0 ? (
          <Card><EmptyState icon={Mail} title="No invites yet" description="When a customer invites you to a job, it appears here. A complete profile helps customers find you." action={<Button to="/profile/edit" size="sm" variant="secondary">Improve your profile</Button>} /></Card>
        ) : (
          <div className="space-y-8">
            {pending.length > 0 && (
              <section aria-labelledby="pending-invites" className="space-y-3">
                <h2 id="pending-invites" className="text-sm font-semibold text-fg">Waiting for you <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{pending.length}</span></h2>
                {pending.map(inv => <InviteCard key={inv.id} invite={inv} onRespond={(action) => respond.mutate({ id: inv.id, jobId: inv.job_id, action })} pendingAction={pendingAction(inv)} />)}
              </section>
            )}
            {past.length > 0 && (
              <section aria-labelledby="past-invites" className="space-y-3">
                <h2 id="past-invites" className="text-sm font-semibold text-fg-muted">Earlier</h2>
                {past.map(inv => <InviteCard key={inv.id} invite={inv} />)}
              </section>
            )}
          </div>
        )}
      </Page>
    </AppShell>
  )
}

const WORK_TABS = [
  { value: 'active', label: 'Active', statuses: ['assigned', 'in_progress'], empty: { title: 'No active jobs', description: 'When a customer hires you, the job appears here.' } },
  { value: 'awaiting_payment', label: 'Awaiting payment', statuses: ['completed', 'payment_recorded'], empty: { title: 'Nothing awaiting payment', description: 'Finished jobs wait here until the payment is recorded and confirmed.' } },
  { value: 'finished', label: 'Finished', statuses: ['reviewed'], empty: { title: 'No finished jobs yet', description: 'Jobs the customer has reviewed appear here.' } },
  { value: 'all', label: 'All', statuses: null, empty: { title: 'No jobs yet', description: 'Send proposals or accept invites to get hired.' } },
]

export function AssignedJobs() {
  const [tab, setTab] = useState('active')
  const statusAction = useJobStatusAction()
  const { user } = useAuth()
  usePageTitle('My work')

  const { data: jobs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['assigned-jobs'],
    queryFn: () => api.get('/jobs/assigned').then(r => r.data),
  })
  const counts = Object.fromEntries(WORK_TABS.map(t => [t.value, t.statuses ? jobs.filter(j => t.statuses.includes(j.status)).length : jobs.length]))
  const activeTab = WORK_TABS.find(t => t.value === tab)
  const filtered = activeTab.statuses ? jobs.filter(j => activeTab.statuses.includes(j.status)) : jobs

  return (
    <AppShell>
      <Page width="default">
        {statusAction.dialog}
        <PageHeader title="My work" description="Jobs you’ve been hired for, and what to do next." />
        <Tabs label="Filter work" value={tab} onChange={setTab} tabs={WORK_TABS.map(t => ({ value: t.value, label: t.label, count: isLoading ? undefined : counts[t.value] }))} className="mb-5" />

        {isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-card" />)}</div>
        ) : isError ? (
          <ErrorFallback title="We couldn’t load your work" description="Check your connection and try again." onRetry={() => refetch()} />
        ) : filtered.length === 0 ? (
          <Card><EmptyState icon={Wrench} title={activeTab.empty.title} description={activeTab.empty.description} action={tab === 'active' ? <Button to="/jobs/feed" size="sm">Browse open jobs</Button> : null} /></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(job => {
              const { icon, tone } = categoryStyle(job.category_name)
              return (
                <Card key={job.id} as="article" className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <IconChip icon={icon} tone={tone} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/jobs/${job.id}`} className="text-[15px] font-semibold text-fg hover:text-brand-text">{job.title}</Link>
                          <JobStatusBadge status={job.status} />
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-muted">
                          <Meta><Users className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />{job.customer_name}</Meta>
                          {job.district && <Meta><MapPin className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />{[job.town, job.district].filter(Boolean).join(', ')}</Meta>}
                          {job.final_price && <Meta><Banknote className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" /><span className="font-semibold text-fg">{formatCurrency(job.final_price)}</span></Meta>}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-[3.25rem] sm:pl-0">
                      {job.status === 'assigned' && (
                        <Button size="sm" onClick={() => statusAction.start(job)} loading={statusAction.isPending(job)}><Play className="h-3.5 w-3.5" aria-hidden="true" /> Start</Button>
                      )}
                      {job.status === 'in_progress' && (
                        <Button size="sm" variant="success" onClick={() => statusAction.requestComplete(job)} loading={statusAction.isPending(job)}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Complete</Button>
                      )}
                      {job.status === 'payment_recorded' && (
                        <Button size="sm" variant="success" to={`/jobs/${job.id}`}><Banknote className="h-3.5 w-3.5" aria-hidden="true" /> Confirm payment</Button>
                      )}
                      {['assigned', 'in_progress', 'completed'].includes(job.status) && (
                        <Button size="sm" variant="secondary" to={threadPath(job.id, user.id)}><MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" /> Message</Button>
                      )}
                      <Button size="sm" variant="ghost" to={`/jobs/${job.id}`}>Details</Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </Page>
    </AppShell>
  )
}
