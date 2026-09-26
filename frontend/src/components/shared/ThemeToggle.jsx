import React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useTheme } from '../../context/ThemeContext'

export function ThemeToggleIconButton({ className }) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const Icon = resolvedTheme === 'dark' ? Sun : Moon

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn('flex h-9 w-9 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-subtle hover:text-fg [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11', className)}
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
          type="button"
          onClick={() => setThemeMode(value)}
          className={cn(
            'min-h-14 rounded-control border px-2 py-3 text-center transition-colors sm:px-4 sm:text-left',
            themeMode === value
              ? 'border-brand bg-brand-subtle text-brand-text'
              : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
          )}
        >
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2">
            <Icon className="h-4 w-4" />
            <span className="text-sm font-semibold">{label}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
