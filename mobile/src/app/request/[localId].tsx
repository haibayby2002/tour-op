import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../auth/AuthContext'
import DateTimeField from '../../components/DateTimeField'
import { Button, Chip, ErrorText, Field, H1, Input, Loading, Notice, Screen, styles, Text } from '../../components/ui'
import { api } from '../../lib/api'
import { localName, money, priceRange } from '../../lib/format'
import { useMeta } from '../../lib/queries'
import type { MyProfile, PublicProfile, TourRequest } from '../../lib/types'
import { canBook, missingContacts } from '../../lib/verification'

function defaultStart() {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  d.setHours(9, 0, 0, 0)
  return d
}

export default function NewRequestScreen() {
  const { t } = useTranslation()
  const { localId } = useLocalSearchParams<{ localId: string }>()
  const { user, hasRole } = useAuth()
  const { data: meta } = useMeta()
  const queryClient = useQueryClient()
  const { data: local } = useQuery({
    queryKey: ['users', Number(localId), 'LOCAL'],
    queryFn: () => api<PublicProfile>(`/users/${localId}/`, { query: { role: 'LOCAL' } }),
  })
  const { data: me } = useQuery({ queryKey: ['profile', 'me'], queryFn: () => api<MyProfile>('/profile/me/') })

  const [service, setService] = useState<number | null>(null)
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(() => new Date(defaultStart().getTime() + 3 * 3600_000))
  const [groupSize, setGroupSize] = useState(1)
  const [budgetMax, setBudgetMax] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [wishes, setWishes] = useState('')
  const [avoid, setAvoid] = useState('')

  useEffect(() => {
    if (!me) return
    setWishes((w) => w || me.traveler?.wishes || '')
    setAvoid((a) => a || me.traveler?.avoid_notes || '')
    setInterests((i) => (i.length ? i : me.interests.map((x) => x.slug)))
  }, [me])

  const mutation = useMutation({
    mutationFn: () =>
      api<TourRequest>('/tour-requests/', {
        body: {
          local: Number(localId),
          service,
          city: local?.city?.slug,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          group_size: groupSize,
          budget_max: budgetMax ? Number(budgetMax) : null,
          interests,
          wishes,
          avoid_notes: avoid,
        },
      }),
    onSuccess: (req) => {
      queryClient.invalidateQueries({ queryKey: ['tour-requests'] })
      router.replace(`/requests/${req.id}`)
    },
  })

  if (!local) return <Loading />
  if (!hasRole('TRAVELER')) return <Screen><Notice title={t('request.need_traveler_role')} /></Screen>
  const maxGroup = meta?.max_group_size ?? 3

  return (
    <Screen>
      <H1>{t('request.title', { name: local.name })}</H1>
      <Text style={styles.hint}>{t('request.subtitle')}</Text>
      {user && !canBook(user) && (
        <Notice title={t('request.verify_first')}>
          <Button small title={t('request.verify_now')} onPress={() => router.push('/verify')} />
        </Notice>
      )}
      {user && canBook(user) && missingContacts(user).map((kind) => (
        <Notice key={kind} title={t(`request.missing_${kind}`)}>
          <Button small variant="secondary" title={t('request.verify_now')} onPress={() => router.push('/verify')} />
        </Notice>
      ))}
      <Field label={t('request.service')} hint={t('request.service_hint')}>
        <View style={styles.wrap}>
          <Chip label={t('request.custom_experience')} selected={service === null} onPress={() => setService(null)} />
          {local.services?.map((s) => (
            <Chip key={s.id} label={`${s.title} · ${money(s.price, s.currency)}`} selected={service === s.id} onPress={() => setService(s.id)} />
          ))}
        </View>
      </Field>
      <Field label={t('request.start')}>
        <DateTimeField value={start} onChange={(d) => { setStart(d); if (end <= d) setEnd(new Date(d.getTime() + 3 * 3600_000)) }} />
      </Field>
      <Field label={t('request.end')}>
        <DateTimeField value={end} onChange={setEnd} />
      </Field>
      <Field label={t('request.group_size')} hint={t('request.group_hint', { max: maxGroup })}>
        <View style={styles.wrap}>
          {Array.from({ length: maxGroup }, (_, i) => i + 1).map((n) => (
            <Chip key={n} label={String(n)} selected={groupSize === n} onPress={() => setGroupSize(n)} />
          ))}
        </View>
      </Field>
      <Field label={t('request.budget_max')} hint={t('request.local_range', { range: priceRange(local.local!.price_min, local.local!.price_max, local.local!.currency) })}>
        <Input value={budgetMax} onChangeText={setBudgetMax} keyboardType="number-pad" />
      </Field>
      <Field label={t('request.interests')}>
        <View style={styles.wrap}>
          {meta?.interests.map((i) => (
            <Chip
              key={i.slug}
              label={localName(i)}
              selected={interests.includes(i.slug)}
              onPress={() => setInterests((cur) => (cur.includes(i.slug) ? cur.filter((s) => s !== i.slug) : [...cur, i.slug]))}
            />
          ))}
        </View>
      </Field>
      <Field label={t('request.wishes')}>
        <Input multiline value={wishes} onChangeText={setWishes} placeholder={t('request.wishes_placeholder')} />
      </Field>
      <Field label={t('request.avoid')} hint={t('request.avoid_hint')}>
        <Input multiline value={avoid} onChangeText={setAvoid} placeholder={t('request.avoid_placeholder')} />
      </Field>
      <Notice tone="blue">{t('request.next_steps')}</Notice>
      <ErrorText error={mutation.error} />
      <Button title={t('request.send')} onPress={() => mutation.mutate()} loading={mutation.isPending} />
    </Screen>
  )
}
