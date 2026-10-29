import { useTranslation } from 'react-i18next'

import { dateTime, localName, money } from '../lib/format'
import { useMeta } from '../lib/queries'
import type { TripWish, WishStatus } from '../lib/types'
import { Badge } from './ui'

const tone = { OPEN: 'green', MATCHED: 'brand', CLOSED: 'neutral', EXPIRED: 'neutral' } as const

export function WishStatusBadge({ status }: { status: WishStatus }) {
  const { t } = useTranslation()
  return <Badge tone={tone[status]}>{t(`wishes.status.${status}`)}</Badge>
}

export function WishFacts({ wish }: { wish: TripWish }) {
  const { t, i18n } = useTranslation()
  const { data: meta } = useMeta()
  const city = i18n.language.startsWith('vi') && wish.city_name_vi ? wish.city_name_vi : wish.city_name
  const requirements = [
    wish.language && t('wishes.req_language', { language: localName(meta?.languages.find((l) => l.code === wish.language)) || wish.language }),
    wish.category && t('wishes.req_category', { category: localName(meta?.service_categories.find((c) => c.slug === wish.category)) || wish.category }),
    wish.min_rating && t('wishes.req_rating', { rating: wish.min_rating }),
    wish.require_manually_checked && t('wishes.only_checked'),
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-2 text-sm text-stone-600">
      <p>📍 {city}{wish.area && ` · ${wish.area}`}</p>
      <p>🗓 {dateTime(wish.start_at)} → {dateTime(wish.end_at)}</p>
      <p>👥 {t('requests.people', { count: wish.group_size })}{wish.budget_max ? ` · ${t('wishes.budget_up_to', { amount: money(wish.budget_max, wish.currency) })}` : ''}</p>
      {wish.interests.length > 0 && (
        <div className="flex flex-wrap gap-1">{wish.interests.map((i) => <Badge key={i.slug} tone="brand">{localName(i)}</Badge>)}</div>
      )}
      {wish.avoid_notes && <p className="font-medium text-amber-800">✗ {wish.avoid_notes}</p>}
      {requirements.length > 0 && (
        <div className="flex flex-wrap gap-1">{requirements.map((r) => <Badge key={r} tone="blue">{r}</Badge>)}</div>
      )}
    </div>
  )
}
