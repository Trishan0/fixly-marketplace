import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, MapPin, Briefcase, MessageSquare, CheckCircle, Play, Bot } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Card, Badge, PageHeader, Spinner, EmptyState } from '../../components/shared/UI'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatRelativeTime, URGENCY_LABELS, DISTRICTS, cn } from '../../lib/utils'
import api from '../../lib/api'
import AgentPanel from '../../components/agent/AgentPanel'

const CATEGORIES = ['Plumbing', 'Electrical', 'Carpentry', 'Cleaning', 'Painting', 'Tiling', 'Welding', 'AC Repair', 'Landscaping', 'General Labour']

export function OpenJobs() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [district, setDistrict] = useState('')
  const [tab, setTab] = useState('open')
  const [agentOpen, setAgentOpen] = useState(false)
  const { data: feed = [], isLoading } = useQuery({
    queryKey: ['job-feed', category, district],
    queryFn: () => api.get(`/jobs/feed?category=${category}&district=${district}`).then(r => r.data),
  })

  const filtered = feed.filter(j => {
    if (search && !j.title.toLowerCase().includes(search.toLowerCase())) return false
    if (tab === 'open') return !j.has_my_proposal
    if (tab === 'sent') return j.has_my_proposal && j.my_proposal_status === 'pending'
    if (tab === 'rejected') return j.my_proposal_status === 'declined'
    return true
  })

  return (
    <AppShell>
      <div className="fixly-app-page">
        <div className="fixly-page max-w-7xl space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <PageHeader title="Open Jobs" description="Browse jobs looking for workers" />
            <Button
              id="run-proposal-agent-btn"
              variant="primary"
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md shadow-violet-200 dark:shadow-violet-900/30 flex-shrink-0"
              onClick={() => setAgentOpen(true)}
            >
              <Bot className="w-4 h-4" /> Run Proposal Agent
            </Button>
          </div>

          <div className="fixly-tab-strip">
            {[
              ['open', 'Open Jobs'],
              ['sent', 'Proposal Sent'],
              ['rejected', 'Rejected'],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} className={cn('fixly-tab', tab === key && 'active')}>
                {label}
              </button>
            ))}
          </div>

          <div className="fixly-glow-panel p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-48 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className="fixly-input pl-9" placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="fixly-input w-44 bg-white dark:bg-slate-900" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="fixly-input w-44 bg-white dark:bg-slate-900" value={district} onChange={e => setDistrict(e.target.value)}>
                <option value="">All Districts</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Briefcase} title="No jobs found" description="Try adjusting your filters" />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {filtered.map(job => (
                <Card key={job.id} className="p-6 transition-shadow hover:shadow-md dark:border-slate-800">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {job.category_name && <span className="fixly-pill-sky">{job.category_name}</span>}
                        {job.has_my_proposal && <span className="fixly-pill-emerald">Proposal sent</span>}
                        {job.my_proposal_status === 'declined' && <span className="fixly-pill-rose">Proposal rejected</span>}
                        {job.urgency && <span className="text-xs text-slate-500">{URGENCY_LABELS[job.urgency]}</span>}
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight text-slate-900">{job.title}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {job.customer_name && <span>Posted by {job.customer_name}</span>}
                        {job.district && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{job.district}</span>}
                        <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{job.proposal_count} proposals</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{formatRelativeTime(job.created_at)}</span>
                  </div>

                  {job.pricing_mode === 'fixed' && job.fixed_budget && (
                    <p className="mb-3 text-sm font-bold text-sky-600 dark:text-sky-300">Budget: {formatCurrency(job.fixed_budget)}</p>
                  )}
                  {job.pricing_mode === 'ask_quotes' && (
                    <p className="mb-3 text-xs font-medium text-violet-600 dark:text-violet-300">Open for quotes</p>
                  )}

                  <div className="flex gap-2">
                    <Link to={`/jobs/${job.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">View Details</Button>
                    </Link>
                    <Link to={job.has_my_proposal ? `/jobs/${job.id}` : `/jobs/${job.id}/propose`}>
                      <Button variant={job.has_my_proposal ? 'secondary' : 'primary'} size="sm">
                        {job.has_my_proposal ? 'View Proposal Status' : 'Send Proposal'}
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Proposal Agent slide-in modal ── */}
      {agentOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Proposal Agent">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setAgentOpen(false)}
          />
          <div className="relative ml-auto w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full overflow-hidden animate-slide-in-right">
            <AgentPanel
              mode="proposal"
              onClose={() => setAgentOpen(false)}
            />
          </div>
        </div>
      )}
    </AppShell>
  )
}

export function Invites() {
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ['invites'],
    queryFn: () => api.get('/invites/received').then(r => r.data),
  })

  const respond = useMutation({
    mutationFn: ({ id, action }) => api.put(`/invites/${id}/${action}`),
    onSuccess: (_, vars) => {
      toast({ title: vars.action === 'accept' ? 'Invite accepted!' : 'Invite declined', variant: vars.action === 'accept' ? 'success' : 'default' })
      qc.invalidateQueries(['invites'])
    },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  const pending = invites.filter(i => i.status === 'pending')
  const past = invites.filter(i => i.status !== 'pending')

  return (
    <AppShell>
      <div className="fixly-app-page">
        <div className="fixly-page max-w-5xl space-y-6">
          <PageHeader title="Job Invites" description="Customers have personally invited you to their jobs" />

          {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> :
            invites.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No invites yet" description="When customers invite you to jobs, they'll appear here" />
            ) : (
              <div className="space-y-6">
                {pending.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-sm font-semibold text-slate-700">Pending ({pending.length})</h2>
                    <div className="space-y-4">
                      {pending.map(inv => (
                        <InviteCard key={inv.id} invite={inv} onRespond={(action) => respond.mutate({ id: inv.id, action })} loading={respond.isPending} />
                      ))}
                    </div>
                  </div>
                )}
                {past.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-sm font-semibold text-slate-500">Past</h2>
                    <div className="space-y-3">
                      {past.map(inv => <InviteCard key={inv.id} invite={inv} past />)}
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </AppShell>
  )
}

function InviteCard({ invite, onRespond, loading, past }) {
  return (
    <Card className={cn('p-6', past && 'opacity-60')}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">{invite.job_title}</h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            {invite.district && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{invite.district}</span>}
            {invite.urgency && <span>{URGENCY_LABELS[invite.urgency]}</span>}
          </div>
        </div>
        <Badge status={invite.status} />
      </div>
      {invite.message && (
        <p className="mb-3 rounded-xl bg-slate-50 p-3 text-sm italic text-slate-600 dark:bg-slate-900/70">"{invite.message}"</p>
      )}
      <p className="mb-3 text-xs text-slate-400">From: {invite.customer_name} • {formatRelativeTime(invite.created_at)}</p>
      {!past && invite.status === 'pending' && (
        <div className="flex gap-2">
          <Button variant="primary" size="sm" className="flex-1" onClick={() => onRespond('accept')} loading={loading}>Accept</Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onRespond('decline')}>Decline</Button>
          <Link to={`/jobs/${invite.job_id}`}>
            <Button variant="ghost" size="sm">View Job</Button>
          </Link>
        </div>
      )}
    </Card>
  )
}

export function AssignedJobs() {
  const [tab, setTab] = useState('active')
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['assigned-jobs'],
    queryFn: () => api.get('/jobs/assigned').then(r => r.data),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => api.put(`/jobs/${id}/status`, { status }),
    onSuccess: () => { toast({ title: 'Updated!', variant: 'success' }); qc.invalidateQueries(['assigned-jobs']) },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  const filteredJobs = jobs.filter(job => {
    if (tab === 'active') return ['assigned', 'in_progress'].includes(job.status)
    if (tab === 'awaiting_payment') return ['completed', 'payment_recorded'].includes(job.status)
    if (tab === 'finished') return job.status === 'reviewed'
    return true
  })

  return (
    <AppShell>
      <div className="fixly-app-page">
        <div className="fixly-page max-w-6xl space-y-6">
          <PageHeader title="My Work" description="Jobs assigned to you" />
          <div className="fixly-tab-strip">
            {[
              ['active', 'Active'],
              ['awaiting_payment', 'Awaiting Payment'],
              ['finished', 'Finished'],
              ['all', 'All'],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} className={cn('fixly-tab', tab === key && 'active')}>
                {label}
              </button>
            ))}
          </div>

          {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> :
            filteredJobs.length === 0 ? (
              <EmptyState icon={Briefcase} title="No assigned jobs" description="Accept proposals or invites to get started" />
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {filteredJobs.map(job => (
                  <Card key={job.id} className="p-6">
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="font-semibold text-slate-900">{job.title}</h3>
                      <Badge status={job.status} />
                    </div>
                    <p className="mb-1 flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />{job.district}{job.town ? `, ${job.town}` : ''}
                    </p>
                    {job.customer_name && <p className="mb-3 text-xs text-slate-400">Customer: {job.customer_name}</p>}
                    {job.final_price && <p className="mb-3 text-sm font-bold text-emerald-600 dark:text-emerald-300">Payment: {formatCurrency(job.final_price)}</p>}
                    <div className="flex gap-2">
                      {job.status === 'assigned' && (
                        <Button variant="primary" size="sm" className="flex-1" onClick={() => updateStatus.mutate({ id: job.id, status: 'in_progress' })} loading={updateStatus.isPending}>
                          <Play className="h-3.5 w-3.5" /> Start
                        </Button>
                      )}
                      {job.status === 'in_progress' && (
                        <Button variant="success" size="sm" className="flex-1" onClick={() => updateStatus.mutate({ id: job.id, status: 'completed' })} loading={updateStatus.isPending}>
                          <CheckCircle className="h-3.5 w-3.5" /> Complete
                        </Button>
                      )}
                      {job.status === 'payment_recorded' && (
                        <Link to={`/jobs/${job.id}`} className="flex-1">
                          <Button variant="success" size="sm" className="w-full">Confirm Payment</Button>
                        </Link>
                      )}
                      <Link to={`/jobs/${job.id}`}>
                        <Button variant="outline" size="sm">Details</Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </div>
      </div>
    </AppShell>
  )
}
