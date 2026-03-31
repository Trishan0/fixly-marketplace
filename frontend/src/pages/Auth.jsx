import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Wrench, Eye, EyeOff } from 'lucide-react'
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

  useEffect(() => { if (user) navigate('/dashboard') }, [user])

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', phone: '', district: '', primary_skill: '', dashboard_mode: 'standard'
  })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally { setLoading(false) }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await register({ ...form, role })
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-sky-500 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-sky-500 rounded-2xl flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-2xl text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Fixly</span>
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {['login', 'register'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError('') }}
                className={`flex-1 py-4 text-sm font-semibold capitalize transition-all ${
                  tab === t ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-4">
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
                      placeholder="••••••••"
                      value={form.password}
                      onChange={set('password')}
                      required
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Link to="/forgot-password" className="block text-xs text-sky-600 hover:underline text-right -mt-2">
                  Forgot password?
                </Link>
                <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                  Sign In
                </Button>
                <p className="text-xs text-center text-slate-400">
                  Demo admin: <span className="font-mono">admin@fixly.lk</span> / <span className="font-mono">admin123</span>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Role toggle */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">I am a...</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['customer', 'worker'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                          role === r ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-200 text-slate-600 hover:border-sky-300'
                        }`}
                      >
                        {r === 'customer' ? '🏠 Customer' : '🔧 Worker'}
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
                      required minLength={6}
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
                      <label className="block text-sm font-medium text-slate-700 mb-2">Dashboard Mode</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[['standard', '🖥️ Standard'], ['simplified', '📱 Simplified']].map(([v, l]) => (
                          <button
                            key={v} type="button" onClick={() => setForm(f => ({ ...f, dashboard_mode: v }))}
                            className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                              form.dashboard_mode === v ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-200 text-slate-600'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Simplified mode has larger text and fewer options</p>
                    </div>
                  </>
                )}

                <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                  Create Account
                </Button>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
