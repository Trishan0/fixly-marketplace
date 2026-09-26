import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Plus, Briefcase } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, PageHeader, Spinner, EmptyState } from '../../components/shared/UI'
import { JobCard } from '../../components/shared/Cards'
import { LoadMore } from '../../components/shared/LoadMore'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { usePageTitle } from '../../hooks/usePageTitle'
import { cn } from '../../lib/utils'
import api from '../../lib/api'

const PAGE_SIZE = 20

const TABS = [
  { key: 'all', label: 'All', countKey: 'total', empty: { title: 'No jobs yet', description: 'Post your first job and local workers will start sending proposals.' } },
  { key: 'active', label: 'Active', countKey: 'active', empty: { title: 'No active jobs', description: 'Jobs you post, and jobs in progress, will show here.' } },
  { key: 'completed', label: 'Completed', countKey: 'completed', empty: { title: 'No completed jobs yet', description: 'Finished jobs, payments and reviews will show here.' } },
  { key: 'cancelled', label: 'Cancelled', countKey: 'cancelled', empty: { title: 'No cancelled jobs', description: 'Jobs you cancel will show here.' } },
]

// Jobs with proposals waiting on the customer come first within a page.
function byPriority(a, b) {
  const aPriority = a.status === 'proposals_received' && Number(a.proposal_count || 0) > 0 ? 0 : 1
  const bPriority = b.status === 'proposals_received' && Number(b.proposal_count || 0) > 0 ? 0 : 1
  if (aPriority !== bPriority) return aPriority - bPriority
  return new Date(b.created_at) - new Date(a.created_at)
}

export default function MyJobs() {
  const [tab, setTab] = useState('all')
  usePageTitle('My jobs')
  const activeTab = TABS.find(item => item.key === tab)

  const { data: summary } = useQuery({
    queryKey: ['my-jobs', 'summary'],
    queryFn: () => api.get('/jobs/my/summary').then(r => r.data),
  })

  const {
    data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['my-jobs', 'list', tab],
    queryFn: ({ pageParam }) => api.get('/jobs/my', {
      params: { group: tab === 'all' ? undefined : tab, page: pageParam, limit: PAGE_SIZE },
    }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined),
  })

  const jobs = (data?.pages.flat() || []).sort(byPriority)
  const total = summary?.[activeTab.countKey]

  return (
    <AppShell>
      <div className="fixly-page max-w-7xl">
        <PageHeader
          title="My jobs"
          description="Track every job you’ve posted"
          action={
            <Link to="/jobs/new">
              <Button variant="primary"><Plus className="h-4 w-4" />Post a job</Button>
            </Link>
          }
        />

        <div className="fixly-tab-strip -mx-1 mb-6 w-[calc(100%+0.5rem)] sm:mx-0 sm:w-fit" role="tablist" aria-label="Filter jobs">
          {TABS.map(t => {
            const count = summary?.[t.countKey]
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn('fixly-tab flex-1 sm:flex-none', tab === t.key && 'active')}
              >
                {t.label}
                {typeof count === 'number' && (
                  <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : isError ? (
          <ErrorFallback title="We couldn’t load your jobs" description="Check your connection and try again." onRetry={() => refetch()} />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={activeTab.empty.title}
            description={activeTab.empty.description}
            action={tab === 'all' || tab === 'active' ? <Link to="/jobs/new"><Button variant="primary">Post a job</Button></Link> : null}
          />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {jobs.map(job => (
                <Link key={job.id} to={`/jobs/${job.id}`} className="block rounded-2xl sm:rounded-3xl">
                  <JobCard job={job} role="customer" />
                </Link>
              ))}
            </div>
            <LoadMore
              shown={jobs.length}
              total={total}
              noun={total === 1 ? 'job' : 'jobs'}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={() => fetchNextPage()}
            />
          </div>
        )}
      </div>
    </AppShell>
  )
}
