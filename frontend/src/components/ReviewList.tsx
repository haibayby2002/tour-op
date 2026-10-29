import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../auth/AuthContext'
import { date } from '../lib/format'
import type { Review } from '../lib/types'
import { ReportDialog } from './safety'
import { Avatar, Badge, EmptyState, Stars } from './ui'

export default function ReviewList({ reviews }: { reviews: Review[] }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [reporting, setReporting] = useState<number | null>(null)
  if (!reviews.length) return <EmptyState title={t('reviews.none_title')}>{t('reviews.none_body')}</EmptyState>
  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li key={r.id} className="card p-4">
          <div className="flex items-center gap-3">
            <Avatar src={r.reviewer.avatar} name={r.reviewer.name} size="sm" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{r.reviewer.name}</p>
              <p className="text-xs text-stone-500">{date(r.created_at)} · {t('reviews.verified_booking')}</p>
            </div>
            <Stars value={r.rating} />
          </div>
          {r.comment && <p className="mt-3 text-sm whitespace-pre-line text-stone-700">{r.comment}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.felt_safe && <Badge tone="green">{t('reviews.felt_safe')}</Badge>}
            {r.price_as_agreed && <Badge tone="green">{t('reviews.price_as_agreed')}</Badge>}
            {r.itinerary_respected && <Badge tone="green">{t('reviews.itinerary_respected')}</Badge>}
            {r.price_as_agreed === false && <Badge tone="red">{t('reviews.price_not_as_agreed')}</Badge>}
            {r.itinerary_respected === false && <Badge tone="red">{t('reviews.itinerary_not_respected')}</Badge>}
          </div>
          {user && user.id !== r.reviewer.id && (
            <button className="mt-2 text-xs text-stone-400 hover:text-red-600" onClick={() => setReporting(r.id)}>
              {t('reviews.report')}
            </button>
          )}
        </li>
      ))}
      <ReportDialog
        open={reporting !== null}
        onClose={() => setReporting(null)}
        target={{ review: reporting ?? undefined }}
        defaultCategory="FAKE_REVIEW"
      />
    </ul>
  )
}
