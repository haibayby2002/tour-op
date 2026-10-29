import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Alert, cx, ErrorText, Field, PageLoader } from '../components/ui'
import { api } from '../lib/api'
import { fromLocalInput, localName, money, priceRange, toLocalInput } from '../lib/format'
import { keys, useMeta } from '../lib/queries'
import type { MyProfile, PublicProfile, TourRequest } from '../lib/types'
import { canBook, missingContacts } from '../lib/verification'

interface Values {
  service: string
  city: string
  area: string
  start_at: string
  end_at: string
  group_size: number
  budget_min: string
  budget_max: string
  language: string
  wishes: string
  avoid_notes: string
}

function defaultStart() {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  d.setHours(9, 0, 0, 0)
  return d
}

export default function NewRequestPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const localId = Number(id)
  const { user, hasRole } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: meta } = useMeta()
  const [interests, setInterests] = useState<string[]>([])

  const { data: local, isLoading } = useQuery({
    queryKey: keys.publicProfile(localId, 'LOCAL'),
    queryFn: () => api<PublicProfile>(`/users/${localId}/`, { query: { role: 'LOCAL' } }),
  })
  const { data: me } = useQuery({ queryKey: keys.myProfile, queryFn: () => api<MyProfile>('/profile/me/') })

  const start = useMemo(defaultStart, [])
  const { register, handleSubmit, reset, watch } = useForm<Values>({
    defaultValues: {
      start_at: toLocalInput(start),
      end_at: toLocalInput(new Date(start.getTime() + 3 * 3600_000)),
      group_size: 1,
    },
  })

  // Prefill from the local's city and the traveler's own preferences.
  useEffect(() => {
    if (!local || !me) return
    reset((v) => ({
      ...v,
      city: local.city?.slug ?? '',
      wishes: v.wishes || me.traveler?.wishes || '',
      avoid_notes: v.avoid_notes || me.traveler?.avoid_notes || '',
      language: v.language || local.languages.find((l) => me.languages.some((m) => m.code === l.code))?.code || '',
    }))
    setInterests((prev) => (prev.length ? prev : me.interests.map((i) => i.slug).filter((s) => local.interests.some((li) => li.slug === s))))
  }, [local, me, reset])

  const mutation = useMutation({
    mutationFn: (v: Values) =>
      api<TourRequest>('/tour-requests/', {
        body: {
          local: localId,
          service: v.service ? Number(v.service) : null,
          city: v.city,
          area: v.area,
          start_at: fromLocalInput(v.start_at),
          end_at: fromLocalInput(v.end_at),
          group_size: Number(v.group_size),
          budget_min: v.budget_min ? Number(v.budget_min) : null,
          budget_max: v.budget_max ? Number(v.budget_max) : null,
          language: v.language || null,
          interests,
          wishes: v.wishes,
          avoid_notes: v.avoid_notes,
        },
      }),
    onSuccess: (req) => {
      queryClient.invalidateQueries({ queryKey: ['tour-requests'] })
      navigate(`/requests/${req.id}`, { replace: true })
    },
  })

  if (isLoading || !local) return <PageLoader />
  const selectedService = local.services?.find((s) => String(s.id) === watch('service'))
  const maxGroup = Math.min(meta?.max_group_size ?? 3, selectedService?.max_group_size ?? 99)

  if (!hasRole('TRAVELER')) {
    return (
      <Alert title={t('request.need_traveler_role')}>
        <Link to="/account" className="link">{t('request.add_role')}</Link>
      </Alert>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">{t('request.title', { name: local.name })}</h1>
      <p className="mt-1 text-sm text-stone-500">{t('request.subtitle')}</p>

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
        <Field label={t('request.service')} hint={t('request.service_hint')} htmlFor="service">
          <select id="service" className="input" {...register('service')}>
            <option value="">{t('request.custom_experience')}</option>
            {local.services?.map((s) => (
              <option key={s.id} value={s.id}>{s.title} · {money(s.price, s.currency)}</option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('request.city')} htmlFor="city">
            <select id="city" className="input" required {...register('city')}>
              {meta?.cities.map((c) => <option key={c.slug} value={c.slug}>{localName(c)}</option>)}
            </select>
          </Field>
          <Field label={t('request.area')} hint={t('request.area_hint')} htmlFor="area">
            <input id="area" className="input" {...register('area')} />
          </Field>
          <Field label={t('request.start')} htmlFor="start_at">
            <input id="start_at" type="datetime-local" className="input" required {...register('start_at')} />
          </Field>
          <Field label={t('request.end')} htmlFor="end_at">
            <input id="end_at" type="datetime-local" className="input" required {...register('end_at')} />
          </Field>
          <Field label={t('request.group_size')} hint={t('request.group_hint', { max: maxGroup })} htmlFor="group_size">
            <select id="group_size" className="input" {...register('group_size')}>
              {Array.from({ length: maxGroup }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label={t('request.language')} htmlFor="language">
            <select id="language" className="input" {...register('language')}>
              <option value="">—</option>
              {local.languages.map((l) => <option key={l.code} value={l.code}>{localName(l)}</option>)}
            </select>
          </Field>
          <Field label={t('request.budget_min')} htmlFor="budget_min">
            <input id="budget_min" type="number" min={0} step={50000} className="input" {...register('budget_min')} />
          </Field>
          <Field label={t('request.budget_max')} hint={t('request.local_range', { range: priceRange(local.local!.price_min, local.local!.price_max, local.local!.currency) })} htmlFor="budget_max">
            <input id="budget_max" type="number" min={0} step={50000} className="input" {...register('budget_max')} />
          </Field>
        </div>
        <div>
          <span className="label">{t('request.interests')}</span>
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
        <Field label={t('request.wishes')} htmlFor="wishes">
          <textarea id="wishes" className="input min-h-24" placeholder={t('request.wishes_placeholder')} {...register('wishes')} />
        </Field>
        <Field label={t('request.avoid')} hint={t('request.avoid_hint')} htmlFor="avoid_notes">
          <textarea id="avoid_notes" className="input min-h-20" placeholder={t('request.avoid_placeholder')} {...register('avoid_notes')} />
        </Field>
        <Alert tone="blue">{t('request.next_steps')}</Alert>
        <ErrorText error={mutation.error} />
        <div className="flex justify-end gap-2">
          <Link to={`/locals/${localId}`} className="btn-ghost">{t('common.cancel')}</Link>
          <button className="btn-primary" disabled={mutation.isPending}>{t('request.send')}</button>
        </div>
      </form>
    </div>
  )
}
