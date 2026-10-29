import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { ImageUploadButton, PhotoGrid } from '../components/photos'
import ServicesManager from '../components/ServicesManager'
import { CompletionMeter } from '../components/trust'
import { Alert, Avatar, Badge, cx, ErrorText, Field, PageHeader, PageLoader, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { dateTime, fromLocalInput, localName } from '../lib/format'
import { keys, useMeta } from '../lib/queries'
import type { Availability, ExternalReview, MyProfile, Photo, UserLanguage } from '../lib/types'

type Tab = 'general' | 'traveler' | 'local' | 'photos' | 'services' | 'availability' | 'external'

function useMyProfile() {
  return useQuery({ queryKey: keys.myProfile, queryFn: () => api<MyProfile>('/profile/me/') })
}

function useSaveProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<MyProfile>('/profile/me/', { method: 'PATCH', body }),
    onSuccess: (data) => queryClient.setQueryData(keys.myProfile, data),
  })
}

function Saved({ show }: { show: boolean }) {
  const { t } = useTranslation()
  return show ? <span className="text-sm text-emerald-700">✓ {t('common.saved')}</span> : null
}

export default function ProfileEditPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [params, setParams] = useSearchParams()
  const { data: profile, isLoading, error } = useMyProfile()
  const tab = (params.get('tab') as Tab) || 'general'
  const setTab = (value: Tab) => setParams({ tab: value }, { replace: true })

  if (isLoading) return <PageLoader />
  if (error || !profile) return <ErrorText error={error} />

  const tabs: { value: Tab; label: string }[] = [{ value: 'general', label: t('profile.tabs.general') }]
  if (hasRole('TRAVELER')) tabs.push({ value: 'traveler', label: t('profile.tabs.traveler') })
  if (hasRole('LOCAL')) tabs.push({ value: 'local', label: t('profile.tabs.local') })
  tabs.push({ value: 'photos', label: t('profile.tabs.photos') })
  if (hasRole('LOCAL')) {
    tabs.push({ value: 'services', label: t('profile.tabs.services') })
    tabs.push({ value: 'availability', label: t('profile.tabs.availability') })
    tabs.push({ value: 'external', label: t('profile.tabs.external') })
  }

  return (
    <div>
      <PageHeader
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
        actions={
          <>
            {hasRole('LOCAL') && <Link to={`/locals/${profile.user_id}`} className="btn-secondary btn-sm">{t('profile.view_public_local')}</Link>}
            {hasRole('TRAVELER') && <Link to={`/travelers/${profile.user_id}`} className="btn-secondary btn-sm">{t('profile.view_public_traveler')}</Link>}
          </>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Tabs value={tab} onChange={setTab} tabs={tabs} />
          {tab === 'general' && <GeneralTab profile={profile} />}
          {tab === 'traveler' && <TravelerTab profile={profile} />}
          {tab === 'local' && <LocalTab profile={profile} />}
          {tab === 'photos' && <PhotosTab profile={profile} />}
          {tab === 'services' && <ServicesManager />}
          {tab === 'availability' && <AvailabilityTab />}
          {tab === 'external' && <ExternalReviewsTab />}
        </div>
        <aside className="space-y-4">
          {profile.completion.local && <CompletionMeter report={profile.completion.local} role="local" />}
          {profile.completion.traveler && <CompletionMeter report={profile.completion.traveler} role="traveler" />}
          <p className="text-xs text-stone-500">🔒 {t('profile.privacy_note')}</p>
        </aside>
      </div>
    </div>
  )
}

