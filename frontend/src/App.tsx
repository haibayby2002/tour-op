import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import { PageLoader } from './components/ui'
import AccountPage from './pages/AccountPage'
import BookingDetailPage from './pages/BookingDetailPage'
import BookingsPage from './pages/BookingsPage'
import ExplorePage from './pages/ExplorePage'
import HomePage from './pages/HomePage'
import LocalProfilePage from './pages/LocalProfilePage'
import LoginPage from './pages/LoginPage'
import MessagesPage from './pages/MessagesPage'
import NewRequestPage from './pages/NewRequestPage'
import NotFoundPage from './pages/NotFoundPage'
import NotificationsPage from './pages/NotificationsPage'
import ProfileEditPage from './pages/ProfileEditPage'
import RegisterPage from './pages/RegisterPage'
import ReportsPage from './pages/ReportsPage'
import RequestDetailPage from './pages/RequestDetailPage'
import RequestsPage from './pages/RequestsPage'
import SharedTripPage from './pages/SharedTripPage'
import TravelerProfilePage from './pages/TravelerProfilePage'
import VerifyPage from './pages/VerifyPage'
import PrivacyPage from './pages/PrivacyPage'
import DeleteAccountPage from './pages/DeleteAccountPage'
import NewWishPage from './pages/NewWishPage'
import WishDetailPage from './pages/WishDetailPage'
import WishesPage from './pages/WishesPage'

// Staff console: loaded only when a staff member opens it.
const StaffLayout = lazy(() => import('./pages/staff/StaffLayout'))
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'))
const StaffReports = lazy(() => import('./pages/staff/StaffReports'))
const StaffLocals = lazy(() => import('./pages/staff/StaffLocals'))
const StaffUsers = lazy(() => import('./pages/staff/StaffUsers'))
const StaffReviews = lazy(() => import('./pages/staff/StaffReviews'))
const StaffBookings = lazy(() => import('./pages/staff/StaffBookings'))
const StaffAudit = lazy(() => import('./pages/staff/StaffAudit'))

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (user) return <Navigate to="/explore" replace />
  return <>{children}</>
}

export default function App() {
  const auth = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>
  return (
    <Routes>
      <Route path="/share/:token" element={<SharedTripPage />} />
      <Route path="/staff" element={<Suspense fallback={<PageLoader />}><StaffLayout /></Suspense>}>
        <Route index element={<StaffDashboard />} />
        <Route path="reports" element={<StaffReports />} />
        <Route path="locals" element={<StaffLocals />} />
        <Route path="users" element={<StaffUsers />} />
        <Route path="reviews" element={<StaffReviews />} />
        <Route path="bookings" element={<StaffBookings />} />
        <Route path="audit" element={<StaffAudit />} />
      </Route>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/delete-account" element={<DeleteAccountPage />} />
        <Route path="/locals/:id" element={<LocalProfilePage />} />
        <Route path="/travelers/:id" element={auth(<TravelerProfilePage />)} />
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route path="/verify" element={auth(<VerifyPage />)} />
        <Route path="/profile" element={auth(<ProfileEditPage />)} />
        <Route path="/account" element={auth(<AccountPage />)} />
        <Route path="/locals/:id/request" element={auth(<NewRequestPage />)} />
        <Route path="/requests" element={auth(<RequestsPage />)} />
        <Route path="/requests/:id" element={auth(<RequestDetailPage />)} />
        <Route path="/bookings" element={auth(<BookingsPage />)} />
        <Route path="/bookings/:id" element={auth(<BookingDetailPage />)} />
        <Route path="/messages" element={auth(<MessagesPage />)} />
        <Route path="/notifications" element={auth(<NotificationsPage />)} />
        <Route path="/reports" element={auth(<ReportsPage />)} />
        <Route path="/wishes" element={auth(<WishesPage />)} />
        <Route path="/wishes/new" element={auth(<NewWishPage />)} />
        <Route path="/wishes/:id" element={auth(<WishDetailPage />)} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
