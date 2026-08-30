import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Briefcase } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, PageHeader, Spinner, EmptyState } from '../../components/shared/UI'
import { JobCard } from '../../components/shared/Cards'
import { cn } from '../../lib/utils'
import api from '../../lib/api'

const TABS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

const ACTIVE_STATUSES = ['posted','proposals_received','assigned','in_progress']

export default function MyJobs() {
  const [tab, setTab] = useState('')

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['my-jobs', tab],
    queryFn: () => api.get('/jobs/my').then(r => r.data),
  })

  const filtered = jobs.filter(j => {
    if (tab === 'active') return ACTIVE_STATUSES.includes(j.status)
    if (tab === 'completed') return ['completed','payment_recorded','reviewed'].includes(j.status)
    if (tab === 'cancelled') return j.status === 'cancelled'
    return true
  })
  const sorted = [...filtered].sort((a, b) => {
    const aPriority = a.status === 'proposals_received' && Number(a.proposal_count || 0) > 0 ? 0 : 1
    const bPriority = b.status === 'proposals_received' && Number(b.proposal_count || 0) > 0 ? 0 : 1
    if (aPriority !== bPriority) return aPriority - bPriority
    return new Date(b.created_at) - new Date(a.created_at)
  })

  return (
    <AppShell>
      <div className="fixly-page max-w-7xl">
        <PageHeader
          title="My Jobs"
          description="Track all your posted jobs"
          action={
            <Link to="/jobs/new">
              <Button variant="primary"><Plus className="w-4 h-4" />Post Job</Button>
            </Link>
          }
        />

        {/* Tabs */}
        <div className="fixly-tab-strip -mx-1 mb-6 w-[calc(100%+0.5rem)] sm:mx-0 sm:w-fit" role="tablist" aria-label="Filter jobs">
          {TABS.map(t => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={cn('fixly-tab flex-1 sm:flex-none', tab === t.key && 'active')}>
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Briefcase} title="No jobs found" description="Post your first job to get started"
            action={<Link to="/jobs/new"><Button variant="primary">Post a Job</Button></Link>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sorted.map(job => (
              <Link key={job.id} to={`/jobs/${job.id}`}>
                <JobCard job={job} role="customer" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
