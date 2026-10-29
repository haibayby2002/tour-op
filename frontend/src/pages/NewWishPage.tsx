import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Alert, cx, ErrorText, Field } from '../components/ui'
import { api } from '../lib/api'
import { fromLocalInput, localName, toLocalInput } from '../lib/format'
import { keys, useMeta } from '../lib/queries'
import type { MyProfile, TripWish } from '../lib/types'
import { canBook, missingContacts } from '../lib/verification'

interface Values {
  title: string
  description: string
  city: string
  area: string
  start_at: string
  end_at: string
  group_size: number
  budget_max: string
  avoid_notes: string
  language: string
  category: string
  require_manually_checked: boolean
  min_rating: string
}

function defaultStart() {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  d.setHours(9, 0, 0, 0)
  return d
}

export default function NewWishPage() {
  const { t } = useTranslation()
  const { user, hasRole } = useAuth()
  const { data: meta } = useMeta()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const { data: me } = useQuery({ queryKey: keys.myProfile, queryFn: () => api<MyProfile>('/profile/me/') })
  const [interests, setInterests] = useState<string[] | null>(null)
  const selected = interests ?? me?.interests.map((i) => i.slug) ?? []

  const start = useMemo(defaultStart, [])
  const { register, handleSubmit, setValue, getValues } = useForm<Values>({
    defaultValues: {
      city: params.get('city') ?? '',
      start_at: toLocalInput(start),
      end_at: toLocalInput(new Date(start.getTime() + 4 * 3600_000)),
      group_size: 1,
      require_manually_checked: false,
      avoid_notes: me?.traveler?.avoid_notes ?? '',
    },
  })

  // Selects only accept a value once their options exist, so apply prefills after loading.
  useEffect(() => {
    const city = params.get('city')
    if (meta && city && meta.cities.some((c) => c.slug === city)) setValue('city', city)
  }, [meta, params, setValue])
  useEffect(() => {
    if (me?.traveler?.avoid_notes && !getValues('avoid_notes')) setValue('avoid_notes', me.traveler.avoid_notes)
  }, [me, getValues, setValue])

  const mutation = useMutation({
    mutationFn: (v: Values) =>
      api<TripWish>('/trip-wishes/', {
        body: {
          title: v.title,
          description: v.description,
          city: v.city,
          area: v.area,
          start_at: fromLocalInput(v.start_at),
          end_at: fromLocalInput(v.end_at),
          group_size: Number(v.group_size),
          budget_max: v.budget_max ? Number(v.budget_max) : null,
          interests: selected,
          avoid_notes: v.avoid_notes,
          language: v.language || null,
          category: v.category || null,
          require_manually_checked: v.require_manually_checked,
          min_rating: v.min_rating || null,
        },
      }),
    onSuccess: (wish) => {
      queryClient.invalidateQueries({ queryKey: ['trip-wishes'] })
      navigate(`/wishes/${wish.id}`, { replace: true })
    },
  })

  if (!hasRole('TRAVELER')) {
    return <Alert title={t('request.need_traveler_role')}><Link to="/account" className="link">{t('request.add_role')}</Link></Alert>
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">{t('wishes.new_title')}</h1>
      <p className="mt-1 text-sm text-stone-500">{t('wishes.new_subtitle')}</p>
      {user && !canBook(user) && (
        <div className="mt-4">
          <Alert title={t('request.verify_first')}>
            <Link to="/verify" className="link">{t('request.verify_now')}</Link>
          </Alert>
        </div>
      )}
      {user && canBook(user) && missingContacts(user).map((kind) => (
        <div key={kind} className="mt-4">
          <Alert tone="amber">
            {t(`request.missing_${kind}`)} <Link to="/verify" className="link">{t('request.verify_now')}</Link>
          </Alert>
        </div>
      ))}

      <form className="card mt-6 space-y-5 p-6" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <Field label={t('wishes.title_field')} htmlFor="w-title">
          <input id="w-title" className="input" required maxLength={120} placeholder={t('wishes.title_placeholder')} {...register('title')} />
        </Field>
        <Field label={t('wishes.description')} hint={t('wishes.description_hint')} htmlFor="w-desc">
          <textarea id="w-desc" className="input min-h-28" required placeholder={t('request.wishes_placeholder')} {...register('description')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('request.city')} htmlFor="w-city">
            <select id="w-city" className="input" required {...register('city')}>
              <option value="">{t('common.choose')}</option>
              {meta?.cities.map((c) => <option key={c.slug} value={c.slug}>{localName(c)}</option>)}
            </select>
          </Field>
          <Field label={t('request.area')} hint={t('request.area_hint')} htmlFor="w-area">
            <input id="w-area" className="input" {...register('area')} />
          </Field>
          <Field label={t('request.start')} htmlFor="w-start">
            <input id="w-start" type="datetime-local" className="input" required {...register('start_at')} />
          </Field>
          <Field label={t('request.end')} htmlFor="w-end">
            <input id="w-end" type="datetime-local" className="input" required {...register('end_at')} />
          </Field>
          <Field label={t('request.group_size')} hint={t('request.group_hint', { max: meta?.max_group_size ?? 3 })} htmlFor="w-gs">
            <select id="w-gs" className="input" {...register('group_size')}>
              {Array.from({ length: meta?.max_group_size ?? 3 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label={t('request.budget_max')} hint={t('wishes.budget_hint')} htmlFor="w-budget">
            <input id="w-budget" type="number" min={0} step={50000} className="input" {...register('budget_max')} />
          </Field>
        </div>
        <div>
          <span className="label">{t('request.interests')}</span>
          <div className="flex flex-wrap gap-1.5">
            {meta?.interests.map((i) => (
              <button
                type="button"
                key={i.slug}
                onClick={() => setInterests(selected.includes(i.slug) ? selected.filter((s) => s !== i.slug) : [...selected, i.slug])}
                className={cx('chip border', selected.includes(i.slug) ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-200 text-stone-600')}
              >
                {localName(i)}
              </button>
            ))}
          </div>
        </div>
        <Field label={t('request.avoid')} hint={t('request.avoid_hint')} htmlFor="w-avoid">
          <textarea id="w-avoid" className="input" placeholder={t('request.avoid_placeholder')} {...register('avoid_notes')} />
        </Field>

        <fieldset className="space-y-4 rounded-xl bg-stone-50 p-4">
          <legend className="px-1 text-sm font-semibold">{t('wishes.requirements')}</legend>
          <p className="text-xs text-stone-500">{t('wishes.requirements_hint')}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('wishes.must_speak')} htmlFor="w-lang">
              <select id="w-lang" className="input" {...register('language')}>
                <option value="">{t('wishes.any')}</option>
                {meta?.languages.map((l) => <option key={l.code} value={l.code}>{localName(l)}</option>)}
              </select>
            </Field>
            <Field label={t('wishes.must_offer')} htmlFor="w-cat">
              <select id="w-cat" className="input" {...register('category')}>
                <option value="">{t('wishes.any')}</option>
                {meta?.service_categories.map((c) => <option key={c.slug} value={c.slug}>{localName(c)}</option>)}
              </select>
            </Field>
            <Field label={t('wishes.min_rating')} htmlFor="w-rating">
              <select id="w-rating" className="input" {...register('min_rating')}>
                <option value="">{t('wishes.any')}</option>
                {['4.0', '4.5', '4.8'].map((r) => <option key={r} value={r}>{r}★+</option>)}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('require_manually_checked')} />
            {t('wishes.only_checked')}
          </label>
          <p className="text-xs text-amber-700">{t('wishes.rating_note')}</p>
        </fieldset>

        <Alert tone="blue">{t('wishes.how_it_works')}</Alert>
        <ErrorText error={mutation.error} />
        <div className="flex justify-end gap-2">
          <Link to="/wishes" className="btn-ghost">{t('common.cancel')}</Link>
          <button className="btn-primary" disabled={mutation.isPending}>{t('wishes.post')}</button>
        </div>
      </form>
    </div>
  )
}
