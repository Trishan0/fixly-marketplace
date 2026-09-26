import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MailWarning, RefreshCw } from 'lucide-react'
import { Button } from './UI'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { errorMessage } from '../../lib/errors'
import api from '../../lib/api'
import { isEmailVerified } from '../../lib/auth'

/**
 * Tells an unverified user what is blocked and lets them resend the link,
 * or re-check after verifying in another tab.
 * variant "banner" is a compact strip; "gate" replaces a blocked screen.
 */
export function EmailVerificationNotice({ variant = 'banner', blockedAction = 'post jobs' }) {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [sentTo, setSentTo] = useState(null)

  const resend = useMutation({
    mutationFn: () => api.post('/auth/resend-verification'),
    onSuccess: () => {
      setSentTo(user?.email)
      toast({ title: 'Verification email sent', description: `Check ${user?.email}, including your spam folder.`, variant: 'success' })
    },
    onError: (error) => {
      if (error.response?.status === 409) {
        refreshUser().catch(() => {})
        toast({ title: 'Your email is already verified', variant: 'success' })
        return
      }
      toast({ title: 'Email not sent', description: errorMessage(error), variant: 'error' })
    },
  })

  const recheck = useMutation({
    mutationFn: () => refreshUser(),
    onSuccess: (fresh) => {
      if (!isEmailVerified(fresh)) toast({ title: 'Not verified yet', description: 'Open the link in the email we sent, then try again.' })
    },
  })

  if (!user || isEmailVerified(user)) return null

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button variant={variant === 'gate' ? 'primary' : 'outline'} size="sm" onClick={() => resend.mutate()} loading={resend.isPending}>
        {sentTo ? 'Send again' : 'Resend email'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => recheck.mutate()} loading={recheck.isPending}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" /> I’ve verified
      </Button>
    </div>
  )

  if (variant === 'gate') {
    return (
      <div className="fixly-card mx-auto max-w-xl p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
          <MailWarning className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Verify your email to {blockedAction}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          We sent a verification link to <span className="font-semibold text-slate-800 dark:text-slate-100">{user.email}</span>. Open it, then come back here.
        </p>
        <div className="mt-6 flex justify-center">{actions}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between" role="status">
      <div className="flex items-start gap-3">
        <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Verify your email to {blockedAction}</p>
          <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">
            {sentTo ? `We sent a new link to ${sentTo}.` : `Open the link we sent to ${user.email}.`}
          </p>
        </div>
      </div>
      {actions}
    </div>
  )
}
