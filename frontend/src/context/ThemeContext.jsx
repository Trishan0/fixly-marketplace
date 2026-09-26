import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

const DEFAULT_MODE = 'light'
const MODES = ['light', 'dark', 'system']
// Only written when someone picks a theme themselves.
const CHOICE_KEY = 'fixly_theme_choice'
// Older builds saved the mode on every visit, so a stored "system" there
// wasn't a real choice; only an explicit light/dark from it is kept.
const LEGACY_KEY = 'fixly_theme_mode'

function readStoredMode() {
  try {
    const choice = localStorage.getItem(CHOICE_KEY)
    if (MODES.includes(choice)) return choice
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy === 'light' || legacy === 'dark') return legacy
  } catch {
    // storage unavailable (private mode) - fall back to the default
  }
  return DEFAULT_MODE
}

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState(readStoredMode)
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemTheme(media.matches ? 'dark' : 'light')
    onChange()
    if (media.addEventListener) media.addEventListener('change', onChange)
    else media.addListener(onChange)
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', onChange)
      else media.removeListener(onChange)
    }
  }, [])

  const resolvedTheme = themeMode === 'system' ? systemTheme : themeMode

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setThemeMode = useCallback((mode) => {
    if (!MODES.includes(mode)) return
    setThemeModeState(mode)
    try {
      localStorage.setItem(CHOICE_KEY, mode)
      localStorage.removeItem(LEGACY_KEY)
    } catch {
      // ignore storage issues
    }
  }, [])

  const value = useMemo(() => ({
    themeMode,
    resolvedTheme,
    setThemeMode,
    toggleTheme: () => setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark'),
  }), [themeMode, resolvedTheme, setThemeMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
