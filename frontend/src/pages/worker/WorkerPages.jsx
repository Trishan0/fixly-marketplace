import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Filter, MapPin, Clock, Briefcase, MessageSquare, CheckCircle, Play } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Card, Badge, PageHeader, Spinner, EmptyState, Select, Input } from '../../components/shared/UI'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatRelativeTime, URGENCY_LABELS, DISTRICTS, cn } from '../../lib/utils'
import api from '../../lib/api'

const CATEGORIES = ['Plumbing','Electrical','Carpentry','Cleaning','Painting','Tiling','Welding','AC Repair','Landscaping','General Labour']

export function OpenJobs() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [district, setDistrict] = useState('')
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: feed = [], isLoading } = useQuery({
    queryKey: ['job-feed', category, district],
    queryFn: () => api.get(`/jobs/feed?category=${category}&district=${district}`).then(r => r.data),
  })

  const sendProposal = useMutation({
    mutationFn: ({ jobId, data }) => api.post(`/jobs/${jobId}/proposals`, data),
    onSuccess: () => { toast({ title: 'Proposal sent!', variant: 'success' }); qc.invalidateQueries(['job-feed']) },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  const filtered = feed.filter(j => !search || j.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <PageHeader title="Open Jobs" description="Browse jobs looking for workers" />

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="fixly-input pl-9"
              placeholder="Search jobs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="fixly-input w-40 bg-white" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="fixly-input w-40 bg-white" value={district} onChange={e => setDistrict(e.target.value)}>
            <option value="">All Districts</option>
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Briefcase} title="No jobs found" description="Try adjusting your filters" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map(job => (
              <Card key={job.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {job.category_name && <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full">{job.category_name}</span>}
                      {job.urgency && <span className="text-xs text-slate-500">{URGENCY_LABELS[job.urgency]}</span>}
                    </div>
                    <h3 className="font-semibold text-slate-900">{job.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      {job.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.district}</span>}
                      <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{job.proposal_count} proposals</span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{formatRelativeTime(job.created_at)}</span>
                </div>

                {job.pricing_mode === 'fixed' && job.fixed_budget && (
                  <p className="text-sm font-bold text-sky-700 mb-3">Budget: {formatCurrency(job.fixed_budget)}</p>
                )}
                {job.pricing_mode === 'ask_quotes' && (
                  <p className="text-xs text-violet-600 font-medium mb-3">💬 Open for quotes</p>
                )}

                <div className="flex gap-2">
                  <Link to={`/jobs/${job.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">View Details</Button>
                  </Link>
                  <Link to={`/jobs/${job.id}`}>
                    <Button variant="primary" size="sm">Send Proposal</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
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
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <PageHeader title="Job Invites" description="Customers have personally invited you to their jobs" />

        {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> :
          invites.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No invites yet" description="When customers invite you to jobs, they'll appear here" />
          ) : (
            <div className="space-y-6">
              {pending.length > 0 && (
                <div>
                  <h2 className="font-semibold text-slate-700 text-sm mb-3">Pending ({pending.length})</h2>
                  <div className="space-y-4">
                    {pending.map(inv => (
                      <InviteCard key={inv.id} invite={inv} onRespond={(action) => respond.mutate({ id: inv.id, action })} loading={respond.isPending} />
                    ))}
                  </div>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <h2 className="font-semibold text-slate-500 text-sm mb-3">Past</h2>
                  <div className="space-y-3">
                    {past.map(inv => <InviteCard key={inv.id} invite={inv} past />)}
                  </div>
                </div>
              )}
            </div>
          )}
      </div>
    </AppShell>
  )
}

function InviteCard({ invite, onRespond, loading, past }) {
  return (
    <Card className={cn('p-5', past && 'opacity-60')}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900">{invite.job_title}</h3>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
            {invite.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{invite.district}</span>}
            {invite.urgency && <span>{URGENCY_LABELS[invite.urgency]}</span>}
          </div>
        </div>
        <Badge status={invite.status} />
      </div>
      {invite.message && (
        <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 italic mb-3">"{invite.message}"</p>
      )}
      <p className="text-xs text-slate-400 mb-3">From: {invite.customer_name} • {formatRelativeTime(invite.created_at)}</p>
      {!past && invite.status === 'pending' && (
        <div className="flex gap-2">
          <Button variant="primary" size="sm" className="flex-1" onClick={() => onRespond('accept')} loading={loading}>
            Accept
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onRespond('decline')}>
            Decline
          </Button>
          <Link to={`/jobs/${invite.job_id}`}>
            <Button variant="ghost" size="sm">View Job</Button>
          </Link>
        </div>
      )}
    </Card>
  )
}

export function AssignedJobs() {
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

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <PageHeader title="My Work" description="Jobs assigned to you" />
        {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> :
          jobs.length === 0 ? (
            <EmptyState icon={Briefcase} title="No assigned jobs" description="Accept proposals or invites to get started" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {jobs.map(job => (
                <Card key={job.id} className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-slate-900">{job.title}</h3>
                    <Badge status={job.status} />
                  </div>
                  <p className="text-sm text-slate-500 flex items-center gap-1 mb-1">
                    <MapPin className="w-3.5 h-3.5" />{job.district}{job.town ? `, ${job.town}` : ''}
                  </p>
                  {job.customer_name && <p className="text-xs text-slate-400 mb-3">Customer: {job.customer_name}</p>}
                  {job.final_price && <p className="text-sm font-bold text-emerald-600 mb-3">Payment: {formatCurrency(job.final_price)}</p>}
                  <div className="flex gap-2">
                    {job.status === 'assigned' && (
                      <Button variant="primary" size="sm" className="flex-1"
                        onClick={() => updateStatus.mutate({ id: job.id, status: 'in_progress' })}
                        loading={updateStatus.isPending}>
                        <Play className="w-3.5 h-3.5" /> Start
                      </Button>
                    )}
                    {job.status === 'in_progress' && (
                      <Button variant="success" size="sm" className="flex-1"
                        onClick={() => updateStatus.mutate({ id: job.id, status: 'completed' })}
                        loading={updateStatus.isPending}>
                        <CheckCircle className="w-3.5 h-3.5" /> Complete
                      </Button>
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
    </AppShell>
  )
}
