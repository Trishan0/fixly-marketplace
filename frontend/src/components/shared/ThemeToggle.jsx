import React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useTheme } from '../../context/ThemeContext'

export function ThemeToggleIconButton({ className }) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const Icon = resolvedTheme === 'dark' ? Sun : Moon

  return (
    <button
      onClick={toggleTheme}
      className={cn('flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white', className)}
      aria-label="Toggle theme"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

export function ThemeModeSelector() {
  const { themeMode, setThemeMode } = useTheme()

  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setThemeMode(value)}
          className={cn(
            'rounded-2xl border px-4 py-3 text-left transition-all',
            themeMode === value
              ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-300'
              : 'border-slate-200 text-slate-600 hover:border-sky-200 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600'
          )}
        >
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="text-sm font-semibold">{label}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
