import React from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { CheckCircle2, ChevronRight, MapPin } from 'lucide-react'
import { Avatar, StarRating } from './UI'
import { ProfileEmpty, ProfileSectionCard } from './ProfileLayout'
import { Button, IconChip, Skeleton } from '../ui'
import { categoryStyle } from '../../lib/tones'
import { shortDate } from '../../lib/jobs'
import api from '../../lib/api'

const PAGE_SIZE = 6

/**
 * A profile's finished jobs; each row opens the public job page.
 * `showWorker` names who did the job (for a customer's history).
 */
export function CompletedJobsSection({ endpoint, queryKey, showWorker = false, emptyText = 'No completed jobs yet.' }) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => api.get(endpoint, { params: { page: pageParam, limit: PAGE_SIZE } }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (pages.length * PAGE_SIZE < lastPage.total ? pages.length + 1 : undefined),
  })
  const jobs = query.data?.pages.flatMap(page => page.jobs) || []
  const total = query.data?.pages[0]?.total ?? 0

  return (
    <ProfileSectionCard title="Completed jobs" meta={total > 0 ? `${total} done on Fixly` : null} bodyClassName={jobs.length > 0 || query.isLoading ? 'p-0' : undefined}>
      {query.isLoading ? (
        <div className="space-y-px p-4 sm:p-5" aria-busy="true">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : query.isError ? (
        <ProfileEmpty icon={CheckCircle2}>
          We couldn’t load completed jobs. <button type="button" onClick={() => query.refetch()} className="font-semibold text-brand-text hover:underline">Try again</button>
        </ProfileEmpty>
      ) : jobs.length === 0 ? (
        <ProfileEmpty icon={CheckCircle2}>{emptyText}</ProfileEmpty>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {jobs.map(job => <CompletedJobRow key={job.id} job={job} showWorker={showWorker} />)}
          </ul>
          {query.hasNextPage && (
            <div className="flex justify-center border-t border-line p-3">
              <Button variant="secondary" size="sm" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>Show more jobs</Button>
            </div>
          )}
        </>
      )}
    </ProfileSectionCard>
  )
}

function CompletedJobRow({ job, showWorker }) {
  const { icon, tone } = categoryStyle(job.category_name)
  const place = [job.town, job.district].filter(Boolean).join(', ')
  return (
    <li>
      <Link to={`/completed-jobs/${job.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none sm:px-5">
        {job.cover_photo
          ? <img src={job.cover_photo} alt="" className="h-10 w-10 shrink-0 rounded-[10px] border border-line object-cover" />
          : <IconChip icon={icon} tone={tone} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{job.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-fg-muted">
            {job.category_name && <span>{job.category_name}</span>}
            {place && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />{place}</span>}
            <span>Done {shortDate(job.completed_at)}</span>
          </p>
          {showWorker && job.worker_name && (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-fg-muted">
              <Avatar name={job.worker_name} src={job.worker_photo} size="sm" className="h-5 w-5 text-[9px]" />
              by {job.worker_name}
            </p>
          )}
        </div>
        {job.rating && <span className="hidden sm:block"><StarRating rating={job.rating} /></span>}
        <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
      </Link>
    </li>
  )
}
