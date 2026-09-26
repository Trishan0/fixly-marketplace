import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './hooks/useToast'
import { ProtectedRoute, RoleRoute, GuestRoute } from './router/guards'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { PageLoader } from './components/shared/PageLoader'
import { usePageTitle } from './hooks/usePageTitle'

// Each area loads on demand so visitors to the landing page don't download
// the admin console, the worker tools, or the AI agent panel.
const Landing = lazy(() => import('./pages/Landing'))
const HowItWorks = lazy(() => import('./pages/HowItWorks'))
const Blog = lazy(() => import('./pages/Blog'))
const Contact = lazy(() => import('./pages/Contact'))
const Auth = lazy(() => import('./pages/Auth'))
const ForgotPasswordPage = lazy(() => import('./pages/AuthActions').then(m => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('./pages/AuthActions').then(m => ({ default: m.ResetPasswordPage })))
const VerifyEmailPage = lazy(() => import('./pages/AuthActions').then(m => ({ default: m.VerifyEmailPage })))
const TermsPage = lazy(() => import('./pages/legal/LegalPages').then(m => ({ default: m.TermsPage })))
const PrivacyPage = lazy(() => import('./pages/legal/LegalPages').then(m => ({ default: m.PrivacyPage })))
const SafetyPage = lazy(() => import('./pages/legal/LegalPages').then(m => ({ default: m.SafetyPage })))
const WorkerCatalogPublic = lazy(() => import('./pages/public/WorkerCatalog'))
const WorkerProfile = lazy(() => import('./pages/public/WorkerProfile'))
const CustomerProfile = lazy(() => import('./pages/public/CustomerProfile'))
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'))
const PostJob = lazy(() => import('./pages/customer/PostJob'))
const MyJobs = lazy(() => import('./pages/customer/MyJobs'))
const JobDetail = lazy(() => import('./pages/customer/JobDetail'))
const WorkersPage = lazy(() => import('./pages/customer/Workers'))
const WorkerDashboard = lazy(() => import('./pages/worker/Dashboard'))
const OpenJobs = lazy(() => import('./pages/worker/WorkerPages').then(m => ({ default: m.OpenJobs })))
const Invites = lazy(() => import('./pages/worker/WorkerPages').then(m => ({ default: m.Invites })))
const AssignedJobs = lazy(() => import('./pages/worker/WorkerPages').then(m => ({ default: m.AssignedJobs })))
const Earnings = lazy(() => import('./pages/worker/Earnings'))
const SendProposal = lazy(() => import('./pages/worker/SendProposal'))
const ProfilePage = lazy(() => import('./pages/shared/ProfileSettings').then(m => ({ default: m.ProfilePage })))
const SettingsPage = lazy(() => import('./pages/shared/ProfileSettings').then(m => ({ default: m.SettingsPage })))
const Notifications = lazy(() => import('./pages/shared/Notifications'))
const Messages = lazy(() => import('./pages/shared/Messages'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminPages').then(m => ({ default: m.AdminDashboard })))
const AdminUsers = lazy(() => import('./pages/admin/AdminPages').then(m => ({ default: m.AdminUsers })))
const AdminWorkers = lazy(() => import('./pages/admin/AdminPages').then(m => ({ default: m.AdminWorkers })))
const AdminReports = lazy(() => import('./pages/admin/AdminPages').then(m => ({ default: m.AdminReports })))
const AdminCategories = lazy(() => import('./pages/admin/AdminPages').then(m => ({ default: m.AdminCategories })))

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
  usePageTitle('Page not found')
  const { user } = useAuth()
  return (
    <main className="fixly-page-shell flex min-h-[100dvh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">Error 404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">The link may be old, or the page may have moved.</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link to={user ? '/dashboard' : '/'} className="fixly-btn-primary text-sm">{user ? 'Go to dashboard' : 'Go to home page'}</Link>
          <Link to="/workers" className="fixly-btn-secondary text-sm">Browse workers</Link>
        </div>
      </div>
    </main>
  )
}

// Public pages scroll the window; reset it on navigation so a new page
// doesn't open halfway down. (The app shell resets its own scroll area.)
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function AppRoutes() {
  const location = useLocation()
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/safety" element={<SafetyPage />} />
          <Route path="/auth" element={<GuestRoute><Auth /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
          <Route path="/workers" element={<WorkerCatalogPublic />} />
          <Route path="/workers/:id" element={<WorkerProfile />} />
          <Route path="/customers/:id" element={<ProtectedRoute><CustomerProfile /></ProtectedRoute>} />
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
          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/messages/:jobId/:workerId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/admin" element={<RoleRoute role="admin"><AdminDashboard /></RoleRoute>} />
          <Route path="/admin/users" element={<RoleRoute role="admin"><AdminUsers /></RoleRoute>} />
          <Route path="/admin/workers" element={<RoleRoute role="admin"><AdminWorkers /></RoleRoute>} />
          <Route path="/admin/reports" element={<RoleRoute role="admin"><AdminReports /></RoleRoute>} />
          <Route path="/admin/categories" element={<RoleRoute role="admin"><AdminCategories /></RoleRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ToastProvider>
          <ScrollToTop />
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
