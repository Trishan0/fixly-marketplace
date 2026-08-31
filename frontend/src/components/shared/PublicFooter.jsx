import React from 'react'
import { Link } from 'react-router-dom'

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 py-8 text-slate-400">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row md:px-12">
        <Link to="/" aria-label="Fixly home"><img src="/fixly-logo-dark.svg" alt="Fixly" width="124" height="34" className="h-auto w-[124px] object-contain" /></Link>
        <div className="flex items-center gap-4 text-xs font-medium">
          <Link to="/how-it-works" className="hover:text-white">How it works</Link>
          <Link to="/blog" className="hover:text-white">Blog</Link>
          <Link to="/contact" className="hover:text-white">Contact</Link>
        </div>
        <p className="text-xs">© {new Date().getFullYear()} Fixly. All rights reserved.</p>
      </div>
    </footer>
  )
}
