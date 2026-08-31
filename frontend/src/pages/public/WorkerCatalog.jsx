import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, SlidersHorizontal, Wrench, X } from 'lucide-react'
import { WorkerCard } from '../../components/shared/Cards'
import { Button, Spinner, EmptyState } from '../../components/shared/UI'
import { DISTRICTS, cn } from '../../lib/utils'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { PublicNavbar } from '../../components/shared/PublicNavbar'
import { PublicFooter } from '../../components/shared/PublicFooter'

const CATEGORIES = ['All','Plumbing','Electrical','Carpentry','Cleaning','Painting','Tiling','Welding','AC Repair','Landscaping','General Labour']

export default function WorkerCatalog({ embedded, jobId, onInvite }) {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(() => params.get('category') || '')
  const [district, setDistrict] = useState('')
  const [verified, setVerified] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['workers', { category, district, verified, search }],
    queryFn: () => api.get('/workers', { params: { category, district, verified: verified || undefined, search } }).then(r => r.data),
    staleTime: 60000,
  })

  const workers = data?.workers || []

  const content = (
    <div className="space-y-6">
      {/* Search */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input aria-label="Search workers" className="fixly-input pl-9" placeholder="Name or skill" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} aria-controls="worker-filters" className="px-3 sm:px-5">
          <SlidersHorizontal className="h-4 w-4" /> <span className="hidden sm:inline">Filters</span>
          {(district || verified) && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] text-white">{Number(Boolean(district)) + Number(verified)}</span>}
        </Button>
      </div>

      {/* Category pills */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Worker categories">
        {CATEGORIES.map(c => (
          <button key={c} type="button" onClick={() => setCategory(c === 'All' ? '' : c)} aria-pressed={(c === 'All' ? !category : category === c)}
            className={cn('min-h-10 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all',
              (c === 'All' ? !category : category === c) ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700')}>
            {c}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div id="worker-filters" className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60">
          <div className="mb-3 flex items-center justify-between sm:hidden">
            <p className="font-bold text-slate-900">Filter workers</p>
            <button type="button" onClick={() => setShowFilters(false)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500" aria-label="Close filters"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center">
            <select aria-label="Filter by district" className="fixly-input w-full bg-white text-sm dark:bg-slate-900 sm:w-48" value={district} onChange={e => setDistrict(e.target.value)}>
              <option value="">All Districts</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="h-5 w-5 rounded" />
              Verified workers only
            </label>
            {(district || verified) && (
              <button type="button" onClick={() => { setDistrict(''); setVerified(false) }} className="min-h-11 px-3 text-sm font-semibold text-sky-600 dark:text-sky-300">Clear filters</button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : workers.length === 0 ? (
        <EmptyState icon={Wrench} title="No workers found" description="Try adjusting your search or filters" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workers.map((w) => (
            <div key={w.id}>
              <WorkerCard
                worker={w}
                onInvite={user && onInvite ? () => onInvite(w) : undefined}
                jobId={jobId}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (embedded) return content

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950">
      <PublicNavbar />
      <div className="fixly-page max-w-7xl">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">Local professionals</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Find the right worker</h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">Browse {data?.total || 0} skilled professionals across Sri Lanka</p>
        </div>
        {content}
      </div>
      <PublicFooter />
    </div>
  )
}
