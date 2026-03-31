import React from 'react'
import { cn, getInitials, STATUS_LABELS, STATUS_COLORS } from '../../lib/utils'

export function Button({ children, variant = 'primary', size = 'md', className, loading, ...props }) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none gap-2'
  const variants = {
    primary: 'bg-sky-600 hover:bg-sky-700 text-white',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    outline: 'border border-slate-200 hover:bg-slate-50 text-slate-700',
    ghost: 'hover:bg-slate-100 text-slate-600',
    success: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} disabled={loading} {...props}>
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  )
}

export function Badge({ status, children, className }) {
  const label = children || STATUS_LABELS[status] || status
  const color = STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={cn('status-badge', color, className)}>{label}</span>
  )
}

export function Avatar({ name, src, size = 'md', className }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-base', xl: 'w-20 h-20 text-xl' }
  return (
    <div className={cn('rounded-xl bg-sky-100 text-sky-600 font-bold flex items-center justify-center flex-shrink-0 overflow-hidden', sizes[size], className)}>
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : getInitials(name)}
    </div>
  )
}

export function StatCard({ icon: Icon, label, value, sub, color = 'sky', className }) {
  const colors = {
    sky: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  }
  return (
    <div className={cn('fixly-card p-5', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value ?? '—'}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

export function Card({ children, className, ...props }) {
  return <div className={cn('fixly-card', className)} {...props}>{children}</div>
}

export function Input({ label, error, className, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      <input className={cn('fixly-input', error && 'border-red-400 focus:ring-red-400', className)} {...props} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, className, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      <textarea className={cn('fixly-input resize-none', error && 'border-red-400', className)} {...props} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Select({ label, error, className, children, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      <select className={cn('fixly-input bg-white', error && 'border-red-400', className)} {...props}>
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Spinner({ className }) {
  return <div className={cn('w-5 h-5 border-2 border-slate-200 border-t-sky-600 rounded-full animate-spin', className)} />
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs mb-6">{description}</p>
      {action}
    </div>
  )
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative bg-white rounded-3xl shadow-2xl w-full overflow-hidden', width)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function StarRating({ rating, size = 'sm' }) {
  const sizes = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5' }
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={cn(sizes[size], i <= Math.round(rating) ? 'text-amber-400' : 'text-slate-200')} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {rating > 0 && <span className="text-xs text-slate-500 ml-1">{Number(rating).toFixed(1)}</span>}
    </div>
  )
}
