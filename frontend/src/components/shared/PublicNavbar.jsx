import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ThemeToggleIconButton } from './ThemeToggle'
import { BrandLogo } from './BrandLogo'
import { buttonClasses } from '../ui/buttonClasses'

const publicLinks = [
  { to: '/workers', label: 'Browse Workers' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/blog', label: 'Blog' },
  { to: '/contact', label: 'Contact us' },
]

function linkClass(active) {
  return `inline-flex h-9 items-center rounded-control px-3 text-sm font-medium transition-colors [@media(pointer:coarse)]:min-h-11 ${active
    ? 'bg-brand-subtle text-brand-text'
    : 'text-fg-muted hover:bg-subtle hover:text-fg'}`
}

export function PublicNavbar() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const dashboardLink = user?.role === 'admin' ? '/admin' : user?.role === 'worker' ? '/worker-dashboard' : '/customer-dashboard'

  return (
    <nav className="sticky top-0 z-30 border-b border-line bg-surface/85 px-4 py-2.5 backdrop-blur-xl sm:px-6 lg:px-8" aria-label="Public navigation">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-5 xl:gap-7">
          <Link to="/" className="flex min-h-11 shrink-0 items-center" aria-label="Fixly home" onClick={() => setMenuOpen(false)}>
            <BrandLogo className="h-9 w-[8.45rem]" />
          </Link>
          <div className="hidden items-center gap-0.5 lg:flex">
            {publicLinks.map(({ to, label }) => (
              <Link key={to} to={to} className={linkClass(pathname === to || (to === '/workers' && pathname.startsWith('/workers/')))}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <ThemeToggleIconButton className="h-10 w-10 rounded-control" />
          {user ? (
            <Link to={dashboardLink} className={buttonClasses()}>Dashboard</Link>
          ) : (
            <>
              <Link to="/auth" className={buttonClasses({ variant: 'ghost' })}>Sign in</Link>
              <Link to="/auth?tab=register" className={buttonClasses()}>Get started</Link>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 lg:hidden">
          <ThemeToggleIconButton className="h-11 w-11 rounded-control" />
          <button
            type="button"
            onClick={() => setMenuOpen(open => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-control border border-line bg-surface text-fg"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mx-auto mt-2.5 grid max-w-[1200px] gap-1 border-t border-line pt-3 lg:hidden">
          {publicLinks.map(({ to, label }) => (
            <Link key={to} to={to} onClick={() => setMenuOpen(false)} className={`${linkClass(pathname === to)} justify-between px-3`}>
              {label}
            </Link>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-3">
            {user ? (
              <Link to={dashboardLink} onClick={() => setMenuOpen(false)} className={buttonClasses({ className: 'col-span-2 w-full' })}>Dashboard</Link>
            ) : (
              <>
                <Link to="/auth" onClick={() => setMenuOpen(false)} className={buttonClasses({ variant: 'secondary', className: 'w-full' })}>Sign in</Link>
                <Link to="/auth?tab=register" onClick={() => setMenuOpen(false)} className={buttonClasses({ className: 'w-full' })}>Get started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
