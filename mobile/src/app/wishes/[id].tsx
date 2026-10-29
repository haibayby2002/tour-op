import { useState } from 'react'
import { RefreshControl, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { MatchReasons, RatingSummary, TrustBadges } from '../../components/trust'
import { Avatar, Badge, Button, Card, colors, Empty, ErrorText, Field, H2, Input, Loading, Notice, Screen, styles, Text } from '../../components/ui'
import WishFacts, { WishStatusBadge } from '../../components/WishFacts'
import { api } from '../../lib/api'
import { localName, money } from '../../lib/format'
import type { Booking, TripWish, WishOffer } from '../../lib/types'

function isMatching(wish?: TripWish) {
  return !!wish && wish.my_role === 'TRAVELER' && wish.status === 'OPEN' && !wish.candidate_count &&
    Date.now() - new Date(wish.created_at).getTime() < 60_000
}

export default function WishScreen() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: wish, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['trip-wishes', 'detail', Number(id)],
    queryFn: () => api<TripWish>(`/trip-wishes/${id}/`),
    // Matching runs in a background worker: poll quickly right after posting.
    refetchInterval: (query) => (isMatching(query.state.data) ? 3_000 : false),
  })
  if (isLoading) return <Loading />
  if (error || !wish) return <Screen><ErrorText error={error} /></Screen>

  return (
    <Screen refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}>
      <Stack.Screen options={{ title: wish.title }} />
      <Card>
        <View style={styles.rowBetween}>
          <Text style={{ fontSize: 18, fontWeight: '700', flex: 1 }}>{wish.title}</Text>
          <WishStatusBadge status={wish.status} />
        </View>
        <Text style={styles.body}>{wish.description}</Text>
        <WishFacts wish={wish} />
      </Card>
      {wish.my_role === 'TRAVELER' ? <OwnerView wish={wish} /> : <LocalView wish={wish} />}
    </Screen>
  )
}

function OwnerView({ wish }: { wish: TripWish }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['trip-wishes'] })
  const accept = useMutation({
    mutationFn: (offer: WishOffer) => api<Booking>(`/wish-offers/${offer.id}/accept/`, { method: 'POST' }),
    onSuccess: (booking) => {
      refresh()
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      router.replace(`/bookings/${booking.id}`)
    },
  })
  const decline = useMutation({ mutationFn: (offer: WishOffer) => api(`/wish-offers/${offer.id}/decline/`, { method: 'POST' }), onSuccess: refresh })
  const close = useMutation({ mutationFn: () => api(`/trip-wishes/${wish.id}/close/`, { method: 'POST' }), onSuccess: refresh })
  const offers = wish.offers ?? []

  return (
    <>
      <Card>
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.brandDark }}>{wish.candidate_count}</Text>
        <Text style={styles.body}>{t('wishes.matched_explainer', { count: wish.candidate_count ?? 0 })}</Text>
        {isMatching(wish) ? (
          <Notice tone="blue">{t('wishes.matching')}</Notice>
        ) : (
          wish.candidate_count === 0 && wish.status === 'OPEN' && <Notice>{t('wishes.no_matches')}</Notice>
        )}
        {wish.booking_id ? <Button title={t('request.open_booking')} onPress={() => router.push(`/bookings/${wish.booking_id}`)} /> : null}
      </Card>
      <H2>{t('wishes.offers_title', { count: offers.length })}</H2>
      {offers.length === 0 ? (
        <Empty title={t('wishes.no_offers_title')}>{t('wishes.no_offers_body')}</Empty>
      ) : (
        offers.map((offer) => (
          <Card key={offer.id}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Avatar src={offer.local.avatar} name={offer.local.name} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{offer.local.name}</Text>
                {offer.trust && <RatingSummary trust={offer.trust} />}
              </View>
              {offer.proposed_price !== null && <Text style={{ fontWeight: '700' }}>{money(offer.proposed_price, wish.currency)}</Text>}
            </View>
            {offer.trust && <TrustBadges trust={offer.trust} />}
            <Text style={styles.body}>{offer.message}</Text>
            {offer.status === 'PENDING' && wish.status === 'OPEN' ? (
              <>
                <Button title={t('wishes.choose')} onPress={() => accept.mutate(offer)} loading={accept.isPending} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button small variant="secondary" title={t('wishes.view_profile')} onPress={() => router.push(`/locals/${offer.local.id}`)} />
                  <Button small variant="ghost" title={t('request.decline')} onPress={() => decline.mutate(offer)} />
                </View>
              </>
            ) : (
              <Badge tone={offer.status === 'ACCEPTED' ? 'green' : 'neutral'} label={t(`wishes.offer_status.${offer.status}`)} />
            )}
          </Card>
        ))
      )}
      <Text style={styles.hint}>{t('wishes.choose_hint')}</Text>
      <ErrorText error={accept.error ?? decline.error ?? close.error} />
      {wish.status === 'OPEN' && <Button variant="ghost" title={t('wishes.close')} onPress={() => close.mutate()} />}
    </>
  )
}

