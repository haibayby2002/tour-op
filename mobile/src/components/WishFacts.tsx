import { View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { dateTime, localName, money } from '../lib/format'
import { useMeta } from '../lib/queries'
import type { TripWish, WishStatus } from '../lib/types'
import { Badge, colors, styles, Text } from './ui'

const tone = { OPEN: 'green', MATCHED: 'brand', CLOSED: 'neutral', EXPIRED: 'neutral' } as const

export function WishStatusBadge({ status }: { status: WishStatus }) {
  const { t } = useTranslation()
  return <Badge tone={tone[status]} label={t(`wishes.status.${status}`)} />
}

export default function WishFacts({ wish }: { wish: TripWish }) {
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
    <View style={{ gap: 4 }}>
      <Text style={styles.body}>📍 {city}{wish.area ? ` · ${wish.area}` : ''}</Text>
      <Text style={styles.body}>🗓 {dateTime(wish.start_at)} → {dateTime(wish.end_at)}</Text>
      <Text style={styles.body}>
        👥 {t('requests.people', { count: wish.group_size })}
        {wish.budget_max ? ` · ${t('wishes.budget_up_to', { amount: money(wish.budget_max, wish.currency) })}` : ''}
      </Text>
      {wish.interests.length > 0 && (
        <View style={styles.wrap}>{wish.interests.map((i) => <Badge key={i.slug} tone="brand" label={localName(i)} />)}</View>
      )}
      {wish.avoid_notes ? <Text style={{ color: colors.amber, fontWeight: '600' }}>✗ {wish.avoid_notes}</Text> : null}
      {requirements.length > 0 && <View style={styles.wrap}>{requirements.map((r) => <Badge key={r} tone="blue" label={r} />)}</View>}
    </View>
  )
}
