import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, ChevronRight } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Card, PageHeader, Spinner, EmptyState } from '../../components/shared/UI'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { formatRelativeTime, cn } from '../../lib/utils'
import { DEFAULT_NOTIFICATION_STYLE, NOTIFICATION_STYLES, TONE_CLASSES, notificationTarget } from '../../lib/notifications'
import { usePageTitle } from '../../hooks/usePageTitle'
import api from '../../lib/api'

export default function Notifications() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading, isError, refetch } = useQuery({
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
      <div className="fixly-page max-w-5xl space-y-5">
        <PageHeader
          title="Notifications"
          description={unread > 0 ? `${unread} unread` : 'You’re all caught up'}
          action={unread > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
              <CheckCheck className="h-4 w-4" /> Mark all as read
            </Button>
          )}
        />

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : isError ? (
          <ErrorFallback title="We couldn’t load your notifications" description="Check your connection and try again." onRetry={() => refetch()} />
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" description="Updates about your jobs, proposals and payments will appear here." />
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map(n => {
                const { icon: Icon, tone } = NOTIFICATION_STYLES[n.type] || DEFAULT_NOTIFICATION_STYLE
                const target = notificationTarget(n)
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:gap-4',
                        !n.is_read && 'bg-sky-50/60 dark:bg-sky-950/20',
                      )}
                      onClick={() => open(n)}
                    >
                      <span className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-card', TONE_CLASSES[tone])}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm', n.is_read ? 'text-slate-700 dark:text-slate-200' : 'font-semibold text-slate-900')}>
                          {!n.is_read && <span className="sr-only">Unread: </span>}
                          {n.title}
                        </span>
                        <span className="mt-0.5 block text-sm leading-5 text-slate-600 dark:text-slate-300">{n.body}</span>
                        <span className="mt-1.5 block text-xs text-slate-500">{formatRelativeTime(n.created_at)}</span>
                      </span>
                      <span className="flex flex-shrink-0 items-center gap-2 self-center">
                        {!n.is_read && <span className="h-2.5 w-2.5 rounded-full bg-sky-500" aria-hidden="true" />}
                        {target && <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
