import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />
  return children
}

export function RoleRoute({ children, role }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />
  return children
}

export function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return children
}
