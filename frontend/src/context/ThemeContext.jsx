import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'fixly_theme_mode'

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'system'
    } catch {
      return 'system'
    }
  })
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
    try {
      localStorage.setItem(STORAGE_KEY, themeMode)
    } catch {
      // ignore storage issues
    }
  }, [resolvedTheme, themeMode])

  const value = useMemo(() => ({
    themeMode,
    resolvedTheme,
    setThemeMode,
    toggleTheme: () => setThemeMode(curr => {
      const active = curr === 'system' ? getSystemTheme() : curr
      return active === 'dark' ? 'light' : 'dark'
    }),
  }), [themeMode, resolvedTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
