import { useState } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { BookingStatusBadge } from '../../components/status'
import { Avatar, Card, Chip, colors, Empty, Loading, styles, Text } from '../../components/ui'
import { api } from '../../lib/api'
import { dateTime, money } from '../../lib/format'
import type { BookingListItem, Paginated } from '../../lib/types'

const FILTERS = { upcoming: 'DISCUSSING,CONFIRMED,IN_PROGRESS', past: 'COMPLETED,CANCELLED,DISPUTED' }

export default function BookingsScreen() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<keyof typeof FILTERS>('upcoming')
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['bookings', filter],
    queryFn: () => api<Paginated<BookingListItem>>('/bookings/', { query: { status: FILTERS[filter], page_size: 50 } }),
  })

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={data?.results ?? []}
      keyExtractor={(b) => String(b.id)}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
          <Chip label={t('bookings.upcoming')} selected={filter === 'upcoming'} onPress={() => setFilter('upcoming')} />
          <Chip label={t('bookings.past')} selected={filter === 'past'} onPress={() => setFilter('past')} />
        </View>
      }
      renderItem={({ item: b }) => {
        const other = b.my_role === 'LOCAL' ? b.traveler : b.local
        return (
          <Card onPress={() => router.push(`/bookings/${b.id}`)}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Avatar src={other.avatar} name={other.name} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }} numberOfLines={1}>{b.service_title ?? t('request.custom_experience')}</Text>
                <Text style={styles.hint}>{other.name} · {dateTime(b.start_at)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <BookingStatusBadge status={b.status} />
                {b.agreed_price !== null && <Text style={{ fontWeight: '600', fontSize: 13 }}>{money(b.agreed_price, b.currency)}</Text>}
              </View>
            </View>
          </Card>
        )
      }}
      ListEmptyComponent={isLoading ? <Loading /> : <Empty title={t('bookings.empty')} />}
    />
  )
}
