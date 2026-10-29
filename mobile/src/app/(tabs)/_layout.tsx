import { Fragment, useCallback } from 'react'
import { useColorScheme } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Redirect } from 'expo-router'
import { Tabs } from 'expo-router/tabs'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../auth/AuthContext'
import { colors, Loading, Text } from '../../components/ui'
import { api } from '../../lib/api'
import { useSocket } from '../../lib/useSocket'

const icon = (glyph: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>
  }

export default function TabsLayout() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const scheme = useColorScheme()
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api<{ count: number }>('/notifications/unread-count/'),
    enabled: !!user,
    refetchInterval: 60_000,
  })
  // Live updates: any notification refreshes the affected lists.
  const onEvent = useCallback(
    (event: Record<string, unknown>) => {
      if (event.type !== 'notification') return
      for (const key of [['notifications'], ['tour-requests'], ['bookings'], ['conversations'], ['trip-wishes']]) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    },
    [queryClient],
  )
  useSocket(user ? '/ws/notifications/' : null, onEvent)

  if (loading) return <Loading />
  if (!user) return <Redirect href="/login" />

  return (
    <Tabs
      screenLayout={({ children }) => <Fragment key={scheme}>{children}</Fragment>}
      screenOptions={{ tabBarActiveTintColor: colors.brand, headerTintColor: colors.text, headerTitleStyle: { fontWeight: '700' } }}>
      <Tabs.Screen name="explore" options={{ title: t('mobile.tabs.explore'), headerTitle: t('explore.title'), tabBarIcon: icon('🧭') }} />
      <Tabs.Screen name="requests" options={{ title: t('mobile.tabs.requests'), headerTitle: t('requests.title'), tabBarIcon: icon('📨') }} />
      <Tabs.Screen name="bookings" options={{ title: t('mobile.tabs.bookings'), headerTitle: t('bookings.title'), tabBarIcon: icon('🗓️') }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('mobile.tabs.notifications'),
          headerTitle: t('notifications.title'),
          tabBarIcon: icon('🔔'),
          tabBarBadge: data?.count ? (data.count > 99 ? '99+' : data.count) : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: t('mobile.tabs.profile'), headerTitle: t('profile.title'), tabBarIcon: icon('👤') }} />
    </Tabs>
  )
}
