import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, BadgeCheck, Banknote, ChevronRight, ClipboardList, MapPin, Search, ShieldCheck, Star, User, Wrench } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { DISTRICTS } from '../lib/utils'
import { PublicNavbar } from '../components/shared/PublicNavbar'
import { PublicFooter } from '../components/shared/PublicFooter'
import { IconChip, buttonClasses } from '../components/ui'
import { categoryStyle } from '../lib/tones'
import './Landing.css'

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

export default function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [service, setService] = useState('')
  const [district, setDistrict] = useState('Colombo')
  usePageTitle('')

  function findWorkers(event) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (service) params.set('category', service)
    if (district) params.set('district', district)
    navigate(`/workers?${params.toString()}`)
  }

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <PublicNavbar />
    <div className="landing-page">
      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-photo"><img src="/images/hero-worker.jpg" alt="Skilled local worker carrying out a home repair" fetchPriority="high" /></div>
          <div className="landing-hero-content">
            <p className="landing-eyebrow">Trusted local workers</p>
            <h1 id="landing-title">Good people.<br />Great repairs.</h1>
            <p className="landing-description">Find local help for the jobs that matter.</p>
            <div className="landing-benefits">
              <Link to="/how-it-works"><ClipboardList aria-hidden="true" /><span>Compare<br />proposals</span></Link>
              <span className="landing-benefit-divider" />
              <Link to="/workers"><User aria-hidden="true" /><span>Choose<br />your worker</span></Link>
            </div>
          </div>
          <div className="landing-note" aria-hidden="true">Local skills.<br />Happier homes.<span /></div>
          <img className="landing-inset" src="/images/plumbing-inset.jpg" alt="Close-up of plumbing repair work" />
        </section>

        <div className="landing-bottom">
          <form className="landing-search" onSubmit={findWorkers} aria-label="Find local workers">
            <label className="landing-select"><Wrench aria-hidden="true" /><span className="sr-only">Service</span><select value={service} onChange={e => setService(e.target.value)}><option value="">What service do you need?</option>{CATEGORIES.map(name => <option key={name}>{name}</option>)}</select><ChevronDown className="landing-chevron" aria-hidden="true" /></label>
            <label className="landing-select"><MapPin aria-hidden="true" /><span className="sr-only">District</span><select value={district} onChange={e => setDistrict(e.target.value)}><option value="">All districts</option>{DISTRICTS.map(name => <option key={name}>{name}</option>)}</select><ChevronDown className="landing-chevron" aria-hidden="true" /></label>
            <button type="submit" className="landing-button">Find workers <ArrowRight aria-hidden="true" /></button>
          </form>
        </div>
      </main>
    </div>

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
