import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

const TOKEN_KEY = 'fixly_token'
const USER_KEY = 'fixly_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  const persistSession = (token, nextUser) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setUser(nextUser)
  }

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    persistSession(data.token, data.user)
    return data.user
  }

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload)
    persistSession(data.token, data.user)
    return data.user
  }

  const logout = () => {
    clearSession()
  }

  const refreshUser = async () => {
    const { data } = await api.get('/auth/me')
    localStorage.setItem(USER_KEY, JSON.stringify(data))
    setUser(data)
    return data
  }

  useEffect(() => {
    let mounted = true
    const token = localStorage.getItem(TOKEN_KEY)

    if (!token) {
      setLoading(false)
      return
    }

    refreshUser()
      .catch(() => {
        if (mounted) clearSession()
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    const onUnauthorized = () => {
      if (!mounted) return
      clearSession()
    }

    window.addEventListener('fixly:auth-expired', onUnauthorized)
    return () => {
      mounted = false
      window.removeEventListener('fixly:auth-expired', onUnauthorized)
    }
  }, [])

  const value = useMemo(() => ({
    user,
    login,
    register,
    logout,
    refreshUser,
    loading,
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
