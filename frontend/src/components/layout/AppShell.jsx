import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Briefcase, Users, Bell, User, Settings,
  LogOut, Menu, X, ChevronRight, MessageSquare, DollarSign,
  Wrench, BarChart3, Shield, FileText, Tag, PanelLeftClose, PanelLeftOpen, ChevronDown
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn, getInitials } from '../../lib/utils'
import api from '../../lib/api'

const customerNav = [
  { href: '/customer-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/jobs', icon: Briefcase, label: 'My Jobs' },
  { href: '/find-workers', icon: Users, label: 'Find Workers' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/profile', icon: User, label: 'Profile' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

const workerNav = [
  { href: '/worker-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/jobs/feed', icon: Briefcase, label: 'Open Jobs' },
  { href: '/invites', icon: MessageSquare, label: 'Invites' },
  { href: '/jobs/assigned', icon: Wrench, label: 'My Work' },
  { href: '/earnings', icon: DollarSign, label: 'Earnings' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/profile', icon: User, label: 'Profile' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

const workerNavSimplified = [
  { href: '/worker-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/jobs/feed', icon: Briefcase, label: 'New Jobs' },
  { href: '/invites', icon: MessageSquare, label: 'Invites' },
  { href: '/jobs/assigned', icon: Wrench, label: 'My Jobs' },
  { href: '/earnings', icon: DollarSign, label: 'Earnings' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/profile', icon: User, label: 'Profile' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

const adminNav = [
  { href: '/admin', icon: BarChart3, label: 'Dashboard' },
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/workers', icon: Shield, label: 'Workers' },
  { href: '/admin/reports', icon: FileText, label: 'Reports' },
  { href: '/admin/categories', icon: Tag, label: 'Categories' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

function AccountMenu({ unread }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300"
      >
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-sky-100 text-sm font-bold text-sky-700">
          {user?.profile_photo
            ? <img src={user.profile_photo} alt="" className="h-full w-full object-cover" />
            : getInitials(user?.full_name)
          }
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-semibold text-slate-900">{user?.full_name}</p>
          <p className="text-xs capitalize text-slate-500">{user?.role}</p>
        </div>
        {(unread || 0) > 0 && (
          <span className="hidden rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white sm:inline-flex">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-30 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
          <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <User className="h-4 w-4" /> View Profile
          </Link>
          <Link to="/profile/edit" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <User className="h-4 w-4" /> Edit Profile
          </Link>
          <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <Link to="/notifications" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <Bell className="h-4 w-4" /> Notifications
          </Link>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50">
            <LogOut className="h-4 w-4" /> Log Out
          </button>
        </div>
      )}
    </div>
  )
}

function SidebarContent({ navItems, onClose, collapsed = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  return (
    <div className={cn('flex h-full flex-col bg-slate-950 text-white transition-all duration-200', collapsed ? 'w-20' : 'w-64')}>
      {/* Logo */}
      <div className={cn('flex items-center border-b border-white/10 py-5', collapsed ? 'justify-center px-3' : 'justify-between px-6')}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sky-500 rounded-xl flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-xl tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              Fixly
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* User info */}
      <div className={cn('border-b border-white/10 py-4', collapsed ? 'px-2' : 'px-4')}>
        <div className={cn('flex px-2', collapsed ? 'justify-center' : 'items-center gap-3')}>
          <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 text-sm font-bold flex-shrink-0 overflow-hidden">
            {user?.profile_photo
              ? <img src={user.profile_photo} alt="" className="w-9 h-9 object-cover" />
              : getInitials(user?.full_name)
            }
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label, badge }) => {
          const isProfileRoute = href === '/profile' && (
            location.pathname === '/profile' ||
            location.pathname.startsWith('/profile/') ||
            location.pathname === `/workers/${user?.id}` ||
            location.pathname === `/customers/${user?.id}`
          )

          const isActive = isProfileRoute ||
            location.pathname === href ||
            (href.length > 1 && !['/', '/admin', '/worker-dashboard', '/customer-dashboard'].includes(href) && location.pathname.startsWith(href))
            || location.pathname === href

          return (
            <Link
              key={href}
              to={href}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center rounded-xl transition-all duration-150 font-medium text-sm relative',
                collapsed ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-2.5',
                isActive
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="flex-1">{label}</span>}
              {badge && (
                <span className={cn('bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0', collapsed ? 'absolute right-1 top-1 h-4 min-w-4 px-1' : 'w-5 h-5')}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              {!collapsed && isActive && <ChevronRight className="w-3 h-3 opacity-60 flex-shrink-0" />}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-6 pt-2 border-t border-white/10">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign Out' : undefined}
          className={cn('w-full flex rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all text-sm font-medium', collapsed ? 'justify-center px-3 py-3' : 'items-center gap-3 px-4 py-2.5')}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </div>
  )
}

export function AppShell({ children }) {
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem('fixly_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })
  const location = useLocation()

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 30000,
    enabled: !!user,
  })
  const unread = notifData?.unread || 0

  useEffect(() => {
    try {
      localStorage.setItem('fixly_sidebar_collapsed', String(desktopCollapsed))
    } catch {
      // ignore storage issues
    }
  }, [desktopCollapsed])

  let baseNav = customerNav
  if (user?.role === 'worker') {
    baseNav = user.dashboard_mode === 'simplified' ? workerNavSimplified : workerNav
  } else if (user?.role === 'admin') {
    baseNav = adminNav
  }

  // Inject unread badge on notifications link
  const navItems = baseNav.map(item =>
    item.href === '/notifications'
      ? { ...item, badge: unread > 0 ? unread : null }
      : item
  )

  const currentSection = useMemo(() => {
    const activeItem = navItems.find(item => {
      if (item.href === '/profile') {
        return location.pathname === '/profile' ||
          location.pathname.startsWith('/profile/') ||
          location.pathname === `/workers/${user?.id}` ||
          location.pathname === `/customers/${user?.id}`
      }
      return location.pathname === item.href || (item.href.length > 1 && location.pathname.startsWith(item.href))
    })
    return activeItem?.label || 'Fixly'
  }, [location.pathname, navItems, user?.id])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside className={cn('hidden lg:flex flex-col flex-shrink-0 shadow-lg transition-all duration-200', desktopCollapsed ? 'w-20' : 'w-64')}>
        <SidebarContent navItems={navItems} collapsed={desktopCollapsed} />
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -270 }} animate={{ x: 0 }} exit={{ x: -270 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed left-0 top-0 bottom-0 z-50 lg:hidden flex flex-col shadow-2xl"
            >
              <SidebarContent navItems={navItems} onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="hidden lg:flex items-center justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-6 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDesktopCollapsed(v => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
              aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {desktopCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Workspace</p>
              <h1 className="text-lg font-bold text-slate-900">{currentSection}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <AccountMenu unread={unread} />
          </div>
        </header>

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-sky-500 rounded-lg flex items-center justify-center">
              <Wrench className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>Fixly</span>
          </div>
          {unread > 0 && (
            <Link to="/notifications" className="ml-auto relative">
              <Bell className="w-5 h-5 text-slate-600" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            </Link>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="min-h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
