import React from 'react'
import { Link } from 'react-router-dom'

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 md:px-12 lg:grid-cols-[1.35fr_0.8fr_0.8fr_0.9fr]">
        <div>
          <Link to="/" aria-label="Fixly home"><img src="/fixly-logo-dark.svg" alt="Fixly" width="124" height="34" className="h-auto w-[124px] object-contain" /></Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">Sri Lanka&apos;s local-service marketplace for finding trusted help and building a stronger service business.</p>
        </div>
        <FooterColumn title="Marketplace" links={[
          ['/workers', 'Browse workers'],
          ['/auth?tab=register&role=customer', 'Post a job'],
          ['/auth?tab=register&role=worker', 'Join as a worker'],
        ]} />
        <FooterColumn title="Discover" links={[
          ['/how-it-works', 'How it works'],
          ['/blog', 'Blog'],
          ['/contact', 'Contact us'],
        ]} />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Get started</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">A clearer way to move from a local need to a job well done.</p>
          <Link to="/auth?tab=register" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-500">Create account</Link>
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 md:px-12">
          <p>© {new Date().getFullYear()} Fixly. All rights reserved.</p>
          <p>Built for better local work.</p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">{title}</p>
      <div className="mt-3 grid gap-2">
        {links.map(([to, label]) => <Link key={to} to={to} className="text-sm transition hover:text-white">{label}</Link>)}
      </div>
    </div>
  )
}
