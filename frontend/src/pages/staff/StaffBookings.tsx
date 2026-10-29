import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { Pager, PersonCell, TableWrap, td, th } from '../../components/staff'
import { BookingStatusBadge } from '../../components/status'
import { EmptyState, ErrorText, PageHeader, PageLoader } from '../../components/ui'
import { api } from '../../lib/api'
import { dateTime, money } from '../../lib/format'
import { staffKeys, type Paged, type StaffBooking } from '../../lib/staff'
import type { BookingStatus } from '../../lib/types'

const STATUSES = ['DISCUSSING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED'] as const

export default function StaffBookings() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? 1)

  const query = { status, page: String(page) }
  const { data, isLoading, error } = useQuery({
    queryKey: staffKeys.list('bookings', query),
    queryFn: () => api<Paged<StaffBooking>>('/staff/bookings/', { query }),
  })

  return (
    <div>
      <PageHeader
        title={t('staff.bookings.title')}
        subtitle={t('staff.bookings.subtitle')}
        actions={
          <select className="input w-auto" value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {}, { replace: true })} aria-label={t('staff.users.status')}>
            <option value="">{t('staff.users.any_status')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`booking_status.${s}`)}</option>)}
          </select>
        }
      />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data?.results.length ? (
        <EmptyState title={t('staff.empty')} />
      ) : (
        <>
          <TableWrap>
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>{t('roles.TRAVELER')}</th>
                  <th className={th}>{t('roles.LOCAL')}</th>
                  <th className={th}>{t('staff.bookings.experience')}</th>
                  <th className={th}>{t('staff.bookings.when')}</th>
                  <th className={th}>{t('staff.bookings.price')}</th>
                  <th className={th}>{t('staff.users.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.results.map((b) => (
                  <tr key={b.id} className="hover:bg-stone-50">
                    <td className={`${td} text-stone-400`}>{b.id}</td>
                    <td className={td}><PersonCell person={b.traveler} /></td>
                    <td className={td}><PersonCell person={b.local} /></td>
                    <td className={`${td} max-w-[220px] truncate`}>{b.service ?? '—'}</td>
                    <td className={`${td} whitespace-nowrap text-stone-600`}>{dateTime(b.start_at)} · 👥 {b.group_size}</td>
                    <td className={`${td} whitespace-nowrap`}>{b.agreed_price ? money(b.agreed_price, b.currency) : '—'}</td>
                    <td className={td}><BookingStatusBadge status={b.status as BookingStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pager page={page} count={data.count} pageSize={data.page_size} onPage={(p) => setParams({ ...(status && { status }), page: String(p) }, { replace: true })} />
        </>
      )}
    </div>
  )
}
