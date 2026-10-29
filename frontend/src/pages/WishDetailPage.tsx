import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import TravelerSummary from '../components/TravelerSummary'
import { MatchReasons, RatingSummary, TrustBadges } from '../components/trust'
import { Alert, Avatar, Badge, EmptyState, ErrorText, Field, PageLoader } from '../components/ui'
import { WishFacts, WishStatusBadge } from '../components/WishSummary'
import { api } from '../lib/api'
import { money } from '../lib/format'
import { keys } from '../lib/queries'
import type { Booking, TripWish, WishOffer } from '../lib/types'

function isMatching(wish?: TripWish) {
  return !!wish && wish.my_role === 'TRAVELER' && wish.status === 'OPEN' && !wish.candidate_count &&
    Date.now() - new Date(wish.created_at).getTime() < 60_000
}

export default function WishDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const wishId = Number(id)
  const { data: wish, isLoading, error } = useQuery({
    queryKey: keys.wish(wishId),
    queryFn: () => api<TripWish>(`/trip-wishes/${wishId}/`),
    // Matching runs in a background worker: poll quickly right after posting.
    refetchInterval: (query) => (isMatching(query.state.data) ? 3_000 : 30_000),
  })
  if (isLoading) return <PageLoader />
  if (error || !wish) return <ErrorText error={error} />

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{wish.title}</h1>
          <WishStatusBadge status={wish.status} />
        </div>
        <div className="card space-y-4 p-6">
          <p className="whitespace-pre-line text-stone-700">{wish.description}</p>
          <WishFacts wish={wish} />
        </div>
        {wish.my_role === 'TRAVELER' ? <OwnerOffers wish={wish} /> : wish.traveler_profile && (
          <div className="card p-6">
            <p className="mb-4 font-semibold">{t('request.about_traveler')}</p>
            <TravelerSummary profile={wish.traveler_profile} />
          </div>
        )}
      </div>
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        {wish.my_role === 'TRAVELER' ? <OwnerPanel wish={wish} /> : <LocalPanel wish={wish} />}
      </aside>
    </div>
  )
}

function OwnerPanel({ wish }: { wish: TripWish }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const close = useMutation({
    mutationFn: () => api(`/trip-wishes/${wish.id}/close/`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip-wishes'] }),
  })
  return (
    <div className="card space-y-3 p-5">
      <p className="text-3xl font-bold text-brand-800">{wish.candidate_count}</p>
      <p className="text-sm text-stone-600">{t('wishes.matched_explainer', { count: wish.candidate_count ?? 0 })}</p>
      {isMatching(wish) ? (
        <Alert tone="blue">{t('wishes.matching')}</Alert>
      ) : (
        wish.candidate_count === 0 && wish.status === 'OPEN' && <Alert>{t('wishes.no_matches')}</Alert>
      )}
      {wish.booking_id && <Link to={`/bookings/${wish.booking_id}`} className="btn-primary w-full">{t('request.open_booking')}</Link>}
      {wish.status === 'OPEN' && (
        <button className="btn-ghost w-full text-red-600" onClick={() => close.mutate()} disabled={close.isPending}>
          {t('wishes.close')}
        </button>
      )}
      <ErrorText error={close.error} />
    </div>
  )
}

function OwnerOffers({ wish }: { wish: TripWish }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const accept = useMutation({
    mutationFn: (offer: WishOffer) => api<Booking>(`/wish-offers/${offer.id}/accept/`, { method: 'POST' }),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['trip-wishes'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      navigate(`/bookings/${booking.id}`)
    },
  })
  const decline = useMutation({
    mutationFn: (offer: WishOffer) => api(`/wish-offers/${offer.id}/decline/`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.wish(wish.id) }),
  })
  const offers = wish.offers ?? []

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('wishes.offers_title', { count: offers.length })}</h2>
      {offers.length === 0 ? (
        <EmptyState title={t('wishes.no_offers_title')}>{t('wishes.no_offers_body')}</EmptyState>
      ) : (
        offers.map((offer) => (
          <div key={offer.id} className="card space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar src={offer.local.avatar} name={offer.local.name} />
              <div className="flex-1">
                <Link to={`/locals/${offer.local.id}`} className="font-semibold hover:text-brand-800">{offer.local.name}</Link>
                {offer.trust && <RatingSummary trust={offer.trust} />}
              </div>
              {offer.proposed_price !== null && (
                <div className="text-right">
                  <p className="text-xs text-stone-500">{t('wishes.indicative_price')}</p>
                  <p className="font-semibold">{money(offer.proposed_price, wish.currency)}</p>
                </div>
              )}
            </div>
            {offer.trust && <TrustBadges trust={offer.trust} compact />}
            <p className="text-sm whitespace-pre-line text-stone-700">{offer.message}</p>
            {offer.status === 'PENDING' && wish.status === 'OPEN' ? (
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" onClick={() => accept.mutate(offer)} disabled={accept.isPending}>{t('wishes.choose')}</button>
                <Link to={`/locals/${offer.local.id}`} className="btn-secondary">{t('wishes.view_profile')}</Link>
                <button className="btn-ghost text-stone-500" onClick={() => decline.mutate(offer)}>{t('request.decline')}</button>
              </div>
            ) : (
              <Badge tone={offer.status === 'ACCEPTED' ? 'green' : 'neutral'}>{t(`wishes.offer_status.${offer.status}`)}</Badge>
            )}
          </div>
        ))
      )}
      <p className="text-xs text-stone-500">{t('wishes.choose_hint')}</p>
      <ErrorText error={accept.error ?? decline.error} />
    </section>
  )
}

