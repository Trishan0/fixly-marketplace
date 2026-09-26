import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, ChevronRight } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Card, EmptyState, IconChip, Page, PageHeader, Skeleton } from '../../components/ui'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { formatRelativeTime, cn } from '../../lib/utils'
import { DEFAULT_NOTIFICATION_STYLE, NOTIFICATION_STYLES, notificationTarget } from '../../lib/notifications'
import { usePageTitle } from '../../hooks/usePageTitle'
import api from '../../lib/api'

export default function Notifications() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
  })

  const markRead = useMutation({
    mutationFn: (id) => api.put(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    meta: { silentError: true },
  })

  const markAllRead = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const notifications = data?.notifications || []
  const unread = data?.unread || 0
  usePageTitle(unread > 0 ? `Notifications (${unread})` : 'Notifications')

  const open = (notification) => {
    if (!notification.is_read) markRead.mutate(notification.id)
    const target = notificationTarget(notification)
    if (target) navigate(target)
  }

  return (
    <AppShell>
      <Page width="narrow">
        <PageHeader
          title="Notifications"
          description={unread > 0 ? `${unread} unread` : 'You’re all caught up'}
          actions={unread > 0 && (
            <Button variant="secondary" size="sm" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
              <CheckCheck className="h-4 w-4" aria-hidden="true" /> Mark all as read
            </Button>
          )}
        />

        {isLoading ? (
          <Card className="divide-y divide-line">{[0, 1, 2, 3].map(i => <div key={i} className="flex gap-3 p-4"><Skeleton className="h-10 w-10 rounded-[10px]" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" /></div></div>)}</Card>
        ) : isError ? (
          <ErrorFallback title="We couldn’t load your notifications" error={error} onRetry={() => refetch()} />
        ) : notifications.length === 0 ? (
          <Card><EmptyState icon={Bell} title="No notifications yet" description="Updates about your jobs, proposals and payments will appear here." /></Card>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {notifications.map(n => {
                const { icon: Icon, tone } = NOTIFICATION_STYLES[n.type] || DEFAULT_NOTIFICATION_STYLE
                const target = notificationTarget(n)
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(
                        'relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:gap-4 sm:px-5',
                        !n.is_read && 'bg-brand-subtle/60',
                      )}
                      onClick={() => open(n)}
                    >
                      <IconChip icon={Icon} tone={tone} />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm', n.is_read ? 'font-medium text-fg' : 'font-semibold text-fg')}>
                          {!n.is_read && <span className="sr-only">Unread: </span>}
                          {n.title}
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-5 text-fg-muted">{n.body}</span>
                        <span className="mt-1.5 block text-xs text-fg-subtle">{formatRelativeTime(n.created_at)}</span>
                      </span>
                      <span className="flex flex-shrink-0 items-center gap-2 self-center">
                        {!n.is_read && <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden="true" />}
                        {target && <ChevronRight className="h-4 w-4 text-fg-subtle" aria-hidden="true" />}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </Page>
    </AppShell>
  )
}
