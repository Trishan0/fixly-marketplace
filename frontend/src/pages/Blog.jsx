import React from 'react'
import { Link } from 'react-router-dom'
import { buttonClasses } from '../components/ui/buttonClasses'
import { ArrowRight, BadgeCheck, Briefcase, Lightbulb, MapPin, Star } from 'lucide-react'
import { PublicNavbar } from '../components/shared/PublicNavbar'
import { PublicFooter } from '../components/shared/PublicFooter'
import { usePageTitle } from '../hooks/usePageTitle'

const articles = [
  { icon: Lightbulb, tag: 'Hiring guide', title: 'How to write a job post that gets better proposals', description: 'A few specific details help skilled workers understand the job, quote accurately, and respond sooner.', read: '4 min read' },
  { icon: BadgeCheck, tag: 'Trust & safety', title: 'What to check before hiring a local professional', description: 'Compare skills, service areas, past work, reviews, availability, and the scope of each proposal.', read: '5 min read' },
  { icon: Briefcase, tag: 'For workers', title: 'Turn your experience into a proposal customers understand', description: 'Lead with the relevant skill, explain your approach clearly, and give a realistic time and price estimate.', read: '4 min read' },
  { icon: MapPin, tag: 'Local services', title: 'Why location matters when choosing a service worker', description: 'Hiring nearby can make scheduling simpler and help you find professionals familiar with your area.', read: '3 min read' },
  { icon: Star, tag: 'Community', title: 'Reviews that make the marketplace more useful for everyone', description: 'Helpful reviews focus on communication, quality, reliability, and whether the job matched expectations.', read: '3 min read' },
  { icon: Lightbulb, tag: 'Getting started', title: 'A simple first-week plan for new Fixly workers', description: 'Set up your profile, add your service areas, browse open work, and send focused proposals consistently.', read: '4 min read' },
]

export default function Blog() {
  usePageTitle('Blog')
  return (
    <div className="fixly-page-shell min-h-[100dvh] overflow-x-hidden">
      <PublicNavbar />
      <main>
        <section className="border-b border-line bg-[radial-gradient(circle_at_12%_0%,rgba(14,165,233,0.16),transparent_34%)] py-12 dark:bg-[radial-gradient(circle_at_12%_0%,rgba(14,165,233,0.22),transparent_34%)] sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-12">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-text">The Fixly journal</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-[-0.035em] text-slate-950 dark:text-white sm:text-5xl">Practical advice for better local work.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-fg-muted sm:text-lg">Useful, no-nonsense guides for customers who need help and workers building a stronger local reputation.</p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 md:px-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map(({ icon: Icon, tag, title, description, read }) => (
              <article key={title} className="flex min-h-64 flex-col rounded-card border border-line bg-surface p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-card bg-sky-50 text-sky-600 dark:bg-sky-950/45 dark:text-sky-300"><Icon className="h-5 w-5" /></div>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-brand-text">{tag}</p>
                <h2 className="mt-2 text-lg font-bold tracking-tight text-slate-950 dark:text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-fg-subtle">{description}</p>
                <div className="mt-auto flex items-center justify-between pt-6 text-sm"><span className="font-semibold text-fg-muted">{read}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-fg-muted dark:bg-slate-800">Coming soon</span></div>
              </article>
            ))}
          </div>
          <div className="relative mt-12 overflow-hidden rounded-overlay bg-gradient-to-br from-sky-500 via-sky-600 to-sky-800 px-6 py-10 text-center text-[#fff] shadow-brand sm:px-10">
            <h2 className="text-2xl font-bold sm:text-3xl">Ready to put the advice into action?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sky-100">Browse workers, post a job, or create a profile that helps local customers find you.</p>
            <Link to="/auth?tab=register" className={buttonClasses({ variant: 'on-brand', size: 'lg', className: 'mt-6' })}>Get started <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
