import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, SlidersHorizontal, Wrench } from 'lucide-react'
import { motion } from 'framer-motion'
import { WorkerCard } from '../../components/shared/Cards'
import { Button, Spinner, EmptyState } from '../../components/shared/UI'
import { DISTRICTS, cn } from '../../lib/utils'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

const CATEGORIES = ['All','Plumbing','Electrical','Carpentry','Cleaning','Painting','Tiling','Welding','AC Repair','Landscaping','General Labour']

export default function WorkerCatalog({ embedded, jobId, onInvite }) {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
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
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="fixly-input pl-9" placeholder="Search by name or skill..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </Button>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c === 'All' ? '' : c)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all',
              (c === 'All' ? !category : category === c) ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
            {c}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="bg-slate-50 rounded-2xl p-4 flex flex-wrap gap-3">
          <select className="fixly-input w-40 bg-white text-sm" value={district} onChange={e => setDistrict(e.target.value)}>
            <option value="">All Districts</option>
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="rounded" />
            Verified only
          </label>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : workers.length === 0 ? (
        <EmptyState icon={Wrench} title="No workers found" description="Try adjusting your search or filters" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workers.map((w, i) => (
            <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <WorkerCard
                worker={w}
                onInvite={user && onInvite ? () => onInvite(w) : undefined}
                jobId={jobId}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )

  if (embedded) return content

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-sky-600 rounded-lg flex items-center justify-center">
            <Wrench className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-black text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>Fixly</span>
        </Link>
        <div className="flex gap-2">
          {user ? (
            <Link to="/dashboard"><Button variant="primary" size="sm">Dashboard</Button></Link>
          ) : (
            <>
              <Link to="/auth"><Button variant="outline" size="sm">Sign In</Button></Link>
              <Link to="/auth?tab=register"><Button variant="primary" size="sm">Get Started</Button></Link>
            </>
          )}
        </div>
      </nav>
      <div className="fixly-page max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Find Workers</h1>
          <p className="text-slate-500">Browse {data?.total || 0} skilled professionals across Sri Lanka</p>
        </div>
        {content}
      </div>
    </div>
  )
}
