import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Eye, LogOut, MoreHorizontal, Pencil, Settings } from 'lucide-react'
import { Avatar } from './UI'
import { Card, CardHeader } from '../ui/Card'
import { buttonClasses } from '../ui/buttonClasses'
import { cn } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { PublicNavbar } from './PublicNavbar'

const MENU_ITEM = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors [@media(pointer:coarse)]:min-h-11'

export function ProfileActionsMenu({ className }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={buttonClasses({ variant: 'secondary', size: 'icon' })}
        aria-label="Profile actions"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-2 w-48 rounded-control border border-line bg-surface p-1.5 shadow-overlay">
          <Link role="menuitem" to="/profile/edit" className={cn(MENU_ITEM, 'text-fg hover:bg-subtle')} onClick={() => setOpen(false)}>
            <Pencil className="h-4 w-4 text-fg-subtle" /> Edit profile
          </Link>
          <Link role="menuitem" to="/settings" className={cn(MENU_ITEM, 'text-fg hover:bg-subtle')} onClick={() => setOpen(false)}>
            <Settings className="h-4 w-4 text-fg-subtle" /> Settings
          </Link>
          <div className="my-1 h-px bg-line" />
          <button role="menuitem" type="button" onClick={handleLogout} className={cn(MENU_ITEM, 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10')}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

/** Shown above your own public profile so you know what you're looking at. */
export function OwnProfileBar({ audience }) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-card border border-sky-200/80 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2"><Eye className="h-4 w-4 shrink-0" aria-hidden="true" /> This is how {audience} see your profile.</p>
      <div className="flex items-center gap-2">
        <Link to="/profile/edit" className={buttonClasses({ size: 'sm' })}><Pencil className="h-4 w-4" aria-hidden="true" /> Edit profile</Link>
        <ProfileActionsMenu />
      </div>
    </div>
  )
}

export function PublicPageChrome({ crumbLabel, crumbTo, currentLabel }) {
  return (
    <>
      <PublicNavbar />
      <nav aria-label="Breadcrumb" className="border-b border-line bg-surface/70">
        <ol className="mx-auto flex min-h-11 max-w-[1200px] items-center gap-1.5 px-4 text-[13px] text-fg-muted sm:px-6 lg:px-8">
          {crumbLabel && (
            <li>{crumbTo ? <Link to={crumbTo} className="hover:text-fg">{crumbLabel}</Link> : crumbLabel}</li>
          )}
          {currentLabel && (
            <li className="flex min-w-0 items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />
              <span className="truncate font-medium text-fg" aria-current="page">{currentLabel}</span>
            </li>
          )}
        </ol>
      </nav>
    </>
  )
}

/** Profile header: a brand cover band, the avatar overlapping it, name, badges and actions. */
export function ProfileHero({ avatarName, avatarSrc, title, badges, meta, actions, stats, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-24 bg-gradient-to-r from-sky-500 via-sky-600 to-sky-700 sm:h-28" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.22),transparent_45%)]" />
      </div>
      <div className="px-4 pb-5 sm:px-6 sm:pb-6">
        <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
          <span className="relative w-fit rounded-full bg-surface ring-4 ring-surface">
            <Avatar name={avatarName} src={avatarSrc} size="xl" className="h-20 w-20 sm:h-24 sm:w-24 sm:text-2xl" />
          </span>
          {actions && <div className="hidden flex-wrap items-center gap-2 sm:flex sm:pb-1">{actions}</div>}
        </div>
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-fg sm:text-[28px]">{title}</h1>
            {badges}
          </div>
          {meta && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-fg-muted">{meta}</div>}
        </div>
        {children}
        {actions && <div className="mt-4 flex flex-wrap items-center gap-2 sm:hidden [&>*]:w-full [&_a]:w-full [&_button]:w-full">{actions}</div>}
      </div>
      {stats && (
        <dl className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          {stats.map(stat => (
            <div key={stat.label} className="bg-surface px-4 py-3.5 sm:px-6">
              <dt className="text-xs font-medium text-fg-subtle">{stat.label}</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-lg font-bold tracking-tight text-fg tabular-nums">
                {stat.icon}{stat.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  )
}

export function ProfileSectionCard({ title, meta, children, className, bodyClassName }) {
  return (
    <Card className={className}>
      <CardHeader title={title} actions={meta && <span className="text-[13px] text-fg-subtle">{meta}</span>} />
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </Card>
  )
}

export function ProfileEmpty({ icon: Icon, children }) {
  return (
    <div className="rounded-control border border-dashed border-line-strong bg-subtle/60 px-6 py-10 text-center text-sm text-fg-muted">
      {Icon && <Icon className="mx-auto mb-2 h-5 w-5 text-fg-subtle" aria-hidden="true" />}
      {children}
    </div>
  )
}
