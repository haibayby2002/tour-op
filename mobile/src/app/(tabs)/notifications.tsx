import { FlatList, Pressable, RefreshControl, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { Button, colors, Empty, Loading, styles, Text } from '../../components/ui'
import { api } from '../../lib/api'
import { relative } from '../../lib/format'
import type { AppNotification, Paginated } from '../../lib/types'

function target(n: AppNotification) {
  if (n.data.booking_id) return `/bookings/${n.data.booking_id}` as const
  if (n.data.wish_id) return `/wishes/${n.data.wish_id}` as const
  if (n.data.request_id) return `/requests/${n.data.request_id}` as const
  return null
}

export default function NotificationsScreen() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api<Paginated<AppNotification>>('/notifications/', { query: { page_size: 50 } }),
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })

  const open = async (n: AppNotification) => {
    if (!n.read) await api(`/notifications/${n.id}/read/`, { method: 'POST' }).then(invalidate)
    const href = target(n)
    if (href) router.push(href)
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      data={data?.results ?? []}
      keyExtractor={(n) => String(n.id)}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
      ListHeaderComponent={
        data?.results.length ? (
          <Button small variant="secondary" title={t('notifications.read_all')} onPress={() => api('/notifications/read-all/', { method: 'POST' }).then(invalidate)} />
        ) : null
      }
      renderItem={({ item: n }) => (
        <Pressable onPress={() => open(n)} style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, backgroundColor: n.read ? colors.surface : colors.brandLight }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: n.read ? 'transparent' : colors.brand }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: n.read ? '400' : '600' }}>{t(`notification.${n.kind}`, { defaultValue: n.kind, ...n.data })}</Text>
            <Text style={styles.hint}>{relative(n.created_at)}</Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={isLoading ? <Loading /> : <Empty title={t('notifications.empty')} />}
    />
  )
}