function LocalView({ wish }: { wish: TripWish }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [price, setPrice] = useState('')
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['trip-wishes'] })
  const send = useMutation({
    mutationFn: () => api(`/trip-wishes/${wish.id}/offer/`, { body: { message, proposed_price: price ? Number(price) : null } }),
    onSuccess: refresh,
  })
  const withdraw = useMutation({ mutationFn: (offerId: number) => api(`/wish-offers/${offerId}/withdraw/`, { method: 'POST' }), onSuccess: refresh })
  const dismiss = useMutation({
    mutationFn: () => api(`/trip-wishes/${wish.id}/dismiss/`, { method: 'POST' }),
    onSuccess: () => {
      refresh()
      router.back()
    },
  })
  const offer = wish.my_offer
  const canOffer = wish.status === 'OPEN' && (!offer || offer.status === 'WITHDRAWN')
  const tp = wish.traveler_profile

  return (
    <>
      <Card>
        <Text style={{ fontWeight: '600' }}>{t('wishes.why_you')}</Text>
        <MatchReasons reasons={wish.match_reasons ?? []} />
      </Card>
      {tp && (
        <Card>
          <H2>{t('request.about_traveler')}</H2>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Avatar src={tp.avatar} name={tp.name} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{tp.name}</Text>
              <RatingSummary trust={tp.trust} />
            </View>
          </View>
          <TrustBadges trust={tp.trust} showMissing />
          {tp.bio ? <Text style={styles.body}>{tp.bio}</Text> : null}
          <View style={styles.wrap}>{tp.languages.map((l) => <Badge key={l.code} label={localName(l)} />)}</View>
        </Card>
      )}
      {offer && offer.status !== 'WITHDRAWN' && (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={{ fontWeight: '600' }}>{t('wishes.your_offer')}</Text>
            <Badge tone={offer.status === 'ACCEPTED' ? 'green' : offer.status === 'PENDING' ? 'amber' : 'neutral'} label={t(`wishes.offer_status.${offer.status}`)} />
          </View>
          <Text style={styles.body}>{offer.message}</Text>
          {offer.booking_id ? <Button title={t('request.open_booking')} onPress={() => router.push(`/bookings/${offer.booking_id}`)} /> : null}
          {offer.status === 'PENDING' && <Button small variant="ghost" title={t('wishes.withdraw')} onPress={() => withdraw.mutate(offer.id)} />}
        </Card>
      )}
      {canOffer && (
        <Card>
          <Text style={{ fontWeight: '600' }}>{t('wishes.respond_title')}</Text>
          <Field label={t('wishes.your_message')} hint={t('wishes.message_hint')}>
            <Input multiline value={message} onChangeText={setMessage} />
          </Field>
          <Field label={t('wishes.indicative_price')} hint={t('wishes.price_hint')}>
            <Input value={price} onChangeText={setPrice} keyboardType="number-pad" />
          </Field>
          <ErrorText error={send.error} />
          <Button title={t('wishes.send_offer')} onPress={() => send.mutate()} loading={send.isPending} disabled={!message.trim()} />
          {!offer && <Button variant="ghost" title={t('wishes.not_interested')} onPress={() => dismiss.mutate()} />}
        </Card>
      )}
      {wish.status !== 'OPEN' && !offer?.booking_id && <Notice tone="neutral">{t('wishes.no_longer_open')}</Notice>}
      <ErrorText error={withdraw.error} />
    </>
  )
}
