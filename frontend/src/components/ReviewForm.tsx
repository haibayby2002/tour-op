import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { api } from '../lib/api'
import type { Booking } from '../lib/types'
import { ErrorText, Field, StarInput } from './ui'

type TriState = boolean | null

function YesNo({ label, value, onChange }: { label: string; value: TriState; onChange: (v: TriState) => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex gap-1">
        {[true, false].map((v) => (
          <button
            type="button"
            key={String(v)}
            onClick={() => onChange(value === v ? null : v)}
            className={value === v ? (v ? 'btn-primary btn-sm' : 'btn-danger btn-sm') : 'btn-secondary btn-sm'}
          >
            {v ? t('common.yes') : t('common.no')}
          </button>
        ))}
      </span>
    </div>
  )
}

export default function ReviewForm({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const { t } = useTranslation()
  const reviewingLocal = booking.my_role === 'TRAVELER'
  const other = reviewingLocal ? booking.local : booking.traveler
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [feltSafe, setFeltSafe] = useState<TriState>(null)
  const [itinerary, setItinerary] = useState<TriState>(null)
  const [price, setPrice] = useState<TriState>(null)

  const mutation = useMutation({
    mutationFn: () =>
      api('/reviews/', {
        body: {
          booking: booking.id,
          rating,
          comment,
          ...(reviewingLocal ? { felt_safe: feltSafe, itinerary_respected: itinerary, price_as_agreed: price } : {}),
        },
      }),
    onSuccess: onDone,
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        mutation.mutate()
      }}
    >
      <p className="font-semibold">{t('review.title', { name: other.name })}</p>
      <StarInput value={rating} onChange={setRating} />
      {reviewingLocal && (
        <div className="space-y-2 rounded-xl bg-stone-50 p-3">
          <YesNo label={t('review.felt_safe')} value={feltSafe} onChange={setFeltSafe} />
          <YesNo label={t('review.itinerary_respected')} value={itinerary} onChange={setItinerary} />
          <YesNo label={t('review.price_as_agreed')} value={price} onChange={setPrice} />
        </div>
      )}
      <Field label={t('review.comment')} hint={t('review.blind_hint')} htmlFor="rv-comment">
        <textarea id="rv-comment" className="input min-h-24" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <ErrorText error={mutation.error} />
      <button className="btn-primary w-full" disabled={!rating || mutation.isPending}>{t('review.submit')}</button>
      <p className="text-xs text-stone-500">{t('review.problem_hint')}</p>
    </form>
  )
}
