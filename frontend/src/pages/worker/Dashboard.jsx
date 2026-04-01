import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Briefcase, DollarSign, MessageSquare, CheckCircle, ArrowRight, Play, Sparkles, Activity } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { StatCard, Card, Badge, Button } from '../../components/shared/UI'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatRelativeTime, URGENCY_LABELS, cn } from '../../lib/utils'
import api from '../../lib/api'

function SimpleDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: assigned = [] } = useQuery({
    queryKey: ['assigned-jobs'],
    queryFn: () => api.get('/jobs/assigned').then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: invites = [] } = useQuery({
    queryKey: ['invites'],
    queryFn: () => api.get('/invites/received').then(r => r.data),
    refetchInterval: 30000,
  })

  const pendingInvites = invites.filter(i => i.status === 'pending')
  const activeJobs = assigned.filter(j => ['assigned', 'in_progress'].includes(j.status))

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => api.put(`/jobs/${id}/status`, { status }),
    onSuccess: () => { toast({ title: 'Updated!', variant: 'success' }); qc.invalidateQueries(['assigned-jobs']) },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  return (
    <div className="fixly-app-page">
      <div className="fixly-page max-w-3xl space-y-6">
        <div className="fixly-glow-panel p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-500">Worker Dashboard</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">Hello, {user?.full_name?.split(' ')[0]}!</h1>
          <p className="mt-2 text-lg text-slate-500">Pick your next move and keep your workday flowing.</p>
          <Link to="/settings" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-300">
            Open settings and switch dashboard mode <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { to: '/jobs/feed', icon: Sparkles, label: 'Find Jobs', tone: 'fixly-tint-sky text-sky-700 dark:text-sky-300' },
            { to: '/invites', icon: MessageSquare, label: `Invites ${pendingInvites.length > 0 ? `(${pendingInvites.length})` : ''}`, tone: pendingInvites.length > 0 ? 'fixly-tint-amber text-amber-700 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
            { to: '/jobs/assigned', icon: Activity, label: 'My Jobs', tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
            { to: '/earnings', icon: DollarSign, label: 'Earnings', tone: 'fixly-tint-emerald text-emerald-700 dark:text-emerald-300' },
          ].map(({ to, icon: Icon, label, tone }) => (
            <Link key={to} to={to}>
              <div className={cn('rounded-[1.75rem] border p-5 transition-transform hover:-translate-y-0.5', tone)}>
                <Icon className="h-6 w-6" />
                <p className="mt-4 text-lg font-bold">{label}</p>
              </div>
            </Link>
          ))}
        </div>

        {activeJobs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">Today&apos;s Jobs</h2>
            {activeJobs.map(job => (
              <Card key={job.id} className="p-6">
                <h3 className="mb-1 text-lg font-bold text-slate-900">{job.title}</h3>
                <p className="mb-4 text-sm text-slate-500">{job.district} • <Badge status={job.status} /></p>
                {job.status === 'assigned' && (
                  <Button variant="primary" size="lg" className="w-full text-lg py-4" onClick={() => updateStatus.mutate({ id: job.id, status: 'in_progress' })} loading={updateStatus.isPending}>
                    <Play className="h-5 w-5" /> Mark Started
                  </Button>
                )}
                {job.status === 'in_progress' && (
                  <Button variant="success" size="lg" className="w-full text-lg py-4" onClick={() => updateStatus.mutate({ id: job.id, status: 'completed' })} loading={updateStatus.isPending}>
                    <CheckCircle className="h-5 w-5" /> Mark Done
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StandardDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: assigned = [] } = useQuery({
    queryKey: ['assigned-jobs'],
    queryFn: () => api.get('/jobs/assigned').then(r => r.data),
  })

  const { data: earnings } = useQuery({
    queryKey: ['earnings'],
    queryFn: () => api.get('/payments/my').then(r => r.data),
  })

  const { data: invites = [] } = useQuery({
    queryKey: ['invites'],
    queryFn: () => api.get('/invites/received').then(r => r.data),
  })

  const { data: feed = [] } = useQuery({
    queryKey: ['job-feed'],
    queryFn: () => api.get('/jobs/feed?limit=3').then(r => r.data),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => api.put(`/jobs/${id}/status`, { status }),
    onSuccess: () => { toast({ title: 'Updated!', variant: 'success' }); qc.invalidateQueries(['assigned-jobs']) },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  const activeJobs = assigned.filter(j => ['assigned', 'in_progress'].includes(j.status))
  const completedJobs = assigned.filter(j => ['completed', 'payment_recorded', 'reviewed'].includes(j.status))
  const pendingInvites = invites.filter(i => i.status === 'pending')

  return (
    <div className="fixly-app-page">
      <div className="fixly-page max-w-7xl space-y-6">
        <div className="fixly-glow-panel grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-500">Worker Overview</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">Welcome back, {user?.full_name?.split(' ')[0]}.</h1>
            <p className="mt-3 max-w-2xl text-base leading-8 text-slate-500">Keep proposals, active jobs, and earnings moving from one focused workspace with stronger visibility into what matters next.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="fixly-elevated p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Pending Invites</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{pendingInvites.length}</p>
              <p className="mt-1 text-sm text-slate-500">Jobs customers want you on</p>
            </div>
            <div className="fixly-elevated p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Live Work</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{activeJobs.length}</p>
              <p className="mt-1 text-sm text-slate-500">Assigned or in progress</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={MessageSquare} label="Pending Invites" value={pendingInvites.length} color="amber" />
          <StatCard icon={Briefcase} label="Active Jobs" value={activeJobs.length} color="sky" />
          <StatCard icon={CheckCircle} label="Completed" value={completedJobs.length} color="emerald" />
          <StatCard icon={DollarSign} label="Total Earned" value={formatCurrency(earnings?.total || 0)} color="violet" />
        </div>

        {activeJobs.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Active Jobs</h2>
              <Link to="/jobs/assigned" className="text-sm font-medium text-sky-600 dark:text-sky-300">Open my work</Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {activeJobs.map(job => (
                <Card key={job.id} className="p-6">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{job.title}</h3>
                      <p className="text-sm text-slate-500">{job.district}</p>
                    </div>
                    <Badge status={job.status} />
                  </div>
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
                    <Link to={`/jobs/${job.id}`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {pendingInvites.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Pending Invites</h2>
              <Link to="/invites" className="text-sm font-medium text-sky-600 dark:text-sky-300">View all</Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {pendingInvites.slice(0, 2).map(inv => (
                <Card key={inv.id} className="p-5">
                  <p className="font-semibold text-slate-900 text-sm">{inv.job_title}</p>
                  <p className="mt-1 text-xs text-slate-500">{inv.district} • {URGENCY_LABELS[inv.urgency]}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatRelativeTime(inv.created_at)}</p>
                  <Link to="/invites">
                    <Button variant="primary" size="sm" className="mt-4 w-full">View Invite</Button>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        )}

        {feed.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">New Jobs Near You</h2>
              <Link to="/jobs/feed" className="text-sm font-medium text-sky-600 dark:text-sky-300">Browse all</Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {feed.map(job => (
                <Card key={job.id} className="p-5 transition-shadow hover:shadow-md">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="fixly-pill-sky">{job.category_name}</span>
                    {job.urgency && <span className="text-xs text-slate-400">{URGENCY_LABELS[job.urgency]}</span>}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{job.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{job.district}</p>
                  <Link to={`/jobs/${job.id}`}>
                    <Button variant="outline" size="sm" className="mt-4 w-full">
                      View Job <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function WorkerDashboard() {
  const { user } = useAuth()
  return (
    <AppShell>
      {user?.dashboard_mode === 'simplified' ? <SimpleDashboard /> : <StandardDashboard />}
    </AppShell>
  )
}
