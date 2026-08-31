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
import { ThemeToggleIconButton } from '../components/shared/ThemeToggle'
import { BrandLogo } from '../components/shared/BrandLogo'

const CATEGORIES = ['Plumbing', 'Electrical', 'Carpentry', 'Cleaning', 'Painting', 'Tiling', 'Welding', 'AC Repair', 'Landscaping', 'General Labour']
const ENABLE_DEMO_ACCOUNTS = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === 'true'
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || 'password123'
const DEMO_ADMIN_PASSWORD = import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'admin123'

const DEMO_ACCOUNTS = [
  { label: 'Customer', email: 'customer@demo.lk', password: DEMO_PASSWORD },
  { label: 'Worker', email: 'worker@demo.lk', password: DEMO_PASSWORD },
  { label: 'Admin', email: 'admin@fixly.lk', password: DEMO_ADMIN_PASSWORD },
]

function PasswordField({ value, onChange, show, onToggle, register = false, error }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        Password
      </label>
      <div className="relative">
        <input
          id="auth-password"
          type={show ? 'text' : 'password'}
          className={cn('fixly-input pr-12', error && 'border-red-400 focus:ring-red-400')}
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
          className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {error ? (
        <p id="auth-password-error" role="alert" className="text-xs text-red-500">{error}</p>
      ) : register ? (
        <p id="auth-password-help" className="text-xs text-slate-400">Use 8+ characters with at least one letter and one number.</p>
      ) : null}
    </div>
  )
}

function AuthStory({ tab }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixly-panel hidden p-8 lg:block"
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-4 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <ShieldCheck className="h-4 w-4 text-sky-500" />
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Trusted local services</span>
      </div>
      <h2 className="mt-7 text-4xl font-black leading-tight tracking-tight text-slate-950">
        {tab === 'login' ? 'Welcome back. Your next task is waiting.' : 'One account. A simpler way to get work done.'}
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-500">
        Hire trusted local professionals or grow your service business through one clear workflow.
      </p>

      <div className="mt-8 space-y-3">
        {[
          [Briefcase, 'Post, quote, hire, and track in one place'],
          [ShieldCheck, 'Worker verification and transparent profiles'],
          [Sparkles, 'Smart matching without losing control'],
        ].map(([Icon, text]) => (
          <div key={text} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
              <Icon className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">{text}</p>
          </div>
        ))}
      </div>
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

  useEffect(() => { if (user) navigate('/dashboard') }, [user, navigate])

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', phone: '', district: '', primary_skill: '', dashboard_mode: 'standard',
  })

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
    setParams(next, { replace: true })
  }

  const changeRole = (nextRole) => {
    setRole(nextRole)
    setParams({ tab: 'register', ...(nextRole === 'worker' ? { role: 'worker' } : {}) }, { replace: true })
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
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'We could not sign you in. Check your details and try again.')
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

    setLoading(true)
    try {
      await register({ ...form, role })
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'We could not create your account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = ({ email, password }) => {
    setForm((current) => ({ ...current, email, password }))
    setError('')
  }

  return (
    <div className="fixly-page-shell min-h-[100dvh]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 md:px-10 md:py-8">
        <Link to="/" className="flex min-h-11 items-center gap-3" aria-label="Fixly home">
          <BrandLogo className="h-9 w-[8.45rem]" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggleIconButton className="h-11 w-11" />
          <Link to="/" className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Home</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl items-start gap-8 px-4 pb-10 sm:px-6 md:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:pb-16">
        <AuthStory tab={tab} />

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_24px_70px_rgba(2,6,23,0.38)]"
          aria-labelledby="auth-title"
        >
          <div className="grid grid-cols-2 border-b border-slate-100 p-1.5 dark:border-slate-800" role="tablist" aria-label="Authentication options">
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
                  'min-h-11 rounded-2xl px-3 text-sm font-bold transition-colors',
                  tab === value
                    ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-5 sm:p-7 md:p-8">
            <div className="mb-6">
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300 lg:hidden">
                <ShieldCheck className="h-4 w-4" /> Trusted local services
              </div>
              <h1 id="auth-title" className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {tab === 'login' ? 'Welcome back' : registerStep === 0 ? 'Create your account' : 'Complete your profile'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {tab === 'login'
                  ? 'Sign in to continue managing your Fixly activity.'
                  : registerStep === 0
                    ? 'Choose how you will use Fixly and set up secure account details.'
                    : `Add a few details to personalize your ${role} experience.`}
              </p>
            </div>

            {error && (
              <div role="alert" aria-live="polite" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <Input label="Email address" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
                <PasswordField value={form.password} onChange={set('password')} show={showPass} onToggle={() => setShowPass((current) => !current)} />
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="flex min-h-11 items-center text-sm font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-300">Forgot password?</Link>
                </div>
                <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                  Sign in <ArrowRight className="h-4 w-4" />
                </Button>

                {ENABLE_DEMO_ACCOUNTS && <details className="group rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Use a demo account
                    <span className="text-xs font-medium text-slate-400 group-open:hidden">Show</span>
                    <span className="hidden text-xs font-medium text-slate-400 group-open:inline">Hide</span>
                  </summary>
                  <div className="grid gap-2 pt-2 sm:grid-cols-3">
                    {DEMO_ACCOUNTS.map((account) => (
                      <button key={account.label} type="button" onClick={() => fillDemo(account)} className="min-h-11 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
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
                    <span key={step} className={cn('h-1.5 flex-1 rounded-full', step <= registerStep ? 'bg-sky-600' : 'bg-slate-200 dark:bg-slate-700')} />
                  ))}
                  <span className="ml-2 text-xs font-semibold text-slate-400">{registerStep + 1}/2</span>
                </div>

                {registerStep === 0 ? (
                  <>
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">I want to</legend>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ['customer', User, 'Hire workers'],
                          ['worker', HardHat, 'Find work'],
                        ].map(([value, Icon, label]) => (
                          <button key={value} type="button" onClick={() => changeRole(value)} className={cn('flex min-h-20 flex-col items-start justify-center rounded-2xl border p-3 text-left transition-colors', role === value ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' : 'border-slate-200 text-slate-600 hover:border-sky-300 dark:border-slate-700 dark:text-slate-300')} aria-pressed={role === value}>
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
                          <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Dashboard experience</legend>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              ['standard', 'Standard', 'Full tools and insights'],
                              ['simplified', 'Simplified', 'Larger, focused actions'],
                            ].map(([value, label, description]) => (
                              <button key={value} type="button" onClick={() => setForm((current) => ({ ...current, dashboard_mode: value }))} className={cn('min-h-20 rounded-2xl border p-3 text-left transition-colors', form.dashboard_mode === value ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/50' : 'border-slate-200 dark:border-slate-700')} aria-pressed={form.dashboard_mode === value}>
                                <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{label}</span>
                                <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                              </button>
                            ))}
                          </div>
                        </fieldset>
                      </>
                    )}

                    <div className="grid grid-cols-[auto_1fr] gap-3">
                      <Button type="button" variant="secondary" size="lg" onClick={() => setRegisterStep(0)} aria-label="Back to account details">
                        <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
                      </Button>
                      <Button type="submit" variant="primary" size="lg" loading={loading}><Check className="h-4 w-4" /> Create account</Button>
                    </div>
                    <p className="text-center text-xs leading-5 text-slate-400">By creating an account, you agree to use Fixly responsibly and keep your information accurate.</p>
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
