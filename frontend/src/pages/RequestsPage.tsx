import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { RequestStatusBadge } from '../components/status'
import { Avatar, EmptyState, ErrorText, PageHeader, PageLoader, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { dateTime, relative } from '../lib/format'
import { keys } from '../lib/queries'
import type { Paginated, TourRequest } from '../lib/types'

type Box = 'received' | 'sent'

export default function RequestsPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [box, setBox] = useState<Box>(hasRole('LOCAL') ? 'received' : 'sent')
  const { data, isLoading, error } = useQuery({
    queryKey: keys.requests(box),
    queryFn: () => api<Paginated<TourRequest>>('/tour-requests/', { query: { box, page_size: 50 } }),
  })
  const pending = (data?.results ?? []).filter((r) => r.status === 'PENDING').length

  const tabs: { value: Box; label: string; count?: number }[] = []
  if (hasRole('LOCAL')) tabs.push({ value: 'received', label: t('requests.received'), count: box === 'received' ? pending : undefined })
  if (hasRole('TRAVELER')) tabs.push({ value: 'sent', label: t('requests.sent') })

  return (
    <div>
      <PageHeader title={t('requests.title')} subtitle={t('requests.subtitle')} />
      {tabs.length > 1 && <Tabs value={box} onChange={setBox} tabs={tabs} />}
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data?.results.length ? (
        <EmptyState
          title={t(box === 'sent' ? 'requests.empty_sent' : 'requests.empty_received')}
          action={box === 'sent' ? <Link to="/explore" className="btn-primary">{t('requests.find_local')}</Link> : <Link to="/profile?tab=local" className="btn-secondary">{t('requests.improve_profile')}</Link>}
        />
      ) : (
        <ul className="space-y-3">
          {data.results.map((r) => {
            const other = box === 'sent' ? r.local : r.traveler
            return (
              <li key={r.id}>
                <Link to={`/requests/${r.id}`} className="card flex flex-wrap items-center gap-4 p-4 hover:border-brand-200">
                  <Avatar src={other.avatar} name={other.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{other.name}</p>
                    <p className="truncate text-sm text-stone-500">
                      {r.service?.title ?? t('request.custom_experience')} · {r.city_name} · {dateTime(r.start_at)} · {t('requests.people', { count: r.group_size })}
                    </p>
                  </div>
                  <div className="text-right">
                    <RequestStatusBadge status={r.status} />
                    <p className="mt-1 text-xs text-stone-400">{relative(r.created_at)}</p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
