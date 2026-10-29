import { useState } from 'react'
import { View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { Button, Card, ErrorText, Field, H1, Input, Loading, Screen, StarInput, styles, Text } from '../../components/ui'
import { api } from '../../lib/api'
import type { Booking } from '../../lib/types'

type Tri = boolean | null

function YesNo({ label, value, onChange }: { label: string; value: Tri; onChange: (v: Tri) => void }) {
  const { t } = useTranslation()
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.body}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button small title={t('common.yes')} variant={value === true ? 'primary' : 'secondary'} onPress={() => onChange(value === true ? null : true)} />
        <Button small title={t('common.no')} variant={value === false ? 'danger' : 'secondary'} onPress={() => onChange(value === false ? null : false)} />
      </View>
    </View>
  )
}

export default function ReviewScreen() {
  const { t } = useTranslation()
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const queryClient = useQueryClient()
  const { data: booking } = useQuery({ queryKey: ['bookings', 'detail', Number(bookingId)], queryFn: () => api<Booking>(`/bookings/${bookingId}/`) })
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [feltSafe, setFeltSafe] = useState<Tri>(null)
  const [itinerary, setItinerary] = useState<Tri>(null)
  const [price, setPrice] = useState<Tri>(null)

  const reviewingLocal = booking?.my_role === 'TRAVELER'
  const mutation = useMutation({
    mutationFn: () =>
      api('/reviews/', {
        body: {
          booking: Number(bookingId),
          rating,
          comment,
          ...(reviewingLocal ? { felt_safe: feltSafe, itinerary_respected: itinerary, price_as_agreed: price } : {}),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      router.back()
    },
  })

  if (!booking) return <Loading />
  const other = reviewingLocal ? booking.local : booking.traveler
  return (
    <Screen>
      <H1>{t('review.title', { name: other.name })}</H1>
      <StarInput value={rating} onChange={setRating} />
      {reviewingLocal && (
        <Card>
          <YesNo label={t('review.felt_safe')} value={feltSafe} onChange={setFeltSafe} />
          <YesNo label={t('review.itinerary_respected')} value={itinerary} onChange={setItinerary} />
          <YesNo label={t('review.price_as_agreed')} value={price} onChange={setPrice} />
        </Card>
      )}
      <Field label={t('review.comment')} hint={t('review.blind_hint')}>
        <Input multiline value={comment} onChangeText={setComment} />
      </Field>
      <ErrorText error={mutation.error} />
      <Button title={t('review.submit')} disabled={!rating} loading={mutation.isPending} onPress={() => mutation.mutate()} />
      <Text style={styles.hint}>{t('review.problem_hint')}</Text>
    </Screen>
  )
}
