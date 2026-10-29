import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { BookingStatusBadge } from '../components/status'
import { Avatar, EmptyState, ErrorText, PageHeader, PageLoader, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { dateTime, money } from '../lib/format'
import { keys } from '../lib/queries'
import type { BookingListItem, Paginated } from '../lib/types'

type Filter = 'upcoming' | 'past'
const UPCOMING = 'DISCUSSING,CONFIRMED,IN_PROGRESS'
const PAST = 'COMPLETED,CANCELLED,DISPUTED'

export default function BookingsPage() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>('upcoming')
  const { data, isLoading, error } = useQuery({
    queryKey: keys.bookings(filter),
    queryFn: () => api<Paginated<BookingListItem>>('/bookings/', { query: { status: filter === 'upcoming' ? UPCOMING : PAST, page_size: 50 } }),
  })

  return (
    <div>
      <PageHeader title={t('bookings.title')} subtitle={t('bookings.subtitle')} />
      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'upcoming', label: t('bookings.upcoming') },
          { value: 'past', label: t('bookings.past') },
        ]}
      />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data?.results.length ? (
        <EmptyState title={t('bookings.empty')} action={<Link to="/explore" className="btn-primary">{t('requests.find_local')}</Link>} />
      ) : (
        <ul className="space-y-3">
          {data.results.map((b) => {
            const other = b.my_role === 'LOCAL' ? b.traveler : b.local
            return (
              <li key={b.id}>
                <Link to={`/bookings/${b.id}`} className="card flex flex-wrap items-center gap-4 p-4 hover:border-brand-200">
                  <Avatar src={other.avatar} name={other.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {b.service_title ?? t('request.custom_experience')} <span className="font-normal text-stone-500">· {other.name}</span>
                    </p>
                    <p className="text-sm text-stone-500">
                      {b.city_name} · {dateTime(b.start_at)} · {t(`roles.${b.my_role}`)}
                    </p>
                  </div>
                  <div className="text-right">
                    <BookingStatusBadge status={b.status} />
                    {b.agreed_price !== null && <p className="mt-1 text-sm font-semibold">{money(b.agreed_price, b.currency)}</p>}
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
