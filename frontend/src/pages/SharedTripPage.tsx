import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { StopKindBadge } from '../components/AgreementView'
import { LanguageSwitcher, ThemeToggle } from '../components/Layout'
import { BookingStatusBadge } from '../components/status'
import { Alert, Avatar, ErrorText, PageLoader } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { dateTime } from '../lib/format'
import type { SharedTrip } from '../lib/types'

/** Public page for a traveler's family/friends. No login, no contact details, no prices. */
export default function SharedTripPage() {
  const { t } = useTranslation()
  const { token } = useParams()
  const { data, isLoading, error } = useQuery({
    queryKey: ['share', token],
    queryFn: () => api<SharedTrip>(`/share/${token}/`, { auth: false }),
    retry: false,
  })

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-bold text-brand-800">
            <img src="/favicon.svg" alt="" className="h-7 w-7" /> Tour-op
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
        {isLoading ? (
          <PageLoader />
        ) : error ? (
          error instanceof ApiError && (error.status === 410 || error.status === 404) ? (
            <Alert tone="neutral" title={t('shared.expired_title')}>{t('shared.expired_body')}</Alert>
          ) : (
            <ErrorText error={error} />
          )
        ) : data ? (
          <div className="card space-y-5 p-6">
            <div>
              <p className="text-sm text-stone-500">{t('shared.intro', { name: data.traveler_name })}</p>
              <div className="mt-1 flex items-center gap-2">
                <h1 className="text-2xl font-bold">{data.city}</h1>
                <BookingStatusBadge status={data.status} />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
              <Avatar src={data.local.avatar} name={data.local.name} />
              <div>
                <p className="text-xs text-stone-500">{t('shared.local')}</p>
                <p className="font-semibold">{data.local.name}</p>
              </div>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-stone-500">{t('agreement.when')}</dt><dd>{dateTime(data.start_at)} → {dateTime(data.end_at)}</dd></div>
              <div><dt className="text-xs text-stone-500">{t('agreement.meeting_point')}</dt><dd>{data.meeting_point ?? '—'}</dd></div>
              <div><dt className="text-xs text-stone-500">{t('request.group_size')}</dt><dd>{t('requests.people', { count: data.group_size })}</dd></div>
            </dl>
            {data.itinerary && (
              <div>
                <p className="mb-2 text-sm font-semibold">{t('agreement.itinerary')}</p>
                <ol className="space-y-2">
                  {data.itinerary.map((s, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-stone-500">{s.time}</span>
                      <span className="font-medium">{s.place_name}</span>
                      <StopKindBadge kind={s.kind} />
                      {s.activity && <span className="w-full text-xs text-stone-500">{s.activity}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <p className="text-xs text-stone-400">{t('shared.footer', { date: dateTime(data.expires_at) })}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
