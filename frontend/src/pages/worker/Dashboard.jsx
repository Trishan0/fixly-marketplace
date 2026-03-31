import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Briefcase, DollarSign, MessageSquare, Star, ArrowRight, CheckCircle, Play } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { StatCard, Card, Badge, Button, Avatar, EmptyState } from '../../components/shared/UI'
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
  const activeJobs = assigned.filter(j => ['assigned','in_progress'].includes(j.status))

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => api.put(`/jobs/${id}/status`, { status }),
    onSuccess: () => { toast({ title: 'Updated!', variant: 'success' }); qc.invalidateQueries(['assigned-jobs']) },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  return (
    <div className="fixly-page max-w-xl space-y-5">
      <div className="pt-2">
        <h1 className="text-3xl font-black text-slate-900">Hello, {user?.full_name?.split(' ')[0]}!</h1>
        <p className="text-slate-500 mt-1 text-lg">What do you want to do?</p>
        <Link to="/settings" className="inline-flex items-center gap-2 text-sm text-sky-600 font-medium mt-3">
          Open settings and switch dashboard mode <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Big action buttons */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { to: '/jobs/feed', icon: '🔍', label: 'Find Jobs', color: 'bg-sky-600 text-white' },
          { to: '/invites', icon: '📩', label: `Invites ${pendingInvites.length > 0 ? `(${pendingInvites.length})` : ''}`, color: pendingInvites.length > 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-800' },
          { to: '/jobs/assigned', icon: '🔧', label: 'My Jobs', color: 'bg-slate-100 text-slate-800' },
          { to: '/earnings', icon: '💰', label: 'Earnings', color: 'bg-emerald-50 text-emerald-800' },
        ].map(({ to, icon, label, color }) => (
          <Link key={to} to={to}>
            <button className={cn('w-full h-24 rounded-3xl flex flex-col items-center justify-center gap-2 font-bold text-lg transition-transform active:scale-95', color)}>
              <span className="text-3xl">{icon}</span>
              <span>{label}</span>
            </button>
          </Link>
        ))}
      </div>

      {/* Active jobs with big action buttons */}
      {activeJobs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">Today's Jobs</h2>
          {activeJobs.map(job => (
            <Card key={job.id} className="p-5">
              <h3 className="font-bold text-lg text-slate-900 mb-1">{job.title}</h3>
              <p className="text-slate-500 text-sm mb-4">{job.district} • <Badge status={job.status} /></p>
              {job.status === 'assigned' && (
                <Button variant="primary" size="lg" className="w-full text-lg py-4"
                  onClick={() => updateStatus.mutate({ id: job.id, status: 'in_progress' })}
                  loading={updateStatus.isPending}>
                  <Play className="w-5 h-5" /> Mark Started
                </Button>
              )}
              {job.status === 'in_progress' && (
                <Button variant="success" size="lg" className="w-full text-lg py-4"
                  onClick={() => updateStatus.mutate({ id: job.id, status: 'completed' })}
                  loading={updateStatus.isPending}>
                  <CheckCircle className="w-5 h-5" /> Mark Done
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
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

  const activeJobs = assigned.filter(j => ['assigned','in_progress'].includes(j.status))
  const completedJobs = assigned.filter(j => ['completed','payment_recorded','reviewed'].includes(j.status))
  const pendingInvites = invites.filter(i => i.status === 'pending')

  return (
    <div className="fixly-page max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {user?.full_name?.split(' ')[0]}! 👷
        </h1>
        <p className="text-slate-500 mt-1">Here's your work overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={MessageSquare} label="Pending Invites" value={pendingInvites.length} color="amber" />
        <StatCard icon={Briefcase} label="Active Jobs" value={activeJobs.length} color="sky" />
        <StatCard icon={CheckCircle} label="Completed" value={completedJobs.length} color="emerald" />
        <StatCard icon={DollarSign} label="Total Earned" value={formatCurrency(earnings?.total || 0)} color="violet" />
      </div>

      {/* Active jobs */}
      {activeJobs.length > 0 && (
        <div>
          <h2 className="font-bold text-slate-900 mb-4">Active Jobs</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activeJobs.map(job => (
              <Card key={job.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{job.title}</h3>
                    <p className="text-sm text-slate-500">{job.district}</p>
                  </div>
                  <Badge status={job.status} />
                </div>
                <div className="flex gap-2">
                  {job.status === 'assigned' && (
                    <Button variant="primary" size="sm" className="flex-1"
                      onClick={() => updateStatus.mutate({ id: job.id, status: 'in_progress' })}
                      loading={updateStatus.isPending}>
                      ▶ Start
                    </Button>
                  )}
                  {job.status === 'in_progress' && (
                    <Button variant="success" size="sm" className="flex-1"
                      onClick={() => updateStatus.mutate({ id: job.id, status: 'completed' })}
                      loading={updateStatus.isPending}>
                      ✓ Complete
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

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Pending Invites</h2>
            <Link to="/invites" className="text-sm text-sky-600 font-medium">View all →</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {pendingInvites.slice(0, 2).map(inv => (
              <Card key={inv.id} className="p-4">
                <p className="font-semibold text-slate-900 text-sm">{inv.job_title}</p>
                <p className="text-xs text-slate-500 mt-1">{inv.district} • {URGENCY_LABELS[inv.urgency]}</p>
                <p className="text-xs text-slate-400 mt-2">{formatRelativeTime(inv.created_at)}</p>
                <Link to="/invites">
                  <Button variant="primary" size="sm" className="mt-3 w-full">View Invite</Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* New jobs feed */}
      {feed.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">New Jobs Near You</h2>
            <Link to="/jobs/feed" className="text-sm text-sky-600 font-medium">Browse all →</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {feed.map(job => (
              <Card key={job.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full">{job.category_name}</span>
                  {job.urgency && <span className="text-xs text-slate-400">{URGENCY_LABELS[job.urgency]}</span>}
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">{job.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{job.district}</p>
                <Link to={`/jobs/${job.id}`}>
                  <Button variant="outline" size="sm" className="mt-3 w-full">
                    View Job <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      )}
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
