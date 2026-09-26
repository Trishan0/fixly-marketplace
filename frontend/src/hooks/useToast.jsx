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
  const colors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-100',
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-100',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100',
    default: 'bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-full sm:max-w-sm lg:bottom-4"
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
                className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-lg ${colors[item.variant] || colors.default}`}
              >
                <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  {item.title && <p className="text-sm font-semibold">{item.title}</p>}
                  {item.description && <p className="mt-0.5 text-sm opacity-90">{item.description}</p>}
                </div>
                <button type="button" onClick={() => dismiss(item.id)} className="-m-2 flex h-11 w-11 items-center justify-center rounded-xl opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10" aria-label="Dismiss notification">
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
