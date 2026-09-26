import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Briefcase, FileText, Scale } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Badge, Button, Select } from '../../components/shared/UI'
import { Card, EmptyState, Page, PageHeader, Skeleton, StatusBadge, Tabs } from '../../components/ui'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { cn, formatCurrency, formatDate, formatRelativeTime, DISTRICTS, STATUS_LABELS } from '../../lib/utils'
import { errorMessage } from '../../lib/errors'
import api from '../../lib/api'

function profilePath(id, role) {
  if (!id) return null
  return role === 'worker' ? `/workers/${id}` : role === 'customer' ? `/customers/${id}` : null
}

const REPORT_TYPES = {
  inappropriate_job: 'Inappropriate job',
  fake_job: 'Fake job or scam',
  no_show: 'No-show or unresponsive',
  abusive_behavior: 'Abusive behaviour',
  fake_review: 'Fake review or profile',
  price_dispute: 'Price or payment dispute',
  other: 'Other',
}

const REPORT_OUTCOMES = [
  { value: 'dismissed', label: 'Dismiss — no rule was broken' },
  { value: 'warned', label: 'Warn the user' },
  { value: 'actioned', label: 'Action taken (e.g. job removed or user suspended)' },
]

// ─── Reports ────────────────────────────────────────────────────────────────
export function AdminReports() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [status, setStatus] = useState('open')
  const [resolving, setResolving] = useState(null)
  const [outcome, setOutcome] = useState('dismissed')
  usePageTitle('Reports')

  const { data: reports = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-reports', status],
    queryFn: () => api.get('/admin/reports', { params: { status: status === 'all' ? undefined : status } }).then(r => r.data),
  })

  const resolve = useMutation({
    mutationFn: ({ report, note }) => api.put(`/admin/reports/${report.id}/resolve`, { status: outcome, resolution_note: note }),
    onSuccess: () => {
      setResolving(null)
      toast({ title: 'Report resolved', description: 'The person who reported it has been notified.', variant: 'success' })
      qc.invalidateQueries({ queryKey: ['admin-reports'] })
      qc.invalidateQueries({ queryKey: ['admin-stats'] })
    },
    onError: (e) => toast({ title: 'Couldn’t resolve the report', description: errorMessage(e), variant: 'error' }),
  })

  return (
    <AppShell>
      <Page width="default">
        <PageHeader title="Reports" description="Problems users have reported about jobs and other users" />
        <div className="mb-5"><Tabs label="Filter reports" value={status} onChange={setStatus} tabs={[{ value: 'open', label: 'Open' }, { value: 'dismissed', label: 'Dismissed' }, { value: 'warned', label: 'Warned' }, { value: 'actioned', label: 'Actioned' }, { value: 'all', label: 'All' }]} /></div>

        {isLoading ? <div className="space-y-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-card" />)}</div>
          : isError ? <ErrorFallback title="We couldn’t load reports" onRetry={() => refetch()} />
          : reports.length === 0 ? <Card><EmptyState icon={FileText} title={status === 'open' ? 'No open reports' : 'Nothing here'} description={status === 'open' ? 'New reports from users will appear here.' : 'No reports match this filter.'} /></Card>
          : (
            <div className="space-y-4">
              {reports.map(report => {
                const reportedPath = profilePath(report.reported_user_id, report.reported_user_role)
                const reporterPath = profilePath(report.reporter_id, report.reporter_role)
                return (
                  <Card key={report.id} className={cn('p-4 sm:p-5', report.status === 'open' && 'border-rose-200 dark:border-rose-500/30')}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold text-fg">{REPORT_TYPES[report.report_type] || report.report_type}</span>
                          <StatusBadge tone={{ open: 'rose', warned: 'amber', actioned: 'emerald' }[report.status] || 'slate'}>{report.status.charAt(0).toUpperCase() + report.status.slice(1)}</StatusBadge>
                        </div>
                        <p className="mt-1 text-xs text-fg-subtle">Reported {formatRelativeTime(report.created_at)} · {formatDate(report.created_at)}</p>
                      </div>
                      {report.status === 'open' && (
                        <Button size="sm" onClick={() => { setOutcome('dismissed'); setResolving(report) }}>Resolve</Button>
                      )}
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-fg-subtle">Reported by</dt>
                        <dd>{reporterPath ? <Link to={reporterPath} className="font-medium text-brand-text hover:underline">{report.reporter_name}</Link> : report.reporter_name}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-fg-subtle">About</dt>
                        <dd>
                          {report.reported_user_name
                            ? <>{reportedPath ? <Link to={reportedPath} className="font-medium text-brand-text hover:underline">{report.reported_user_name}</Link> : report.reported_user_name}{report.reported_user_suspended && <StatusBadge tone="rose" className="ml-1.5">Suspended</StatusBadge>}</>
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-fg-subtle">Job</dt>
                        <dd>
                          {report.job_id
                            ? <><Link to={`/jobs/${report.job_id}`} className="font-medium text-brand-text hover:underline">{report.job_title}</Link>{report.job_is_active === false && <StatusBadge tone="rose" className="ml-1.5">Taken down</StatusBadge>}</>
                            : '—'}
                        </dd>
                      </div>
                    </dl>
                    {report.description && <p className="mt-3 whitespace-pre-line rounded-control bg-subtle p-3 text-sm leading-6 text-fg-muted">{report.description}</p>}
                    {report.resolution_note && <p className="mt-2 text-sm text-fg-muted"><span className="font-semibold">Resolution:</span> {report.resolution_note}</p>}
                    {report.status === 'open' && (report.reported_user_id || report.job_id) && (
                      <p className="mt-3 text-xs text-fg-subtle">
                        To act on it: {report.reported_user_id && <Link to="/admin/users" className="font-semibold text-brand-text hover:underline">suspend the user</Link>}
                        {report.reported_user_id && report.job_id && ' or '}
                        {report.job_id && <Link to="/admin/jobs" className="font-semibold text-brand-text hover:underline">take the job down</Link>}, then resolve this report as “Action taken”.
                      </p>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
      </Page>

      <ConfirmDialog
        open={Boolean(resolving)}
        onClose={() => setResolving(null)}
        onConfirm={(note) => resolve.mutate({ report: resolving, note })}
        loading={resolve.isPending}
        title="Resolve this report"
        description="The person who reported it will be told the outcome."
        confirmLabel="Resolve report"
        reason={{ label: 'Note for the audit log', placeholder: 'What did you check and decide?', required: true, minLength: 3 }}
      >
        <Select label="Outcome" value={outcome} onChange={e => setOutcome(e.target.value)}>
          {REPORT_OUTCOMES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      </ConfirmDialog>
    </AppShell>
  )
}

// ─── Payment disputes ───────────────────────────────────────────────────────
const DISPUTE_OUTCOMES = [
  { value: 'paid', label: 'Resolved — the full amount has now been paid' },
  { value: 'adjusted', label: 'Resolved — both agreed a different amount' },
  { value: 'error', label: 'Resolved — the payment was recorded by mistake' },
  { value: 'unresolved', label: 'Closed without agreement' },
  { value: 'other', label: 'Other' },
]

export function AdminDisputes() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [state, setState] = useState('open')
  const [resolving, setResolving] = useState(null)
  usePageTitle('Payment disputes')

  const { data: disputes = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-disputes', state],
    queryFn: () => api.get('/admin/disputes', { params: { state } }).then(r => r.data),
  })

  const resolve = useMutation({
    mutationFn: ({ dispute, note }) => api.put(`/admin/disputes/${dispute.id}/resolve`, { note }),
    onSuccess: () => {
      setResolving(null)
      toast({ title: 'Dispute closed', description: 'The customer and worker have both been notified.', variant: 'success' })
      qc.invalidateQueries({ queryKey: ['admin-disputes'] })
      qc.invalidateQueries({ queryKey: ['admin-stats'] })
    },
    onError: (e) => toast({ title: 'Couldn’t close the dispute', description: errorMessage(e), variant: 'error' }),
  })

  return (
    <AppShell>
      <Page width="default">
        <PageHeader title="Payment disputes" description="Workers who say a recorded payment is wrong. Contact both sides, then close the dispute with the outcome." />
        <div className="mb-5"><Tabs label="Filter disputes" value={state} onChange={setState} tabs={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Closed' }, { value: 'all', label: 'All' }]} /></div>

        {isLoading ? <div className="space-y-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-card" />)}</div>
          : isError ? <ErrorFallback title="We couldn’t load disputes" onRetry={() => refetch()} />
          : disputes.length === 0 ? <Card><EmptyState icon={Scale} title={state === 'open' ? 'No open disputes' : 'Nothing here'} description={state === 'open' ? 'When a worker disputes a payment, it appears here.' : 'No disputes match this filter.'} /></Card>
          : (
            <div className="space-y-4">
              {disputes.map(dispute => (
                <Card key={dispute.id} className={cn('p-4 sm:p-5', !dispute.dispute_resolved_at && 'border-amber-200 dark:border-amber-500/30')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/jobs/${dispute.job_id}`} className="font-semibold text-fg hover:text-brand-text">{dispute.job_title}</Link>
                      <p className="mt-1 text-xs text-fg-subtle">Payment recorded {formatDate(dispute.created_at)} · {dispute.method?.replace('_', ' ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-fg">{formatCurrency(dispute.amount)}</p>
                      {dispute.final_price && Number(dispute.final_price) !== Number(dispute.amount) && <p className="text-xs text-fg-subtle">Agreed price {formatCurrency(dispute.final_price)}</p>}
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-control border border-line bg-subtle p-3">
                      <dt className="text-xs text-fg-subtle">Customer</dt>
                      <dd><Link to={`/customers/${dispute.customer_id}`} className="font-medium text-brand-text hover:underline">{dispute.customer_name}</Link></dd>
                      {dispute.customer_phone && <dd><a href={`tel:${dispute.customer_phone}`} className="text-fg-muted hover:underline">{dispute.customer_phone}</a></dd>}
                      {dispute.note && <dd className="mt-1 text-xs italic text-fg-subtle">Their note: “{dispute.note}”</dd>}
                    </div>
                    <div className="rounded-control border border-line bg-subtle p-3">
                      <dt className="text-xs text-fg-subtle">Worker</dt>
                      <dd><Link to={`/workers/${dispute.worker_id}`} className="font-medium text-brand-text hover:underline">{dispute.worker_name}</Link></dd>
                      {dispute.worker_phone && <dd><a href={`tel:${dispute.worker_phone}`} className="text-fg-muted hover:underline">{dispute.worker_phone}</a></dd>}
                    </div>
                  </dl>
                  <p className="mt-3 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span><span className="font-semibold">Worker’s reason:</span> {dispute.dispute_reason || 'No reason given'}</span>
                  </p>
                  {dispute.dispute_resolved_at ? (
                    <p className="mt-3 border-t border-line pt-3 text-sm text-fg-muted">
                      <span className="font-semibold">Closed {formatDate(dispute.dispute_resolved_at)}{dispute.resolved_by_name ? ` by ${dispute.resolved_by_name}` : ''}:</span> {dispute.dispute_resolution_note}
                    </p>
                  ) : (
                    <div className="mt-4 flex justify-end border-t border-line pt-4">
                      <Button size="sm" onClick={() => setResolving(dispute)}>Close dispute</Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
      </Page>

      <ConfirmDialog
        open={Boolean(resolving)}
        onClose={() => setResolving(null)}
        onConfirm={(note) => resolve.mutate({ dispute: resolving, note })}
        loading={resolve.isPending}
        title="Close this dispute"
        description={resolving ? `The customer (${resolving.customer_name}) and worker (${resolving.worker_name}) will both see your note.` : ''}
        confirmLabel="Close dispute"
        reason={{ label: 'Outcome', placeholder: 'Details both parties should know', required: true, options: DISPUTE_OUTCOMES }}
      />
    </AppShell>
  )
}

// ─── Jobs ───────────────────────────────────────────────────────────────────
const JOB_PAGE_SIZE = 20
const TAKEDOWN_REASONS = [
  { value: 'not_service', label: 'Not a service job (selling items, adverts, etc.)' },
  { value: 'scam', label: 'Looks like a scam or asks for payment up front' },
  { value: 'unsafe', label: 'Illegal, unsafe or discriminatory' },
  { value: 'contact', label: 'Shares contact details or links to move off Fixly' },
  { value: 'other', label: 'Other' },
]

export function AdminJobs() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [district, setDistrict] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [takingDown, setTakingDown] = useState(null)
  const debouncedCategory = useDebouncedValue(category.trim())
  usePageTitle('Jobs')

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-jobs', { status, district, category: debouncedCategory, page }],
    queryFn: () => api.get('/admin/jobs', { params: { status: status || undefined, district: district || undefined, category: debouncedCategory || undefined, page, limit: JOB_PAGE_SIZE } }).then(r => r.data),
    placeholderData: previous => previous,
  })
  const jobs = data?.jobs || []

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-jobs'] })
  const takeDown = useMutation({
    mutationFn: ({ job, reason }) => api.put(`/admin/jobs/${job.id}/flag`, { reason }),
    onSuccess: () => { setTakingDown(null); toast({ title: 'Job taken down', description: 'The customer has been told why.', variant: 'success' }); refresh() },
    onError: (e) => toast({ title: 'Couldn’t take the job down', description: errorMessage(e), variant: 'error' }),
  })
  const restore = useMutation({
    mutationFn: (job) => api.put(`/admin/jobs/${job.id}/restore`, {}),
    onSuccess: () => { toast({ title: 'Job restored', description: 'Workers can see it again and the customer has been told.', variant: 'success' }); refresh() },
    onError: (e) => toast({ title: 'Couldn’t restore the job', description: errorMessage(e), variant: 'error' }),
  })

  const setFilter = (setter) => (event) => { setter(event.target.value); setPage(1) }

  return (
    <AppShell>
      <Page width="default">
        <PageHeader title="Jobs" description={typeof data?.total === 'number' ? `${data.total.toLocaleString('en-LK')} jobs` : 'All jobs on Fixly'} />
        <Card as="div" className="mb-5 grid gap-2 p-3 sm:grid-cols-3 sm:p-4">
          <Select aria-label="Filter by status" value={status} onChange={setFilter(setStatus)}>
            <option value="">All statuses</option>
            {['posted', 'proposals_received', 'assigned', 'in_progress', 'completed', 'payment_recorded', 'reviewed', 'cancelled'].map(value => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
          </Select>
          <Select aria-label="Filter by district" value={district} onChange={setFilter(setDistrict)}>
            <option value="">All districts</option>
            {DISTRICTS.map(value => <option key={value} value={value}>{value}</option>)}
          </Select>
          <input aria-label="Filter by category" className="fixly-input" placeholder="Category, e.g. Plumbing" value={category} onChange={setFilter(setCategory)} />
        </Card>

        {isLoading ? <div className="space-y-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-card" />)}</div>
          : isError ? <ErrorFallback title="We couldn’t load jobs" onRetry={() => refetch()} />
          : jobs.length === 0 ? <Card><EmptyState icon={Briefcase} title="No jobs found" description="Try different filters." /></Card>
          : (
            <div className={cn('space-y-3', isFetching && 'opacity-70')}>
              {jobs.map(job => (
                <Card key={job.id} className={cn('p-4', !job.is_active && 'border-rose-200 bg-rose-50/40 dark:border-rose-500/30 dark:bg-rose-500/5')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge status={job.status} />
                        {!job.is_active && <StatusBadge tone="rose">Taken down</StatusBadge>}
                        {job.open_reports > 0 && <Link to="/admin/reports" className="hover:opacity-80"><StatusBadge tone="amber">{job.open_reports} open report{job.open_reports === 1 ? '' : 's'}</StatusBadge></Link>}
                      </div>
                      <Link to={`/jobs/${job.id}`} className="mt-1 block font-semibold text-fg hover:text-brand-text">{job.title}</Link>
                      <p className="mt-0.5 text-xs text-fg-subtle">
                        <Link to={`/customers/${job.customer_id}`} className="hover:underline">{job.customer_name}</Link> · {job.category_name || 'No category'} · {job.district || 'No district'} · {formatRelativeTime(job.created_at)}
                      </p>
                      {job.description && <p className="mt-2 line-clamp-2 text-sm text-fg-muted">{job.description}</p>}
                      {!job.is_active && job.flag_reason && <p className="mt-2 text-sm text-rose-700 dark:text-rose-300"><span className="font-semibold">Reason:</span> {job.flag_reason}</p>}
                    </div>
                    {job.is_active ? (
                      <Button size="sm" variant="danger-ghost" onClick={() => setTakingDown(job)}>Take down</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => restore.mutate(job)} loading={restore.isPending && restore.variables?.id === job.id}>Restore</Button>
                    )}
                  </div>
                </Card>
              ))}
              <p className="pt-2 text-center text-sm text-fg-subtle" aria-live="polite">
                Page {page} of {Math.max(1, Math.ceil(data.total / JOB_PAGE_SIZE))}
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page * JOB_PAGE_SIZE >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
      </Page>

      <ConfirmDialog
        open={Boolean(takingDown)}
        onClose={() => setTakingDown(null)}
        onConfirm={(reason) => takeDown.mutate({ job: takingDown, reason })}
        loading={takeDown.isPending}
        title={`Take down “${takingDown?.title || ''}”?`}
        description="Workers won’t see it or be able to send proposals. The customer will see your reason. You can restore it later."
        confirmLabel="Take job down"
        tone="danger"
        reason={{ label: 'Why is it being taken down?', placeholder: 'Anything the customer should know', required: true, options: TAKEDOWN_REASONS }}
      />
    </AppShell>
  )
}
