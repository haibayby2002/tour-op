import { useState } from 'react'
import { View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import DateTimeField from '../../components/DateTimeField'
import { Button, Card, Chip, ErrorText, Field, Input, Loading, Screen, styles, Text } from '../../components/ui'
import { api } from '../../lib/api'
import { useMeta, usePlaces } from '../../lib/queries'
import type { Booking, Place, StopKind } from '../../lib/types'

interface StopDraft {
  time: string
  place_name: string
  activity: string
  kind: StopKind
  estimated_cost: string
}

const COSTS = ['cost_tickets', 'cost_transport', 'cost_food', 'cost_overtime', 'cost_other'] as const
const emptyStop = (): StopDraft => ({ time: '', place_name: '', activity: '', kind: 'SIGHTSEEING', estimated_cost: '' })

/** Local proposes a new, immutable itinerary + price version. */
export default function ProposeScreen() {
  const { t, i18n } = useTranslation()
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const { data: meta } = useMeta()
  const queryClient = useQueryClient()
  const { data: booking } = useQuery({
    queryKey: ['bookings', 'detail', Number(bookingId)],
    queryFn: () => api<Booking>(`/bookings/${bookingId}/`),
  })
  const base = booking?.pending_agreement ?? booking?.current_agreement
  const { data: places } = usePlaces(booking?.request.city)
  const vi = i18n.language.startsWith('vi')

  const [form, setForm] = useState<Record<string, string> | null>(null)
  const [stops, setStops] = useState<StopDraft[] | null>(null)
  const [start, setStart] = useState<Date | null>(null)
  const [end, setEnd] = useState<Date | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      api(`/bookings/${bookingId}/agreements/`, {
        body: {
          ...values,
          price: Number(values.price),
          group_size: Number(values.group_size),
          currency: booking?.currency ?? 'VND',
          start_at: (start ?? new Date(booking!.start_at)).toISOString(),
          end_at: (end ?? new Date(booking!.end_at)).toISOString(),
          stops: stopList,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      router.back()
    },
  })

  if (!booking) return <Loading />
  const values: Record<string, string> = form ?? {
    meeting_point: base?.meeting_point ?? '',
    scope: base?.scope ?? '',
    price: String(base?.price ?? booking.service?.price ?? ''),
    price_unit: base?.price_unit ?? 'PER_GROUP',
    group_size: String(base?.group_size ?? booking.group_size),
    included: base?.included ?? '',
    excluded: base?.excluded ?? '',
    cost_tickets: base?.cost_tickets ?? '',
    cost_transport: base?.cost_transport ?? '',
    cost_food: base?.cost_food ?? '',
    cost_overtime: base?.cost_overtime ?? '',
    cost_other: base?.cost_other ?? '',
    cancellation_policy: base?.cancellation_policy ?? '',
    notes: base?.notes ?? '',
  }
  const stopList: StopDraft[] =
    stops ?? (base?.stops.map(({ time, place_name, activity, kind, estimated_cost }) => ({ time, place_name, activity, kind, estimated_cost })) ?? [emptyStop()])
  const set = (key: string) => (v: string) => setForm({ ...values, [key]: v })
  const setStop = (i: number, patch: Partial<StopDraft>) => setStops(stopList.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  return (
    <Screen>
      <Text style={styles.hint}>{t('agreement.form_intro')}</Text>
      <Field label={t('agreement.meeting_point')} hint={t('agreement.meeting_point_hint')}>
        <Input value={values.meeting_point} onChangeText={set('meeting_point')} />
      </Field>
      <Field label={t('request.start')}>
        <DateTimeField value={start ?? new Date(base?.start_at ?? booking.start_at)} onChange={setStart} />
      </Field>
      <Field label={t('request.end')}>
        <DateTimeField value={end ?? new Date(base?.end_at ?? booking.end_at)} onChange={setEnd} />
      </Field>
      <Field label={t('request.group_size')}>
        <Input value={values.group_size} onChangeText={set('group_size')} keyboardType="number-pad" />
      </Field>
      <Field label={t('agreement.scope')} hint={t('agreement.scope_hint')}>
        <Input multiline value={values.scope} onChangeText={set('scope')} />
      </Field>

      <Text style={styles.label}>{t('mobile.stops')}</Text>
      <Text style={styles.hint}>{t('agreement.kind_hint')}</Text>
      {stopList.map((stop, i) => (
        <Card key={i}>
          <Input placeholder={t('mobile.stop_time')} value={stop.time} onChangeText={(v) => setStop(i, { time: v })} />
          <Input placeholder={t('mobile.stop_place')} value={stop.place_name} onChangeText={(v) => setStop(i, { place_name: v })} />
          <PlaceSuggestions places={places} text={stop.place_name} vi={vi} onPick={(name) => setStop(i, { place_name: name })} />
          <Input placeholder={t('mobile.stop_activity')} value={stop.activity} onChangeText={(v) => setStop(i, { activity: v })} />
          <View style={styles.wrap}>
            {(meta?.stop_kinds ?? []).map((k) => (
              <Chip key={k} label={t(`stop_kind.${k}`)} selected={stop.kind === k} onPress={() => setStop(i, { kind: k })} />
            ))}
          </View>
          <Input placeholder={t('agreement.estimated_cost')} value={stop.estimated_cost} onChangeText={(v) => setStop(i, { estimated_cost: v })} />
          {stopList.length > 1 && <Button small variant="ghost" title={t('common.remove')} onPress={() => setStops(stopList.filter((_, j) => j !== i))} />}
        </Card>
      ))}
      <Button small variant="secondary" title={`+ ${t('mobile.add_stop')}`} onPress={() => setStops([...stopList, emptyStop()])} />

      <Field label={t('agreement.price')}>
        <Input value={values.price} onChangeText={set('price')} keyboardType="number-pad" />
      </Field>
      <View style={styles.wrap}>
        {(['PER_GROUP', 'PER_PERSON'] as const).map((u) => (
          <Chip key={u} label={t(`price_unit.${u}`)} selected={values.price_unit === u} onPress={() => set('price_unit')(u)} />
        ))}
      </View>
      <Field label={t('agreement.included')}>
        <Input multiline value={values.included} onChangeText={set('included')} />
      </Field>
      <Field label={t('agreement.excluded')}>
        <Input multiline value={values.excluded} onChangeText={set('excluded')} />
      </Field>
      <Card>
        <Text style={{ fontWeight: '600' }}>{t('agreement.extra_costs')}</Text>
        <Text style={styles.hint}>{t('agreement.extra_costs_hint')}</Text>
        {COSTS.map((k) => (
          <Field key={k} label={t(`agreement.${k}`)}>
            <Input value={values[k]} onChangeText={set(k)} placeholder={t('agreement.cost_placeholder')} />
          </Field>
        ))}
      </Card>
      <Field label={t('agreement.cancellation_policy')}>
        <Input multiline value={values.cancellation_policy} onChangeText={set('cancellation_policy')} placeholder={t('agreement.cancellation_placeholder')} />
      </Field>
      <Field label={t('agreement.notes')}>
        <Input multiline value={values.notes} onChangeText={set('notes')} />
      </Field>
      <ErrorText error={mutation.error} />
      <Button
        title={t('agreement.send_proposal')}
        onPress={() => mutation.mutate()}
        loading={mutation.isPending}
        disabled={!values.meeting_point || !values.scope || !values.price || !values.cancellation_policy || stopList.some((s) => !s.place_name)}
      />
    </Screen>
  )
}

/** Up to 6 recommended places matching what the local typed. Tapping one fills the box; any other text is fine too. */
function PlaceSuggestions({ places, text, vi, onPick }: { places?: Place[]; text: string; vi: boolean; onPick: (name: string) => void }) {
  const q = text.trim().toLocaleLowerCase()
  if (!places?.length || !q) return null
  const matches = places
    .map((p) => (vi && p.name_vi ? p.name_vi : p.name))
    .filter((name) => name.toLocaleLowerCase().includes(q) && name.toLocaleLowerCase() !== q)
    .slice(0, 6)
  if (!matches.length) return null
  return (
    <View style={styles.wrap}>
      {matches.map((name) => <Chip key={name} label={name} onPress={() => onPick(name)} />)}
    </View>
  )
}
