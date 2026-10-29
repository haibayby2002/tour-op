import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { cx, EmptyState, ErrorText, PageHeader, PageLoader } from '../components/ui'
import { api } from '../lib/api'
import { relative } from '../lib/format'
import { keys } from '../lib/queries'
import type { AppNotification, Paginated } from '../lib/types'

export function notificationLink(n: AppNotification) {
  const d = n.data
  if (d.booking_id) return `/bookings/${d.booking_id}`
  if (d.wish_id) return `/wishes/${d.wish_id}`
  if (d.request_id) return `/requests/${d.request_id}`
  if (d.report_id) return '/reports'
  return null
}

export default function NotificationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: keys.notifications,
    queryFn: () => api<Paginated<AppNotification>>('/notifications/', { query: { page_size: 50 } }),
  })
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: keys.notifications })
    queryClient.invalidateQueries({ queryKey: keys.unread })
  }
  const readAll = useMutation({ mutationFn: () => api('/notifications/read-all/', { method: 'POST' }), onSuccess: invalidate })
  const open = async (n: AppNotification) => {
    if (!n.read) await api(`/notifications/${n.id}/read/`, { method: 'POST' }).then(invalidate)
    const link = notificationLink(n)
    if (link) navigate(link)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t('notifications.title')}
        actions={<button className="btn-secondary btn-sm" onClick={() => readAll.mutate()}>{t('notifications.read_all')}</button>}
      />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data?.results.length ? (
        <EmptyState title={t('notifications.empty')} />
      ) : (
        <ul className="card divide-y divide-stone-100">
          {data.results.map((n) => (
            <li key={n.id}>
              <button onClick={() => open(n)} className={cx('flex w-full items-start gap-3 p-4 text-left hover:bg-stone-50', !n.read && 'bg-brand-50/50')}>
                <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand-600')} />
                <span className="flex-1">
                  <span className={cx('block text-sm', !n.read && 'font-semibold')}>{t(`notification.${n.kind}`, { defaultValue: n.kind, ...n.data })}</span>
                  <span className="text-xs text-stone-400">{relative(n.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
