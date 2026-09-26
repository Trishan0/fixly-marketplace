import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { BadgeCheck, Search, SlidersHorizontal, Wrench, X } from 'lucide-react'
import { WorkerCard } from '../../components/shared/Cards'
import { Button, Card, EmptyState, Page, PageHeader, Skeleton } from '../../components/ui'
import { useCategories } from '../../hooks/useCategories'
import { DISTRICTS, cn } from '../../lib/utils'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { PublicNavbar } from '../../components/shared/PublicNavbar'
import { PublicFooter } from '../../components/shared/PublicFooter'
import { LoadMore } from '../../components/shared/LoadMore'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePageTitle } from '../../hooks/usePageTitle'

const PAGE_SIZE = 24


export default function WorkerCatalog({ embedded, onInvite }) {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(() => params.get('category') || '')
  const [district, setDistrict] = useState('')
  const [verified, setVerified] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const debouncedSearch = useDebouncedValue(search.trim())
  const { categories } = useCategories()
  usePageTitle(embedded ? null : 'Browse workers')

  const {
    data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['workers', { category, district, verified, search: debouncedSearch }],
    queryFn: ({ pageParam }) => api.get('/workers', {
      params: { category: category || undefined, district: district || undefined, verified: verified || undefined, search: debouncedSearch || undefined, page: pageParam, limit: PAGE_SIZE },
    }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + page.workers.length, 0)
      return loaded < lastPage.total ? pages.length + 1 : undefined
    },
    staleTime: 60000,
  })

  const workers = data?.pages.flatMap(page => page.workers) || []
  const total = data?.pages[0]?.total

  const activeFilters = Number(Boolean(category)) + Number(Boolean(district)) + Number(verified)

  const content = (
    <div className="space-y-5">
      <Card as="div" className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
              <input type="search" aria-label="Search workers" className="fixly-input pl-9" placeholder="Search by name or skill" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button variant="secondary" className="lg:hidden" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} aria-controls="worker-filters">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {activeFilters > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] text-brand-on">{activeFilters}</span>}
              <span className="sr-only">Filters</span>
            </Button>
          </div>
          <div id="worker-filters" className={cn('grid gap-2 sm:grid-cols-3 lg:flex lg:w-auto lg:items-center', !showFilters && 'hidden lg:flex')}>
            <select aria-label="Filter by category" className="fixly-input fixly-select lg:w-44" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select aria-label="Filter by district" className="fixly-input fixly-select lg:w-44" value={district} onChange={e => setDistrict(e.target.value)}>
              <option value="">All districts</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <label className="flex h-10 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-control border border-line bg-surface px-3 text-sm font-medium text-fg hover:bg-subtle [@media(pointer:coarse)]:h-11">
              <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="h-4 w-4 rounded border-line-strong accent-sky-600" />
              <BadgeCheck className="h-4 w-4 text-brand-text" aria-hidden="true" /> Verified only
            </label>
            {activeFilters > 0 && (
              <Button variant="ghost" onClick={() => { setCategory(''); setDistrict(''); setVerified(false) }}><X className="h-4 w-4" aria-hidden="true" /> Clear</Button>
            )}
          </div>
        </div>
      </Card>

      {typeof total === 'number' && !isLoading && (
        <p className="text-[13px] text-fg-muted" aria-live="polite">{total.toLocaleString('en-LK')} {total === 1 ? 'worker' : 'workers'}{category ? ` in ${category}` : ''}{district ? ` · ${district}` : ''}</p>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-56 w-full rounded-card" />)}</div>
      ) : isError ? (
        <ErrorFallback title="We couldn’t load workers" description="Check your connection and try again." onRetry={() => refetch()} />
      ) : workers.length === 0 ? (
        <Card><EmptyState icon={Wrench} title="No workers found" description="Try a different skill, district or search term." /></Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workers.map((w) => (
              <WorkerCard
                key={w.id}
                worker={w}
                onInvite={user && onInvite ? () => onInvite(w) : undefined}
              />
            ))}
          </div>
          <LoadMore
            shown={workers.length}
            total={total}
            noun={total === 1 ? 'worker' : 'workers'}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
          />
        </>
      )}
    </div>
  )

  if (embedded) return content

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <PublicNavbar />
      <Page>
        <PageHeader
          title="Find the right worker"
          description={typeof total === 'number' ? `${total.toLocaleString('en-LK')} skilled ${total === 1 ? 'professional' : 'professionals'} across Sri Lanka` : 'Skilled professionals across Sri Lanka'}
        />
        {content}
      </Page>
      <PublicFooter />
    </div>
  )
}
