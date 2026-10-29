import { useEffect, useState } from 'react'
import { Pressable, Switch, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../auth/AuthContext'
import { PhotoStrip } from '../components/photos'
import { Avatar, Badge, Button, Card, Chip, colors, ErrorText, Field, H2, Input, Loading, Notice, Screen, styles, Text } from '../components/ui'
import { api } from '../lib/api'
import { pickImages } from '../lib/images'
import { localName } from '../lib/format'
import { useMeta } from '../lib/queries'
import type { MyProfile, Photo } from '../lib/types'

const TRAVEL_STYLES = ['RELAXED', 'ADVENTUROUS', 'CULTURAL', 'FOODIE', 'BUDGET', 'COMFORT']

export default function ProfileEditScreen() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const { data: meta } = useMeta()
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useQuery({ queryKey: ['profile', 'me'], queryFn: () => api<MyProfile>('/profile/me/') })

  const [general, setGeneral] = useState({ display_name: '', bio: '', city: '', location_name: '' })
  const [languages, setLanguages] = useState<string[]>([])
  const [interests, setInterests] = useState<string[]>([])
  const [traveler, setTraveler] = useState({ travel_style: '', wishes: '', avoid_notes: '' })
  const [local, setLocal] = useState({ experience_summary: '', areas_description: '', support_skills: '', price_min: '', price_max: '', pricing_note: '', is_accepting_requests: true })

  useEffect(() => {
    if (!profile) return
    setGeneral({ display_name: profile.display_name, bio: profile.bio, city: profile.city?.slug ?? '', location_name: profile.location_name })
    setLanguages(profile.languages.map((l) => l.code))
    setInterests(profile.interests.map((i) => i.slug))
    if (profile.traveler) setTraveler({ travel_style: profile.traveler.travel_style, wishes: profile.traveler.wishes, avoid_notes: profile.traveler.avoid_notes })
    if (profile.local) {
      const l = profile.local
      setLocal({
        experience_summary: l.experience_summary,
        areas_description: l.areas_description,
        support_skills: l.support_skills,
        price_min: l.price_min?.toString() ?? '',
        price_max: l.price_max?.toString() ?? '',
        pricing_note: l.pricing_note,
        is_accepting_requests: l.is_accepting_requests,
      })
    }
  }, [profile])

  const save = useMutation({
    mutationFn: () => {
      const existing = new Map(profile?.languages.map((l) => [l.code, l.proficiency]))
      return api<MyProfile>('/profile/me/', {
        method: 'PATCH',
        body: {
          ...general,
          city: general.city || null,
          languages: languages.map((code) => ({ code, proficiency: existing.get(code) ?? 'CONVERSATIONAL' })),
          interests,
          ...(hasRole('TRAVELER') ? { traveler } : {}),
          ...(hasRole('LOCAL')
            ? { local: { ...local, price_min: local.price_min ? Number(local.price_min) : null, price_max: local.price_max ? Number(local.price_max) : null } }
            : {}),
        },
      })
    },
    onSuccess: (data) => queryClient.setQueryData(['profile', 'me'], data),
  })

  const avatar = useMutation({
    mutationFn: async () => {
      const [file] = await pickImages({ square: true, maxMb: meta?.image_upload.max_mb })
      if (!file) return null
      const form = new FormData()
      form.append('avatar', file)
      return api<MyProfile>('/profile/me/avatar/', { form })
    },
    onSuccess: (data) => data && queryClient.setQueryData(['profile', 'me'], data),
  })

  if (isLoading || !profile) return <Loading />
  const toggle = (list: string[], set: (v: string[]) => void, value: string) => set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Avatar src={profile.avatar} name={profile.public_name} size={88} />
        <Button small variant="secondary" title={t('photos.upload_avatar')} onPress={() => avatar.mutate()} loading={avatar.isPending} />
        <ErrorText error={avatar.error} />
      </View>
      <Field label={t('profile.display_name')} hint={t('profile.display_name_hint', { name: profile.full_name })}>
        <Input value={general.display_name} onChangeText={(v) => setGeneral({ ...general, display_name: v })} />
      </Field>
      <Field label={t('profile.bio')} hint={t('profile.bio_hint')}>
        <Input multiline value={general.bio} onChangeText={(v) => setGeneral({ ...general, bio: v })} />
      </Field>
      <Field label={t('profile.city')}>
        <View style={styles.wrap}>
          {meta?.cities.map((c) => <Chip key={c.slug} label={localName(c)} selected={general.city === c.slug} onPress={() => setGeneral({ ...general, city: c.slug })} />)}
        </View>
      </Field>
      <Field label={t('profile.location_name')} hint={t('profile.location_hint')}>
        <Input value={general.location_name} onChangeText={(v) => setGeneral({ ...general, location_name: v })} />
      </Field>
      <Field label={t('profile.languages')}>
        <View style={styles.wrap}>
          {meta?.languages.map((l) => <Chip key={l.code} label={localName(l)} selected={languages.includes(l.code)} onPress={() => toggle(languages, setLanguages, l.code)} />)}
        </View>
      </Field>
      <Field label={t('profile.interests')}>
        <View style={styles.wrap}>
          {meta?.interests.map((i) => <Chip key={i.slug} label={localName(i)} selected={interests.includes(i.slug)} onPress={() => toggle(interests, setInterests, i.slug)} />)}
        </View>
      </Field>

      <PhotosCard profile={profile} maxMb={meta?.image_upload.max_mb} />

      {hasRole('TRAVELER') && (
        <Card>
          <H2>{t('profile.tabs.traveler')}</H2>
          <Field label={t('traveler.style')}>
            <View style={styles.wrap}>
              {TRAVEL_STYLES.map((s) => <Chip key={s} label={t(`travel_style.${s}`)} selected={traveler.travel_style === s} onPress={() => setTraveler({ ...traveler, travel_style: s })} />)}
            </View>
          </Field>
          <Field label={t('traveler.wishes')} hint={t('traveler.wishes_hint')}>
            <Input multiline value={traveler.wishes} onChangeText={(v) => setTraveler({ ...traveler, wishes: v })} />
          </Field>
          <Field label={t('traveler.avoid')} hint={t('traveler.avoid_hint')}>
            <Input multiline value={traveler.avoid_notes} onChangeText={(v) => setTraveler({ ...traveler, avoid_notes: v })} />
          </Field>
        </Card>
      )}

      {hasRole('LOCAL') && (
        <Card>
          <H2>{t('profile.tabs.local')}</H2>
          {!local.price_min && <Notice title={t('local_edit.pricing_required')}>{t('local_edit.pricing_required_body')}</Notice>}
          <Field label={t('local.experience')} hint={t('local_edit.experience_hint')}>
            <Input multiline value={local.experience_summary} onChangeText={(v) => setLocal({ ...local, experience_summary: v })} />
          </Field>
          <Field label={t('local.areas')} hint={t('local_edit.areas_hint')}>
            <Input value={local.areas_description} onChangeText={(v) => setLocal({ ...local, areas_description: v })} />
          </Field>
          <Field label={t('local.skills')} hint={t('local_edit.skills_hint')}>
            <Input multiline value={local.support_skills} onChangeText={(v) => setLocal({ ...local, support_skills: v })} />
          </Field>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Field label={t('local_edit.price_min')}>
                <Input keyboardType="number-pad" value={local.price_min} onChangeText={(v) => setLocal({ ...local, price_min: v })} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('local_edit.price_max')}>
                <Input keyboardType="number-pad" value={local.price_max} onChangeText={(v) => setLocal({ ...local, price_max: v })} />
              </Field>
            </View>
          </View>
          <Field label={t('local_edit.pricing_note')} hint={t('local_edit.pricing_note_hint')}>
            <Input value={local.pricing_note} onChangeText={(v) => setLocal({ ...local, pricing_note: v })} />
          </Field>
          <Pressable style={styles.rowBetween} onPress={() => setLocal({ ...local, is_accepting_requests: !local.is_accepting_requests })}>
            <Text style={styles.body}>{t('local_edit.accepting')}</Text>
            <Switch value={local.is_accepting_requests} onValueChange={(v) => setLocal({ ...local, is_accepting_requests: v })} />
          </Pressable>
        </Card>
      )}

      <ErrorText error={save.error} />
      {save.isSuccess && <Notice tone="green">{t('common.saved')}</Notice>}
      <Button title={t('common.save')} onPress={() => save.mutate()} loading={save.isPending} />
    </Screen>
  )
}

