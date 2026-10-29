import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { keys } from '../lib/queries'
import { useSocket } from '../lib/useSocket'
import { Avatar, cx } from './ui'

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation()
  const current = i18n.language?.startsWith('vi') ? 'vi' : 'en'
  return (
    <div className={cx('inline-flex rounded-lg border border-stone-200 bg-surface p-0.5 text-xs font-semibold', className)}>
      {(['vi', 'en'] as const).map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          className={cx('rounded-md px-2 py-1', current === lng ? 'bg-brand-700 text-white' : 'text-stone-600 hover:bg-stone-100')}
          aria-pressed={current === lng}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

/** Light/dark switch. Until the visitor clicks it, the site follows the system setting (see index.html). */
export function ThemeToggle() {
  const { t } = useTranslation()
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    // Follow system changes only while the visitor hasn't picked a theme.
    const media = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      let saved: string | null = null
      try { saved = localStorage.getItem('theme') } catch { /* storage blocked */ }
      if (!saved) apply(media.matches)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  function apply(next: boolean) {
    document.documentElement.classList.toggle('dark', next)
    setDark(next)
  }

  function toggle() {
    apply(!dark)
    try { localStorage.setItem('theme', !dark ? 'dark' : 'light') } catch { /* storage blocked */ }
  }

  const label = dark ? t('nav.theme_light') : t('nav.theme_dark')
  return (
    <button onClick={toggle} className="rounded-lg p-2 text-stone-600 hover:bg-stone-100" aria-label={label} title={label}>
      {dark ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}

function NotificationBell() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: keys.unread,
    queryFn: () => api<{ count: number }>('/notifications/unread-count/'),
    refetchInterval: 60_000,
  })
  const onEvent = useCallback(
    (event: Record<string, unknown>) => {
      if (event.type !== 'notification') return
      queryClient.invalidateQueries({ queryKey: keys.unread })
      queryClient.invalidateQueries({ queryKey: keys.notifications })
      // refresh lists that a notification may affect
      queryClient.invalidateQueries({ queryKey: ['tour-requests'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: keys.conversations })
      queryClient.invalidateQueries({ queryKey: ['trip-wishes'] })
    },
    [queryClient],
  )
  useSocket('/ws/notifications/', onEvent)
  const count = data?.count ?? 0
  return (
    <Link to="/notifications" className="relative rounded-lg p-2 text-stone-600 hover:bg-stone-100" aria-label="Notifications">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[10px] leading-[18px] font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

function UserMenu() {
  const { t } = useTranslation()
  const { user, logout, hasRole } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  if (!user) return null
  const item = 'block rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100'
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-brand-100">
        <Avatar name={user.full_name} size="sm" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-stone-200 bg-surface p-1.5 shadow-lg" onClick={() => setOpen(false)}>
          <p className="truncate px-3 pt-1.5 pb-2 text-xs text-stone-500">{user.email}</p>
          <Link to="/profile" className={item}>{t('nav.profile')}</Link>
          {hasRole('LOCAL') && <Link to="/profile?tab=services" className={item}>{t('nav.my_services')}</Link>}
          <Link to="/account" className={item}>{t('nav.account')}</Link>
          <Link to="/reports" className={item}>{t('nav.reports')}</Link>
          {user.is_staff && <Link to="/staff" className={cx(item, 'font-semibold text-brand-800')}>{t('nav.staff')}</Link>}
          <button
            className={cx(item, 'w-full text-left text-red-600')}
            onClick={async () => {
              await logout()
              navigate('/')
            }}
          >
            {t('nav.logout')}
          </button>
        </div>
      )}
    </div>
  )
}

const TAB_ICONS: Record<string, string> = {
  explore: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-3.5-3.5',
  wishes: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  requests: 'M9 4h6l1 2h3v14H5V6h3zm0 8h6m-6 4h4',
  bookings: 'M4 6h16v14H4zM4 10h16M8 3v4m8-4v4',
  messages: 'M4 5h16v11H8l-4 4z',
}

/** Mobile tab bar, as in the Android app: the main destinations always one tap away. */
function BottomNav() {
  const { t } = useTranslation()
  const tabs = ['explore', 'wishes', 'requests', 'bookings', 'messages'] as const
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-stone-200 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label={t('nav.main')}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab}
          to={`/${tab}`}
          className={({ isActive }) =>
            cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-700 dark:text-teal-400' : 'text-stone-500')
          }
        >
          {({ isActive }) => (
            <>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill={isActive && tab !== 'explore' ? 'currentColor' : 'none'} fillOpacity={0.15} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={TAB_ICONS[tab]} />
              </svg>
              <span className="max-w-full truncate px-1">{t(`nav.tab_${tab}`)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navClass = ({ isActive }: { isActive: boolean }) =>
    cx('rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-brand-50 text-brand-800' : 'text-stone-600 hover:bg-stone-100')

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-brand-800">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="text-lg tracking-tight">Tour-op</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            <NavLink to="/explore" className={navClass}>{t('nav.explore')}</NavLink>
            {user && <NavLink to="/wishes" className={navClass}>{t('nav.wishes')}</NavLink>}
            {user && <NavLink to="/requests" className={navClass}>{t('nav.requests')}</NavLink>}
            {user && <NavLink to="/bookings" className={navClass}>{t('nav.bookings')}</NavLink>}
            {user && <NavLink to="/messages" className={navClass}>{t('nav.messages')}</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            {user ? (
              <>
                <NotificationBell />
                <UserMenu />
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost btn-sm">{t('nav.login')}</Link>
                <Link to="/register" className="btn-primary btn-sm">{t('nav.register')}</Link>
              </>
            )}
          </div>
        </div>
      </header>
      {user && <BottomNav />}
      <main className={cx('mx-auto w-full max-w-6xl flex-1 px-4 py-8', user && 'pb-24 md:pb-8')}>
        <Outlet />
      </main>
      <footer className={cx('border-t border-stone-200 bg-surface', user && 'mb-16 md:mb-0')}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-stone-500">
          <span>© {new Date().getFullYear()} Tour-op</span>
          <span>{t('footer.safety_note')}</span>
          <span className="flex gap-3">
            <Link to="/privacy" className="hover:text-stone-700">{t('footer.privacy')}</Link>
            <Link to="/delete-account" className="hover:text-stone-700">{t('footer.delete_account')}</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
