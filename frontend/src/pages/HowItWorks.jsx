import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, Briefcase, CheckCircle2, ClipboardList,
  MapPin, Search, Sparkles, Star, UserCheck,
} from 'lucide-react'
import { PublicNavbar } from '../components/shared/PublicNavbar'
import { PublicFooter } from '../components/shared/PublicFooter'

const journeys = {
  customer: {
    label: 'For customers',
    eyebrow: 'Hire with clarity',
    title: 'From a job to a job well done.',
    description: 'Fixly keeps each part of hiring local help in one simple, visible flow—so you can make decisions with confidence.',
    action: { to: '/auth?tab=register&role=customer', label: 'Post your first job' },
    steps: [
      { icon: ClipboardList, title: 'Tell us what you need', text: 'Add the job details, category, area, budget, and urgency in a guided form.', label: 'Post a job' },
      { icon: Search, title: 'Find the right fit', text: 'Browse nearby workers, invite promising people, or review incoming proposals.', label: 'Compare options' },
      { icon: UserCheck, title: 'Choose and hire', text: 'Review profiles, experience, ratings, and quotes before assigning the work.', label: 'Hire with confidence' },
      { icon: Star, title: 'Complete and review', text: 'Keep the outcome, payment record, and review together when the work is finished.', label: 'Close the loop' },
    ],
    preview: {
      title: 'Kitchen pipe repair',
      meta: 'Colombo 05 · Urgent',
      tag: '3 proposals received',
      rows: [
        ['Nimal Perera', '4.9', 'LKR 4,500'],
        ['Kasun Silva', '4.8', 'LKR 5,000'],
      ],
      footer: 'Review proposals',
    },
  },
  worker: {
    label: 'For workers',
    eyebrow: 'Turn skill into steady work',
    title: 'A clear path from opportunity to reputation.',
    description: 'Fixly makes it easier to show what you do, find suitable work, and run every job professionally.',
    action: { to: '/auth?tab=register&role=worker', label: 'Join as a worker' },
    steps: [
      { icon: UserCheck, title: 'Build a credible profile', text: 'Add your skills, service areas, experience, portfolio, and availability once.', label: 'Show your strengths' },
      { icon: Briefcase, title: 'Discover suitable jobs', text: 'See open jobs and direct invitations that match the work you want to do.', label: 'Find opportunities' },
      { icon: Sparkles, title: 'Send a strong proposal', text: 'Use the proposal assistant to start a tailored response, then make it your own.', label: 'Win the work' },
      { icon: BadgeCheck, title: 'Deliver and grow', text: 'Manage active work, update customers, record earnings, and build your reviews.', label: 'Build momentum' },
    ],
    preview: {
      title: 'Repair leaking kitchen pipe',
      meta: 'Colombo 05 · Today',
      tag: 'Matches your plumbing skills',
      rows: [
        ['Quoted price', '—', 'LKR 4,500'],
        ['Your proposal', 'Ready', 'Send now'],
      ],
      footer: 'Draft proposal with AI',
    },
  },
}

function WorkflowPreview({ journey }) {
  const isCustomer = journey.label === 'For customers'
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-sky-100/70 blur-3xl dark:bg-sky-900/30" />
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-[0_24px_70px_rgba(15,23,42,0.14)] dark:border-slate-700 dark:bg-slate-900 sm:p-4">
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800">
          <span className="h-2 w-2 rounded-full bg-rose-300" />
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          <div className="ml-2 h-5 flex-1 rounded-md bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="px-1 pb-1 pt-4 sm:px-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">{isCustomer ? 'My job' : 'Open job'}</p>
              <h2 className="mt-1 text-base font-bold text-slate-950 dark:text-white">{journey.preview.title}</h2>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" />{journey.preview.meta}</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-2 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
              {isCustomer ? <ClipboardList className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2 text-xs font-semibold text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300">
            {journey.preview.tag}
          </div>
          <div className="mt-3 space-y-2">
            {journey.preview.rows.map(([name, rating, amount]) => (
              <div key={name} className="flex items-center gap-2 rounded-xl border border-slate-100 p-2.5 dark:border-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-200">{name.charAt(0)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{rating === '—' ? 'Suggested amount' : rating === 'Ready' ? 'Personalised response' : `★ ${rating} rating`}</p>
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{amount}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-bold text-white shadow-sm">
            {journey.preview.footer} <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HowItWorks() {
  const [role, setRole] = useState('customer')
  const journey = journeys[role]

  return (
    <div className="fixly-page-shell min-h-[100dvh] overflow-x-hidden">
      <PublicNavbar />

      <main>
        <section className="relative overflow-hidden border-b border-slate-100 dark:border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(14,165,233,0.16),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(56,189,248,0.13),transparent_32%)] dark:bg-[radial-gradient(circle_at_15%_0%,rgba(14,165,233,0.25),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(56,189,248,0.13),transparent_32%)]" />
          <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:px-12 md:py-20">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">A simpler local-service journey</p>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.035em] text-slate-950 dark:text-white sm:text-5xl md:text-6xl">See exactly how Fixly works.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg sm:leading-8">Whether you need help at home or want to grow your service business, every next step is clear and easy to act on.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:px-12">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">Choose your path</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">Built for both sides of the job.</h2>
            </div>
            <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800" role="tablist" aria-label="Select a Fixly journey">
              {Object.entries(journeys).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={role === key}
                  onClick={() => setRole(key)}
                  className={`min-h-11 rounded-xl px-4 text-sm font-bold transition ${role === key ? 'bg-white text-sky-700 shadow-sm dark:bg-slate-900 dark:text-sky-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <p className="text-sm font-bold text-sky-600 dark:text-sky-300">{journey.eyebrow}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">{journey.title}</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">{journey.description}</p>

              <ol className="mt-8 space-y-3">
                {journey.steps.map(({ icon: Icon, title, text, label }, index) => (
                  <li key={title} className="group flex gap-4 rounded-2xl border border-slate-100 bg-white/70 p-4 transition hover:border-sky-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-sky-900">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sm font-black text-sky-700 dark:bg-sky-950/45 dark:text-sky-300">{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                        <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">{label}</span>
                      </div>
                      <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link to={journey.action.to} className="fixly-btn-primary mt-8 w-full gap-2 rounded-2xl text-sm sm:w-auto">
                {journey.action.label} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <WorkflowPreview journey={journey} />
          </div>
        </section>

        <section className="border-y border-slate-100 bg-slate-50/70 py-12 dark:border-slate-800 dark:bg-slate-950/30 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-12">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['Keep context', 'Jobs, proposals, messages, and outcomes are organized around the same work.'],
                ['Make informed choices', 'Profiles, skills, service areas, availability, ratings, and quotes stay easy to compare.'],
                ['Move with confidence', 'Every role has clear next actions instead of a maze of marketplace features.'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <CheckCircle2 className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  <h2 className="mt-4 font-bold text-slate-950 dark:text-white">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6 sm:py-16 md:px-12">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">Ready to make local work easier?</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">Create an account to post a job, find your next opportunity, or simply explore the marketplace first.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/auth?tab=register" className="fixly-btn-primary rounded-2xl">Create an account</Link>
            <Link to="/workers" className="fixly-btn-secondary rounded-2xl">Browse workers</Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
