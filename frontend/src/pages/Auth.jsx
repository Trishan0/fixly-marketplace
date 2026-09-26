import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  Eye,
  EyeOff,
  HardHat,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button, Input, Select } from '../components/shared/UI'
import { DISTRICTS, cn } from '../lib/utils'
import { errorMessage } from '../lib/errors'
import { safeNextPath } from '../lib/redirect'
import { usePageTitle } from '../hooks/usePageTitle'
import { ThemeToggleIconButton } from '../components/shared/ThemeToggle'
import { BrandLogo } from '../components/shared/BrandLogo'

const CATEGORIES = ['Plumbing', 'Electrical', 'Carpentry', 'Cleaning', 'Painting', 'Tiling', 'Welding', 'AC Repair', 'Landscaping', 'General Labour']
// Demo sign-in shortcuts. Local dev builds fall back to the seed passwords;
// any other build only shows them when both the flag and the passwords are
// provided explicitly, so no credentials are baked into a production bundle.
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || (import.meta.env.DEV ? 'password123' : '')
const DEMO_ADMIN_PASSWORD = import.meta.env.VITE_DEMO_ADMIN_PASSWORD || (import.meta.env.DEV ? 'admin123' : '')
const ENABLE_DEMO_ACCOUNTS = (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === 'true') && Boolean(DEMO_PASSWORD)

const DEMO_ACCOUNTS = [
  { label: 'Customer', email: 'customer@demo.lk', password: DEMO_PASSWORD },
  { label: 'Worker', email: 'worker@demo.lk', password: DEMO_PASSWORD },
  ...(DEMO_ADMIN_PASSWORD ? [{ label: 'Admin', email: 'admin@fixly.lk', password: DEMO_ADMIN_PASSWORD }] : []),
]

function PasswordField({ value, onChange, show, onToggle, register = false, error }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="auth-password" className="block text-sm font-medium text-fg-muted">
        Password
      </label>
      <div className="relative">
        <input
          id="auth-password"
          type={show ? 'text' : 'password'}
          className={cn('fixly-input pr-12', error && 'fixly-input-error')}
          placeholder={register ? 'At least 8 characters' : 'Enter your password'}
          value={value}
          onChange={onChange}
          required
          minLength={register ? 8 : 1}
          autoComplete={register ? 'new-password' : 'current-password'}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'auth-password-error' : register ? 'auth-password-help' : undefined}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-fg-subtle hover:text-fg-muted"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {error ? (
        <p id="auth-password-error" role="alert" className="text-xs text-red-500">{error}</p>
      ) : register ? (
        <p id="auth-password-help" className="text-xs text-fg-subtle">Use 8+ characters with at least one letter and one number.</p>
      ) : null}
    </div>
  )
}

function AuthStory({ tab }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative hidden overflow-hidden rounded-overlay bg-gradient-to-br from-sky-500 via-sky-600 to-sky-800 p-8 text-[#fff] shadow-brand lg:flex lg:min-h-[34rem] lg:flex-col"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.22),transparent_45%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full border border-white/15" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-10 -right-2 h-44 w-44 rounded-full border border-white/10" aria-hidden="true" />
      <span className="relative inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-white/25">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Trusted local services
      </span>
      <h2 className="relative mt-6 text-[34px] font-bold leading-tight tracking-tight">
        {tab === 'login' ? 'Welcome back. Your next job is waiting.' : 'One account. A simpler way to get work done.'}
      </h2>
      <p className="relative mt-3 max-w-md text-base leading-7 text-sky-100">
        Hire trusted local professionals, or grow your service business, with every step in one place.
      </p>

      <ul className="relative mt-auto space-y-3 pt-10">
        {[
          [Briefcase, 'Post, quote, hire and track in one place'],
          [ShieldCheck, 'ID-checked workers and honest reviews'],
          [Sparkles, 'Smart matching, with you in control'],
        ].map(([Icon, text]) => (
          <li key={text} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-inset ring-white/20">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-sky-50">{text}</p>
          </li>
        ))}
      </ul>
    </motion.aside>
  )
}

