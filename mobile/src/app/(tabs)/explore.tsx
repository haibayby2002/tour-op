import { useState } from 'react'
import { FlatList, RefreshControl, ScrollView, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { MatchReasons, RatingSummary, TrustBadges } from '../../components/trust'
import { Avatar, Button, Card, Chip, colors, Empty, ErrorText, Input, Loading, styles, Text } from '../../components/ui'
import { api } from '../../lib/api'
import { localName } from '../../lib/format'
import { useMeta } from '../../lib/queries'
import type { LocalCard, SearchResult } from '../../lib/types'

function LocalRow({ local }: { local: LocalCard }) {
  const { t } = useTranslation()
  return (
    <Card onPress={() => router.push(`/locals/${local.id}`)}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Avatar src={local.avatar} name={local.name} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 17, fontWeight: '700' }}>{local.name}</Text>
          <Text style={styles.hint}>
            {t('profile.age_by_year', { age: local.age_by_birth_year })} · {local.city}
          </Text>
          <RatingSummary trust={local.trust} />
        </View>
      </View>
      <Text style={styles.body} numberOfLines={3}>{local.bio}</Text>
      <TrustBadges trust={local.trust} />
      <MatchReasons reasons={local.match.reasons} />
      {/* Prices stay off the landing list (as on the web); the local's profile shows them. */}
      <Text style={styles.hint}>{local.languages.map((l) => l.code.toUpperCase()).join(' · ')}</Text>
    </Card>
  )
}

export default function ExploreScreen() {
  const { t } = useTranslation()
  const { data: meta } = useMeta()
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const params = { city, category, q: query }
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['locals', params],
    queryFn: () => api<SearchResult>('/locals/', { query: { ...params, page_size: 50 } }),
  })

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      data={data?.results ?? []}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <LocalRow local={item} />}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <Text style={styles.hint}>{t('explore.subtitle')}</Text>
          <Button
            variant="secondary"
            title={`✨ ${t('wishes.cta_explore')}`}
            onPress={() => router.push({ pathname: '/wishes/new', params: city ? { city } : {} })}
          />
          <Input
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => setQuery(q)}
            returnKeyType="search"
            placeholder={t('explore.search_placeholder')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Chip label={t('explore.any_city')} selected={!city} onPress={() => setCity('')} />
            {meta?.cities.map((c) => (
              <Chip key={c.slug} label={localName(c)} selected={city === c.slug} onPress={() => setCity(c.slug)} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Chip label={t('explore.any_category')} selected={!category} onPress={() => setCategory('')} />
            {meta?.service_categories.map((c) => (
              <Chip key={c.slug} label={localName(c)} selected={category === c.slug} onPress={() => setCategory(c.slug)} />
            ))}
          </ScrollView>
          {data && <Text style={styles.hint}>{t('explore.results', { count: data.count })}</Text>}
          <ErrorText error={error} />
        </View>
      }
      ListEmptyComponent={
        isLoading ? <Loading /> : <Empty title={t('explore.empty_title')}>{t('explore.empty_body')}</Empty>
      }
    />
  )
}
