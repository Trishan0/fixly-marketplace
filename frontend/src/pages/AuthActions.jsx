import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ShieldCheck, KeyRound, MailCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import api from '../lib/api'
import { errorMessage } from '../lib/errors'
import { Button, Input, Card, Spinner } from '../components/shared/UI'
import { BrandLogo } from '../components/shared/BrandLogo'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { track } from '../lib/monitoring'

const PASSWORD_RULE = 'Use at least 8 characters with a letter and a number.'

function isStrongEnough(password) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
}

function AuthActionLayout({ icon: Icon, title, description, children }) {
  return (
    <div className="fixly-page-shell min-h-screen">
      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
        <Link to="/" className="mb-8 inline-flex items-center gap-3" aria-label="Fixly home">
          <BrandLogo className="h-10 w-[9.4rem]" />
        </Link>

        <Card className="p-5 sm:p-8">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-card bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h1>
          {description && <p className="mt-3 text-sm leading-7 text-fg-muted">{description}</p>}
          <div className="mt-6">{children}</div>
        </Card>
      </main>
    </div>
  )
}

function Notice({ tone, children }) {
  const success = tone === 'success'
  const Icon = success ? CheckCircle2 : AlertCircle
  return (
    <div
      role={success ? 'status' : 'alert'}
      className={`flex items-start gap-3 rounded-card border p-4 text-sm leading-6 ${success
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
        : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export function ForgotPasswordPage() {
  usePageTitle('Reset your password')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(errorMessage(err, 'We couldn’t send the reset email. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthActionLayout
      icon={KeyRound}
      title="Forgot your password?"
      description={sent ? null : 'Enter your account email and we’ll send you a link to choose a new password.'}
    >
      {sent ? (
        <div className="space-y-5">
          <Notice tone="success">
            If an account exists for <strong>{email}</strong>, we’ve sent a reset link. It expires in 1 hour. Check your spam folder if you don’t see it.
          </Notice>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to="/auth" className="fixly-btn-primary text-sm">Back to sign in</Link>
            <Button variant="ghost" onClick={() => setSent(false)}>Use a different email</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          <Input label="Email address" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Button type="submit" className="w-full" loading={loading}>Send reset link</Button>
          <p className="text-center text-sm text-fg-subtle">
            Remembered it? <Link to="/auth" className="font-semibold text-brand-text">Sign in</Link>
          </p>
        </form>
      )}
    </AuthActionLayout>
  )
}

export function ResetPasswordPage() {
  usePageTitle('Choose a new password')
  const { token } = useParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const nextErrors = {}
    if (!isStrongEnough(password)) nextErrors.password = PASSWORD_RULE
    if (password !== confirmPassword) nextErrors.confirmPassword = 'The passwords don’t match.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
    } catch (err) {
      setError(errorMessage(err, 'We couldn’t reset your password. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthActionLayout icon={ShieldCheck} title="Password updated">
        <div className="space-y-5">
          <Notice tone="success">Your password has been changed. Sign in with your new password.</Notice>
          <Link to="/auth" className="fixly-btn-primary w-full text-sm">Sign in</Link>
        </div>
      </AuthActionLayout>
    )
  }

  return (
    <AuthActionLayout icon={ShieldCheck} title="Choose a new password" description={PASSWORD_RULE}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <Notice tone="error">
            {error} {/expired|invalid/i.test(error) && <Link to="/forgot-password" className="font-semibold underline underline-offset-2">Request a new link</Link>}
          </Notice>
        )}
        <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} error={fieldErrors.password} required />
        <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} error={fieldErrors.confirmPassword} required />
        <Button type="submit" className="w-full" loading={loading}>Update password</Button>
      </form>
    </AuthActionLayout>
  )
}

export function VerifyEmailPage() {
  usePageTitle('Verify your email')
  const { token } = useParams()
  const { user, refreshUser } = useAuth()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true

    api.post(`/auth/verify-email/${token}`)
      .then(() => {
        if (!mounted) return
        setStatus('success')
        track('email_verified')
        refreshUser().catch(() => {})
      })
      .catch((err) => {
        if (!mounted) return
        setStatus('error')
        setMessage(errorMessage(err, 'This verification link didn’t work.'))
      })

    return () => {
      mounted = false
    }
    // refreshUser is recreated each render; verification should run once per token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <AuthActionLayout icon={MailCheck} title={status === 'success' ? 'Email verified' : status === 'error' ? 'We couldn’t verify your email' : 'Verifying your email'}>
      {status === 'loading' && (
        <div className="flex items-center gap-3 text-sm text-fg-muted" role="status">
          <Spinner /> Checking your link…
        </div>
      )}
      {status === 'success' && (
        <div className="space-y-5">
          <Notice tone="success">Thanks — your email is confirmed. You can now post jobs and use every Fixly feature.</Notice>
          <Link to={user ? '/dashboard' : '/auth'} className="fixly-btn-primary w-full text-sm">{user ? 'Go to dashboard' : 'Sign in'}</Link>
        </div>
      )}
      {status === 'error' && (
        <div className="space-y-5">
          <Notice tone="error">
            {message} Links expire after 24 hours and can only be used once.
            {user ? ' You can send yourself a new one from your dashboard.' : ' Sign in to send yourself a new one.'}
          </Notice>
          <Link to={user ? '/dashboard' : '/auth'} className="fixly-btn-primary w-full text-sm">{user ? 'Go to dashboard' : 'Sign in'}</Link>
        </div>
      )}
    </AuthActionLayout>
  )
}
