import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Card, PageHeader, Spinner, EmptyState } from '../../components/shared/UI'
import { formatRelativeTime, cn } from '../../lib/utils'
import api from '../../lib/api'

const NOTIF_ICONS = {
  new_proposal: '💬',
  proposal_accepted: '✅',
  proposal_declined: '❌',
  new_invite: '📩',
  job_started: '▶️',
  job_completed: '🏁',
  payment_recorded: '💰',
  payment_confirmed: '✓',
  payment_disputed: '⚠️',
  review_received: '⭐',
  report_updated: '📋',
  nic_verified: '🛡️',
  invite_accepted: '👍',
}

export default function Notifications() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
  })

  const markRead = useMutation({
    mutationFn: (id) => api.put(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries(['notifications']),
  })

  const markAllRead = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries(['notifications']),
  })

  const notifications = data?.notifications || []
  const unread = data?.unread || 0

  return (
    <AppShell>
      <div className="fixly-page max-w-5xl space-y-5">
        <PageHeader
          title={`Notifications ${unread > 0 ? `(${unread} unread)` : ''}`}
          action={unread > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
              <CheckCheck className="w-4 h-4" /> Mark all read
            </Button>
          )}
        />

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
        ) : (
          <Card>
            <div className="divide-y divide-slate-50">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={cn('flex items-start gap-4 p-4 transition-colors cursor-pointer hover:bg-slate-50', !n.is_read && 'bg-sky-50/50')}
                  onClick={() => !n.is_read && markRead.mutate(n.id)}
                >
                  <div className="w-10 h-10 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
                    {NOTIF_ICONS[n.type] || '🔔'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm', n.is_read ? 'text-slate-700' : 'font-semibold text-slate-900')}>{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400">{formatRelativeTime(n.created_at)}</span>
                    {!n.is_read && <div className="w-2 h-2 bg-sky-500 rounded-full" />}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
