import React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Briefcase, MapPin, MessageSquare, Calendar } from 'lucide-react'
import { Avatar, Card, Spinner } from '../../components/shared/UI'
import { formatDate } from '../../lib/utils'
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

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        <Card className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <Avatar name={customer.full_name} src={customer.profile_photo} size="xl" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">{customer.full_name}</h1>
              <p className="text-slate-500 mt-1">Customer on Fixly</p>
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
          </div>
        </Card>

        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Jobs Posted</p>
            <p className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-sky-600" /> {customer.jobs_posted || 0}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Completed Jobs</p>
            <p className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-600" /> {customer.jobs_completed || 0}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Reviews Given</p>
            <p className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-violet-600" /> {customer.reviews_given || 0}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
