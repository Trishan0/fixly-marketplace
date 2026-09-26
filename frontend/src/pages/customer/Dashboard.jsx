import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Plus, Bell, CheckCircle, Banknote, Users } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { StatCard, Card, Button } from '../../components/shared/UI'
import { JobCard } from '../../components/shared/Cards'
import { useAuth } from '../../context/AuthContext'
import { formatRelativeTime, formatCurrency } from '../../lib/utils'
import api from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'
import { EmailVerificationNotice } from '../../components/shared/EmailVerificationNotice'
import { notificationTarget } from '../../lib/notifications'

function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function CustomerDashboard() {
  const { user } = useAuth()
  usePageTitle('Dashboard')

  const { data: jobs = [] } = useQuery({
    queryKey: ['my-jobs', 'recent'],
    queryFn: () => api.get('/jobs/my', { params: { limit: 8 } }).then(r => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['my-jobs', 'summary'],
    queryFn: () => api.get('/jobs/my/summary').then(r => r.data),
  })

  const { data: notifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: proposalJobs = [] } = useQuery({
    queryKey: ['my-jobs', 'awaiting-review'],
    queryFn: () => api.get('/jobs/my', { params: { status: 'proposals_received', limit: 4 } }).then(r => r.data),
  })

  const unreadNotifs = notifs?.notifications?.filter(n => !n.is_read) || []
  const jobsAwaitingProposalReview = proposalJobs.filter(j => Number(j.proposal_count || 0) > 0)
  const prioritizedJobs = [...jobs].sort((a, b) => {
    const aPriority = a.status === 'proposals_received' && Number(a.proposal_count || 0) > 0 ? 0 : 1
    const bPriority = b.status === 'proposals_received' && Number(b.proposal_count || 0) > 0 ? 0 : 1
    if (aPriority !== bPriority) return aPriority - bPriority
    return new Date(b.created_at) - new Date(a.created_at)
  })

  return (
    <AppShell>
      <div className="fixly-app-page">
        <div className="fixly-page max-w-7xl space-y-6">
          <div className="fixly-glow-panel flex items-start justify-between p-5 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-500">Customer Overview</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:mt-3 sm:text-3xl">
                {greeting()}, {user?.full_name?.split(' ')[0]}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">Manage jobs, review proposals, and hire trusted workers from one place.</p>
            </div>
            <Link to="/jobs/new">
              <Button variant="primary" className="hidden sm:flex">
                <Plus className="h-4 w-4" /> Post a Job
              </Button>
            </Link>
          </div>

          <EmailVerificationNotice />

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard icon={Briefcase} label="Active jobs" value={summary?.active} color="sky" />
            <StatCard icon={CheckCircle} label="Completed" value={summary?.completed} color="emerald" />
            <StatCard icon={Banknote} label="Total paid" value={summary ? formatCurrency(Number(summary.total_spent)) : undefined} sub="Payments you recorded" color="violet" />
            <StatCard icon={Users} label="Proposals to review" value={summary?.awaiting_review} color="amber" />
          </div>

          {jobsAwaitingProposalReview.length > 0 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Review Proposals First</h2>
                <Link to="/jobs" className="text-sm font-medium text-sky-600 dark:text-sky-300">View all jobs</Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {jobsAwaitingProposalReview.slice(0, 2).map(job => (
                  <Link key={job.id} to={`/jobs/${job.id}`}>
                    <JobCard job={job} role="customer" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="sm:hidden">
            <Link to="/jobs/new" className="block">
              <Button variant="primary" size="lg" className="w-full">
                <Plus className="h-4 w-4" /> Post a New Job
              </Button>
            </Link>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Recent Jobs</h2>
              <Link to="/jobs" className="text-sm font-medium text-sky-600 dark:text-sky-300">View all</Link>
            </div>
            {jobs.length === 0 ? (
              <Card className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-950/40">
                  <Briefcase className="h-6 w-6 text-sky-400" />
                </div>
                <h3 className="mb-2 font-semibold text-slate-800">No jobs yet</h3>
                <p className="mb-4 text-sm text-slate-500">Post your first job to find skilled workers near you.</p>
                <Link to="/jobs/new"><Button variant="primary">Post a Job</Button></Link>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {prioritizedJobs.slice(0, 4).map(job => (
                  <Link key={job.id} to={`/jobs/${job.id}`}>
                    <JobCard job={job} role="customer" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {unreadNotifs.length > 0 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Recent Notifications</h2>
                <Link to="/notifications" className="text-sm font-medium text-sky-600 dark:text-sky-300">View all</Link>
              </div>
              <Card className="divide-y divide-slate-50 dark:divide-slate-800">
                {unreadNotifs.slice(0, 3).map(n => (
                  <Link key={n.id} to={notificationTarget(n) || '/notifications'} className="flex items-start gap-3 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950/50">
                      <Bell className="h-4 w-4 text-sky-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                      <p className="text-xs text-slate-500">{n.body}</p>
                    </div>
                    <p className="shrink-0 text-xs text-slate-500">{formatRelativeTime(n.created_at)}</p>
                  </Link>
                ))}
              </Card>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
