import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Mail, MapPin, MessageCircle } from 'lucide-react'
import { PublicNavbar } from '../components/shared/PublicNavbar'
import { PublicFooter } from '../components/shared/PublicFooter'

const contactOptions = [
  { icon: MessageCircle, title: 'Using Fixly', description: 'Need help posting a job, creating a worker profile, or understanding a proposal?', action: 'Explore how it works', to: '/how-it-works' },
  { icon: Mail, title: 'Demo and project enquiries', description: 'For now, use the project contact channel shared by the Fixly team for demo enquiries.', action: 'Email the team', href: 'mailto:team@fixly.lk' },
  { icon: MapPin, title: 'Local-first marketplace', description: 'Fixly is designed around the way customers and skilled workers connect across Sri Lanka.', action: 'Browse workers', to: '/workers' },
]

export default function Contact() {
  return (
    <div className="fixly-page-shell min-h-[100dvh] overflow-x-hidden">
      <PublicNavbar />
      <main>
        <section className="border-b border-slate-100 bg-[radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.16),transparent_35%)] py-12 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.22),transparent_35%)] sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-12">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">Contact Fixly</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.035em] text-slate-950 dark:text-white sm:text-5xl">Let&apos;s make local work simpler.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">Whether you are exploring the marketplace or preparing a project enquiry, this is the right place to start.</p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 md:px-12">
          <div className="grid gap-4 lg:grid-cols-3">
            {contactOptions.map(({ icon: Icon, title, description, action, to, href }) => (
              <div key={title} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/45 dark:text-sky-300"><Icon className="h-5 w-5" /></div>
                <h2 className="mt-5 text-lg font-black text-slate-950 dark:text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
                {href ? <a href={href} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-sky-700 dark:text-sky-300">{action} <ArrowRight className="h-4 w-4" /></a> : <Link to={to} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-sky-700 dark:text-sky-300">{action} <ArrowRight className="h-4 w-4" /></Link>}
              </div>
            ))}
          </div>
          <div className="mt-12 grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/45 dark:text-sky-300"><Clock className="h-5 w-5" /></div>
              <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">Already know what you need?</h2>
              <p className="mt-2 max-w-2xl leading-7 text-slate-600 dark:text-slate-300">Start with the marketplace. Customers can post a job in minutes, while workers can build a profile and discover suitable work.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link to="/auth?tab=register&role=customer" className="fixly-btn-primary rounded-2xl text-sm">Post a job</Link>
              <Link to="/auth?tab=register&role=worker" className="fixly-btn-secondary rounded-2xl text-sm">Join as worker</Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
