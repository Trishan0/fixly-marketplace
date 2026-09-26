import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BadgeCheck, Banknote, ChevronRight, ClipboardList, MapPin, Search, ShieldCheck, Star } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { PublicNavbar } from '../components/shared/PublicNavbar'
import { PublicFooter } from '../components/shared/PublicFooter'
import { IconChip, PersonAvatar, StatusBadge, buttonClasses } from '../components/ui'
import { categoryStyle } from '../lib/tones'
import { cn } from '../lib/utils'
import { usePageTitle } from '../hooks/usePageTitle'
import api from '../lib/api'

const CATEGORIES = ['Plumbing', 'Electrical', 'Carpentry', 'Cleaning', 'Painting', 'AC Repair', 'Tiling', 'Landscaping']

const STEPS = [
  { icon: ClipboardList, tone: 'sky', title: 'Post your job', desc: 'Describe what needs doing and where. It takes about two minutes.' },
  { icon: Search, tone: 'indigo', title: 'Compare proposals', desc: 'Local workers send a price and availability. Check their reviews and past work.' },
  { icon: BadgeCheck, tone: 'emerald', title: 'Hire with confidence', desc: 'Pick the best fit, agree the details in chat, and track the job to the end.' },
  { icon: Star, tone: 'amber', title: 'Pay and review', desc: 'Pay the worker directly, record it in Fixly, and leave an honest review.' },
]

