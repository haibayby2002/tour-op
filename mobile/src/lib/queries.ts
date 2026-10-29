import { useQuery } from '@tanstack/react-query'

import { api } from './api'
import type { Meta, Place } from './types'

/** Recommended places in a city, offered as suggestions (free text is still allowed). */
export function usePlaces(city: string | undefined) {
  return useQuery({
    queryKey: ['places', city ?? ''],
    queryFn: () => api<Place[]>(`/places/?city=${encodeURIComponent(city ?? '')}`, { auth: false }),
    enabled: !!city,
    staleTime: 60 * 60 * 1000,
  })
}

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => api<Meta>('/meta/', { auth: false }), staleTime: 60 * 60 * 1000 })
}
