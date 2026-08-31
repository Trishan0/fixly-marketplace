import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ThemeToggleIconButton } from './ThemeToggle'
import { BrandLogo } from './BrandLogo'

const publicLinks = [
  { to: '/workers', label: 'Browse Workers' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/blog', label: 'Blog' },
  { to: '/contact', label: 'Contact us' },
]

function linkClass(active) {
  return `inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold transition ${active
    ? 'text-sky-700 dark:text-sky-300'
    : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'}`
}

export function PublicNavbar() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const dashboardLink = user?.role === 'admin' ? '/admin' : user?.role === 'worker' ? '/worker-dashboard' : '/customer-dashboard'

  return (
    <nav className="fixly-topbar sticky top-0 z-30 border-b px-4 py-3 sm:px-6 md:px-12" aria-label="Public navigation">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <Link to="/" className="flex min-h-11 items-center" aria-label="Fixly home" onClick={() => setMenuOpen(false)}>
          <BrandLogo className="h-9 w-[8.45rem]" />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {publicLinks.map(({ to, label }) => (
            <Link key={to} to={to} className={linkClass(pathname === to || (to === '/workers' && pathname.startsWith('/workers/')))}>
              {label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <ThemeToggleIconButton className="h-11 w-11 rounded-xl" />
          {user ? (
            <Link to={dashboardLink} className="fixly-btn-primary text-sm">Dashboard</Link>
          ) : (
            <>
              <Link to="/auth" className="hidden min-h-11 items-center px-2 text-sm font-semibold text-slate-600 dark:text-slate-300 xl:inline-flex">Sign in</Link>
              <Link to="/auth?tab=register" className="fixly-btn-primary text-sm">Get started</Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggleIconButton className="h-11 w-11 rounded-xl" />
          <button
            type="button"
            onClick={() => setMenuOpen(open => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mx-auto mt-3 grid max-w-7xl gap-1 border-t border-slate-100 pt-3 dark:border-slate-800 lg:hidden">
          {publicLinks.map(({ to, label }) => (
            <Link key={to} to={to} onClick={() => setMenuOpen(false)} className={`${linkClass(pathname === to)} justify-between px-3`}>
              {label}
            </Link>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            {user ? (
              <Link to={dashboardLink} onClick={() => setMenuOpen(false)} className="fixly-btn-primary w-full text-sm">Dashboard</Link>
            ) : (
              <>
                <Link to="/auth" onClick={() => setMenuOpen(false)} className="fixly-btn-secondary w-full text-sm">Sign in</Link>
                <Link to="/auth?tab=register" onClick={() => setMenuOpen(false)} className="fixly-btn-primary w-full text-sm">Get started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
