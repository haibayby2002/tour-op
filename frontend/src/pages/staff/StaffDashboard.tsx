import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { StatCard } from '../../components/staff'
import { ErrorText, PageHeader, PageLoader } from '../../components/ui'
import { api } from '../../lib/api'
import { relative } from '../../lib/format'
import { staffKeys, type AuditEntry, type StaffOverview } from '../../lib/staff'

const BOOKING_ORDER = ['DISCUSSING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED']
const BAR = { DISCUSSING: 'bg-sky-500', CONFIRMED: 'bg-teal-600', IN_PROGRESS: 'bg-amber-500', COMPLETED: 'bg-emerald-600', CANCELLED: 'bg-stone-400', DISPUTED: 'bg-red-500' } as Record<string, string>

export function ActivityRow({ entry }: { entry: AuditEntry }) {
  const { t } = useTranslation()
  const dot = /SUSPEND|REJECT|HIDDEN|DISMISS|BLOCK/.test(entry.action) ? 'bg-red-500' : /VERIFIED|CHECKED|RESOLVED|REACTIVATED/.test(entry.action) ? 'bg-emerald-500' : 'bg-sky-500'
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-stone-800">
          <span className="font-medium">{entry.actor ?? t('staff.system')}</span>{' '}
          <span className="font-mono text-xs text-stone-600">{entry.action}</span>{' '}
          <span className="text-stone-500">· {entry.entity_type.split('.').pop()} #{entry.entity_id}</span>
        </p>
        <p className="text-xs text-stone-500">{relative(entry.created_at)}</p>
      </div>
    </li>
  )
}

export default function StaffDashboard() {
  const { t } = useTranslation()
  const { data, isLoading, error } = useQuery({ queryKey: staffKeys.overview, queryFn: () => api<StaffOverview>('/staff/overview/') })
  if (isLoading) return <PageLoader />
  if (error || !data) return <ErrorText error={error} />

  const { users, queues, bookings } = data
  const totalBookings = Object.values(bookings).reduce((a, b) => a + b, 0)
  const nothingToDo = !queues.open_reports && !queues.pending_locals && !queues.unverified_external_reviews && !queues.disputed_bookings

  return (
    <div className="space-y-8">
      <PageHeader title={t('staff.dashboard.title')} subtitle={t('staff.dashboard.subtitle')} />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-stone-500">{t('staff.dashboard.needs_attention')}</h2>
        {nothingToDo ? (
          <div className="card flex items-center gap-3 p-5 text-sm text-stone-600">
            <span className="text-2xl" aria-hidden>✅</span> {t('staff.dashboard.all_clear')}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard tone="alert" label={t('staff.dashboard.open_reports')} value={queues.open_reports} to="/staff/reports"
              hint={queues.critical_reports ? t('staff.dashboard.critical', { count: queues.critical_reports }) : t('staff.dashboard.review_queue')} />
            <StatCard label={t('staff.dashboard.pending_locals')} value={queues.pending_locals} to="/staff/locals" hint={t('staff.dashboard.manual_check')} />
            <StatCard label={t('staff.dashboard.external_reviews')} value={queues.unverified_external_reviews} to="/staff/locals?tab=ALL" hint={t('staff.dashboard.external_hint')} />
            <StatCard tone="alert" label={t('staff.dashboard.disputes')} value={queues.disputed_bookings} to="/staff/bookings?status=DISPUTED" hint={t('staff.dashboard.disputes_hint')} />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-stone-500">{t('staff.dashboard.community')}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t('staff.dashboard.total_users')} value={users.total} to="/staff/users" hint={t('staff.dashboard.new_week', { count: users.new_this_week })} />
          <StatCard label={t('roles.TRAVELER')} value={users.travelers} to="/staff/users?role=TRAVELER" />
          <StatCard label={t('roles.LOCAL')} value={users.locals} to="/staff/users?role=LOCAL" />
          <StatCard tone="alert" label={t('staff.dashboard.suspended')} value={users.suspended} to="/staff/users?status=SUSPENDED" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="card p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold">{t('staff.dashboard.bookings')}</h2>
            <span className="text-sm text-stone-500">{totalBookings}</span>
          </div>
          <ul className="space-y-3">
            {BOOKING_ORDER.map((s) => {
              const n = bookings[s] ?? 0
              return (
                <li key={s}>
                  <Link to={`/staff/bookings?status=${s}`} className="block rounded-lg hover:bg-stone-50">
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-stone-700">{t(`booking_status.${s}`)}</span>
                      <span className="font-medium tabular-nums">{n}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                      <div className={`h-full rounded-full ${BAR[s]}`} style={{ width: `${totalBookings ? (n / totalBookings) * 100 : 0}%` }} />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="card p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-semibold">{t('staff.dashboard.recent')}</h2>
            <Link to="/staff/audit" className="link text-sm">{t('staff.dashboard.view_all')} →</Link>
          </div>
          {data.recent_activity.length ? (
            <ul className="divide-y divide-stone-100">
              {data.recent_activity.map((e) => <ActivityRow key={e.id} entry={e} />)}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-stone-500">{t('staff.empty')}</p>
          )}
        </section>
      </div>
    </div>
  )
}
