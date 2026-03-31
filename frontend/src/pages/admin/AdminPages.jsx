import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Users, Briefcase, FileText, Tag, BarChart3, Shield, Search, CheckCircle, XCircle, AlertTriangle, Ban, ArrowRight, Clock3 } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { StatCard, Card, Button, Badge, PageHeader, Spinner, Input, Select, Modal, Avatar, EmptyState } from '../../components/shared/UI'
import { useToast } from '../../hooks/useToast'
import { formatDate, formatCurrency, cn } from '../../lib/utils'
import api from '../../lib/api'

// Admin Dashboard
export function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: workers = [] } = useQuery({
    queryKey: ['admin-workers-dashboard'],
    queryFn: () => api.get('/admin/workers').then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: reports = [] } = useQuery({
    queryKey: ['admin-reports-dashboard'],
    queryFn: () => api.get('/admin/reports').then(r => r.data),
    refetchInterval: 60000,
  })

  const pendingWorkers = workers.filter(w => w.nic_image_path && !w.is_nic_verified)
  const openReports = reports.filter(r => r.status === 'open')
  const reviewedReports = reports.filter(r => r.status !== 'open')
  const actionCards = [
    {
      to: '/admin/users',
      icon: Users,
      title: 'Manage Users',
      desc: 'Search accounts, suspend abuse, and adjust verification flags.',
      accent: 'sky',
    },
    {
      to: '/admin/workers',
      icon: Shield,
      title: 'Verify Workers',
      desc: `${pendingWorkers.length} worker${pendingWorkers.length === 1 ? '' : 's'} currently waiting for NIC review.`,
      accent: 'emerald',
    },
    {
      to: '/admin/reports',
      icon: FileText,
      title: 'Review Reports',
      desc: `${openReports.length} report${openReports.length === 1 ? '' : 's'} still need moderation action.`,
      accent: 'rose',
    },
    {
      to: '/admin/categories',
      icon: Tag,
      title: 'Manage Categories',
      desc: 'Keep marketplace services clean, active, and easy to browse.',
      accent: 'amber',
    },
  ]

  const accentClasses = {
    sky: 'bg-sky-50 text-sky-600 border-sky-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  }

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <PageHeader title="Admin Dashboard" description="Marketplace operations at a glance" />

        <Card className="overflow-hidden border-white/90 bg-white/95 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">Operations Overview</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Keep the marketplace healthy and moving.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Review queue pressure, worker verification demand, and platform activity from one place so the admin workspace feels like an operations console instead of a blank report page.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-sky-100 bg-sky-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Users</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{stats?.total_users ?? 0}</p>
                  <p className="mt-1 text-sm text-slate-500">{stats?.total_workers ?? 0} workers active</p>
                </div>
                <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Open Jobs</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{stats?.open_jobs ?? 0}</p>
                  <p className="mt-1 text-sm text-slate-500">{stats?.total_jobs ?? 0} total jobs created</p>
                </div>
                <div className="rounded-[1.5rem] border border-rose-100 bg-rose-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Risk Queue</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{openReports.length}</p>
                  <p className="mt-1 text-sm text-slate-500">{pendingWorkers.length} workers pending verification</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50/80 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Attention Needed</p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">Live moderation snapshot</h3>
                </div>
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-[1.25rem] border border-white bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Pending NIC review</p>
                      <p className="mt-1 text-sm text-slate-500">Workers waiting for manual verification.</p>
                    </div>
                    <span className="text-2xl font-bold text-slate-950">{pendingWorkers.length}</span>
                  </div>
                </div>
                <div className="rounded-[1.25rem] border border-white bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Open reports</p>
                      <p className="mt-1 text-sm text-slate-500">Reported issues that still need resolution.</p>
                    </div>
                    <span className="text-2xl font-bold text-slate-950">{openReports.length}</span>
                  </div>
                </div>
                <div className="rounded-[1.25rem] border border-white bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Resolved reports</p>
                      <p className="mt-1 text-sm text-slate-500">Moderation actions already completed.</p>
                    </div>
                    <span className="text-2xl font-bold text-slate-950">{reviewedReports.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          <StatCard icon={Users} label="Total Users" value={stats?.total_users} sub="Platform accounts" color="sky" className="shadow-[0_12px_30px_rgba(15,23,42,0.04)]" />
          <StatCard icon={Shield} label="Workers" value={stats?.total_workers} sub="Service providers" color="violet" className="shadow-[0_12px_30px_rgba(15,23,42,0.04)]" />
          <StatCard icon={Briefcase} label="Total Jobs" value={stats?.total_jobs} sub="Jobs ever posted" color="emerald" className="shadow-[0_12px_30px_rgba(15,23,42,0.04)]" />
          <StatCard icon={Briefcase} label="Open Jobs" value={stats?.open_jobs} sub="Currently awaiting workers" color="amber" className="shadow-[0_12px_30px_rgba(15,23,42,0.04)]" />
          <StatCard icon={FileText} label="Open Reports" value={stats?.open_reports} sub="Needs moderation action" color="rose" className="shadow-[0_12px_30px_rgba(15,23,42,0.04)]" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-6 shadow-[0_16px_44px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Quick Actions</p>
                <h3 className="mt-2 text-xl font-bold text-slate-950">Common admin tasks</h3>
              </div>
              <BarChart3 className="h-5 w-5 text-slate-300" />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {actionCards.map(({ to, icon: Icon, title, desc, accent }) => (
                <Link key={to} to={to} className="group rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-4 transition hover:border-slate-200 hover:bg-white hover:shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border', accentClasses[accent])}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{title}</p>
                        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-6 shadow-[0_16px_44px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Queue Summary</p>
                <h3 className="mt-2 text-xl font-bold text-slate-950">What needs attention now</h3>
              </div>
              <Clock3 className="h-5 w-5 text-slate-300" />
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">Worker verification queue</p>
                    <p className="mt-1 text-sm text-slate-500">Pending NIC reviews waiting for an admin decision.</p>
                  </div>
                  <span className="text-2xl font-bold text-slate-950">{pendingWorkers.length}</span>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">Open moderation reports</p>
                    <p className="mt-1 text-sm text-slate-500">User and job issues still waiting to be processed.</p>
                  </div>
                  <span className="text-2xl font-bold text-slate-950">{openReports.length}</span>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">Operational health</p>
                    <p className="mt-1 text-sm text-slate-500">Open jobs relative to total jobs on the platform.</p>
                  </div>
                  <span className="text-2xl font-bold text-slate-950">
                    {stats?.total_jobs ? `${Math.round(((stats?.open_jobs || 0) / stats.total_jobs) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}

// Admin Users
export function AdminUsers() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', { search, role }],
    queryFn: () => api.get('/admin/users', { params: { search, role } }).then(r => r.data),
  })

  const update = useMutation({
    mutationFn: ({ id, action, data }) => api.put(`/admin/users/${id}/${action}`, data),
    onSuccess: (_, vars) => {
      toast({ title: 'Updated!', variant: 'success' })
      qc.invalidateQueries(['admin-users'])
      setSelectedUser(null)
    },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  const users = data?.users || []

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <PageHeader title="User Management" description={`${data?.total || 0} users`} />

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="fixly-input pl-9" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="fixly-input w-36 bg-white" value={role} onChange={e => setRole(e.target.value)}>
            <option value="">All Roles</option>
            <option value="customer">Customer</option>
            <option value="worker">Worker</option>
          </select>
        </div>

        {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['User','Role','District','Status','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.full_name} size="sm" />
                          <div>
                            <p className="font-medium text-slate-900">{u.full_name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">{u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.district || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {u.is_email_verified && <span className="text-xs text-emerald-600">✓ Email</span>}
                          {u.is_nic_verified && <span className="text-xs text-sky-600">✓ NIC</span>}
                          {u.force_verified && <span className="text-xs text-violet-600">✓ Force</span>}
                          {u.is_suspended && <span className="text-xs text-red-600">⛔ Suspended</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedUser(u)}>Manage</Button>
                          <Button size="sm" variant={u.is_suspended ? 'success' : 'danger'}
                            onClick={() => update.mutate({ id: u.id, action: 'suspend', data: { suspended: !u.is_suspended } })}>
                            {u.is_suspended ? 'Unsuspend' : 'Suspend'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* User detail modal */}
      <Modal open={!!selectedUser} onClose={() => setSelectedUser(null)} title={selectedUser?.full_name}>
        {selectedUser && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[['Email', selectedUser.email], ['Role', selectedUser.role], ['District', selectedUser.district || '—'], ['Joined', formatDate(selectedUser.created_at)]].map(([l, v]) => (
                <div key={l}><p className="text-slate-400 text-xs">{l}</p><p className="font-medium">{v}</p></div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Force Verify (bypass email)</span>
                <Button size="sm" variant={selectedUser.force_verified ? 'danger' : 'primary'}
                  onClick={() => update.mutate({ id: selectedUser.id, action: 'force-verify', data: { force_verified: !selectedUser.force_verified } })}
                  loading={update.isPending}>
                  {selectedUser.force_verified ? 'Remove Force Verify' : 'Force Verify'}
                </Button>
              </div>
              {selectedUser.role === 'worker' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">NIC Verification</span>
                  <Button size="sm" variant={selectedUser.is_nic_verified ? 'danger' : 'success'}
                    onClick={() => update.mutate({ id: selectedUser.id, action: 'verify-nic', data: { verified: !selectedUser.is_nic_verified } })}
                    loading={update.isPending}>
                    {selectedUser.is_nic_verified ? 'Remove NIC Badge' : 'Verify NIC'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  )
}

// Admin Workers
export function AdminWorkers() {
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ['admin-workers'],
    queryFn: () => api.get('/admin/workers').then(r => r.data),
  })

  const verify = useMutation({
    mutationFn: ({ id, verified }) => api.put(`/admin/users/${id}/verify-nic`, { verified }),
    onSuccess: () => { toast({ title: 'Updated!', variant: 'success' }); qc.invalidateQueries(['admin-workers']) },
  })

  const pending = workers.filter(w => w.nic_image_path && !w.is_nic_verified)
  const verified = workers.filter(w => w.is_nic_verified)

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <PageHeader title="Worker Management" description="Manage NIC verification" />

        {pending.length > 0 && (
          <div>
            <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full text-xs flex items-center justify-center font-bold">{pending.length}</span>
              Pending NIC Review
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {pending.map(w => (
                <Card key={w.id} className="p-5 border-amber-200">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar name={w.full_name} size="md" />
                    <div>
                      <p className="font-semibold text-slate-900">{w.full_name}</p>
                      <p className="text-sm text-slate-500">{w.primary_skill} • {w.district}</p>
                    </div>
                  </div>
                  {w.nic_image_path && (
                    <img src={w.nic_image_path} alt="NIC" className="w-full h-32 object-cover rounded-xl mb-3" />
                  )}
                  <div className="flex gap-2">
                    <Button variant="success" size="sm" className="flex-1" onClick={() => verify.mutate({ id: w.id, verified: true })}>
                      <CheckCircle className="w-3.5 h-3.5" /> Verify
                    </Button>
                    <Button variant="danger" size="sm" className="flex-1" onClick={() => verify.mutate({ id: w.id, verified: false })}>
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="font-semibold text-slate-700 mb-3">All Workers ({workers.length})</h2>
          {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Worker','Skill','Rating','Jobs','NIC Status'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {workers.map(w => (
                      <tr key={w.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={w.full_name} size="sm" />
                            <div>
                              <p className="font-medium">{w.full_name}</p>
                              <p className="text-xs text-slate-400">{w.district}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{w.primary_skill || '—'}</td>
                        <td className="px-4 py-3">{w.avg_rating ? `${Number(w.avg_rating).toFixed(1)}★` : '—'}</td>
                        <td className="px-4 py-3">{w.total_jobs_done || 0}</td>
                        <td className="px-4 py-3">
                          {w.is_nic_verified ? (
                            <span className="text-xs text-emerald-600 font-medium">✓ Verified</span>
                          ) : w.nic_image_path ? (
                            <span className="text-xs text-amber-600 font-medium">⏳ Pending</span>
                          ) : (
                            <span className="text-xs text-slate-400">Not uploaded</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  )
}

// Admin Reports
export function AdminReports() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [resolution, setResolution] = useState({ status: 'dismissed', resolution_note: '' })

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => api.get('/admin/reports').then(r => r.data),
  })

  const resolve = useMutation({
    mutationFn: ({ id }) => api.put(`/admin/reports/${id}/resolve`, resolution),
    onSuccess: () => {
      toast({ title: 'Report resolved!', variant: 'success' })
      qc.invalidateQueries(['admin-reports'])
      setSelected(null)
    },
  })

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <PageHeader title="Reports Queue" description={`${reports.filter(r => r.status === 'open').length} open reports`} />

        {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> :
          reports.length === 0 ? (
            <EmptyState icon={FileText} title="No reports" description="No reports have been filed" />
          ) : (
            <Card>
              <div className="divide-y divide-slate-50">
                {reports.map(r => (
                  <div key={r.id} className="flex items-start gap-4 p-5">
                    <div className={cn('w-2 h-2 rounded-full mt-2 flex-shrink-0', r.status === 'open' ? 'bg-red-400' : 'bg-slate-300')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm capitalize">{r.report_type?.replace(/_/g, ' ')}</span>
                        <Badge status={r.status} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        By: {r.reporter_name} → {r.reported_user_name || 'N/A'}
                        {r.job_title && ` • Job: ${r.job_title}`}
                      </p>
                      {r.description && <p className="text-sm text-slate-600 mt-1 truncate">{r.description}</p>}
                      {r.resolution_note && <p className="text-xs text-slate-400 mt-1 italic">Resolution: {r.resolution_note}</p>}
                    </div>
                    {r.status === 'open' && (
                      <Button size="sm" variant="outline" onClick={() => setSelected(r)}>Resolve</Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Resolve Report">
        {selected && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-2xl p-4 text-sm">
              <p className="font-medium">{selected.report_type?.replace(/_/g, ' ')}</p>
              <p className="text-slate-600 mt-1">{selected.description}</p>
            </div>
            <Select label="Action" value={resolution.status} onChange={e => setResolution(r => ({ ...r, status: e.target.value }))}>
              <option value="dismissed">Dismiss</option>
              <option value="reviewing">Mark as Reviewing</option>
              <option value="warned">Warn User</option>
              <option value="actioned">Action Taken</option>
            </Select>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Resolution Note</label>
              <textarea className="fixly-input resize-none" rows={3} value={resolution.resolution_note} onChange={e => setResolution(r => ({ ...r, resolution_note: e.target.value }))} placeholder="Describe what action was taken..." />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setSelected(null)} className="flex-1">Cancel</Button>
              <Button variant="primary" onClick={() => resolve.mutate({ id: selected.id })} loading={resolve.isPending} className="flex-1">
                Resolve Report
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  )
}

// Admin Categories
export function AdminCategories() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [newCat, setNewCat] = useState({ name: '', icon: '' })
  const [adding, setAdding] = useState(false)

  const { data: cats = [], isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api.get('/admin/categories').then(r => r.data),
  })

  const add = useMutation({
    mutationFn: () => api.post('/admin/categories', newCat),
    onSuccess: () => {
      toast({ title: 'Category added!', variant: 'success' })
      qc.invalidateQueries(['admin-categories'])
      setNewCat({ name: '', icon: '' })
      setAdding(false)
    },
  })

  const toggle = useMutation({
    mutationFn: ({ id, is_active }) => api.put(`/admin/categories/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries(['admin-categories']),
  })

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <PageHeader
          title="Categories"
          action={<Button variant="primary" size="sm" onClick={() => setAdding(true)}>+ Add Category</Button>}
        />

        {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <Card>
            <div className="divide-y divide-slate-50">
              {cats.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-4">
                  <div className="w-8 h-8 bg-sky-50 rounded-xl flex items-center justify-center text-sky-600 text-sm">
                    {c.icon || '🔧'}
                  </div>
                  <span className={cn('flex-1 font-medium text-sm', !c.is_active && 'line-through text-slate-400')}>{c.name}</span>
                  <Button size="sm" variant={c.is_active ? 'outline' : 'success'}
                    onClick={() => toggle.mutate({ id: c.id, is_active: !c.is_active })}>
                    {c.is_active ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add Category">
        <div className="space-y-4">
          <Input label="Name" value={newCat.name} onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Solar Installation" />
          <Input label="Icon (emoji)" value={newCat.icon} onChange={e => setNewCat(c => ({ ...c, icon: e.target.value }))} placeholder="e.g. ☀️" />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setAdding(false)} className="flex-1">Cancel</Button>
            <Button variant="primary" onClick={() => add.mutate()} loading={add.isPending} disabled={!newCat.name} className="flex-1">Add Category</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
