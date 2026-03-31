import React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Briefcase, MapPin, MessageSquare, Calendar, Sparkles, Clock, CheckCircle2 } from 'lucide-react'
import { Badge, Avatar, Card, Spinner } from '../../components/shared/UI'
import { formatDate, formatRelativeTime } from '../../lib/utils'
import api from '../../lib/api'
import { Wrench } from 'lucide-react'

export default function CustomerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/customers/${id}`).then(r => r.data),
  })

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
  const trustNotes = [
    `${customer.jobs_posted || 0} jobs posted on Fixly`,
    `${customer.jobs_completed || 0} completed jobs so far`,
    `${customer.reviews_given || 0} worker reviews written`,
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-sky-600 rounded-lg flex items-center justify-center">
            <Wrench className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-black text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>Fixly</span>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-700 font-medium">Customer Profile</span>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <Card className="p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-sky-600 via-cyan-500 to-emerald-400 h-28" />
          <div className="px-6 pb-6 -mt-12">
            <div className="flex flex-col lg:flex-row gap-5 items-start">
              <Avatar name={customer.full_name} src={customer.profile_photo} size="xl" className="ring-4 ring-white shadow-lg" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-3xl font-black text-slate-900">{customer.full_name}</h1>
                  <Badge className="bg-slate-100 text-slate-700">Customer</Badge>
                </div>
                <p className="text-slate-500 mt-1">Reliable job poster on Fixly</p>
                <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-500">
                  {(customer.district || customer.area) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {[customer.district, customer.area].filter(Boolean).join(', ')}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> Joined {formatDate(customer.created_at)}
                  </span>
                </div>
              </div>
              <div className="w-full lg:w-72 rounded-3xl bg-slate-950 text-white p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Trust Snapshot</p>
                <div className="space-y-3">
                  {trustNotes.map(note => (
                    <div key={note} className="flex items-start gap-2 text-sm text-slate-100">
                      <Sparkles className="w-4 h-4 text-cyan-300 mt-0.5 flex-shrink-0" />
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-4 gap-4">
          <Card className="p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Jobs Posted</p>
            <p className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-sky-600" /> {customer.jobs_posted || 0}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Active Jobs</p>
            <p className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" /> {customer.active_jobs || 0}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Completed Jobs</p>
            <p className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> {customer.jobs_completed || 0}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Reviews Given</p>
            <p className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-violet-600" /> {customer.reviews_given || 0}
            </p>
          </Card>
        </div>

        <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900 text-xl">Recent Jobs</h2>
              <span className="text-sm text-slate-400">{recentJobs.length} shown</span>
            </div>
            {recentJobs.length === 0 ? (
              <p className="text-sm text-slate-500">No public job history yet.</p>
            ) : (
              <div className="space-y-4">
                {recentJobs.map(job => (
                  <div key={job.id} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {job.category_name && <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full">{job.category_name}</span>}
                          <Badge status={job.status} />
                        </div>
                        <p className="font-semibold text-slate-900">{job.title}</p>
                        <p className="text-xs text-slate-500 mt-2">
                          {job.proposal_count || 0} proposal{job.proposal_count !== 1 ? 's' : ''} received
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">{formatRelativeTime(job.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-bold text-slate-900 text-xl mb-4">What Workers See</h2>
            <div className="space-y-4 text-sm text-slate-600">
              <p>Workers can quickly tell this customer is active, has a history of completing jobs, and regularly leaves reviews.</p>
              <p>A fuller customer profile helps workers feel safer about spending time on quotes, inspections, and follow-up messages.</p>
              <p>These signals are intentionally trust-focused instead of social-style details.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
