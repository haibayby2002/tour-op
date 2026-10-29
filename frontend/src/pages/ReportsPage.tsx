import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge, EmptyState, ErrorText, PageHeader, PageLoader } from '../components/ui'
import { api } from '../lib/api'
import { dateTime } from '../lib/format'
import { keys } from '../lib/queries'
import type { Report } from '../lib/types'

const tone = { OPEN: 'amber', IN_REVIEW: 'blue', RESOLVED: 'green', DISMISSED: 'neutral' } as const

export default function ReportsPage() {
  const { t } = useTranslation()
  const { data, isLoading, error } = useQuery({ queryKey: keys.reports, queryFn: () => api<Report[]>('/reports/') })
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data?.length ? (
        <EmptyState title={t('reports.empty')} />
      ) : (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className="card space-y-2 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{t(`report.categories.${r.category}`)}</p>
                <Badge tone={tone[r.status]}>{t(`reports.status.${r.status}`)}</Badge>
              </div>
              <p className="text-xs text-stone-500">
                #{r.id} · {dateTime(r.created_at)}
                {r.reported_user && <> · {r.reported_user.name}</>}
                {r.booking_id && <> · <Link to={`/bookings/${r.booking_id}`} className="link">{t('reports.booking', { id: r.booking_id })}</Link></>}
              </p>
              <p className="text-sm whitespace-pre-line text-stone-700">{r.description}</p>
              {r.evidence.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {r.evidence.map((e) => (
                    <a key={e.id} href={e.file} target="_blank" rel="noopener noreferrer" className="link text-xs">📎 {t('reports.evidence')} {e.id}</a>
                  ))}
                </div>
              )}
              {r.resolution_note && <p className="rounded-lg bg-stone-50 p-3 text-sm"><span className="font-medium">{t('reports.resolution')}:</span> {r.resolution_note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
