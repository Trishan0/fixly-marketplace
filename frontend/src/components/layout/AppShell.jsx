import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Briefcase, Users, Bell, User, Settings,
  LogOut, Menu, X, ChevronRight, MessageSquare, DollarSign,
  Wrench, BarChart3, Shield, FileText, Tag
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn, getInitials, formatRelativeTime } from '../../lib/utils'
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
  { href: '/profile', icon: User, label: 'Profile' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

const workerNavSimplified = [
  { href: '/worker-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/jobs/feed', icon: Briefcase, label: 'New Jobs' },
  { href: '/invites', icon: MessageSquare, label: 'Invites' },
  { href: '/jobs/assigned', icon: Wrench, label: 'My Jobs' },
  { href: '/earnings', icon: DollarSign, label: 'Earnings' },
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

function SidebarContent({ navItems, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white w-64">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sky-500 rounded-xl flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            Fixly
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 text-sm font-bold flex-shrink-0 overflow-hidden">
            {user?.profile_photo
              ? <img src={user.profile_photo} alt="" className="w-9 h-9 object-cover" />
              : getInitials(user?.full_name)
            }
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{user?.full_name}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label, badge }) => {
          const isActive = location.pathname === href ||
            (href.length > 1 && !['/', '/admin', '/worker-dashboard', '/customer-dashboard'].includes(href) && location.pathname.startsWith(href))
            || location.pathname === href

          return (
            <Link
              key={href}
              to={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-150 font-medium text-sm relative',
                isActive
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              {isActive && <ChevronRight className="w-3 h-3 opacity-60 flex-shrink-0" />}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-6 pt-2 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}

export function AppShell({ children }) {
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 30000,
    enabled: !!user,
  })
  const unread = notifData?.unread || 0

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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col flex-shrink-0 w-64 shadow-lg">
        <SidebarContent navItems={navItems} />
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