function GeneralTab({ profile }: { profile: MyProfile }) {
  const { t } = useTranslation()
  const { data: meta } = useMeta()
  const save = useSaveProfile()
  const [languages, setLanguages] = useState<Pick<UserLanguage, 'code' | 'proficiency'>[]>(profile.languages)
  const [interests, setInterests] = useState<string[]>(profile.interests.map((i) => i.slug))
  const { register, handleSubmit } = useForm({
    defaultValues: {
      display_name: profile.display_name,
      bio: profile.bio,
      city: profile.city?.slug ?? '',
      location_name: profile.location_name,
      visibility: profile.visibility,
    },
  })

  return (
    <form
      className="card space-y-5 p-6"
      onSubmit={handleSubmit((v) => save.mutate({ ...v, city: v.city || null, languages, interests }))}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('profile.display_name')} hint={t('profile.display_name_hint', { name: profile.full_name })} htmlFor="p-dn">
          <input id="p-dn" className="input" {...register('display_name')} />
        </Field>
        <Field label={t('profile.city')} htmlFor="p-city">
          <select id="p-city" className="input" {...register('city')}>
            <option value="">—</option>
            {meta?.cities.map((c) => <option key={c.slug} value={c.slug}>{localName(c)}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t('profile.bio')} hint={t('profile.bio_hint')} htmlFor="p-bio">
        <textarea id="p-bio" className="input min-h-32" {...register('bio')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('profile.location_name')} hint={t('profile.location_hint')} htmlFor="p-loc">
          <input id="p-loc" className="input" {...register('location_name')} />
        </Field>
        <Field label={t('profile.visibility')} htmlFor="p-vis">
          <select id="p-vis" className="input" {...register('visibility')}>
            <option value="PUBLIC">{t('profile.visibility_public')}</option>
            <option value="MEMBERS">{t('profile.visibility_members')}</option>
          </select>
        </Field>
      </div>

      <div>
        <span className="label">{t('profile.languages')}</span>
        <div className="space-y-2">
          {languages.map((l, i) => (
            <div key={l.code} className="flex gap-2">
              <span className="input flex-1 bg-stone-50">{localName(meta?.languages.find((x) => x.code === l.code))}</span>
              <select
                className="input w-44"
                value={l.proficiency}
                onChange={(e) => setLanguages((cur) => cur.map((x, j) => (j === i ? { ...x, proficiency: e.target.value as UserLanguage['proficiency'] } : x)))}
              >
                {(['BASIC', 'CONVERSATIONAL', 'FLUENT', 'NATIVE'] as const).map((p) => <option key={p} value={p}>{t(`proficiency.${p}`)}</option>)}
              </select>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setLanguages((cur) => cur.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <select
            className="input"
            value=""
            onChange={(e) => e.target.value && setLanguages((cur) => [...cur, { code: e.target.value, proficiency: 'CONVERSATIONAL' }])}
          >
            <option value="">+ {t('profile.add_language')}</option>
            {meta?.languages.filter((l) => !languages.some((x) => x.code === l.code)).map((l) => <option key={l.code} value={l.code}>{localName(l)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <span className="label">{t('profile.interests')}</span>
        <div className="flex flex-wrap gap-1.5">
          {meta?.interests.map((i) => (
            <button
              type="button"
              key={i.slug}
              onClick={() => setInterests((cur) => (cur.includes(i.slug) ? cur.filter((s) => s !== i.slug) : [...cur, i.slug]))}
              className={cx('chip border', interests.includes(i.slug) ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-200 text-stone-600')}
            >
              {localName(i)}
            </button>
          ))}
        </div>
      </div>
      <ErrorText error={save.error} />
      <div className="flex items-center justify-end gap-3">
        <Saved show={save.isSuccess} />
        <button className="btn-primary" disabled={save.isPending}>{t('common.save')}</button>
      </div>
    </form>
  )
}

function TravelerTab({ profile }: { profile: MyProfile }) {
  const { t } = useTranslation()
  const save = useSaveProfile()
  const { register, handleSubmit } = useForm({ defaultValues: profile.traveler ?? {} })
  return (
    <form className="card space-y-5 p-6" onSubmit={handleSubmit((v) => save.mutate({ traveler: v }))}>
      <Field label={t('traveler.style')} htmlFor="t-style">
        <select id="t-style" className="input" {...register('travel_style')}>
          <option value="">—</option>
          {['RELAXED', 'ADVENTUROUS', 'CULTURAL', 'FOODIE', 'BUDGET', 'COMFORT'].map((s) => <option key={s} value={s}>{t(`travel_style.${s}`)}</option>)}
        </select>
      </Field>
      <Field label={t('traveler.wishes')} hint={t('traveler.wishes_hint')} htmlFor="t-wishes">
        <textarea id="t-wishes" className="input min-h-24" {...register('wishes')} />
      </Field>
      <Field label={t('traveler.avoid')} hint={t('traveler.avoid_hint')} htmlFor="t-avoid">
        <textarea id="t-avoid" className="input min-h-20" {...register('avoid_notes')} />
      </Field>
      <Field label={t('traveler.visibility')} htmlFor="t-vis">
        <select id="t-vis" className="input" {...register('visibility')}>
          <option value="REQUEST_ONLY">{t('traveler.visibility_request_only')}</option>
          <option value="PUBLIC">{t('traveler.visibility_public')}</option>
        </select>
      </Field>
      <ErrorText error={save.error} />
      <div className="flex items-center justify-end gap-3">
        <Saved show={save.isSuccess} />
        <button className="btn-primary" disabled={save.isPending}>{t('common.save')}</button>
      </div>
    </form>
  )
}

function LocalTab({ profile }: { profile: MyProfile }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const save = useSaveProfile()
  const local = profile.local!
  const { register, handleSubmit } = useForm({
    defaultValues: { ...local, price_min: local.price_min ?? '', price_max: local.price_max ?? '' },
  })
  const submitReview = useMutation({
    mutationFn: () => api('/profile/me/submit-review/', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.myProfile }),
  })
  const num = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v))

  return (
    <div className="space-y-4">
      {!local.price_min && <Alert title={t('local_edit.pricing_required')}>{t('local_edit.pricing_required_body')}</Alert>}
      <form
        className="card space-y-5 p-6"
        onSubmit={handleSubmit((v) =>
          save.mutate({
            local: {
              experience_summary: v.experience_summary,
              areas_description: v.areas_description,
              support_skills: v.support_skills,
              price_min: num(v.price_min),
              price_max: num(v.price_max),
              currency: v.currency || 'VND',
              pricing_note: v.pricing_note,
              is_accepting_requests: v.is_accepting_requests,
            },
          }),
        )}
      >
        <Field label={t('local.experience')} hint={t('local_edit.experience_hint')} htmlFor="l-exp">
          <textarea id="l-exp" className="input min-h-28" {...register('experience_summary')} />
        </Field>
        <Field label={t('local.areas')} hint={t('local_edit.areas_hint')} htmlFor="l-areas">
          <input id="l-areas" className="input" {...register('areas_description')} />
        </Field>
        <Field label={t('local.skills')} hint={t('local_edit.skills_hint')} htmlFor="l-skills">
          <textarea id="l-skills" className="input" {...register('support_skills')} />
        </Field>
        <p className="text-sm text-stone-600">{t('local_edit.price_hint')}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('local_edit.price_min')} htmlFor="l-pmin">
            <input id="l-pmin" type="number" min={0} step={10000} className="input" {...register('price_min')} />
          </Field>
          <Field label={t('local_edit.price_max')} htmlFor="l-pmax">
            <input id="l-pmax" type="number" min={0} step={10000} className="input" {...register('price_max')} />
          </Field>
          <Field label={t('local_edit.currency')} htmlFor="l-cur">
            <select id="l-cur" className="input" {...register('currency')}>
              {['VND', 'USD', 'EUR'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t('local_edit.pricing_note')} hint={t('local_edit.pricing_note_hint')} htmlFor="l-pnote">
          <input id="l-pnote" className="input" {...register('pricing_note')} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_accepting_requests')} />
          {t('local_edit.accepting')}
        </label>
        <ErrorText error={save.error} />
        <div className="flex items-center justify-end gap-3">
          <Saved show={save.isSuccess} />
          <button className="btn-primary" disabled={save.isPending}>{t('common.save')}</button>
        </div>
      </form>
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="font-semibold">{t('local_edit.manual_check')}</p>
          <p className="text-sm text-stone-500">{t('local_edit.manual_check_body')}</p>
        </div>
        {local.review_status === 'MANUALLY_CHECKED' ? (
          <Badge tone="green">✔ {t('trust.manually_checked')}</Badge>
        ) : local.review_status === 'PENDING' ? (
          <Badge tone="amber">{t('local_edit.review_pending')}</Badge>
        ) : (
          <button className="btn-secondary btn-sm" onClick={() => submitReview.mutate()} disabled={submitReview.isPending}>
            {t('local_edit.request_check')}
          </button>
        )}
      </div>
    </div>
  )
}

const MAX_GALLERY_PHOTOS = 12

function PhotosTab({ profile }: { profile: MyProfile }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [caption, setCaption] = useState('')
  const [avatarPickError, setAvatarPickError] = useState<unknown>(null)
  const [galleryPickError, setGalleryPickError] = useState<unknown>(null)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: keys.myProfile })
  const setProfile = (data: MyProfile) => queryClient.setQueryData(keys.myProfile, data)

  const avatar = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('avatar', file)
      return api<MyProfile>('/profile/me/avatar/', { form })
    },
    onSuccess: setProfile,
  })
  const removeAvatar = useMutation({
    mutationFn: () => api<MyProfile>('/profile/me/avatar/', { method: 'DELETE' }),
    onSuccess: setProfile,
  })
  const upload = useMutation({
    // One at a time, so a partial failure keeps the photos already uploaded.
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const form = new FormData()
        form.append('image', file)
        form.append('caption', caption)
        await api<Photo>('/profile/me/photos/', { form })
      }
    },
    onSuccess: () => setCaption(''),
    onSettled: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => api(`/profile/me/photos/${id}/`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
  const hidden = new Set(profile.photos.filter((p) => p.status === 'HIDDEN').map((p) => p.id))
  const remaining = MAX_GALLERY_PHOTOS - profile.photos.length

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-5 p-6">
        <Avatar src={profile.avatar} name={profile.public_name} size="xl" />
        <div className="space-y-2">
          <p className="font-semibold">{t('photos.avatar')}</p>
          <p className="text-sm text-stone-500">{t('photos.avatar_hint')}</p>
          <div className="flex flex-wrap gap-2">
            <ImageUploadButton pending={avatar.isPending} onFiles={([file]) => avatar.mutateAsync(file)} onError={setAvatarPickError}>
              {t('photos.upload_avatar')}
            </ImageUploadButton>
            {profile.avatar && (
              <button className="btn-ghost btn-sm text-red-600" onClick={() => removeAvatar.mutate()} disabled={removeAvatar.isPending}>
                {t('common.remove')}
              </button>
            )}
          </div>
          <ErrorText error={avatarPickError ?? avatar.error ?? removeAvatar.error} />
        </div>
      </div>
      <div className="card space-y-4 p-6">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold">{t('photos.gallery')}</p>
          <span className="text-xs text-stone-500">{profile.photos.length}/{MAX_GALLERY_PHOTOS}</span>
        </div>
        <p className="text-sm text-stone-500">{t('photos.gallery_hint')}</p>
        {profile.photos.length > 0 ? (
          <PhotoGrid
            photos={profile.photos}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            overlay={(p) => (
              <>
                {hidden.has(p.id) && (
                  <span className="pointer-events-none absolute top-2 left-2"><Badge tone="red">{t('photos.hidden')}</Badge></span>
                )}
                <button
                  className="absolute top-2 right-2 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-medium text-red-600 shadow hover:bg-surface"
                  onClick={() => remove.mutate(p.id)}
                  disabled={remove.isPending}
                >
                  {t('common.remove')}
                </button>
              </>
            )}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">{t('photos.empty')}</p>
        )}
        {remaining > 0 ? (
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1" placeholder={t('photos.caption')} value={caption} onChange={(e) => setCaption(e.target.value)} />
            <ImageUploadButton
              multiple
              className="btn-primary"
              pending={upload.isPending}
              onFiles={(files) => upload.mutateAsync(files.slice(0, remaining))}
              onError={setGalleryPickError}
            >
              {upload.isPending ? t('photos.uploading') : t('photos.add')}
            </ImageUploadButton>
          </div>
        ) : (
          <p className="text-sm text-stone-500">{t('photos.limit_reached', { count: MAX_GALLERY_PHOTOS })}</p>
        )}
        <ErrorText error={galleryPickError ?? upload.error ?? remove.error} />
      </div>
    </div>
  )
}

function AvailabilityTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const queryKey = ['profile', 'me', 'availability']
  const { data = [] } = useQuery({ queryKey, queryFn: () => api<Availability[]>('/profile/me/availability/') })
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const invalidate = () => queryClient.invalidateQueries({ queryKey })
  const add = useMutation({
    mutationFn: () => api('/profile/me/availability/', { body: { start_at: fromLocalInput(start), end_at: fromLocalInput(end) } }),
    onSuccess: () => {
      setStart('')
      setEnd('')
      invalidate()
    },
  })
  const remove = useMutation({ mutationFn: (id: number) => api(`/profile/me/availability/${id}/`, { method: 'DELETE' }), onSuccess: invalidate })

  return (
    <div className="card space-y-4 p-6">
      <p className="text-sm text-stone-500">{t('availability.hint')}</p>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          add.mutate()
        }}
      >
        <input type="datetime-local" className="input" required value={start} onChange={(e) => setStart(e.target.value)} aria-label={t('request.start')} />
        <input type="datetime-local" className="input" required value={end} onChange={(e) => setEnd(e.target.value)} aria-label={t('request.end')} />
        <button className="btn-primary" disabled={add.isPending}>{t('availability.add')}</button>
      </form>
      <ErrorText error={add.error} />
      {data.length === 0 ? (
        <p className="text-sm text-stone-500">{t('availability.none')}</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {data.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2 text-sm">
              <span>{dateTime(a.start_at)} → {dateTime(a.end_at)}</span>
              <button className="text-xs text-red-600" onClick={() => remove.mutate(a.id)}>{t('common.remove')}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ExternalReviewsTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const queryKey = ['profile', 'me', 'external']
  const { data = [] } = useQuery({ queryKey, queryFn: () => api<ExternalReview[]>('/profile/me/external-reviews/') })
  const { register, handleSubmit, reset } = useForm<{ platform: string; url: string; rating_text: string; note: string; screenshot: FileList }>()
  const invalidate = () => queryClient.invalidateQueries({ queryKey })
  const add = useMutation({
    mutationFn: (v: { platform: string; url: string; rating_text: string; note: string; screenshot: FileList }) => {
      const form = new FormData()
      form.append('platform', v.platform)
      form.append('url', v.url)
      form.append('rating_text', v.rating_text)
      form.append('note', v.note)
      if (v.screenshot?.[0]) form.append('screenshot', v.screenshot[0])
      return api('/profile/me/external-reviews/', { form })
    },
    onSuccess: () => {
      reset()
      invalidate()
    },
  })
  const remove = useMutation({ mutationFn: (id: number) => api(`/profile/me/external-reviews/${id}/`, { method: 'DELETE' }), onSuccess: invalidate })
  useEffect(() => reset({ platform: 'GOOGLE' }), [reset])

  return (
    <div className="space-y-4">
      <Alert tone="blue">{t('external.hint')}</Alert>
      <form className="card space-y-4 p-6" onSubmit={handleSubmit((v) => add.mutate(v))}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('external.platform')} htmlFor="e-pl">
            <select id="e-pl" className="input" {...register('platform')}>
              {['GOOGLE', 'TRIPADVISOR', 'AIRBNB', 'FACEBOOK', 'KLOOK', 'OTHER'].map((p) => <option key={p} value={p}>{t(`platform.${p}`)}</option>)}
            </select>
          </Field>
          <Field label={t('external.rating_text')} htmlFor="e-rt">
            <input id="e-rt" className="input" placeholder="4.8/5 (120)" {...register('rating_text')} />
          </Field>
        </div>
        <Field label={t('external.url')} htmlFor="e-url">
          <input id="e-url" type="url" className="input" placeholder="https://" {...register('url')} />
        </Field>
        <Field label={t('external.screenshot')} htmlFor="e-ss">
          <input id="e-ss" type="file" accept="image/*" className="block text-sm" {...register('screenshot')} />
        </Field>
        <Field label={t('external.note')} htmlFor="e-note">
          <input id="e-note" className="input" {...register('note')} />
        </Field>
        <ErrorText error={add.error} />
        <div className="flex justify-end"><button className="btn-primary" disabled={add.isPending}>{t('external.add')}</button></div>
      </form>
      <ul className="space-y-2">
        {data.map((r) => (
          <li key={r.id} className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
            <span>
              <span className="font-semibold">{t(`platform.${r.platform}`)}</span> {r.rating_text && `· ${r.rating_text}`}
              {r.url && <span className="block truncate text-xs text-stone-500">{r.url}</span>}
            </span>
            <span className="flex items-center gap-2">
              <Badge tone={r.status === 'VERIFIED' ? 'green' : r.status === 'REJECTED' ? 'red' : 'amber'}>{t(`external.status.${r.status}`)}</Badge>
              <button className="text-xs text-red-600" onClick={() => remove.mutate(r.id)}>{t('common.remove')}</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
