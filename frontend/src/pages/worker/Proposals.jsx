import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, MapPin, MessagesSquare, Pencil } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../../components/shared/UI'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { LoadMore } from '../../components/shared/LoadMore'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import { cn, formatCurrency, formatRelativeTime } from '../../lib/utils'
import { errorMessage } from '../../lib/errors'
import { threadPath } from '../../lib/messages'
import api from '../../lib/api'

const PAGE_SIZE = 20

const TABS = [
  { key: 'all', label: 'All', countKey: 'total', empty: 'You haven’t sent any proposals yet. Browse open jobs to find work.' },
  { key: 'pending', label: 'Waiting', countKey: 'pending', empty: 'No proposals are waiting for a customer’s decision.' },
  { key: 'accepted', label: 'Hired', countKey: 'accepted', empty: 'When a customer hires you, the job shows here.' },
  { key: 'declined', label: 'Not chosen', countKey: 'declined', empty: 'Proposals that weren’t chosen show here.' },
  { key: 'withdrawn', label: 'Withdrawn', countKey: 'withdrawn', empty: 'Proposals you withdraw show here.' },
]

function needsQuote(proposal) {
  return proposal.status === 'pending' && !proposal.proposed_price && !proposal.inspection_needed
}

function outcome(proposal) {
  if (proposal.status === 'accepted') return 'You were hired for this job.'
  if (proposal.status === 'declined') return proposal.hired_someone_else ? 'The customer hired someone else.' : 'The customer chose not to go ahead with your proposal.'
  if (proposal.status === 'withdrawn') return 'You withdrew this proposal.'
  if (proposal.job_status === 'cancelled' || !proposal.job_is_active) return 'This job is no longer available.'
  if (needsQuote(proposal)) return 'You accepted the invite. Add your price so the customer can hire you.'
  return 'Waiting for the customer to decide.'
}

export default function Proposals() {
  const { user } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState('all')
  const [withdrawing, setWithdrawing] = useState(null)
  usePageTitle('My proposals')
  const activeTab = TABS.find(item => item.key === tab)

  const {
    data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['my-proposals', tab],
    queryFn: ({ pageParam }) => api.get('/proposals/mine', {
      params: { status: tab === 'all' ? undefined : tab, page: pageParam, limit: PAGE_SIZE },
    }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.proposals.length === PAGE_SIZE ? pages.length + 1 : undefined),
  })
  const proposals = data?.pages.flatMap(page => page.proposals) || []
  const counts = data?.pages[0]?.counts

  const withdraw = useMutation({
    mutationFn: (proposal) => api.put(`/proposals/${proposal.id}/withdraw`),
    onSuccess: (_data, proposal) => {
      setWithdrawing(null)
      toast({ title: 'Proposal withdrawn', description: `We’ve told the customer you’re no longer available for “${proposal.job_title}”.` })
      qc.invalidateQueries({ queryKey: ['my-proposals'] })
      qc.invalidateQueries({ queryKey: ['job-feed'] })
      qc.invalidateQueries({ queryKey: ['proposals', proposal.job_id] })
    },
    onError: (e) => toast({ title: 'Couldn’t withdraw', description: errorMessage(e), variant: 'error' }),
  })

  return (
    <AppShell>
      <div className="fixly-page max-w-5xl space-y-5">
        <PageHeader title="My proposals" description="Every job you’ve applied for, and what happened" />

        <div className="fixly-tab-strip" role="tablist" aria-label="Filter proposals">
          {TABS.map(t => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn('fixly-tab', tab === t.key && 'active')}>
              {t.label}
              {typeof counts?.[t.countKey] === 'number' && (
                <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{counts[t.countKey]}</span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : isError ? (
          <ErrorFallback title="We couldn’t load your proposals" description="Check your connection and try again." onRetry={() => refetch()} />
        ) : proposals.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nothing here yet"
            description={activeTab.empty}
            action={tab === 'all' ? <Link to="/jobs/feed" className="fixly-btn-primary text-sm">Browse open jobs</Link> : null}
          />
        ) : (
          <div className="space-y-4">
            {proposals.map(proposal => {
              const open = proposal.status === 'pending' && proposal.job_is_active && ['posted', 'proposals_received'].includes(proposal.job_status)
              return (
                <Card key={proposal.id} className={cn('p-4 sm:p-5', needsQuote(proposal) && 'border-amber-300 dark:border-amber-800')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge status={proposal.status} />
                        {proposal.category_name && <span className="fixly-pill-sky">{proposal.category_name}</span>}
                      </div>
                      <Link to={`/jobs/${proposal.job_id}`} className="text-lg font-bold text-slate-900 hover:text-sky-700 dark:hover:text-sky-300">{proposal.job_title}</Link>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{proposal.customer_name}</span>
                        {proposal.district && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" />{proposal.district}</span>}
                        <span>Updated {formatRelativeTime(proposal.updated_at)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Your price</p>
                      <p className="font-bold text-slate-900">
                        {proposal.proposed_price ? formatCurrency(proposal.proposed_price) : proposal.inspection_needed ? 'After inspection' : 'Not sent yet'}
                      </p>
                    </div>
                  </div>
                  <p className={cn('mt-3 text-sm', needsQuote(proposal) ? 'font-semibold text-amber-800 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300')}>{outcome(proposal)}</p>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                    {open && (
                      <Link to={`/jobs/${proposal.job_id}/propose`} className={cn(needsQuote(proposal) ? 'fixly-btn-primary' : 'fixly-btn-secondary', 'min-h-11 gap-1.5 px-4 text-sm')}>
                        <Pencil className="h-4 w-4" aria-hidden="true" /> {needsQuote(proposal) ? 'Add your price' : 'Edit proposal'}
                      </Link>
                    )}
                    {['pending', 'accepted'].includes(proposal.status) && proposal.job_status !== 'cancelled' && (
                      <Link to={threadPath(proposal.job_id, user.id)} className="fixly-btn-secondary min-h-11 gap-1.5 px-4 text-sm">
                        <MessagesSquare className="h-4 w-4" aria-hidden="true" /> Message customer
                      </Link>
                    )}
                    <Link to={`/jobs/${proposal.job_id}`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">View job</Link>
                    {open && (
                      <Button variant="ghost" className="ml-auto text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40" onClick={() => setWithdrawing(proposal)}>
                        Withdraw
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
            <LoadMore
              shown={proposals.length}
              total={counts?.[activeTab.countKey]}
              noun={counts?.[activeTab.countKey] === 1 ? 'proposal' : 'proposals'}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={() => fetchNextPage()}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(withdrawing)}
        onClose={() => setWithdrawing(null)}
        onConfirm={() => withdraw.mutate(withdrawing)}
        loading={withdraw.isPending}
        title="Withdraw this proposal?"
        description={withdrawing ? `The customer will be told you’re no longer available for “${withdrawing.job_title}”. You can’t apply to this job again.` : ''}
        confirmLabel="Withdraw proposal"
        cancelLabel="Keep proposal"
        tone="danger"
      />
    </AppShell>
  )
}
