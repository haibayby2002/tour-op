import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import DateTimeField from '../../components/DateTimeField'
import { Button, Card, Chip, ErrorText, Field, Input, Notice, Screen, styles, Text } from '../../components/ui'
import { api } from '../../lib/api'
import { localName } from '../../lib/format'
import { useMeta } from '../../lib/queries'
import type { MyProfile, TripWish } from '../../lib/types'

function defaultStart() {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  d.setHours(9, 0, 0, 0)
  return d
}

export default function NewWishScreen() {
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ city?: string }>()
  const { data: meta } = useMeta()
  const queryClient = useQueryClient()
  const { data: me } = useQuery({ queryKey: ['profile', 'me'], queryFn: () => api<MyProfile>('/profile/me/') })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [city, setCity] = useState(params.city ?? '')
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(() => new Date(defaultStart().getTime() + 4 * 3600_000))
  const [groupSize, setGroupSize] = useState(1)
  const [budgetMax, setBudgetMax] = useState('')
  const [interests, setInterests] = useState<string[] | null>(null)
  const [avoid, setAvoid] = useState<string | null>(null)
  const [language, setLanguage] = useState('')
  const [category, setCategory] = useState('')
  const [minRating, setMinRating] = useState('')
  const [onlyChecked, setOnlyChecked] = useState(false)
  const selected = interests ?? me?.interests.map((i) => i.slug) ?? []
  const avoidNotes = avoid ?? me?.traveler?.avoid_notes ?? ''

  const mutation = useMutation({
    mutationFn: () =>
      api<TripWish>('/trip-wishes/', {
        body: {
          title,
          description,
          city,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          group_size: groupSize,
          budget_max: budgetMax ? Number(budgetMax) : null,
          interests: selected,
          avoid_notes: avoidNotes,
          language: language || null,
          category: category || null,
          min_rating: minRating || null,
          require_manually_checked: onlyChecked,
        },
      }),
    onSuccess: (wish) => {
      queryClient.invalidateQueries({ queryKey: ['trip-wishes'] })
      router.replace(`/wishes/${wish.id}`)
    },
  })

  const toggle = (slug: string) => setInterests(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug])

  return (
    <Screen>
      <Text style={styles.hint}>{t('wishes.new_subtitle')}</Text>
      <Field label={t('wishes.title_field')}>
        <Input value={title} onChangeText={setTitle} maxLength={120} placeholder={t('wishes.title_placeholder')} />
      </Field>
      <Field label={t('wishes.description')} hint={t('wishes.description_hint')}>
        <Input multiline value={description} onChangeText={setDescription} placeholder={t('request.wishes_placeholder')} />
      </Field>
      <Field label={t('request.city')}>
        <View style={styles.wrap}>
          {meta?.cities.map((c) => <Chip key={c.slug} label={localName(c)} selected={city === c.slug} onPress={() => setCity(c.slug)} />)}
        </View>
      </Field>
      <Field label={t('request.start')}>
        <DateTimeField value={start} onChange={(d) => { setStart(d); if (end <= d) setEnd(new Date(d.getTime() + 4 * 3600_000)) }} />
      </Field>
      <Field label={t('request.end')}>
        <DateTimeField value={end} onChange={setEnd} />
      </Field>
      <Field label={t('request.group_size')}>
        <View style={styles.wrap}>
          {Array.from({ length: meta?.max_group_size ?? 3 }, (_, i) => i + 1).map((n) => (
            <Chip key={n} label={String(n)} selected={groupSize === n} onPress={() => setGroupSize(n)} />
          ))}
        </View>
      </Field>
      <Field label={t('request.budget_max')} hint={t('wishes.budget_hint')}>
        <Input value={budgetMax} onChangeText={setBudgetMax} keyboardType="number-pad" />
      </Field>
      <Field label={t('request.interests')}>
        <View style={styles.wrap}>
          {meta?.interests.map((i) => <Chip key={i.slug} label={localName(i)} selected={selected.includes(i.slug)} onPress={() => toggle(i.slug)} />)}
        </View>
      </Field>
      <Field label={t('request.avoid')} hint={t('request.avoid_hint')}>
        <Input multiline value={avoidNotes} onChangeText={setAvoid} placeholder={t('request.avoid_placeholder')} />
      </Field>

      <Card>
        <Text style={{ fontWeight: '600' }}>{t('wishes.requirements')}</Text>
        <Text style={styles.hint}>{t('wishes.requirements_hint')}</Text>
        <Field label={t('wishes.must_speak')}>
          <View style={styles.wrap}>
            <Chip label={t('wishes.any')} selected={!language} onPress={() => setLanguage('')} />
            {meta?.languages.map((l) => <Chip key={l.code} label={localName(l)} selected={language === l.code} onPress={() => setLanguage(l.code)} />)}
          </View>
        </Field>
        <Field label={t('wishes.must_offer')}>
          <View style={styles.wrap}>
            <Chip label={t('wishes.any')} selected={!category} onPress={() => setCategory('')} />
            {meta?.service_categories.map((c) => <Chip key={c.slug} label={localName(c)} selected={category === c.slug} onPress={() => setCategory(c.slug)} />)}
          </View>
        </Field>
        <Field label={t('wishes.min_rating')} hint={t('wishes.rating_note')}>
          <View style={styles.wrap}>
            {['', '4.0', '4.5', '4.8'].map((r) => <Chip key={r || 'any'} label={r ? `${r}★+` : t('wishes.any')} selected={minRating === r} onPress={() => setMinRating(r)} />)}
          </View>
        </Field>
        <Pressable onPress={() => setOnlyChecked((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: onlyChecked }}>
          <Text style={styles.body}>{onlyChecked ? '☑' : '☐'} {t('wishes.only_checked')}</Text>
        </Pressable>
      </Card>

      <Notice tone="blue">{t('wishes.how_it_works')}</Notice>
      <ErrorText error={mutation.error} />
      <Button
        title={t('wishes.post')}
        onPress={() => mutation.mutate()}
        loading={mutation.isPending}
        disabled={!title.trim() || !description.trim() || !city}
      />
    </Screen>
  )
}
