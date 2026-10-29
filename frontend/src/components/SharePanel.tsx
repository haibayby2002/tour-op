import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { api } from '../lib/api'
import { dateTime } from '../lib/format'
import type { TripShare } from '../lib/types'
import { ErrorText } from './ui'

/** Traveler shares guide + itinerary with family/friends (PRD D3). */
export default function SharePanel({ bookingId }: { bookingId: number }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [includeItinerary, setIncludeItinerary] = useState(true)
  const [copied, setCopied] = useState<number | null>(null)
  const queryKey = ['bookings', bookingId, 'shares']
  const { data: shares = [] } = useQuery({ queryKey, queryFn: () => api<TripShare[]>(`/bookings/${bookingId}/shares/`) })

  const create = useMutation({
    mutationFn: () => api<TripShare>(`/bookings/${bookingId}/shares/`, { body: { include_itinerary: includeItinerary } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
  const revoke = useMutation({
    mutationFn: (id: number) => api(`/shares/${id}/`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const copy = async (share: TripShare) => {
    await navigator.clipboard.writeText(`${t('share.message')} ${share.url}`)
    setCopied(share.id)
    setTimeout(() => setCopied(null), 2000)
  }
  const active = shares.filter((s) => s.active)

  return (
    <div className="card space-y-3 p-5">
      <p className="font-semibold">{t('share.title')}</p>
      <p className="text-sm text-stone-500">{t('share.body')}</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={includeItinerary} onChange={(e) => setIncludeItinerary(e.target.checked)} />
        {t('share.include_itinerary')}
      </label>
      <button className="btn-secondary w-full" onClick={() => create.mutate()} disabled={create.isPending}>
        {t('share.create')}
      </button>
      <ErrorText error={create.error} />
      {active.map((s) => (
        <div key={s.id} className="rounded-lg bg-stone-50 p-3 text-xs">
          <p className="truncate font-mono text-stone-600">{s.url}</p>
          <p className="mt-1 text-stone-400">{t('share.expires', { date: dateTime(s.expires_at) })}</p>
          <div className="mt-2 flex gap-2">
            <button className="btn-primary btn-sm" onClick={() => copy(s)}>{copied === s.id ? t('share.copied') : t('share.copy')}</button>
            <a className="btn-ghost btn-sm" href={s.url} target="_blank" rel="noopener noreferrer">{t('share.preview')}</a>
            <button className="btn-ghost btn-sm text-red-600" onClick={() => revoke.mutate(s.id)}>{t('share.revoke')}</button>
          </div>
        </div>
      ))}
    </div>
  )
}