const TRUST = [
  { icon: ShieldCheck, title: 'ID-checked workers', desc: 'Look for the verified badge: Fixly has checked their National ID.' },
  { icon: Star, title: 'Reviews from real jobs', desc: 'Only customers who hired a worker through Fixly can review them.' },
  { icon: Banknote, title: 'You stay in control of payment', desc: 'Pay in cash or by transfer once you’re happy. Both sides confirm it.' },
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

/** An illustrative preview of the product: a job receiving proposals. */
function HeroVisual() {
  const proposals = [
    { name: 'Kasun Perera', rating: '4.9', jobs: 34, price: 'LKR 3,500', when: 'Tomorrow, 9am' },
    { name: 'Nimal Fernando', rating: '4.8', jobs: 21, price: 'LKR 4,000', when: 'Today, after 4pm' },
  ]
  const { icon, tone } = categoryStyle('Plumbing')
  return (
    <div className="relative" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.22),transparent_55%)]" />
      <div className="relative rounded-overlay border border-line bg-surface p-4 shadow-overlay sm:p-5">
        <div className="flex items-start gap-3">
          <IconChip icon={icon} tone={tone} />
          <div className="min-w-0 flex-1">
            <StatusBadge tone="indigo">Reviewing proposals</StatusBadge>
            <p className="mt-1.5 text-[15px] font-semibold text-fg">Fix leaking kitchen tap</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-muted"><MapPin className="h-3.5 w-3.5" /> Nugegoda, Colombo · Posted 20 min ago</p>
          </div>
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">2 proposals</p>
        <ul className="mt-2 space-y-2">
          {proposals.map((p, index) => (
            <li key={p.name} className={cn('flex items-center gap-3 rounded-control border p-3', index === 0 ? 'border-brand/40 bg-brand-subtle/60' : 'border-line bg-surface')}>
              <PersonAvatar name={p.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-sm font-semibold text-fg">{p.name} <BadgeCheck className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /></p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-muted"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{p.rating} · {p.jobs} jobs · {p.when}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-fg">{p.price}</p>
                {index === 0 && <span className="mt-1 inline-flex h-7 items-center rounded-lg bg-brand px-2.5 text-xs font-semibold text-brand-on">Hire</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -bottom-12 -left-6 hidden items-center gap-2.5 rounded-control border border-line bg-surface px-3.5 py-2.5 shadow-card-hover md:flex">
        <IconChip icon={BadgeCheck} tone="emerald" size="sm" />
        <div>
          <p className="text-xs font-semibold text-fg">Payment confirmed</p>
          <p className="text-[11px] text-fg-muted">Bathroom retiling · LKR 18,000</p>
        </div>
      </div>
    </div>
  )
}

// Live marketplace numbers. Each figure only appears once it is meaningful,
// so a young marketplace never shows placeholder or inflated claims.
function marketplaceStats(stats) {
  if (!stats) return []
  const items = []
  if (stats.workers > 0) items.push([stats.workers.toLocaleString('en-LK'), stats.workers === 1 ? 'Local worker' : 'Local workers'])
  if (stats.verified_workers > 0) items.push([stats.verified_workers.toLocaleString('en-LK'), 'Identity verified'])
  if (stats.districts > 1) items.push([String(stats.districts), 'Districts covered'])
  if (stats.reviews >= 5 && stats.avg_rating) items.push([stats.avg_rating, `Average rating (${stats.reviews.toLocaleString('en-LK')} reviews)`])
  return items.slice(0, 3)
}

export default function Landing() {
  const { user } = useAuth()
  const hero = getHeroContent(user)
  usePageTitle('')
  const { data: stats } = useQuery({
    queryKey: ['marketplace-stats'],
    queryFn: () => api.get('/workers/stats').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const statItems = marketplaceStats(stats)

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <PublicNavbar />

      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-sky-200/50 blur-3xl dark:bg-sky-500/10" />
          <div className="absolute right-0 top-32 h-72 w-72 rounded-full bg-cyan-100/60 blur-3xl dark:bg-cyan-500/10" />
        </div>

        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {hero.eyebrow}
            </span>
            <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-[1.08] tracking-[-0.03em] text-fg sm:text-5xl lg:text-[56px]">
              {hero.title}
            </h1>
            <p className="mt-3 max-w-xl bg-gradient-to-r from-sky-500 to-sky-700 bg-clip-text text-xl font-bold leading-snug text-transparent dark:from-sky-300 dark:to-sky-500 sm:text-2xl">
              {hero.accent}
            </p>
            <p className="mt-5 max-w-xl text-base leading-7 text-fg-muted sm:text-lg sm:leading-8">{hero.description}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link to={hero.primary.to} className={buttonClasses({ size: 'lg', className: 'w-full shadow-brand sm:w-auto' })}>
                {hero.primary.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to={hero.secondary.to} className={buttonClasses({ variant: 'secondary', size: 'lg', className: 'w-full sm:w-auto' })}>{hero.secondary.label}</Link>
              <Link to={hero.tertiary.to} className="inline-flex min-h-11 items-center justify-center gap-1 px-2 text-sm font-semibold text-brand-text hover:underline sm:justify-start">
                {hero.tertiary.label} <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            {statItems.length > 0 && (
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
                {statItems.map(([value, label]) => (
                  <div key={label}>
                    <dd className="text-2xl font-bold tracking-tight text-fg">{value}</dd>
                    <dt className="mt-0.5 text-xs leading-4 text-fg-muted sm:text-[13px]">{label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </motion.div>

          <motion.div className="hidden pb-8 sm:block lg:pl-6" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <HeroVisual />
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-fg sm:text-[28px]">Popular services</h2>
            <p className="mt-1 text-sm text-fg-muted">Skilled local workers for the jobs around your home.</p>
          </div>
          <Link to="/workers" className="hidden items-center gap-1 text-sm font-semibold text-brand-text hover:underline sm:inline-flex">All workers <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {CATEGORIES.map((name) => {
            const { icon, tone } = categoryStyle(name)
            return (
              <Link key={name} to={`/workers?category=${encodeURIComponent(name)}`} className="group flex items-center gap-3 rounded-card border border-line/80 bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:p-5">
                <IconChip icon={icon} tone={tone} className="h-11 w-11 rounded-xl [&>svg]:h-5 [&>svg]:w-5" />
                <span className="min-w-0 flex-1 text-sm font-semibold text-fg">{name}</span>
                <ChevronRight className="h-4 w-4 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            )
          })}
        </div>
      </section>

      <section className="border-y border-line bg-surface py-14 lg:py-20">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-fg sm:text-[28px]">How Fixly works</h2>
          <p className="mt-1 text-sm text-fg-muted">From “something’s broken” to “job done” in four steps.</p>
          <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon, tone, title, desc }, index) => (
              <li key={title} className="relative rounded-card border border-line/80 bg-canvas/60 p-5">
                <div className="flex items-center justify-between">
                  <IconChip icon={icon} tone={tone} />
                  <span className="text-3xl font-bold text-line-strong">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-4 font-semibold text-fg">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-fg-muted">{desc}</p>
              </li>
            ))}
          </ol>
          <Link to="/how-it-works" className="mt-6 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-text hover:underline">
            See the full customer and worker journey <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          {TRUST.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand-text"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <div>
                <h3 className="font-semibold text-fg">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-fg-muted">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {!user && (
          <div className="relative mt-14 overflow-hidden rounded-overlay bg-gradient-to-br from-sky-500 via-sky-600 to-sky-800 px-6 py-10 text-center shadow-brand sm:px-10 sm:py-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.22),transparent_45%)]" aria-hidden="true" />
            <h2 className="relative text-2xl font-bold tracking-tight text-[#fff] sm:text-3xl">Ready to get started?</h2>
            <p className="relative mx-auto mt-2 max-w-lg text-sky-100">Post a job in minutes, or create a profile that helps local customers find you.</p>
            <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/auth?tab=register&role=customer" className={buttonClasses({ variant: 'on-brand', size: 'lg' })}>Post a job</Link>
              <Link to="/auth?tab=register&role=worker" className={buttonClasses({ variant: 'on-brand-ghost', size: 'lg' })}>Join as a worker</Link>
            </div>
          </div>
        )}
      </section>

      <PublicFooter />
    </div>
  )
}
