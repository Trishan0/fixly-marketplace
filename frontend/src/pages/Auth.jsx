import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Wrench, Eye, EyeOff, ShieldCheck, Briefcase, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Input, Select, Button } from '../components/shared/UI'
import { DISTRICTS } from '../lib/utils'

const CATEGORIES = ['Plumbing','Electrical','Carpentry','Cleaning','Painting','Tiling','Welding','AC Repair','Landscaping','General Labour']

export default function Auth() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') === 'register' ? 'register' : 'login')
  const [role, setRole] = useState(params.get('role') || 'customer')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login, register, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { if (user) navigate('/dashboard') }, [user, navigate])

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', phone: '', district: '', primary_skill: '', dashboard_mode: 'standard'
  })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally { setLoading(false) }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register({ ...form, role })
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)]">
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900">Fixly</span>
          </Link>
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-900">
            Back to Home
          </Link>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixly-panel p-6 md:p-8"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-4 py-1.5 shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                Trusted local service marketplace
              </span>
            </div>

            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950">
              {tab === 'login' ? 'Welcome back to Fixly.' : 'Create your Fixly account.'}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
              {tab === 'login'
                ? 'Pick up where you left off, manage jobs, proposals, payments, and keep everything moving from one place.'
                : 'Join as a customer or worker and step into the same clean workflow the rest of the platform uses.'}
            </p>

            <div className="mt-8 space-y-4">
              <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-sky-50 p-2.5 text-sky-600">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">For customers</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">Post jobs, compare proposals, hire trusted workers, and record payments cleanly.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-emerald-50 p-2.5 text-emerald-600">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">For workers</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">Browse open jobs, send proposals, manage assigned work, and track earnings without friction.</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixly-card overflow-hidden"
          >
            <div className="flex border-b border-slate-100">
              {['login', 'register'].map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError('') }}
                  className={`flex-1 py-4 text-sm font-semibold capitalize transition-all ${
                    tab === t ? 'border-b-2 border-sky-600 text-sky-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            <div className="p-6 md:p-8">
              {error && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {tab === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <Input label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Password</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        className="fixly-input pr-10"
                        placeholder="Password"
                        value={form.password}
                        onChange={set('password')}
                        required
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Link to="/forgot-password" className="block text-right text-xs text-sky-600 hover:underline -mt-2">
                    Forgot password?
                  </Link>
                  <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                    Sign In
                  </Button>
                  <p className="text-center text-xs text-slate-400">
                    Demo admin: <span className="font-mono">admin@fixly.lk</span> / <span className="font-mono">admin123</span>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">I am a...</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['customer', 'worker'].map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`rounded-xl border py-2.5 text-sm font-semibold transition-all ${
                            role === r ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 text-slate-600 hover:border-sky-300'
                          }`}
                        >
                          {r === 'customer' ? 'Customer' : 'Worker'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Input label="Full Name" placeholder="Kasun Perera" value={form.full_name} onChange={set('full_name')} required />
                  <Input label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Password</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        className="fixly-input pr-10"
                        placeholder="Min. 8 characters"
                        value={form.password}
                        onChange={set('password')}
                        required
                        minLength={6}
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Input label="Phone" type="tel" placeholder="077 123 4567" value={form.phone} onChange={set('phone')} />
                  <Select label="District" value={form.district} onChange={set('district')}>
                    <option value="">Select district</option>
                    {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </Select>

                  {role === 'worker' && (
                    <>
                      <Select label="Primary Skill" value={form.primary_skill} onChange={set('primary_skill')}>
                        <option value="">Select skill</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Dashboard Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[['standard', 'Standard'], ['simplified', 'Simplified']].map(([v, l]) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, dashboard_mode: v }))}
                              className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                                form.dashboard_mode === v ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 text-slate-600'
                              }`}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">Simplified mode uses larger text and fewer options.</p>
                      </div>
                    </>
                  )}

                  <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                    Create Account
                  </Button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
