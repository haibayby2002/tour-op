import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { api } from '../lib/api'
import { duration, localName, money } from '../lib/format'
import { keys, useMeta } from '../lib/queries'
import type { Service } from '../lib/types'
import { ImageUploadButton, PhotoGrid } from './photos'
import { Badge, EmptyState, ErrorText, Field, Modal } from './ui'

type ServiceInput = Pick<
  Service,
  'category' | 'city' | 'title' | 'description' | 'location_name' | 'duration_minutes' | 'price' | 'currency' | 'price_unit' | 'max_group_size' | 'included' | 'excluded' | 'status'
>

function ServiceForm({ service, onDone }: { service?: Service; onDone: () => void }) {
  const { t } = useTranslation()
  const { data: meta } = useMeta()
  const queryClient = useQueryClient()
  const { register, handleSubmit } = useForm<ServiceInput>({
    defaultValues: service ?? {
      currency: 'VND',
      price_unit: 'PER_GROUP',
      max_group_size: meta?.max_group_size ?? 3,
      duration_minutes: 180,
      status: 'ACTIVE',
      category: meta?.service_categories[0]?.slug,
      city: meta?.cities[0]?.slug,
    },
  })
  const mutation = useMutation({
    mutationFn: (v: ServiceInput) =>
      api<Service>(service ? `/services/mine/${service.id}/` : '/services/mine/', {
        method: service ? 'PATCH' : 'POST',
        body: { ...v, price: Number(v.price), duration_minutes: Number(v.duration_minutes), max_group_size: Number(v.max_group_size) },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.myServices })
      queryClient.invalidateQueries({ queryKey: keys.myProfile })
      onDone()
    },
  })

  return (
    <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
      <Field label={t('services.title_field')} htmlFor="s-title">
        <input id="s-title" className="input" required {...register('title')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('services.category')} htmlFor="s-cat">
          <select id="s-cat" className="input" {...register('category')}>
            {meta?.service_categories.map((c) => <option key={c.slug} value={c.slug}>{localName(c)}</option>)}
          </select>
        </Field>
        <Field label={t('profile.city')} htmlFor="s-city">
          <select id="s-city" className="input" {...register('city')}>
            {meta?.cities.map((c) => <option key={c.slug} value={c.slug}>{localName(c)}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t('services.description')} hint={t('services.description_hint')} htmlFor="s-desc">
        <textarea id="s-desc" className="input min-h-28" required {...register('description')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('services.duration')} htmlFor="s-dur">
          <input id="s-dur" type="number" min={30} step={15} className="input" {...register('duration_minutes')} />
        </Field>
        <Field label={t('services.max_group')} htmlFor="s-max">
          <input id="s-max" type="number" min={1} max={meta?.max_group_size ?? 3} className="input" {...register('max_group_size')} />
        </Field>
        <Field label={t('services.area')} htmlFor="s-area">
          <input id="s-area" className="input" {...register('location_name')} />
        </Field>
        <Field label={t('agreement.price')} htmlFor="s-price">
          <input id="s-price" type="number" min={0} step={10000} className="input" required {...register('price')} />
        </Field>
        <Field label={t('agreement.price_unit')} htmlFor="s-unit">
          <select id="s-unit" className="input" {...register('price_unit')}>
            {(['PER_GROUP', 'PER_PERSON', 'PER_HOUR'] as const).map((u) => <option key={u} value={u}>{t(`price_unit.${u}`)}</option>)}
          </select>
        </Field>
        <Field label={t('local_edit.currency')} htmlFor="s-cur">
          <select id="s-cur" className="input" {...register('currency')}>
            {['VND', 'USD', 'EUR'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('agreement.included')} htmlFor="s-inc">
          <textarea id="s-inc" className="input" {...register('included')} />
        </Field>
        <Field label={t('agreement.excluded')} hint={t('services.excluded_hint')} htmlFor="s-exc">
          <textarea id="s-exc" className="input" {...register('excluded')} />
        </Field>
      </div>
      <Field label={t('services.status')} htmlFor="s-status">
        <select id="s-status" className="input" {...register('status')}>
          <option value="ACTIVE">{t('services.active')}</option>
          <option value="PAUSED">{t('services.paused')}</option>
        </select>
      </Field>
      <ErrorText error={mutation.error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onDone}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={mutation.isPending}>{t('common.save')}</button>
      </div>
    </form>
  )
}

const MAX_SERVICE_PHOTOS = 8

export default function ServicesManager() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  const { data = [] } = useQuery({ queryKey: keys.myServices, queryFn: () => api<Service[]>('/services/mine/') })
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: keys.myServices })
    queryClient.invalidateQueries({ queryKey: keys.myProfile })
  }
  const archive = useMutation({ mutationFn: (id: number) => api(`/services/mine/${id}/`, { method: 'DELETE' }), onSuccess: invalidate })
  const [pickError, setPickError] = useState<unknown>(null)
  const addPhotos = useMutation({
    mutationFn: async ({ id, files }: { id: number; files: File[] }) => {
      for (const file of files) {
        const form = new FormData()
        form.append('image', file)
        await api(`/services/mine/${id}/photos/`, { form })
      }
    },
    onSettled: invalidate,
  })
  const removePhoto = useMutation({
    mutationFn: ({ id, photoId }: { id: number; photoId: number }) => api(`/services/mine/${id}/photos/${photoId}/`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setEditing('new')}>+ {t('services.add')}</button>
      </div>
      {data.length === 0 ? (
        <EmptyState title={t('services.empty_title')}>{t('services.empty_body')}</EmptyState>
      ) : (
        data.map((s) => (
          <div key={s.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{s.title} {s.status === 'PAUSED' && <Badge tone="amber">{t('services.paused')}</Badge>}</p>
                <p className="text-xs text-stone-500">{localName(s.category_detail)} · {s.city_name} · {duration(s.duration_minutes)}</p>
              </div>
              <p className="font-semibold">{money(s.price, s.currency)} <span className="text-xs font-normal text-stone-500">{t(`price_unit.${s.price_unit}`)}</span></p>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-stone-600">{s.description}</p>
            {s.photos.length > 0 && (
              <PhotoGrid
                photos={s.photos}
                className="mt-3 flex flex-wrap gap-2"
                imageClassName="h-20 w-20 rounded-lg"
                overlay={(p) => (
                  <button
                    className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-xs text-red-600 shadow ring-1 ring-stone-200 hover:bg-red-50"
                    onClick={() => removePhoto.mutate({ id: s.id, photoId: p.id })}
                    disabled={removePhoto.isPending}
                    aria-label={t('common.remove')}
                  >
                    ✕
                  </button>
                )}
              />
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-secondary btn-sm" onClick={() => setEditing(s)}>{t('common.edit')}</button>
              {s.photos.length < MAX_SERVICE_PHOTOS && (
                <ImageUploadButton
                  multiple
                  className="btn-ghost btn-sm"
                  pending={addPhotos.isPending && addPhotos.variables?.id === s.id}
                  onFiles={(files) => addPhotos.mutateAsync({ id: s.id, files: files.slice(0, MAX_SERVICE_PHOTOS - s.photos.length) })}
                  onError={setPickError}
                >
                  + {t('services.photo')}
                </ImageUploadButton>
              )}
              <button className="btn-ghost btn-sm text-red-600" onClick={() => archive.mutate(s.id)}>{t('services.archive')}</button>
            </div>
          </div>
        ))
      )}
      <ErrorText error={pickError ?? addPhotos.error ?? removePhoto.error ?? archive.error} />
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? t('services.add') : t('common.edit')} wide>
        {editing !== null && <ServiceForm service={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  )
}