export default function Auth() {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') === 'register' ? 'register' : 'login')
  const [role, setRole] = useState(params.get('role') === 'worker' ? 'worker' : 'customer')
  const [registerStep, setRegisterStep] = useState(0)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const { login, register, user } = useAuth()
  const navigate = useNavigate()
  const nextPath = safeNextPath(params.get('next'))
  const destination = nextPath || '/dashboard'
  usePageTitle(tab === 'login' ? 'Sign in' : 'Create account')

  useEffect(() => { if (user) navigate(destination, { replace: true }) }, [user, navigate, destination])

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', phone: '', district: '', primary_skill: '', dashboard_mode: 'standard',
  })
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
    setFieldErrors((current) => ({ ...current, [key]: '' }))
  }

  const changeTab = (nextTab) => {
    setTab(nextTab)
    setRegisterStep(0)
    setError('')
    setFieldErrors({})
    const next = new URLSearchParams()
    if (nextTab === 'register') next.set('tab', 'register')
    if (nextTab === 'register' && role === 'worker') next.set('role', 'worker')
    if (nextPath) next.set('next', nextPath)
    setParams(next, { replace: true })
  }

  const changeRole = (nextRole) => {
    setRole(nextRole)
    setParams({ tab: 'register', ...(nextRole === 'worker' ? { role: 'worker' } : {}), ...(nextPath ? { next: nextPath } : {}) }, { replace: true })
  }

  const validateAccountDetails = () => {
    const nextErrors = {}
    if (form.full_name.trim().length < 2) nextErrors.full_name = 'Enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.'
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      nextErrors.password = 'Use at least 8 characters with a letter and a number.'
    }
    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err.response?.status === 401
        ? 'That email and password don’t match an account. Check them and try again.'
        : errorMessage(err, 'We could not sign you in. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    setError('')
    if (registerStep === 0) {
      if (validateAccountDetails()) setRegisterStep(1)
      return
    }

    if (!acceptedTerms) {
      setFieldErrors(current => ({ ...current, accept_terms: 'Please accept the Terms of Service and Privacy Policy to continue.' }))
      return
    }

    setLoading(true)
    try {
      await register({ ...form, role, accept_terms: true })
      navigate(destination, { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'We could not create your account. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = ({ email, password }) => {
    setForm((current) => ({ ...current, email, password }))
    setError('')
  }

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-5 sm:px-6 md:px-10 md:py-8">
        <Link to="/" className="flex min-h-11 items-center gap-3" aria-label="Fixly home">
          <BrandLogo className="h-9 w-[8.45rem]" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggleIconButton className="h-11 w-11" />
          <Link to="/" className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-fg-subtle hover:text-fg">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Home</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1100px] items-stretch gap-8 px-4 pb-10 sm:px-6 md:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:pb-16">
        <AuthStory tab={tab} />

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-xl self-start overflow-hidden rounded-overlay border border-line bg-surface shadow-overlay"
          aria-labelledby="auth-title"
        >
          <div className="grid grid-cols-2 border-b border-line p-1.5" role="tablist" aria-label="Authentication options">
            {[
              ['login', 'Sign in'],
              ['register', 'Create account'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => changeTab(value)}
                className={cn(
                  'min-h-11 rounded-card px-3 text-sm font-bold transition-colors',
                  tab === value
                    ? 'bg-brand-subtle text-brand-text'
                    : 'text-fg-subtle hover:text-fg',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-5 sm:p-7 md:p-8">
            <div className="mb-6">
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-text lg:hidden">
                <ShieldCheck className="h-4 w-4" /> Trusted local services
              </div>
              <h1 id="auth-title" className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
                {tab === 'login' ? 'Welcome back' : registerStep === 0 ? 'Create your account' : 'Complete your profile'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-fg-subtle">
                {tab === 'login'
                  ? 'Sign in to continue managing your Fixly activity.'
                  : registerStep === 0
                    ? 'Choose how you will use Fixly and set up secure account details.'
                    : `Add a few details to personalize your ${role} experience.`}
              </p>
            </div>

            {error && (
              <div role="alert" aria-live="polite" className="mb-5 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <Input label="Email address" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
                <PasswordField value={form.password} onChange={set('password')} show={showPass} onToggle={() => setShowPass((current) => !current)} />
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="flex min-h-11 items-center text-sm font-semibold text-sky-600 hover:text-brand-text">Forgot password?</Link>
                </div>
                <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                  Sign in <ArrowRight className="h-4 w-4" />
                </Button>

                {ENABLE_DEMO_ACCOUNTS && <details className="group rounded-card border border-line p-3">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-fg-muted">
                    Use a demo account
                    <span className="text-xs font-medium text-fg-subtle group-open:hidden">Show</span>
                    <span className="hidden text-xs font-medium text-fg-subtle group-open:inline">Hide</span>
                  </summary>
                  <div className="grid gap-2 pt-2 sm:grid-cols-3">
                    {DEMO_ACCOUNTS.map((account) => (
                      <button key={account.label} type="button" onClick={() => fillDemo(account)} className="min-h-11 rounded-control border border-line bg-subtle px-3 text-sm font-semibold text-fg hover:bg-brand-subtle hover:text-brand-text">
                        {account.label}
                      </button>
                    ))}
                  </div>
                </details>}
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="flex items-center gap-2" aria-label={`Registration step ${registerStep + 1} of 2`}>
                  {[0, 1].map((step) => (
                    <span key={step} className={cn('h-1.5 flex-1 rounded-full', step <= registerStep ? 'bg-brand' : 'bg-line')} />
                  ))}
                  <span className="ml-2 text-xs font-semibold text-fg-subtle">{registerStep + 1}/2</span>
                </div>

                {registerStep === 0 ? (
                  <>
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium text-fg-muted">I want to</legend>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ['customer', User, 'Hire workers'],
                          ['worker', HardHat, 'Find work'],
                        ].map(([value, Icon, label]) => (
                          <button key={value} type="button" onClick={() => changeRole(value)} className={cn('flex min-h-20 flex-col items-start justify-center rounded-card border p-3 text-left transition-colors', role === value ? 'border-brand bg-brand-subtle text-brand-text ring-1 ring-brand' : 'border-line text-fg-muted hover:border-line-strong hover:bg-subtle')} aria-pressed={role === value}>
                            <Icon className="mb-2 h-5 w-5" />
                            <span className="text-sm font-bold">{label}</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <Input label="Full name" autoComplete="name" placeholder="Kasun Perera" value={form.full_name} onChange={set('full_name')} error={fieldErrors.full_name} required />
                    <Input label="Email address" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set('email')} error={fieldErrors.email} required />
                    <PasswordField value={form.password} onChange={set('password')} show={showPass} onToggle={() => setShowPass((current) => !current)} register error={fieldErrors.password} />
                    <Button type="submit" variant="primary" size="lg" className="w-full">Continue <ArrowRight className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <Input label="Phone number" type="tel" inputMode="tel" autoComplete="tel" placeholder="077 123 4567" value={form.phone} onChange={set('phone')} />
                    <Select label="District" autoComplete="address-level1" value={form.district} onChange={set('district')}>
                      <option value="">Select district</option>
                      {DISTRICTS.map((district) => <option key={district} value={district}>{district}</option>)}
                    </Select>

                    {role === 'worker' && (
                      <>
                        <Select label="Primary skill" value={form.primary_skill} onChange={set('primary_skill')}>
                          <option value="">Select skill</option>
                          {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                        </Select>
                        <fieldset>
                          <legend className="mb-2 text-sm font-medium text-fg-muted">Dashboard experience</legend>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              ['standard', 'Standard', 'Full tools and insights'],
                              ['simplified', 'Simplified', 'Larger, focused actions'],
                            ].map(([value, label, description]) => (
                              <button key={value} type="button" onClick={() => setForm((current) => ({ ...current, dashboard_mode: value }))} className={cn('min-h-20 rounded-card border p-3 text-left transition-colors', form.dashboard_mode === value ? 'border-brand bg-brand-subtle ring-1 ring-brand' : 'border-line hover:border-line-strong hover:bg-subtle')} aria-pressed={form.dashboard_mode === value}>
                                <span className="block text-sm font-bold text-fg">{label}</span>
                                <span className="mt-1 block text-xs leading-5 text-fg-subtle">{description}</span>
                              </button>
                            ))}
                          </div>
                        </fieldset>
                      </>
                    )}

                    <div className="space-y-1.5">
                      <label className="flex cursor-pointer items-start gap-3 rounded-card border border-line p-3 text-sm leading-6 text-fg-muted">
                        <input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(event) => {
                            setAcceptedTerms(event.target.checked)
                            setFieldErrors(current => ({ ...current, accept_terms: '' }))
                          }}
                          className="mt-1 h-4 w-4 shrink-0 rounded"
                          aria-invalid={Boolean(fieldErrors.accept_terms)}
                          aria-describedby={fieldErrors.accept_terms ? 'accept-terms-error' : undefined}
                        />
                        <span>
                          I agree to the{' '}
                          <Link to="/terms" target="_blank" className="font-semibold text-sky-700 underline underline-offset-2 dark:text-sky-300">Terms of Service</Link>
                          {' '}and{' '}
                          <Link to="/privacy" target="_blank" className="font-semibold text-sky-700 underline underline-offset-2 dark:text-sky-300">Privacy Policy</Link>.
                        </span>
                      </label>
                      {fieldErrors.accept_terms && <p id="accept-terms-error" role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">{fieldErrors.accept_terms}</p>}
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-3">
                      <Button type="button" variant="secondary" size="lg" onClick={() => setRegisterStep(0)} aria-label="Back to account details">
                        <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
                      </Button>
                      <Button type="submit" variant="primary" size="lg" loading={loading}><Check className="h-4 w-4" /> Create account</Button>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        </motion.section>
      </main>
    </div>
  )
}
