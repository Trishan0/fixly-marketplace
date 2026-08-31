import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronRight, Droplets, Zap, Hammer, Sparkles, ShieldCheck,
  Briefcase, Star, ClipboardList, BellRing, Banknote, ArrowRight, Search
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { PublicNavbar } from '../components/shared/PublicNavbar'
import { PublicFooter } from '../components/shared/PublicFooter'

const categories = [
  { icon: Droplets, name: 'Plumbing', color: 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300' },
  { icon: Zap, name: 'Electrical', color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-300' },
  { icon: Hammer, name: 'Carpentry', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  { icon: Sparkles, name: 'Cleaning', color: 'bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-300' },
]

const features = [
  { icon: Search, title: 'Find Skilled Workers', desc: 'Browse verified local professionals in your district' },
  { icon: ClipboardList, title: 'Get Competitive Quotes', desc: 'Workers send proposals and you choose the best fit' },
  { icon: Banknote, title: 'Pay Offline Safely', desc: 'Record cash or bank payments directly in the app' },
  { icon: Star, title: 'Leave Reviews', desc: 'Help your community find the best workers' },
]

function getHeroContent(user) {
  if (!user) {
    return {
      eyebrow: 'Sri Lanka\'s Local Service Marketplace',
      title: 'Find trusted workers without the usual hassle.',
      accent: 'Hire with confidence in your area.',
      description: 'Connect with skilled plumbers, electricians, carpenters, and more. Post a job, get quotes, and manage the whole process in one clean workflow.',
      primary: { to: '/auth?tab=register&role=customer', label: 'Post a Job' },
      secondary: { to: '/auth?tab=register&role=worker', label: 'Join as Worker' },
      tertiary: { to: '/workers', label: 'Browse Workers' },
    }
  }
  if (user.role === 'customer') {
    return {
      eyebrow: 'Welcome Back',
      title: 'Find the right worker faster.',
      accent: 'Post jobs and review proposals in one place.',
      description: 'Browse trusted workers, post a new job, and keep your hiring workflow moving from the same Fixly experience.',
      primary: { to: '/jobs/new', label: 'Post a Job' },
      secondary: { to: '/find-workers', label: 'Browse Workers' },
      tertiary: { to: '/customer-dashboard', label: 'Go to Dashboard' },
    }
  }
  if (user.role === 'worker') {
    return {
      eyebrow: 'Welcome Back',
      title: 'Discover new jobs worth your time.',
      accent: 'Track invites, work, and earnings from one dashboard.',
      description: 'Browse open jobs, send proposals quickly, and stay on top of active work, notifications, and payments.',
      primary: { to: '/jobs/feed', label: 'Browse Open Jobs' },
      secondary: { to: '/worker-dashboard', label: 'Go to Dashboard' },
      tertiary: { to: '/earnings', label: 'View Earnings' },
    }
  }
  return {
    eyebrow: 'Admin Access',
    title: 'Monitor the marketplace clearly.',
    accent: 'Manage users, workers, reports, and categories.',
    description: 'Jump into the admin dashboard to review platform activity and keep the marketplace running smoothly.',
    primary: { to: '/admin', label: 'Go to Dashboard' },
    secondary: { to: '/admin/users', label: 'Manage Users' },
    tertiary: { to: '/admin/reports', label: 'Open Reports' },
  }
}

function HeroVisual({ user }) {
  const roleLabel =
    user?.role === 'admin'
      ? 'Platform Overview'
      : user?.role === 'worker'
        ? 'Worker Workspace'
        : user?.role === 'customer'
          ? 'Customer Workspace'
          : 'Marketplace Flow'

  return (
    <div className="relative">
      <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.24),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.18),transparent_34%)]" />
      <div className="fixly-panel relative p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-500">{roleLabel}</p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">Fixly at a glance</h3>
          </div>
          <div className="rounded-2xl bg-sky-50 p-3 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="fixly-surface-muted p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Post job or find work</p>
                <p className="mt-1 text-sm text-slate-500">
                  {user?.role === 'worker'
                    ? 'Browse open jobs near you and send proposals fast.'
                    : user?.role === 'admin'
                      ? 'Review platform activity and moderation queues.'
                      : 'Reach the right worker without messy back-and-forth.'}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
                <Briefcase className="h-5 w-5 text-sky-600 dark:text-sky-300" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-sky-100 bg-sky-50/80 p-4 dark:border-sky-900/50 dark:bg-sky-950/30">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white p-2.5 shadow-sm dark:bg-slate-900">
                  <BellRing className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Stay updated</p>
                  <p className="text-xs text-slate-500">Notifications, invites, and job updates stay organized.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white p-2.5 shadow-sm dark:bg-slate-900">
                  <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Track outcomes</p>
                  <p className="text-xs text-slate-500">Payments, reviews, and completion signals stay visible.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-100 bg-[linear-gradient(135deg,rgba(2,132,199,0.10),rgba(255,255,255,0.96))] p-5 text-slate-900 dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(2,132,199,0.22),rgba(15,23,42,0.92))] dark:text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Professional marketplace flow</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Browse, match, hire, complete, and review without losing context.</p>
              </div>
              <ArrowRight className="h-5 w-5 text-sky-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const hero = getHeroContent(user)

  return (
    <div className="fixly-page-shell min-h-[100dvh]">
      <PublicNavbar />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-80">
          <div className="absolute left-[-6rem] top-10 h-72 w-72 rounded-full bg-sky-100 blur-3xl dark:bg-sky-900/50" />
          <div className="absolute right-[-3rem] top-24 h-80 w-80 rounded-full bg-cyan-100 blur-3xl dark:bg-cyan-900/40" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 md:px-12 md:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-sky-100 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-4">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300 sm:text-xs sm:tracking-[0.18em]">{hero.eyebrow}</span>
              </div>

              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.08] tracking-[-0.03em] text-slate-950 sm:text-5xl md:text-6xl">
                {hero.title}
              </h1>
              <p className="mt-4 max-w-2xl text-xl font-bold leading-snug text-sky-600 dark:text-sky-300 sm:text-2xl md:text-3xl">
                {hero.accent}
              </p>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                {hero.description}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link to={hero.primary.to} className="fixly-btn-primary w-full rounded-2xl px-8 py-3.5 text-base sm:w-auto">
                  {hero.primary.label}
                </Link>
                <Link to={hero.secondary.to} className="fixly-btn-secondary w-full rounded-2xl px-8 py-3.5 text-base sm:w-auto">
                  {hero.secondary.label}
                </Link>
                <Link to={hero.tertiary.to} className="inline-flex min-h-12 items-center justify-center gap-1 px-2 py-3 text-base font-semibold text-sky-700 transition hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200 sm:justify-start">
                  {hero.tertiary.label} <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.45 }}
                className="mt-8 grid grid-cols-3 gap-3 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex sm:flex-wrap sm:gap-8 sm:pt-8"
              >
                {[['500+', 'Verified Workers'], ['25', 'Districts Covered'], ['4.8', 'Average Rating']].map(([v, l]) => (
                  <div key={l}>
                    <p className="text-xl font-black text-slate-950 sm:text-2xl">{v}</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500 sm:text-sm">{l}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div className="hidden sm:block" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55, delay: 0.1 }}>
              <HeroVisual user={user} />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:px-12 md:py-20">
        <h2 className="mb-6 text-2xl font-bold text-slate-900 sm:mb-8">Popular Services</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {categories.map(({ icon: Icon, name, color }) => (
            <Link key={name} to={`/workers?category=${name}`} className="fixly-card group flex min-h-32 flex-col items-center justify-center gap-3 p-4 transition-shadow hover:shadow-md sm:p-6">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-semibold text-slate-800 transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-300">{name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-14 dark:bg-slate-950/40 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-12">
          <h2 className="mb-2 text-2xl font-bold text-slate-900">How Fixly Works</h2>
          <p className="mb-10 text-slate-500">Simple, transparent, and built for Sri Lanka</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="fixly-card p-5 sm:p-6">
                <div className="mb-4 inline-flex rounded-2xl bg-sky-50 p-3 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-bold text-slate-900">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
          <Link to="/how-it-works" className="mt-7 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-sky-700 transition hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200">
            See the full customer and worker journey <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {!user && (
        <section className="bg-sky-600 py-14 text-center text-white dark:bg-sky-700 md:py-20">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <h2 className="mb-4 text-3xl font-bold">Ready to get started?</h2>
            <p className="mb-8 text-sky-100">Join thousands of homeowners and skilled workers across Sri Lanka.</p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/auth?tab=register" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-8 py-3 font-bold text-sky-600 transition-all hover:bg-sky-50 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900">
                Create Account
              </Link>
              <Link to="/workers" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-sky-700 px-8 py-3 font-bold text-white transition-all hover:bg-sky-800 dark:bg-sky-800 dark:hover:bg-sky-900">
                Browse Workers
              </Link>
            </div>
          </div>
        </section>
      )}

      <PublicFooter />
    </div>
  )
}
