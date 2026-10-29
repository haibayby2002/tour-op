import { Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../../auth/AuthContext'
import { LanguageSwitcher, ThemeToggle } from '../../components/Layout'
import { Avatar, cx, PageLoader } from '../../components/ui'
import { api } from '../../lib/api'
import { DJANGO_ADMIN_URL, staffKeys, type StaffOverview } from '../../lib/staff'

const ICONS: Record<string, string> = {
  dashboard: 'M4 13h6V4H4zm10 7h6v-9h-6zM4 20h6v-4H4zm10-11h6V4h-6z',
  reports: 'M5 21V4h11l-1 4 4 1v8H9l-1-2H5',
  locals: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zm-3 9 2 2 4-4',
  users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8',
  reviews: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  bookings: 'M4 6h16v14H4zM4 10h16M8 3v4m8-4v4',
  audit: 'M8 4h11v16H5V7zm0 0v3H5m4 5h7m-7 4h5',
}

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  )
}

export default function StaffLayout() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const location = useLocation()
  const { data: overview } = useQuery({
    queryKey: staffKeys.overview,
    queryFn: () => api<StaffOverview>('/staff/overview/'),
    enabled: !!user?.is_staff,
    refetchInterval: 60_000,
  })

  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!user.is_staff) return <Navigate to="/" replace />

  const q = overview?.queues
  const items = [
    { to: '/staff', name: 'dashboard', end: true },
    { to: '/staff/reports', name: 'reports', badge: q?.open_reports, alert: !!q?.critical_reports },
    { to: '/staff/locals', name: 'locals', badge: (q?.pending_locals ?? 0) + (q?.unverified_external_reviews ?? 0) },
    { to: '/staff/users', name: 'users' },
    { to: '/staff/reviews', name: 'reviews' },
    { to: '/staff/bookings', name: 'bookings', badge: q?.disputed_bookings, alert: !!q?.disputed_bookings },
    { to: '/staff/audit', name: 'audit' },
  ]

  const link = ({ isActive }: { isActive: boolean }) =>
    cx(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition',
      isActive ? 'bg-white/15 text-white' : 'text-teal-100 hover:bg-white/10 hover:text-white',
    )

  return (
    <div className="min-h-screen bg-stone-50 md:flex">
      <aside className="bg-teal-900 text-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col">
        <div className="flex items-center justify-between gap-2 px-4 py-4 md:px-5 md:py-6">
          <Link to="/staff" className="flex items-center gap-2 font-bold">
            <img src="/favicon.svg" alt="" className="h-7 w-7 rounded-md bg-white p-0.5" />
            <span className="text-lg">Tour-op</span>
            <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">{t('staff.badge')}</span>
          </Link>
          <Link to="/" className="text-xs text-teal-100 hover:text-white md:hidden">{t('staff.back_to_site')}</Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0" aria-label={t('staff.title')}>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={link}>
              <Icon name={item.name} />
              <span className="flex-1">{t(`staff.nav.${item.name}`)}</span>
              {!!item.badge && (
                <span className={cx('min-w-[22px] rounded-full px-1.5 text-center text-xs leading-[22px] font-bold', item.alert ? 'bg-red-500 text-white' : 'bg-white/20 text-white')}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="hidden space-y-1 border-t border-white/10 p-3 md:block">
          <a href={DJANGO_ADMIN_URL} className={link({ isActive: false })} target="_blank" rel="noreferrer">
            <span className="w-5 text-center" aria-hidden>⚙</span>
            <span className="flex-1">{t('staff.django_admin')}</span>
            <span aria-hidden>↗</span>
          </a>
          <Link to="/" className={link({ isActive: false })}>
            <span className="w-5 text-center" aria-hidden>←</span>
            {t('staff.back_to_site')}
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-end gap-2 border-b border-stone-200 bg-surface/90 px-4 py-2.5 backdrop-blur md:px-8">
          <ThemeToggle />
          <LanguageSwitcher />
          <div className="ml-2 flex items-center gap-2">
            <Avatar name={user.full_name} size="sm" />
            <span className="hidden text-sm font-medium text-stone-700 sm:inline">{user.full_name}</span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
