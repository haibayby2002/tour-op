import { View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { localName } from '../lib/format'
import { useMeta } from '../lib/queries'
import type { MatchReason, Trust } from '../lib/types'
import { Badge, colors, Stars, styles, Text } from './ui'

/** Separate trust signals; email/phone verification is never shown as identity verification. */
/** `showMissing` adds amber badges for unverified email/phone (what a local sees about a traveler). */
export function TrustBadges({ trust, showMissing = false }: { trust: Trust; showMissing?: boolean }) {
  const { t } = useTranslation()
  return (
    <View style={styles.wrap}>
      {trust.identity_verified && <Badge tone="green" label={`🪪 ${t('trust.identity_verified')}`} />}
      {trust.manually_checked && <Badge tone="brand" label={`✔ ${t('trust.manually_checked')}`} />}
      {trust.email_verified && <Badge tone="blue" label={`✉ ${t('trust.email_verified')}`} />}
      {trust.phone_verified && <Badge tone="blue" label={`☎ ${t('trust.phone_verified')}`} />}
      {showMissing && !trust.email_verified && <Badge tone="amber" label={`✉ ${t('trust.email_unverified')}`} />}
      {showMissing && !trust.phone_verified && <Badge tone="amber" label={`☎ ${t('trust.phone_unverified')}`} />}
      {trust.is_new_member && <Badge tone="amber" label={t('trust.new_member')} />}
    </View>
  )
}

export function RatingSummary({ trust }: { trust: Trust }) {
  const { t } = useTranslation()
  if (!trust.review_count || trust.rating_avg === null) return <Text style={styles.hint}>{t('trust.no_reviews')}</Text>
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Stars value={trust.rating_avg} />
      <Text style={{ fontWeight: '600' }}>{trust.rating_avg.toFixed(1)}</Text>
      <Text style={styles.hint}>({t('trust.review_count', { count: trust.review_count })})</Text>
    </View>
  )
}

export function MatchReasons({ reasons }: { reasons: MatchReason[] }) {
  const { t } = useTranslation()
  const { data: meta } = useMeta()
  const lang = (c: string) => localName(meta?.languages.find((l) => l.code === c)) || c
  const interest = (s: string) => localName(meta?.interests.find((i) => i.slug === s)) || s
  const category = (s: string) => localName(meta?.service_categories.find((c) => c.slug === s)) || s
  const text = (r: MatchReason) => {
    const p = r.params
    if (r.code === 'common_language') return t('match.common_language', { languages: (p.languages as string[]).map(lang).join(', ') })
    if (r.code === 'shared_interests') return t('match.shared_interests', { interests: (p.interests as string[]).map(interest).join(', ') })
    if (r.code === 'offers_category') return t('match.offers_category', { category: category(p.category as string) })
    if (r.code === 'highly_rated') return t('match.highly_rated', { rating: p.rating })
    return t(`match.${r.code}`)
  }
  const visible = reasons.filter((r) => !['verified_contacts', 'manually_checked', 'new_member'].includes(r.code)).slice(0, 3)
  return (
    <View style={{ gap: 2 }}>
      {visible.map((r) => (
        <Text key={r.code} style={{ fontSize: 12, color: colors.brandDark }}>✓ {text(r)}</Text>
      ))}
    </View>
  )
}
