import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Briefcase, ChevronRight, Plus, Search, X } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Card, EmptyState, IconChip, JobStatusBadge, Page, PageHeader, PersonAvatar, RowLink, Skeleton, Table, Tabs, Td, Th } from '../../components/ui'
import { categoryStyle } from '../../lib/tones'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePageTitle } from '../../hooks/usePageTitle'
import { pluralize } from '../../lib/utils'
import { jobPriceLabel, shortDate } from '../../lib/jobs'
import api from '../../lib/api'

const PAGE_SIZE = 20

const TABS = [
  { value: 'all', label: 'All', countKey: 'total', empty: { title: 'No jobs yet', description: 'Post your first job and local workers will start sending proposals.' } },
  { value: 'active', label: 'Active', countKey: 'active', empty: { title: 'No active jobs', description: 'Jobs you post, and jobs in progress, will show here.' } },
  { value: 'completed', label: 'Completed', countKey: 'completed', empty: { title: 'No completed jobs yet', description: 'Finished jobs, payments and reviews will show here.' } },
  { value: 'cancelled', label: 'Cancelled', countKey: 'cancelled', empty: { title: 'No cancelled jobs', description: 'Jobs you cancel will show here.' } },
]

function Meta({ job }) {
  return (
    <>
      {[job.category_name, job.town || job.district].filter(Boolean).join(' · ')}
      {Number(job.pending_proposal_count) > 0 && (
        <span className="font-semibold text-indigo-600 dark:text-indigo-300"> · {pluralize(job.pending_proposal_count, 'new proposal')}</span>
      )}
    </>
  )
}

export default function MyJobs() {
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const query = useDebouncedValue(search.trim())
  usePageTitle('My jobs')
  const activeTab = TABS.find(item => item.value === tab)

  const { data: summary } = useQuery({
    queryKey: ['my-jobs', 'summary'],
    queryFn: () => api.get('/jobs/my/summary').then(r => r.data),
  })

  const {
    data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching,
  } = useInfiniteQuery({
    queryKey: ['my-jobs', 'list', tab, query],
    queryFn: ({ pageParam }) => api.get('/jobs/my', {
      params: { group: tab === 'all' ? undefined : tab, search: query || undefined, page: pageParam, limit: PAGE_SIZE },
    }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined),
    placeholderData: previous => previous,
  })
  const jobs = data?.pages.flat() || []
  const total = query ? undefined : summary?.[activeTab.countKey]

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="My jobs"
          description="Every job you’ve posted, from open to completed."
          actions={<Button to="/jobs/new"><Plus className="h-4 w-4" aria-hidden="true" /> Post a job</Button>}
        />

        <Card>
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <Tabs
              label="Filter jobs"
              value={tab}
              onChange={setTab}
              tabs={TABS.map(t => ({ value: t.value, label: t.label, count: summary?.[t.countKey] }))}
            />
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search jobs"
                aria-label="Search jobs"
                className="h-10 w-full rounded-control border border-line bg-surface pl-9 pr-8 text-sm text-fg shadow-xs placeholder:text-fg-subtle focus:border-brand focus:outline-none focus:ring-4 focus:ring-sky-500/15 [@media(pointer:coarse)]:h-11"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-fg-subtle hover:text-fg" aria-label="Clear search">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="border-t border-line" />

          {isLoading ? (
            <div className="space-y-3 p-5">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-11 w-full" />)}</div>
          ) : isError ? (
            <ErrorFallback title="We couldn’t load your jobs" description="Check your connection and try again." onRetry={() => refetch()} />
          ) : jobs.length === 0 ? (
            query ? (
              <EmptyState icon={Search} title="No matching jobs" description={`Nothing matches “${query}”. Try a different word.`} action={<Button variant="secondary" size="sm" onClick={() => setSearch('')}>Clear search</Button>} />
            ) : (
              <EmptyState
                icon={Briefcase}
                title={activeTab.empty.title}
                description={activeTab.empty.description}
                action={tab === 'all' || tab === 'active' ? <Button to="/jobs/new" size="sm"><Plus className="h-4 w-4" aria-hidden="true" /> Post a job</Button> : null}
              />
            )
          ) : (
            <div className={isFetching && !isFetchingNextPage ? 'opacity-60 transition-opacity' : undefined}>
              <div className="hidden md:block">
                <Table>
                  <thead>
                    <tr>
                      <Th className="w-full">Job</Th>
                      <Th>Status</Th>
                      <Th>Worker</Th>
                      <Th align="right">Price</Th>
                      <Th align="right">Posted</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => (
                      <RowLink key={job.id}>
                        <Td className="max-w-0">
                          <div className="flex min-w-0 items-center gap-3">
                            <IconChip {...categoryStyle(job.category_name)} size="sm" />
                            <div className="min-w-0">
                              <Link
                                to={`/jobs/${job.id}`}
                                className="block truncate font-semibold text-fg after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand"
                              >
                                {job.title}
                              </Link>
                              <span className="block truncate text-[13px] text-fg-muted"><Meta job={job} /></span>
                            </div>
                          </div>
                        </Td>
                        <Td><JobStatusBadge status={job.status} /></Td>
                        <Td className="whitespace-nowrap">
                          {job.assigned_worker_name ? (
                            <span className="flex items-center gap-2">
                              <PersonAvatar name={job.assigned_worker_name} src={job.assigned_worker_photo} size="xs" />
                              <span className="text-fg">{job.assigned_worker_name}</span>
                            </span>
                          ) : <span className="text-fg-subtle">Not hired yet</span>}
                        </Td>
                        <Td align="right" className="whitespace-nowrap font-medium">{jobPriceLabel(job)}</Td>
                        <Td align="right" className="whitespace-nowrap text-fg-muted" title={new Date(job.created_at).toLocaleString('en-LK')}>{shortDate(job.created_at)}</Td>
                      </RowLink>
                    ))}
                  </tbody>
                </Table>
              </div>

              <ul className="divide-y divide-line md:hidden">
                {jobs.map(job => (
                  <li key={job.id}>
                    <Link to={`/jobs/${job.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-brand-subtle/50">
                      <IconChip {...categoryStyle(job.category_name)} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-fg">{job.title}</span>
                          <span className="shrink-0 text-[13px] font-medium text-fg">{jobPriceLabel(job)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] text-fg-muted"><Meta job={job} /></span>
                        <span className="mt-1.5 flex items-center gap-2 text-xs text-fg-subtle">
                          <JobStatusBadge status={job.status} />
                          <span>{shortDate(job.created_at)}</span>
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col items-center gap-3 border-t border-line px-4 py-3 text-[13px] text-fg-muted sm:flex-row sm:justify-between sm:px-5">
                <span aria-live="polite">
                  {typeof total === 'number' ? `Showing ${jobs.length} of ${total}` : pluralize(jobs.length, 'job')}
                </span>
                {hasNextPage && (
                  <Button variant="secondary" size="sm" onClick={() => fetchNextPage()} loading={isFetchingNextPage}>Load more</Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </Page>
    </AppShell>
  )
}
