import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Briefcase, MapPin, MessageSquare, Calendar,
  Sparkles, Clock, CheckCircle2, ArrowUpRight, MoreHorizontal, Settings, Pencil, LogOut
} from 'lucide-react'
import { Badge, Avatar, Card, Spinner } from '../../components/shared/UI'
import { formatDate, formatRelativeTime } from '../../lib/utils'
import api from '../../lib/api'
import { Wrench } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { useAuth } from '../../context/AuthContext'

function StatPanel({ label, value, hint, accent = 'sky' }) {
  const accents = {
    sky: 'bg-[linear-gradient(180deg,#f8fdff_0%,#eef8ff_100%)] border-sky-100/80',
    amber: 'bg-[linear-gradient(180deg,#fffdf7_0%,#fff7e6_100%)] border-amber-100/80',
    emerald: 'bg-[linear-gradient(180deg,#f7fffb_0%,#ecfdf3_100%)] border-emerald-100/80',
    violet: 'bg-[linear-gradient(180deg,#fcfbff_0%,#f3efff_100%)] border-violet-100/80',
  }

  return (
    <div className={`rounded-[1.75rem] border p-5 ${accents[accent]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
      {hint && <p className="mt-2 text-sm text-slate-500">{hint}</p>}
    </div>
  )
}

export default function CustomerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/customers/${id}`).then(r => r.data),
  })

  useEffect(() => {
    if (!menuOpen) return undefined
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Customer not found</p>
      </div>
    )
  }

  const recentJobs = customer.recent_jobs || []
  const completionRate = customer.jobs_posted ? Math.round(((customer.jobs_completed || 0) / customer.jobs_posted) * 100) : 0
  const isOwnProfile = !!user && user.role === 'customer' && String(user.id) === String(id)

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  const content = (
    <>
      {isOwnProfile ? (
        <div className="mb-6 flex items-start justify-between gap-4 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Profile</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Public Profile</h1>
            <p className="mt-1 text-sm text-slate-500">This is the profile workers see before sending proposals or accepting your jobs.</p>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-14 z-20 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                <Link
                  to="/profile/edit"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <Pencil className="h-4 w-4" /> Edit Profile
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!isOwnProfile && (
        <nav className="border-b border-white/70 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600">
                <Wrench className="h-4 w-4 text-white" />
              </div>
              <span className="font-black text-slate-950" style={{ fontFamily: 'Syne, sans-serif' }}>Fixly</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-800">Customer Profile</span>
          </div>
        </nav>
      )}

      <div className={isOwnProfile ? 'px-6 pb-6' : 'mx-auto max-w-6xl px-6 py-8'}>
        {!isOwnProfile && (
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}

        <Card className="mt-4 overflow-hidden border-white/90 bg-white/90 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="relative p-8 lg:p-10">
              <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(120deg,rgba(225,247,255,0.98)_0%,rgba(90,200,250,0.75)_42%,rgba(172,247,226,0.82)_100%)]" />
              <div className="relative">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                  <Avatar
                    name={customer.full_name}
                    src={customer.profile_photo}
                    size="xl"
                    className="ring-4 ring-white shadow-[0_20px_40px_rgba(15,23,42,0.14)]"
                  />
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-4xl font-black tracking-tight text-slate-950">{customer.full_name}</h1>
                      <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">Customer</span>
                    </div>
                    <p className="mt-3 max-w-2xl text-[15px] leading-8 text-slate-600">
                      Active on Fixly with a visible posting history, completed-job track record, and worker review footprint.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-6 text-sm text-slate-600">
                      {(customer.district || customer.area) && (
                        <span className="inline-flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          {[customer.district, customer.area].filter(Boolean).join(', ')}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        Joined {formatDate(customer.created_at)}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                        {completionRate}% completion signal
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-[linear-gradient(180deg,#fbfdff_0%,#f3f9ff_100%)] p-8 xl:border-l xl:border-t-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-500">Trust Snapshot</p>
              <div className="mt-6 space-y-4 text-sm text-slate-600">
                <div className="rounded-[1.5rem] border border-sky-100 bg-white p-5 shadow-[0_14px_30px_rgba(14,165,233,0.08)]">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" />
                    <span>{customer.jobs_posted || 0} jobs posted on Fixly</span>
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-[0_14px_30px_rgba(16,185,129,0.08)]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                    <span>{customer.jobs_completed || 0} completed jobs so far</span>
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-violet-100 bg-white p-5 shadow-[0_14px_30px_rgba(139,92,246,0.08)]">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-500" />
                    <span>{customer.reviews_given || 0} worker review{customer.reviews_given === 1 ? '' : 's'} written</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <StatPanel label="Jobs Posted" value={customer.jobs_posted || 0} hint="Public activity footprint" accent="sky" />
          <StatPanel label="Active Jobs" value={customer.active_jobs || 0} hint="Current live jobs on platform" accent="amber" />
          <StatPanel label="Completed Jobs" value={customer.jobs_completed || 0} hint="Signals follow-through" accent="emerald" />
          <StatPanel label="Reviews Given" value={customer.reviews_given || 0} hint="Worker-facing accountability" accent="violet" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-white/80 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">Recent Jobs</h2>
              <span className="text-sm text-slate-400">{recentJobs.length} shown</span>
            </div>

            {recentJobs.length === 0 ? (
              <div className="mt-5 rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                No public job history yet.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {recentJobs.map(job => (
                  <div key={job.id} className="rounded-[1.75rem] border border-slate-100 bg-slate-50/70 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {job.category_name && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{job.category_name}</span>}
                          <Badge status={job.status} />
                        </div>
                        <p className="mt-3 text-lg font-semibold text-slate-900">{job.title}</p>
                        <p className="mt-2 text-sm text-slate-500">
                          {job.proposal_count || 0} proposal{job.proposal_count === 1 ? '' : 's'} received
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-slate-400">{formatRelativeTime(job.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="border-white/80 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <h2 className="text-2xl font-black tracking-tight text-slate-950">How This Profile Helps Workers</h2>
            <div className="mt-5 space-y-5 text-sm leading-7 text-slate-600">
              <p>
                Workers want clear signs that a customer is legitimate, active, and likely to close the job properly.
              </p>
              <p>
                Posting volume, completion history, and review activity are stronger marketplace trust signals than decorative profile content.
              </p>
              <p>
                This page is intentionally built around confidence, not biography.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  )

  if (isOwnProfile) {
    return (
      <AppShell>
        <div className="min-h-full bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.10),_transparent_24%),radial-gradient(circle_at_top_left,_rgba(56,189,248,0.09),_transparent_28%),linear-gradient(180deg,#f8fbff_0%,#f6f9fc_100%)]">
          {content}
        </div>
      </AppShell>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.10),_transparent_24%),radial-gradient(circle_at_top_left,_rgba(56,189,248,0.09),_transparent_28%),linear-gradient(180deg,#f8fbff_0%,#f6f9fc_100%)]">
      {content}
    </div>
  )
}
