import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './hooks/useToast'
import { ProtectedRoute, RoleRoute, GuestRoute } from './router/guards'

import Landing from './pages/Landing'
import HowItWorks from './pages/HowItWorks'
import Blog from './pages/Blog'
import Contact from './pages/Contact'
import Auth from './pages/Auth'
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from './pages/AuthActions'
import WorkerCatalogPublic from './pages/public/WorkerCatalog'
import WorkerProfile from './pages/public/WorkerProfile'
import CustomerProfile from './pages/public/CustomerProfile'
import CustomerDashboard from './pages/customer/Dashboard'
import PostJob from './pages/customer/PostJob'
import MyJobs from './pages/customer/MyJobs'
import JobDetail from './pages/customer/JobDetail'
import WorkersPage from './pages/customer/Workers'
import WorkerDashboard from './pages/worker/Dashboard'
import { OpenJobs, Invites, AssignedJobs } from './pages/worker/WorkerPages'
import Earnings from './pages/worker/Earnings'
import SendProposal from './pages/worker/SendProposal'
import { ProfilePage, SettingsPage } from './pages/shared/ProfileSettings'
import Notifications from './pages/shared/Notifications'
import { AdminDashboard, AdminUsers, AdminWorkers, AdminReports, AdminCategories } from './pages/admin/AdminPages'

function DashboardRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/auth" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.role === 'worker') return <Navigate to="/worker-dashboard" replace />
  return <Navigate to="/customer-dashboard" replace />
}

function ProfileRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/auth" replace />
  if (user.role === 'worker') return <Navigate to={`/workers/${user.id}`} replace />
  if (user.role === 'customer') return <Navigate to={`/customers/${user.id}`} replace />
  return <Navigate to="/settings" replace />
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <p className="text-6xl font-black text-slate-200 mb-4">404</p>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Page not found</h1>
        <a href="/" className="fixly-btn-primary text-sm">Go Home</a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/auth" element={<GuestRoute><Auth /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
            <Route path="/workers" element={<WorkerCatalogPublic />} />
            <Route path="/workers/:id" element={<WorkerProfile />} />
            <Route path="/customers/:id" element={<CustomerProfile />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
            <Route path="/customer-dashboard" element={<RoleRoute role="customer"><CustomerDashboard /></RoleRoute>} />
            <Route path="/jobs/new" element={<RoleRoute role="customer"><PostJob /></RoleRoute>} />
            <Route path="/jobs" element={<RoleRoute role="customer"><MyJobs /></RoleRoute>} />
            <Route path="/find-workers" element={<RoleRoute role="customer"><WorkersPage /></RoleRoute>} />
            <Route path="/worker-dashboard" element={<RoleRoute role="worker"><WorkerDashboard /></RoleRoute>} />
            <Route path="/jobs/feed" element={<RoleRoute role="worker"><OpenJobs /></RoleRoute>} />
            <Route path="/invites" element={<RoleRoute role="worker"><Invites /></RoleRoute>} />
            <Route path="/jobs/assigned" element={<RoleRoute role="worker"><AssignedJobs /></RoleRoute>} />
            <Route path="/earnings" element={<RoleRoute role="worker"><Earnings /></RoleRoute>} />
            <Route path="/jobs/:jobId/propose" element={<RoleRoute role="worker"><SendProposal /></RoleRoute>} />
            <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfileRedirect /></ProtectedRoute>} />
            <Route path="/profile/edit" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/admin" element={<RoleRoute role="admin"><AdminDashboard /></RoleRoute>} />
            <Route path="/admin/users" element={<RoleRoute role="admin"><AdminUsers /></RoleRoute>} />
            <Route path="/admin/workers" element={<RoleRoute role="admin"><AdminWorkers /></RoleRoute>} />
            <Route path="/admin/reports" element={<RoleRoute role="admin"><AdminReports /></RoleRoute>} />
            <Route path="/admin/categories" element={<RoleRoute role="admin"><AdminCategories /></RoleRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
