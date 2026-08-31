import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ShieldCheck, KeyRound, MailCheck, Wrench } from 'lucide-react'
import api from '../lib/api'
import { Button, Input, Card } from '../components/shared/UI'

function AuthActionLayout({ icon: Icon, title, description, children }) {
  return (
    <div className="fixly-page-shell min-h-screen">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
        <Link to="/" className="mb-8 inline-flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">Fixly</span>
        </Link>

        <Card className="p-5 sm:p-8">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
            <Icon className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-300">{description}</p>
          <div className="mt-6">{children}</div>
        </Card>
      </div>
    </div>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      setMessage(data.message)
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthActionLayout
      icon={KeyRound}
      title="Forgot your password?"
      description="Enter your account email and we'll send you a secure password reset link."
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Button type="submit" className="w-full" loading={loading}>Send Reset Link</Button>
      </form>
      {message && <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">{message}</p>}
    </AuthActionLayout>
  )
}

export function ResetPasswordPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const { data } = await api.post('/auth/reset-password', { token, password })
      setMessage(data.message)
      setTimeout(() => navigate('/auth'), 1200)
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthActionLayout
      icon={ShieldCheck}
      title="Reset your password"
      description="Choose a new password for your Fixly account. Use at least 8 characters with letters and numbers."
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="New Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <Input label="Confirm Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
        <Button type="submit" className="w-full" loading={loading}>Update Password</Button>
      </form>
      {message && <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">{message}</p>}
    </AuthActionLayout>
  )
}

export function VerifyEmailPage() {
  const { token } = useParams()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('Verifying your email...')

  useEffect(() => {
    let mounted = true

    api.post(`/auth/verify-email/${token}`)
      .then(({ data }) => {
        if (!mounted) return
        setStatus('success')
        setMessage(data.message || 'Email verified successfully')
      })
      .catch((err) => {
        if (!mounted) return
        setStatus('error')
        setMessage(err.response?.data?.error || 'Verification failed')
      })

    return () => {
      mounted = false
    }
  }, [token])

  return (
    <AuthActionLayout
      icon={MailCheck}
      title="Email verification"
      description="We're confirming your Fixly account email so you can continue using protected customer actions."
    >
      <p className="text-sm text-slate-500 dark:text-slate-300">{message}</p>
      <div className="mt-6">
        <Link to="/auth">
          <Button className="w-full">{status === 'success' ? 'Continue to Sign In' : 'Back to Sign In'}</Button>
        </Link>
      </div>
    </AuthActionLayout>
  )
}
