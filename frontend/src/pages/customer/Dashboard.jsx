import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Plus, Bell, CheckCircle, DollarSign, Users, Clock } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { StatCard, Card, Badge, Button, EmptyState, PageHeader } from '../../components/shared/UI'
import { JobCard } from '../../components/shared/Cards'
import { useAuth } from '../../context/AuthContext'
import { formatRelativeTime, formatCurrency } from '../../lib/utils'
import api from '../../lib/api'

export default function CustomerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: jobs = [] } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: () => api.get('/jobs/my?limit=5').then(r => r.data),
  })

  const { data: notifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 30000,
  })

  const activeJobs = jobs.filter(j => !['completed','payment_recorded','reviewed','cancelled'].includes(j.status))
  const completedJobs = jobs.filter(j => ['completed','payment_recorded','reviewed'].includes(j.status))
  const totalSpent = completedJobs.reduce((s, j) => s + parseFloat(j.final_price || 0), 0)
  const unreadNotifs = notifs?.notifications?.filter(n => !n.is_read) || []

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.full_name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-slate-500 mt-1">Manage your jobs and find skilled workers</p>
          </div>
          <Link to="/jobs/new">
            <Button variant="primary" className="hidden sm:flex">
              <Plus className="w-4 h-4" /> Post a Job
            </Button>
          </Link>
        </div>

        {/* Email verification banner */}
        {!user?.is_email_verified && !user?.force_verified && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">📧</span>
            <div className="flex-1">
              <p className="font-semibold text-amber-800 text-sm">Verify your email to post jobs</p>
              <p className="text-xs text-amber-600">Check your inbox for a verification link</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Briefcase} label="Active Jobs" value={activeJobs.length} color="sky" />
          <StatCard icon={CheckCircle} label="Completed" value={completedJobs.length} color="emerald" />
          <StatCard icon={DollarSign} label="Total Spent" value={formatCurrency(totalSpent)} color="violet" />
          <StatCard icon={Bell} label="Unread" value={unreadNotifs.length} color="amber" />
        </div>

        {/* Quick actions mobile */}
        <div className="sm:hidden">
          <Link to="/jobs/new" className="block">
            <Button variant="primary" size="lg" className="w-full">
              <Plus className="w-4 h-4" /> Post a New Job
            </Button>
          </Link>
        </div>

        {/* Recent jobs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Recent Jobs</h2>
            <Link to="/jobs" className="text-sm text-sky-600 hover:underline font-medium">View all →</Link>
          </div>
          {jobs.length === 0 ? (
            <Card className="text-center py-12">
              <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Briefcase className="w-6 h-6 text-sky-400" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">No jobs yet</h3>
              <p className="text-sm text-slate-500 mb-4">Post your first job to find skilled workers near you</p>
              <Link to="/jobs/new"><Button variant="primary">Post a Job</Button></Link>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {jobs.slice(0, 4).map(job => (
                <Link key={job.id} to={`/jobs/${job.id}`}>
                  <JobCard job={job} role="customer" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent notifications */}
        {unreadNotifs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900">Recent Notifications</h2>
              <Link to="/notifications" className="text-sm text-sky-600 hover:underline font-medium">View all →</Link>
            </div>
            <Card className="divide-y divide-slate-50">
              {unreadNotifs.slice(0, 3).map(n => (
                <div key={n.id} className="flex items-start gap-3 p-4">
                  <div className="w-8 h-8 bg-sky-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                    <p className="text-xs text-slate-500">{n.body}</p>
                  </div>
                  <p className="text-xs text-slate-400 flex-shrink-0">{formatRelativeTime(n.created_at)}</p>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  )
}
