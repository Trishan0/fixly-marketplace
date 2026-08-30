import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MoreHorizontal, Settings, Pencil, LogOut, Wrench } from 'lucide-react'
import { Card, Avatar } from './UI'
import { cn } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { ThemeToggleIconButton } from './ThemeToggle'

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
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
        aria-label="Open profile actions"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-20 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)] dark:border-slate-700 dark:bg-slate-900">
          <Link
            to="/profile/edit"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            <Pencil className="h-4 w-4" /> Edit Profile
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <LogOut className="h-4 w-4" /> Log Out
          </button>
        </div>
      )}
    </div>
  )
}

export function ProfilePageIntro({ title = 'Public Profile', subtitle, ownView = false }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3 sm:gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Profile</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {ownView && <ProfileActionsMenu />}
    </div>
  )
}

export function PublicPageChrome({ crumbLabel, crumbTo, currentLabel }) {
  return (
    <nav className="fixly-topbar border-b border-white/70 dark:border-slate-800">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600">
            <Wrench className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-slate-950" style={{ fontFamily: 'Syne, sans-serif' }}>Fixly</span>
        </Link>
        {crumbLabel && (
          <>
            <span className="text-slate-300">/</span>
            {crumbTo ? (
              <Link to={crumbTo} className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">{crumbLabel}</Link>
            ) : (
              <span className="text-sm text-slate-500">{crumbLabel}</span>
            )}
          </>
        )}
        {currentLabel && (
          <span className="hidden min-w-0 items-center gap-3 sm:flex">
            <span className="text-slate-300">/</span>
            <span className="truncate text-sm font-medium text-slate-800">{currentLabel}</span>
          </span>
        )}
        <div className="ml-auto">
          <ThemeToggleIconButton />
        </div>
      </div>
    </nav>
  )
}

export function ProfileStatPanel({ label, value, hint, accent = 'sky' }) {
  const accents = {
    sky: 'bg-[linear-gradient(180deg,#f8fdff_0%,#eef8ff_100%)] border-sky-100/80 dark:bg-[linear-gradient(180deg,rgba(8,47,73,0.72)_0%,rgba(12,74,110,0.32)_100%)] dark:border-sky-900/60',
    amber: 'bg-[linear-gradient(180deg,#fffdf7_0%,#fff7e6_100%)] border-amber-100/80 dark:bg-[linear-gradient(180deg,rgba(120,53,15,0.56)_0%,rgba(146,64,14,0.18)_100%)] dark:border-amber-900/50',
    emerald: 'bg-[linear-gradient(180deg,#f7fffb_0%,#ecfdf3_100%)] border-emerald-100/80 dark:bg-[linear-gradient(180deg,rgba(6,78,59,0.56)_0%,rgba(5,150,105,0.16)_100%)] dark:border-emerald-900/50',
    violet: 'bg-[linear-gradient(180deg,#fcfbff_0%,#f3efff_100%)] border-violet-100/80 dark:bg-[linear-gradient(180deg,rgba(76,29,149,0.52)_0%,rgba(109,40,217,0.14)_100%)] dark:border-violet-900/50',
  }

  return (
    <div className={cn('rounded-2xl border p-3 sm:rounded-[1.75rem] sm:p-5', accents[accent])}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px] sm:tracking-[0.24em]">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950 sm:mt-3 sm:text-3xl">{value}</p>
      {hint && <p className="mt-2 hidden text-sm text-slate-500 sm:block">{hint}</p>}
    </div>
  )
}

export function ProfileHeroCard({ avatarName, avatarSrc, header, summary, stats, asideTitle, asideContent, children }) {
  return (
    <Card className="overflow-hidden border-white/90 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-[0_24px_70px_rgba(2,6,23,0.34)]">
      <div className="grid gap-5 p-4 sm:p-6 lg:p-8 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <Avatar
              name={avatarName}
              src={avatarSrc}
              size="xl"
              className="ring-4 ring-sky-50 shadow-[0_12px_30px_rgba(15,23,42,0.10)] dark:ring-slate-800"
            />
            <div className="min-w-0 flex-1 space-y-4">
              {header}
              {summary}
            </div>
          </div>

          {stats && <div className="grid grid-cols-3 gap-2 sm:gap-3">{stats}</div>}
          {children}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-none sm:rounded-[1.75rem] sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{asideTitle}</p>
          <div className="mt-4 space-y-4">{asideContent}</div>
        </div>
      </div>
    </Card>
  )
}

export function ProfileSectionCard({ title, meta, children, className }) {
  return (
    <Card className={cn('border-white/90 bg-white/95 p-4 shadow-[0_16px_44px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-[0_16px_44px_rgba(2,6,23,0.28)] sm:p-6', className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">{title}</h2>
        {meta && <span className="text-sm text-slate-400">{meta}</span>}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  )
}
