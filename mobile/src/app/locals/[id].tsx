import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../auth/AuthContext'
import { PhotoStrip } from '../../components/photos'
import { RatingSummary, TrustBadges } from '../../components/trust'
import { Avatar, Badge, Button, Card, colors, Empty, ErrorText, H1, H2, Loading, Row, Screen, Stars, styles, Text } from '../../components/ui'
import { api } from '../../lib/api'
import { localName, money, priceRange } from '../../lib/format'
import type { PublicProfile } from '../../lib/types'

export default function LocalProfileScreen() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const { data: p, isLoading, error } = useQuery({
    queryKey: ['users', Number(id), 'LOCAL'],
    queryFn: () => api<PublicProfile>(`/users/${id}/`, { query: { role: 'LOCAL' } }),
  })
  if (isLoading) return <Loading />
  if (error || !p) return <Screen><ErrorText error={error} /></Screen>
  const local = p.local!
  const isMe = user?.id === p.id

  return (
    <Screen>
      <Stack.Screen options={{ title: p.name }} />
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <Avatar src={p.avatar} name={p.name} size={80} />
        <View style={{ flex: 1, gap: 4 }}>
          <H1>{p.name}</H1>
          <Text style={styles.hint}>
            {t('profile.age_by_year', { age: p.age_by_birth_year })} · {p.city ? localName(p.city) : ''}
          </Text>
          <RatingSummary trust={p.trust} />
        </View>
      </View>
      <TrustBadges trust={p.trust} />

      <Card>
        <Text style={styles.hint}>{t('local.price_range')}</Text>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>{priceRange(local.price_min, local.price_max, local.currency)}</Text>
        <Text style={styles.hint}>{t('local.price_scope')}</Text>
        {local.pricing_note ? <Text style={styles.hint}>{local.pricing_note}</Text> : null}
        {!isMe &&
          (local.is_accepting_requests ? (
            <Button title={t('local.send_request')} onPress={() => router.push(`/request/${p.id}`)} />
          ) : (
            <Text style={styles.hint}>{t('local.not_accepting')}</Text>
          ))}
        <Text style={styles.hint}>✓ {t('local.promise_price')}{'\n'}✓ {t('local.promise_itinerary')}{'\n'}✓ {t('local.promise_chat')}</Text>
      </Card>

      {p.bio ? <Text style={styles.body}>{p.bio}</Text> : null}
      <Card>
        <Row label={t('local.experience')} value={local.experience_summary || '—'} />
        <Row label={t('local.areas')} value={local.areas_description || '—'} />
        <Row label={t('local.skills')} value={local.support_skills || '—'} />
        <Row label={t('local.languages')} value={p.languages.map((l) => `${localName(l)} (${t(`proficiency.${l.proficiency}`)})`).join(', ')} />
      </Card>
      <View style={styles.wrap}>
        {p.interests.map((i) => <Badge key={i.slug} tone="brand" label={localName(i)} />)}
      </View>

      {p.photos.length > 0 && (
        <>
          <H2>{t('local.photos')}</H2>
          <PhotoStrip photos={p.photos} size={160} />
        </>
      )}

      <H2>{t('local.services')}</H2>
      {p.services?.length ? (
        p.services.map((s) => (
          <Card key={s.id}>
            <View style={styles.rowBetween}>
              <Text style={{ fontWeight: '600', flex: 1 }}>{s.title}</Text>
              <Text style={{ fontWeight: '700' }}>{money(s.price, s.currency)}</Text>
            </View>
            <Text style={styles.hint}>{localName(s.category_detail)} · {Math.round(s.duration_minutes / 60 * 10) / 10}h · {t(`price_unit.${s.price_unit}`)}</Text>
            <Text style={styles.body}>{s.description}</Text>
            {s.photos.length > 0 && <PhotoStrip photos={s.photos.map((ph) => ({ ...ph, caption: s.title }))} size={96} />}
            {s.included ? <Text style={styles.body}>✓ {s.included}</Text> : null}
            {s.excluded ? <Text style={[styles.body, { color: colors.amber }]}>✗ {s.excluded}</Text> : null}
          </Card>
        ))
      ) : (
        <Text style={styles.hint}>{t('local.no_services')}</Text>
      )}

      {!!p.external_reviews?.length && (
        <>
          <H2>{t('local.external_reviews')}</H2>
          <Text style={styles.hint}>{t('local.external_reviews_hint')}</Text>
          {p.external_reviews.map((r) => (
            <Card key={r.id}>
              <View style={styles.rowBetween}>
                <Text style={{ fontWeight: '600' }}>{t(`platform.${r.platform}`)} {r.rating_text ? `· ${r.rating_text}` : ''}</Text>
                <Badge tone={r.status === 'VERIFIED' ? 'green' : 'amber'} label={r.status === 'VERIFIED' ? t('local.source_checked') : t('local.source_unverified')} />
              </View>
            </Card>
          ))}
        </>
      )}

      <H2>{t('local.reviews_title')}</H2>
      {p.reviews.length ? (
        p.reviews.map((r) => (
          <Card key={r.id}>
            <View style={styles.rowBetween}>
              <Text style={{ fontWeight: '600' }}>{r.reviewer.name}</Text>
              <Stars value={r.rating} />
            </View>
            {r.comment ? <Text style={styles.body}>{r.comment}</Text> : null}
            <View style={styles.wrap}>
              {r.felt_safe && <Badge tone="green" label={t('reviews.felt_safe')} />}
              {r.price_as_agreed && <Badge tone="green" label={t('reviews.price_as_agreed')} />}
              {r.itinerary_respected && <Badge tone="green" label={t('reviews.itinerary_respected')} />}
            </View>
          </Card>
        ))
      ) : (
        <Empty title={t('reviews.none_title')}>{t('reviews.none_body')}</Empty>
      )}

      {user && !isMe && (
        <Button
          variant="ghost"
          title={t('report.button')}
          onPress={() => router.push({ pathname: '/report', params: { reported_user: String(p.id), category: 'FAKE_PROFILE', block: '1' } })}
        />
      )}
    </Screen>
  )
}