function LocalPanel({ wish }: { wish: TripWish }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [price, setPrice] = useState('')
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['trip-wishes'] })
  const send = useMutation({
    mutationFn: () => api(`/trip-wishes/${wish.id}/offer/`, { body: { message, proposed_price: price ? Number(price) : null } }),
    onSuccess: refresh,
  })
  const withdraw = useMutation({
    mutationFn: (offerId: number) => api(`/wish-offers/${offerId}/withdraw/`, { method: 'POST' }),
    onSuccess: refresh,
  })
  const dismiss = useMutation({
    mutationFn: () => api(`/trip-wishes/${wish.id}/dismiss/`, { method: 'POST' }),
    onSuccess: () => {
      refresh()
      navigate('/wishes')
    },
  })
  const offer = wish.my_offer
  const canOffer = wish.status === 'OPEN' && (!offer || offer.status === 'WITHDRAWN')

  return (
    <div className="space-y-4">
      <div className="card space-y-2 p-5">
        <p className="text-sm font-semibold">{t('wishes.why_you')}</p>
        <MatchReasons reasons={wish.match_reasons ?? []} />
      </div>
      {offer && offer.status !== 'WITHDRAWN' && (
        <div className="card space-y-2 p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{t('wishes.your_offer')}</p>
            <Badge tone={offer.status === 'ACCEPTED' ? 'green' : offer.status === 'PENDING' ? 'amber' : 'neutral'}>{t(`wishes.offer_status.${offer.status}`)}</Badge>
          </div>
          <p className="text-sm whitespace-pre-line text-stone-700">{offer.message}</p>
          {offer.proposed_price !== null && <p className="text-sm font-semibold">{money(offer.proposed_price, wish.currency)}</p>}
          {offer.booking_id && <Link to={`/bookings/${offer.booking_id}`} className="btn-primary w-full">{t('request.open_booking')}</Link>}
          {offer.status === 'PENDING' && (
            <button className="btn-ghost btn-sm text-red-600" onClick={() => withdraw.mutate(offer.id)}>{t('wishes.withdraw')}</button>
          )}
        </div>
      )}
      {canOffer && (
        <form
          className="card space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault()
            send.mutate()
          }}
        >
          <p className="font-semibold">{t('wishes.respond_title')}</p>
          <Field label={t('wishes.your_message')} hint={t('wishes.message_hint')} htmlFor="o-msg">
            <textarea id="o-msg" className="input min-h-32" required value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <Field label={t('wishes.indicative_price')} hint={t('wishes.price_hint')} htmlFor="o-price">
            <input id="o-price" type="number" min={0} step={10000} className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <ErrorText error={send.error} />
          <button className="btn-primary w-full" disabled={send.isPending || !message.trim()}>{t('wishes.send_offer')}</button>
          {!offer && (
            <button type="button" className="btn-ghost w-full text-stone-500" onClick={() => dismiss.mutate()}>{t('wishes.not_interested')}</button>
          )}
        </form>
      )}
      {wish.status !== 'OPEN' && !offer?.booking_id && <Alert tone="neutral">{t('wishes.no_longer_open')}</Alert>}
    </div>
  )
}
