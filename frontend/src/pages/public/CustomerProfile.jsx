import React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, MapPin, MessageSquare, Calendar,
  Sparkles, CheckCircle2, ArrowUpRight, Briefcase, Clock
} from 'lucide-react'
import { Badge, Card, Spinner } from '../../components/shared/UI'
import {
  ProfileHeroCard,
  ProfilePageIntro,
  ProfileSectionCard,
  ProfileStatPanel,
  PublicPageChrome,
} from '../../components/shared/ProfileLayout'
import { formatDate, formatRelativeTime } from '../../lib/utils'
import api from '../../lib/api'
import { AppShell } from '../../components/layout/AppShell'
import { useAuth } from '../../context/AuthContext'

export default function CustomerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/customers/${id}`).then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-500">Customer not found</p>
      </div>
    )
  }

  const recentJobs = customer.recent_jobs || []
  const completionRate = customer.jobs_posted ? Math.round(((customer.jobs_completed || 0) / customer.jobs_posted) * 100) : 0
  const isOwnProfile = !!user && user.role === 'customer' && String(user.id) === String(id)
  const useShell = !!user

  const content = (
    <>
      {useShell ? (
        <div className="p-6">
          <ProfilePageIntro
            ownView={isOwnProfile}
            title={isOwnProfile ? 'Public Profile' : customer.full_name}
            subtitle={isOwnProfile ? 'This is the profile workers see before sending proposals or accepting your jobs.' : 'Customer profile inside your Fixly workspace.'}
          />
          <CustomerProfileBody customer={customer} recentJobs={recentJobs} completionRate={completionRate} />
        </div>
      ) : (
        <>
          <PublicPageChrome crumbLabel="Customers" currentLabel={customer.full_name} />
          <div className="fixly-page max-w-7xl">
            <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <CustomerProfileBody customer={customer} recentJobs={recentJobs} completionRate={completionRate} />
          </div>
        </>
      )}
    </>
  )

  if (useShell) {
    return (
      <AppShell>
        <div className="min-h-full bg-slate-50 dark:bg-slate-950">{content}</div>
      </AppShell>
    )
  }

  return <div className="min-h-screen bg-slate-50 dark:bg-slate-950">{content}</div>
}

function CustomerProfileBody({ customer, recentJobs, completionRate }) {
  return (
    <>
      <ProfileHeroCard
        avatarName={customer.full_name}
        avatarSrc={customer.profile_photo}
        header={(
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{customer.full_name}</h1>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">Customer</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-6 text-sm text-slate-600">
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
        )}
        summary={(
          <p className="max-w-3xl text-[15px] leading-8 text-slate-600">
            Active on Fixly with visible job activity, completed work history, and worker-facing review signals that help professionals judge reliability quickly.
          </p>
        )}
        stats={(
          <>
            <ProfileStatPanel label="Jobs Posted" value={customer.jobs_posted || 0} hint="Public activity footprint" accent="sky" />
            <ProfileStatPanel label="Active Jobs" value={customer.active_jobs || 0} hint="Current live jobs on platform" accent="amber" />
            <ProfileStatPanel label="Completed Jobs" value={customer.jobs_completed || 0} hint="Signals follow-through" accent="emerald" />
          </>
        )}
        asideTitle="Trust Snapshot"
        asideContent={(
          <>
            <div className="rounded-[1.5rem] border border-sky-100 bg-white p-5 dark:border-sky-900/50 dark:bg-slate-900">
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" />
                <span>{customer.jobs_posted || 0} jobs posted on Fixly</span>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 dark:border-emerald-900/50 dark:bg-slate-900">
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                <span>{customer.jobs_completed || 0} completed jobs so far</span>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-violet-100 bg-white p-5 dark:border-violet-900/50 dark:bg-slate-900">
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-500" />
                <span>{customer.reviews_given || 0} worker review{customer.reviews_given === 1 ? '' : 's'} written</span>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Why This Matters</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Workers want to know the customer is active, finishes jobs properly, and leaves a reliable communication trail.
              </p>
            </div>
          </>
        )}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ProfileSectionCard title="Recent Jobs" meta={`${recentJobs.length} shown`}>
          {recentJobs.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              No public job history yet.
            </div>
          ) : (
            <div className="space-y-4">
              {recentJobs.map(job => (
                <Card key={job.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-5 shadow-none">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {job.category_name && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{job.category_name}</span>}
                        <Badge status={job.status} />
                      </div>
                      <p className="mt-3 text-lg font-semibold text-slate-900">{job.title}</p>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="h-4 w-4 text-slate-400" /> {job.proposal_count || 0} proposal{job.proposal_count === 1 ? '' : 's'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-4 w-4 text-slate-400" /> {formatRelativeTime(job.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ProfileSectionCard>

        <ProfileSectionCard title="Reliability Signals">
          <div className="space-y-4 text-sm leading-7 text-slate-600">
            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
              Job volume, completion history, and review activity are stronger marketplace trust signals than decorative profile content.
            </div>
            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
              This profile is intentionally optimized to help workers decide quickly whether the customer looks active and legitimate.
            </div>
            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
              Review-writing history shows accountability after work is completed.
            </div>
          </div>
        </ProfileSectionCard>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <ProfileStatPanel label="Jobs Posted" value={customer.jobs_posted || 0} hint="Public activity footprint" accent="sky" />
        <ProfileStatPanel label="Active Jobs" value={customer.active_jobs || 0} hint="Current live jobs on platform" accent="amber" />
        <ProfileStatPanel label="Completed Jobs" value={customer.jobs_completed || 0} hint="Signals follow-through" accent="emerald" />
        <ProfileStatPanel label="Reviews Given" value={customer.reviews_given || 0} hint="Worker-facing accountability" accent="violet" />
      </div>
    </>
  )
}
