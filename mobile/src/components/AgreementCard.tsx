import { Linking, Pressable, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { dateTime, money } from '../lib/format'
import type { Agreement } from '../lib/types'
import { AgreementStatusBadge, StopKindBadge } from './status'
import { Card, colors, Notice, Row, styles, Text } from './ui'

const COSTS = ['cost_tickets', 'cost_transport', 'cost_food', 'cost_overtime', 'cost_other'] as const

export default function AgreementCard({
  agreement,
  declined,
  onToggleStop,
}: {
  agreement: Agreement
  declined?: number[]
  onToggleStop?: (id: number) => void
}) {
  const { t } = useTranslation()
  const costs = COSTS.filter((k) => agreement[k])
  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={{ fontWeight: '600' }}>{t('agreement.version', { version: agreement.version })}</Text>
        <AgreementStatusBadge status={agreement.status} />
      </View>
      <View style={{ backgroundColor: colors.brandLight, borderRadius: 12, padding: 12 }}>
        <Text style={{ fontSize: 12, color: colors.brandDark, fontWeight: '600' }}>{t('agreement.total').toUpperCase()}</Text>
        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.brandDark }}>{money(agreement.total_price, agreement.currency)}</Text>
        <Text style={{ fontSize: 12, color: colors.brandDark }}>
          {money(agreement.price, agreement.currency)} {t(`price_unit.${agreement.price_unit}`)}
        </Text>
      </View>
      <Row label={t('agreement.when')} value={`${dateTime(agreement.start_at)} → ${dateTime(agreement.end_at)}`} />
      <Row label={t('agreement.meeting_point')} value={agreement.meeting_point} />
      <Row label={t('agreement.scope')} value={agreement.scope} />
      {agreement.included ? <Row label={`✓ ${t('agreement.included')}`} value={agreement.included} /> : null}
      {agreement.excluded ? <Row label={`✗ ${t('agreement.excluded')}`} value={agreement.excluded} /> : null}
      {costs.length > 0 && (
        <Notice tone="amber" title={t('agreement.extra_costs')}>
          {costs.map((k) => (
            <Text key={k} style={{ color: colors.amber, fontSize: 13 }}>
              {t(`agreement.${k}`)}: {agreement[k]}
            </Text>
          ))}
        </Notice>
      )}
      <Text style={{ fontWeight: '600', marginTop: 4 }}>{t('agreement.itinerary')}</Text>
      {agreement.stops.some((s) => s.is_commercial) && <Text style={{ fontSize: 12, color: colors.amber }}>⚠ {t('agreement.commercial_warning')}</Text>}
      {agreement.stops.map((stop) => {
        const isDeclined = stop.declined_by_traveler || declined?.includes(stop.id)
        return (
          <View key={stop.id} style={{ borderLeftWidth: 2, borderColor: colors.brandBorder, paddingLeft: 10, gap: 3, opacity: isDeclined ? 0.5 : 1 }}>
            <View style={[styles.wrap, { alignItems: 'center' }]}>
              {stop.time ? <Text style={styles.hint}>{stop.time}</Text> : null}
              <Text style={{ fontWeight: '600', textDecorationLine: isDeclined ? 'line-through' : 'none' }}>{stop.place_name}</Text>
              <StopKindBadge kind={stop.kind} />
              {stop.place?.latitude && stop.place.longitude ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${stop.place!.latitude},${stop.place!.longitude}`)}
                >
                  <Text style={{ color: colors.brand, fontSize: 13, textDecorationLine: 'underline' }}>{t('agreement.map')}</Text>
                </Pressable>
              ) : null}
            </View>
            {stop.activity ? <Text style={styles.body}>{stop.activity}</Text> : null}
            {stop.declinable && onToggleStop && (
              <Pressable onPress={() => onToggleStop(stop.id)} accessibilityRole="checkbox" accessibilityState={{ checked: !!declined?.includes(stop.id) }}>
                <Text style={{ color: colors.brandDark, fontSize: 13 }}>
                  {declined?.includes(stop.id) ? '☑' : '☐'} {t('agreement.decline_this_stop')}
                </Text>
              </Pressable>
            )}
          </View>
        )
      })}
      <Row label={t('agreement.cancellation_policy')} value={agreement.cancellation_policy} />
      {agreement.response_note ? <Row label={t('agreement.traveler_feedback')} value={agreement.response_note} /> : null}
    </Card>
  )
}
