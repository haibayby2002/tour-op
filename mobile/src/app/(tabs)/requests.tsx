import { useState } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../auth/AuthContext'
import { RequestStatusBadge } from '../../components/status'
import { MatchReasons } from '../../components/trust'
import { Avatar, Badge, Button, Card, Chip, colors, Empty, Loading, styles, Text } from '../../components/ui'
import WishFacts, { WishStatusBadge } from '../../components/WishFacts'
import { api } from '../../lib/api'
import { dateTime } from '../../lib/format'
import type { Paginated, TourRequest, TripWish } from '../../lib/types'

type Mode = 'received' | 'sent' | 'wishes_mine' | 'wishes_for_me'

function RequestList({ box }: { box: 'received' | 'sent' }) {
  const { t } = useTranslation()
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['tour-requests', box],
    queryFn: () => api<Paginated<TourRequest>>('/tour-requests/', { query: { box, page_size: 50 } }),
  })
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={data?.results ?? []}
      keyExtractor={(r) => String(r.id)}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
      renderItem={({ item: r }) => {
        const other = box === 'sent' ? r.local : r.traveler
        return (
          <Card onPress={() => router.push(`/requests/${r.id}`)}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Avatar src={other.avatar} name={other.name} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{other.name}</Text>
                <Text style={styles.hint} numberOfLines={1}>
                  {r.service?.title ?? t('request.custom_experience')} · {dateTime(r.start_at)}
                </Text>
              </View>
              <RequestStatusBadge status={r.status} />
            </View>
          </Card>
        )
      }}
      ListEmptyComponent={isLoading ? <Loading /> : <Empty title={t(box === 'sent' ? 'requests.empty_sent' : 'requests.empty_received')} />}
    />
  )
}

function WishList({ box }: { box: 'mine' | 'for_me' }) {
  const { t } = useTranslation()
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trip-wishes', box],
    queryFn: () => api<TripWish[]>('/trip-wishes/', { query: { box } }),
  })
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={data ?? []}
      keyExtractor={(w) => String(w.id)}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
      ListHeaderComponent={box === 'mine' ? <Button title={`✨ ${t('wishes.post')}`} onPress={() => router.push('/wishes/new')} /> : null}
      renderItem={({ item: w }) => (
        <Card onPress={() => router.push(`/wishes/${w.id}`)}>
          <View style={styles.rowBetween}>
            <Text style={{ fontWeight: '700', flex: 1 }}>{w.title}</Text>
            <WishStatusBadge status={w.status} />
          </View>
          {box === 'for_me' && <Text style={styles.hint}>{w.traveler.name}</Text>}
          <WishFacts wish={w} />
          {box === 'mine' ? (
            <Text style={{ color: colors.brandDark, fontWeight: '600' }}>
              {t('wishes.matched_count', { count: w.candidate_count ?? 0 })} · {t('wishes.offer_count', { count: w.offer_count ?? 0 })}
            </Text>
          ) : (
            <>
              <MatchReasons reasons={w.match_reasons ?? []} />
              {w.my_offer && <Badge tone="green" label={t(`wishes.offer_status.${w.my_offer.status}`)} />}
            </>
          )}
        </Card>
      )}
      ListEmptyComponent={
        isLoading ? <Loading /> : (
          <Empty title={t(box === 'mine' ? 'wishes.empty_mine' : 'wishes.empty_for_me')}>
            {t(box === 'mine' ? 'wishes.empty_mine_body' : 'wishes.empty_for_me_body')}
          </Empty>
        )
      }
    />
  )
}

export default function RequestsScreen() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const isLocal = hasRole('LOCAL')
  const isTraveler = hasRole('TRAVELER')
  const [mode, setMode] = useState<Mode>(isLocal ? 'received' : 'sent')

  const options: { value: Mode; label: string }[] = []
  if (isLocal) options.push({ value: 'received', label: t('requests.received') })
  if (isTraveler) options.push({ value: 'sent', label: t('requests.sent') })
  if (isTraveler) options.push({ value: 'wishes_mine', label: t('wishes.mine') })
  if (isLocal) options.push({ value: 'wishes_for_me', label: t('wishes.for_me') })

  return (
    <View style={styles.screen}>
      <View style={[styles.wrap, { paddingHorizontal: 16, paddingTop: 12 }]}>
        {options.map((o) => <Chip key={o.value} label={o.label} selected={mode === o.value} onPress={() => setMode(o.value)} />)}
      </View>
      {mode === 'received' || mode === 'sent' ? (
        <RequestList key={mode} box={mode} />
      ) : (
        <WishList key={mode} box={mode === 'wishes_mine' ? 'mine' : 'for_me'} />
      )}
    </View>
  )
}
