import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { MatchReasons } from '../components/trust'
import { EmptyState, ErrorText, PageHeader, PageLoader, Tabs, Badge } from '../components/ui'
import { WishFacts, WishStatusBadge } from '../components/WishSummary'
import { api } from '../lib/api'
import { relative } from '../lib/format'
import { keys } from '../lib/queries'
import type { TripWish } from '../lib/types'

type Box = 'mine' | 'for_me'

export default function WishesPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [box, setBox] = useState<Box>(hasRole('TRAVELER') ? 'mine' : 'for_me')
  const { data, isLoading, error } = useQuery({
    queryKey: keys.wishes(box),
    queryFn: () => api<TripWish[]>('/trip-wishes/', { query: { box } }),
  })

  const tabs: { value: Box; label: string }[] = []
  if (hasRole('TRAVELER')) tabs.push({ value: 'mine', label: t('wishes.mine') })
  if (hasRole('LOCAL')) tabs.push({ value: 'for_me', label: t('wishes.for_me') })

  return (
    <div>
      <PageHeader
        title={t('wishes.title')}
        subtitle={t(box === 'mine' ? 'wishes.subtitle_mine' : 'wishes.subtitle_for_me')}
        actions={hasRole('TRAVELER') ? <Link to="/wishes/new" className="btn-primary">+ {t('wishes.post')}</Link> : undefined}
      />
      {tabs.length > 1 && <Tabs value={box} onChange={setBox} tabs={tabs} />}
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data?.length ? (
        <EmptyState
          title={t(box === 'mine' ? 'wishes.empty_mine' : 'wishes.empty_for_me')}
          action={box === 'mine' ? <Link to="/wishes/new" className="btn-primary">{t('wishes.post')}</Link> : <Link to="/profile?tab=local" className="btn-secondary">{t('requests.improve_profile')}</Link>}
        >
          {t(box === 'mine' ? 'wishes.empty_mine_body' : 'wishes.empty_for_me_body')}
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((w) => (
            <Link key={w.id} to={`/wishes/${w.id}`} className="card space-y-3 p-5 hover:border-brand-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{w.title}</p>
                  <p className="text-xs text-stone-500">
                    {box === 'for_me' ? `${w.traveler.name} · ` : ''}{relative(w.created_at)}
                  </p>
                </div>
                <WishStatusBadge status={w.status} />
              </div>
              <WishFacts wish={w} />
              {box === 'mine' ? (
                <p className="text-sm font-medium text-brand-800">
                  {t('wishes.matched_count', { count: w.candidate_count ?? 0 })} · {t('wishes.offer_count', { count: w.offer_count ?? 0 })}
                </p>
              ) : (
                <>
                  <MatchReasons reasons={w.match_reasons ?? []} />
                  {w.my_offer && <Badge tone="green">{t(`wishes.offer_status.${w.my_offer.status}`)}</Badge>}
                </>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
