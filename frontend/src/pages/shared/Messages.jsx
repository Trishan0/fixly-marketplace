import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Lock, MessageSquare, Send } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Avatar, Button, EmptyState, Spinner } from '../../components/shared/UI'
import { buttonClasses } from '../../components/ui/buttonClasses'
import { ErrorFallback } from '../../components/shared/ErrorBoundary'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import { errorMessage, errorStatus, loadFailureHint } from '../../lib/errors'
import { cn, formatRelativeTime } from '../../lib/utils'
import api from '../../lib/api'
import { threadPath } from '../../lib/messages'

const MAX_LENGTH = 2000
const THREAD_POLL_MS = 8000
const LIST_POLL_MS = 30000

function dayLabel(date) {
  const value = new Date(date)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (value.toDateString() === today.toDateString()) return 'Today'
  if (value.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return value.toLocaleDateString('en-LK', { weekday: 'short', day: 'numeric', month: 'short', year: value.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

function timeLabel(date) {
  return new Date(date).toLocaleTimeString('en-LK', { hour: 'numeric', minute: '2-digit' })
}

function ConversationList({ conversations, activeKey, userId }) {
  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No messages yet"
        description="Open a job and choose Message to start a conversation with a customer or worker."
      />
    )
  }
  return (
    <ul className="divide-y divide-line" aria-label="Conversations">
      {conversations.map(conversation => {
        const key = `${conversation.job_id}:${conversation.worker_id}`
        const unread = conversation.unread_count > 0
        const fromMe = conversation.last_sender_id === userId
        return (
          <li key={key}>
            <Link
              to={threadPath(conversation.job_id, conversation.worker_id)}
              aria-current={activeKey === key ? 'true' : undefined}
              className={cn(
                'relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-subtle',
                activeKey === key && 'bg-brand-subtle before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-brand hover:bg-brand-subtle',
              )}
            >
              <Avatar name={conversation.other_name} src={conversation.other_photo} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn('truncate text-sm', unread ? 'font-bold text-fg' : 'font-semibold text-fg')}>{conversation.other_name}</span>
                  <span className="shrink-0 text-xs text-fg-subtle">{formatRelativeTime(conversation.last_message_at)}</span>
                </span>
                <span className="block truncate text-xs font-medium text-brand-text">{conversation.job_title}</span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span className={cn('min-w-0 flex-1 truncate text-sm', unread ? 'text-fg' : 'text-fg-subtle')}>
                    {fromMe && 'You: '}{conversation.last_message}
                  </span>
                  {unread && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-brand-on">
                      <span className="sr-only">Unread: </span>{conversation.unread_count}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function Thread({ jobId, workerId }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const lastMessageId = useRef(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['thread', jobId, workerId],
    queryFn: () => api.get(`/messages/${jobId}/${workerId}`).then(r => r.data),
    refetchInterval: THREAD_POLL_MS,
  })

  const thread = data?.thread
  const messages = useMemo(() => data?.messages || [], [data])
  // Show a date divider above the first message of each day.
  const dayBreaks = useMemo(() => messages.map((message, index) => {
    const day = dayLabel(message.created_at)
    return index === 0 || day !== dayLabel(messages[index - 1].created_at) ? day : null
  }), [messages])
  const other = thread ? (user.role === 'customer' ? thread.worker : thread.customer) : null
  usePageTitle(other ? `Messages · ${other.full_name}` : 'Messages')

  // Opening a thread marks it read on the server; refresh the badges.
  useEffect(() => {
    if (!data) return
    qc.invalidateQueries({ queryKey: ['conversations'] })
    qc.invalidateQueries({ queryKey: ['messages-unread'] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }, [data, qc])

  // Keep the newest message in view when one arrives.
  useLayoutEffect(() => {
    const newest = messages[messages.length - 1]?.id
    if (newest && newest !== lastMessageId.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    lastMessageId.current = newest
  }, [messages])

  const send = useMutation({
    mutationFn: (body) => api.post(`/messages/${jobId}/${workerId}`, { body }),
    meta: { track: 'message_sent', trackProps: () => ({ role: user.role }) },
    onSuccess: () => {
      setDraft('')
      qc.invalidateQueries({ queryKey: ['thread', jobId, workerId] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      requestAnimationFrame(() => inputRef.current?.focus())
    },
    onError: (e) => toast({ title: 'Message not sent', description: errorMessage(e), variant: 'error' }),
  })

  const submit = (event) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || send.isPending) return
    send.mutate(body)
  }

  if (isLoading) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>
  if (!thread) {
    const status = errorStatus(error)
    return (
      <ErrorFallback
        title={status === 403 || status === 404 ? 'You can’t open this conversation' : 'We couldn’t load this conversation'}
        description={status === 403 || status === 404 ? errorMessage(error) : loadFailureHint(error)}
        onRetry={status === 403 || status === 404 ? undefined : () => refetch()}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link to="/messages" className="flex h-11 w-11 items-center justify-center -ml-2 rounded-control text-fg-muted hover:bg-subtle lg:hidden" aria-label="Back to conversations">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar name={other.full_name} src={other.profile_photo} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-fg">{other.full_name}</p>
          <Link to={`/jobs/${thread.job.id}`} className="block truncate text-xs font-medium text-brand-text hover:underline">{thread.job.title}</Link>
        </div>
        {user.role === 'customer' && (
          <Link to={`/workers/${thread.worker.id}`} className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'hidden sm:inline-flex' })}>View profile</Link>
        )}
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-canvas/60 px-4 py-4" aria-live="polite" aria-label={`Messages with ${other.full_name}`}>
        {messages.length === 0 && (
          <p className="mx-auto max-w-sm py-10 text-center text-sm text-fg-muted">
            Say hello and agree the details — time, access, materials and price. Keep payments and personal details safe; see our <Link to="/safety" className="font-semibold text-brand-text underline underline-offset-2">safety tips</Link>.
          </p>
        )}
        {messages.map((message, index) => {
          const mine = message.sender_id === user.id
          return (
            <React.Fragment key={message.id}>
              {dayBreaks[index] && <p className="py-2 text-center"><span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-fg-subtle">{dayBreaks[index]}</span></p>}
              <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-card px-3.5 py-2 text-sm leading-6 sm:max-w-[70%]',
                  mine ? 'rounded-br-md bg-gradient-to-br from-sky-500 to-sky-600 text-[#fff] shadow-xs' : 'rounded-bl-md border border-line bg-surface text-fg shadow-xs',
                )}>
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p className={cn('mt-0.5 text-right text-[11px]', mine ? 'text-sky-100' : 'text-fg-subtle')}>
                    <span className="sr-only">{mine ? 'You, ' : `${other.full_name}, `}</span>
                    {timeLabel(message.created_at)}{mine && message.read_at ? ' · Seen' : ''}
                  </p>
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </div>

      {thread.can_send ? (
        <form onSubmit={submit} className="border-t border-line bg-surface p-3">
          <div className="flex items-end gap-2">
            <label htmlFor="message-input" className="sr-only">Message {other.full_name}</label>
            <textarea
              id="message-input"
              ref={inputRef}
              rows={1}
              maxLength={MAX_LENGTH}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event)
              }}
              placeholder={`Message ${other.full_name.split(' ')[0]}…`}
              className="fixly-input max-h-40 min-h-11 flex-1 resize-none py-2.5 [field-sizing:content]"
            />
            <Button type="submit" className="h-11 w-11 shrink-0 px-0" loading={send.isPending} disabled={!draft.trim()} aria-label="Send message">
              {!send.isPending && <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1.5 flex justify-between text-[11px] text-fg-subtle">
            <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line</span>
            {draft.length > MAX_LENGTH - 200 && <span>{MAX_LENGTH - draft.length} characters left</span>}
          </p>
        </form>
      ) : (
        <p className="flex items-center gap-2 border-t border-line bg-subtle px-4 py-4 text-sm text-fg-muted">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" /> {thread.blocked_reason}
        </p>
      )}
    </div>
  )
}

export default function Messages() {
  const { jobId, workerId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const hasThread = Boolean(jobId && workerId)
  usePageTitle(hasThread ? null : 'Messages')

  const { data: conversations = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/messages/conversations').then(r => r.data),
    refetchInterval: LIST_POLL_MS,
  })

  // On wide screens, open the latest conversation instead of an empty pane.
  useEffect(() => {
    if (!hasThread && conversations.length > 0 && window.matchMedia('(min-width: 1024px)').matches) {
      navigate(threadPath(conversations[0].job_id, conversations[0].worker_id), { replace: true })
    }
  }, [hasThread, conversations, navigate])

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        {/* Fills the space between the top bar and the mobile bottom nav / page padding. */}
        <div className="flex h-[calc(100dvh-9.5rem)] min-h-[26rem] overflow-hidden rounded-card border border-line/80 bg-surface shadow-card lg:h-[calc(100dvh-56px-3rem)]">
          <aside className={cn('w-full shrink-0 overflow-y-auto border-line lg:block lg:w-80 lg:border-r', hasThread && 'hidden')}>
            <div className="sticky top-0 z-10 border-b border-line bg-surface px-4 py-4">
              <h1 className="text-lg font-bold tracking-tight text-fg">Messages</h1>
              <p className="text-xs text-fg-subtle">Conversations about your jobs</p>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : isError ? (
              <ErrorFallback title="We couldn’t load your messages" error={error} onRetry={() => refetch()} />
            ) : (
              <ConversationList conversations={conversations} activeKey={hasThread ? `${jobId}:${workerId}` : null} userId={user.id} />
            )}
          </aside>
          <section className={cn('min-w-0 flex-1 flex-col lg:flex', hasThread ? 'flex' : 'hidden')} aria-label="Conversation">
            {hasThread ? (
              <Thread key={`${jobId}:${workerId}`} jobId={jobId} workerId={workerId} />
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState icon={MessageSquare} title="Select a conversation" description="Choose a conversation from the list to read and reply." />
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  )
}
