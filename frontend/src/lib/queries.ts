import { useQuery } from '@tanstack/react-query'

import { api } from './api'
import type { Meta, Place } from './types'

export const keys = {
  meta: ['meta'] as const,
  places: (city: string) => ['places', city] as const,
  me: ['me'] as const,
  myProfile: ['profile', 'me'] as const,
  myServices: ['services', 'mine'] as const,
  search: (params: Record<string, string>) => ['locals', params] as const,
  publicProfile: (id: number, role: string) => ['users', id, role] as const,
  requests: (box: string) => ['tour-requests', box] as const,
  request: (id: number) => ['tour-requests', 'detail', id] as const,
  bookings: (role: string) => ['bookings', role] as const,
  booking: (id: number) => ['bookings', 'detail', id] as const,
  messages: (conversationId: number) => ['conversations', conversationId, 'messages'] as const,
  conversations: ['conversations'] as const,
  notifications: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  reports: ['reports'] as const,
  blocks: ['blocks'] as const,
  wishes: (box: string) => ['trip-wishes', box] as const,
  wish: (id: number) => ['trip-wishes', 'detail', id] as const,
}

/** Recommended places in a city, offered as suggestions (free text is still allowed). */
export function usePlaces(city: string | undefined) {
  return useQuery({
    queryKey: keys.places(city ?? ''),
    queryFn: () => api<Place[]>(`/places/?city=${encodeURIComponent(city ?? '')}`, { auth: false }),
    enabled: !!city,
    staleTime: 60 * 60 * 1000,
  })
}

export function useMeta() {
  return useQuery({
    queryKey: keys.meta,
    queryFn: () => api<Meta>('/meta/', { auth: false }),
    staleTime: 60 * 60 * 1000,
  })
}