const MAX_GALLERY_PHOTOS = 12

function PhotosCard({ profile, maxMb }: { profile: MyProfile; maxMb?: number }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [caption, setCaption] = useState('')
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['profile', 'me'] })
  const remaining = MAX_GALLERY_PHOTOS - profile.photos.length
  const hidden = new Set(profile.photos.filter((p) => p.status === 'HIDDEN').map((p) => p.id))

  const upload = useMutation({
    mutationFn: async () => {
      const files = await pickImages({ multiple: true, limit: remaining, maxMb })
      // One at a time, so a failure keeps the photos already uploaded.
      for (const file of files) {
        const form = new FormData()
        form.append('image', file)
        form.append('caption', caption)
        await api<Photo>('/profile/me/photos/', { form })
      }
      return files.length
    },
    onSuccess: (count) => {
      if (count) setCaption('')
    },
    onSettled: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => api(`/profile/me/photos/${id}/`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  return (
    <Card>
      <View style={styles.rowBetween}>
        <H2>{t('photos.gallery')}</H2>
        <Text style={styles.hint}>{profile.photos.length}/{MAX_GALLERY_PHOTOS}</Text>
      </View>
      <Text style={styles.hint}>{t('photos.gallery_hint')}</Text>
      {profile.photos.length > 0 ? (
        <PhotoStrip
          photos={profile.photos}
          size={110}
          overlay={(p) => (
            <>
              {hidden.has(p.id) && (
                <View style={{ position: 'absolute', left: 6, bottom: 6 }} pointerEvents="none">
                  <Badge tone="red" label={t('photos.hidden')} />
                </View>
              )}
              <Pressable
                onPress={() => remove.mutate(p.id)}
                disabled={remove.isPending}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common.remove')}
                style={{ position: 'absolute', top: -6, right: -6, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.red, fontSize: 12 }}>✕</Text>
              </Pressable>
            </>
          )}
        />
      ) : (
        <Text style={[styles.hint, { textAlign: 'center', paddingVertical: 12 }]}>{t('photos.empty')}</Text>
      )}
      {remaining > 0 ? (
        <>
          <Input placeholder={t('photos.caption')} value={caption} onChangeText={setCaption} />
          <Button
            variant="secondary"
            title={upload.isPending ? t('photos.uploading') : t('photos.add')}
            onPress={() => upload.mutate()}
            loading={upload.isPending}
          />
        </>
      ) : (
        <Text style={styles.hint}>{t('photos.limit_reached', { count: MAX_GALLERY_PHOTOS })}</Text>
      )}
      <ErrorText error={upload.error ?? remove.error} />
    </Card>
  )
}
