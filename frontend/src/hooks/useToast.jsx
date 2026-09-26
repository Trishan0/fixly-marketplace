import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle, XCircle, Info, X } from 'lucide-react'
import { subscribeToToasts } from '../lib/toastBus'

const ToastContext = createContext(null)

// Errors stay longer because they usually need reading and acting on.
const DURATIONS = { error: 8000, warning: 6000, success: 4000, default: 4000 }

let nextToastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts(current => current.filter(item => item.id !== id))
  }, [])

  const schedule = useCallback((id, variant) => {
    clearTimeout(timers.current.get(id))
    timers.current.set(id, setTimeout(() => dismiss(id), DURATIONS[variant] || DURATIONS.default))
  }, [dismiss])

  const toast = useCallback(({ title, description, variant = 'default' }) => {
    nextToastId += 1
    const id = nextToastId
    setToasts(current => [...current.slice(-3), { id, title, description, variant }])
    schedule(id, variant)
  }, [schedule])

  useEffect(() => subscribeToToasts(toast), [toast])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(timer => clearTimeout(timer))
  }, [])

  const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, default: Info }
  // White card with a coloured icon, matching the rest of the interface.
  const iconTones = {
    success: 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
    error: 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
    warning: 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
    default: 'bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:right-5 sm:w-full sm:max-w-sm lg:bottom-5"
        role="region"
        aria-label="Notifications"
      >
          {toasts.map(item => {
            const Icon = icons[item.variant] || Info
            return (
              <div
                key={item.id}
                role={item.variant === 'error' ? 'alert' : 'status'}
                aria-live={item.variant === 'error' ? 'assertive' : 'polite'}
                onMouseEnter={() => clearTimeout(timers.current.get(item.id))}
                onMouseLeave={() => schedule(item.id, item.variant)}
                onFocus={() => clearTimeout(timers.current.get(item.id))}
                onBlur={() => schedule(item.id, item.variant)}
                className="animate-toast-in pointer-events-auto flex items-start gap-3 rounded-card border border-line bg-surface p-3.5 text-fg shadow-overlay"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${iconTones[item.variant] || iconTones.default}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  {item.title && <p className="pt-1 text-sm font-semibold text-fg">{item.title}</p>}
                  {item.description && <p className="mt-0.5 text-[13px] leading-5 text-fg-muted">{item.description}</p>}
                </div>
                <button type="button" onClick={() => dismiss(item.id)} className="-m-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-fg-subtle hover:bg-subtle hover:text-fg" aria-label="Dismiss notification">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
