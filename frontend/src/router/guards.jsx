import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from '../components/shared/PageLoader'
import { safeNextPath } from '../lib/redirect'

function signInPath(location) {
  const next = `${location.pathname}${location.search}`
  return `/auth?next=${encodeURIComponent(next)}`
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader label="Checking your session" />
  if (!user) return <Navigate to={signInPath(location)} replace />
  return children
}

export function RoleRoute({ children, role }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader label="Checking your session" />
  if (!user) return <Navigate to={signInPath(location)} replace />
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />
  return children
}

export function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader label="Checking your session" />
  if (user) {
    const next = safeNextPath(new URLSearchParams(location.search).get('next'))
    return <Navigate to={next || '/dashboard'} replace />
  }
  return children
}
