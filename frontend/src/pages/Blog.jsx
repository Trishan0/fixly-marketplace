import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Briefcase, Lightbulb, MapPin, Star } from 'lucide-react'
import { PublicNavbar } from '../components/shared/PublicNavbar'
import { PublicFooter } from '../components/shared/PublicFooter'

const articles = [
  { icon: Lightbulb, tag: 'Hiring guide', title: 'How to write a job post that gets better proposals', description: 'A few specific details help skilled workers understand the job, quote accurately, and respond sooner.', read: '4 min read' },
  { icon: BadgeCheck, tag: 'Trust & safety', title: 'What to check before hiring a local professional', description: 'Compare skills, service areas, past work, reviews, availability, and the scope of each proposal.', read: '5 min read' },
  { icon: Briefcase, tag: 'For workers', title: 'Turn your experience into a proposal customers understand', description: 'Lead with the relevant skill, explain your approach clearly, and give a realistic time and price estimate.', read: '4 min read' },
  { icon: MapPin, tag: 'Local services', title: 'Why location matters when choosing a service worker', description: 'Hiring nearby can make scheduling simpler and help you find professionals familiar with your area.', read: '3 min read' },
  { icon: Star, tag: 'Community', title: 'Reviews that make the marketplace more useful for everyone', description: 'Helpful reviews focus on communication, quality, reliability, and whether the job matched expectations.', read: '3 min read' },
  { icon: Lightbulb, tag: 'Getting started', title: 'A simple first-week plan for new Fixly workers', description: 'Set up your profile, add your service areas, browse open work, and send focused proposals consistently.', read: '4 min read' },
]

export default function Blog() {
  return (
    <div className="fixly-page-shell min-h-[100dvh] overflow-x-hidden">
      <PublicNavbar />
      <main>
        <section className="border-b border-slate-100 bg-[radial-gradient(circle_at_12%_0%,rgba(14,165,233,0.16),transparent_34%)] py-12 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_12%_0%,rgba(14,165,233,0.22),transparent_34%)] sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-12">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">The Fixly journal</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.035em] text-slate-950 dark:text-white sm:text-5xl">Practical advice for better local work.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">Useful, no-nonsense guides for customers who need help and workers building a stronger local reputation.</p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 md:px-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map(({ icon: Icon, tag, title, description, read }) => (
              <article key={title} className="group flex min-h-64 flex-col rounded-3xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-900">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/45 dark:text-sky-300"><Icon className="h-5 w-5" /></div>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">{tag}</p>
                <h2 className="mt-2 text-lg font-black tracking-tight text-slate-950 dark:text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
                <div className="mt-auto flex items-center justify-between pt-6 text-sm font-bold text-sky-700 dark:text-sky-300"><span>{read}</span><span className="inline-flex items-center gap-1">Read guide <ArrowRight className="h-4 w-4" /></span></div>
              </article>
            ))}
          </div>
          <div className="mt-12 rounded-3xl bg-sky-600 px-6 py-10 text-center text-white sm:px-10">
            <h2 className="text-2xl font-black sm:text-3xl">Ready to put the advice into action?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sky-100">Browse workers, post a job, or create a profile that helps local customers find you.</p>
            <Link to="/auth?tab=register" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-sky-700">Get started <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
