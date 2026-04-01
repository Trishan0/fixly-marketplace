import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Plus, Bell, CheckCircle, DollarSign, Users } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { StatCard, Card, Button } from '../../components/shared/UI'
import { JobCard } from '../../components/shared/Cards'
import { useAuth } from '../../context/AuthContext'
import { formatRelativeTime, formatCurrency } from '../../lib/utils'
import api from '../../lib/api'

export default function CustomerDashboard() {
  const { user } = useAuth()

  const { data: jobs = [] } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: () => api.get('/jobs/my?limit=5').then(r => r.data),
  })

  const { data: notifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 30000,
  })

  const activeJobs = jobs.filter(j => !['completed', 'payment_recorded', 'reviewed', 'cancelled'].includes(j.status))
  const completedJobs = jobs.filter(j => ['completed', 'payment_recorded', 'reviewed'].includes(j.status))
  const totalSpent = completedJobs.reduce((s, j) => s + parseFloat(j.final_price || 0), 0)
  const unreadNotifs = notifs?.notifications?.filter(n => !n.is_read) || []
  const jobsAwaitingProposalReview = jobs.filter(j => j.status === 'proposals_received' && Number(j.proposal_count || 0) > 0)
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
          <div className="fixly-glow-panel flex items-start justify-between p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-500">Customer Overview</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.full_name?.split(' ')[0]}!
              </h1>
              <p className="mt-2 text-slate-500">Manage your jobs, review proposals, and hire trusted workers from one place.</p>
            </div>
            <Link to="/jobs/new">
              <Button variant="primary" className="hidden sm:flex">
                <Plus className="h-4 w-4" /> Post a Job
              </Button>
            </Link>
          </div>

          {!user?.is_email_verified && !user?.force_verified && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
              <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Verify your email to post jobs</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Check your inbox for a verification link.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Briefcase} label="Active Jobs" value={activeJobs.length} color="sky" />
            <StatCard icon={CheckCircle} label="Completed" value={completedJobs.length} color="emerald" />
            <StatCard icon={DollarSign} label="Total Spent" value={formatCurrency(totalSpent)} color="violet" />
            <StatCard icon={Users} label="Need Proposal Review" value={jobsAwaitingProposalReview.length} color="amber" />
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
                  <div key={n.id} className="flex items-start gap-3 p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950/50">
                      <Bell className="h-4 w-4 text-sky-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                      <p className="text-xs text-slate-500">{n.body}</p>
                    </div>
                    <p className="shrink-0 text-xs text-slate-400">{formatRelativeTime(n.created_at)}</p>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
