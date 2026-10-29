import { useMutation } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { api } from '../lib/api'
import { fromLocalInput, toLocalInput } from '../lib/format'
import { useMeta, usePlaces } from '../lib/queries'
import type { Agreement, Booking, StopKind } from '../lib/types'
import { ErrorText, Field } from './ui'

interface StopValues {
  time: string
  place_name: string
  activity: string
  kind: StopKind
  estimated_cost: string
}

interface Values {
  meeting_point: string
  start_at: string
  end_at: string
  group_size: number
  scope: string
  price: number
  price_unit: 'PER_GROUP' | 'PER_PERSON'
  included: string
  excluded: string
  cost_tickets: string
  cost_transport: string
  cost_food: string
  cost_overtime: string
  cost_other: string
  cancellation_policy: string
  notes: string
  stops: StopValues[]
}

function defaults(booking: Booking): Values {
  const base = booking.pending_agreement ?? booking.current_agreement
  if (base) {
    return {
      ...base,
      start_at: toLocalInput(base.start_at),
      end_at: toLocalInput(base.end_at),
      stops: base.stops.map(({ time, place_name, activity, kind, estimated_cost }) => ({ time, place_name, activity, kind, estimated_cost })),
    }
  }
  const service = booking.service
  return {
    meeting_point: '',
    start_at: toLocalInput(booking.start_at),
    end_at: toLocalInput(booking.end_at),
    group_size: booking.group_size,
    scope: '',
    price: service?.price ?? 0,
    price_unit: service?.price_unit === 'PER_PERSON' ? 'PER_PERSON' : 'PER_GROUP',
    included: '',
    excluded: '',
    cost_tickets: '',
    cost_transport: '',
    cost_food: '',
    cost_overtime: '',
    cost_other: '',
    cancellation_policy: '',
    notes: '',
    stops: [{ time: '', place_name: '', activity: '', kind: 'SIGHTSEEING', estimated_cost: '' }],
  }
}

/** Local proposes a new, immutable version of the itinerary + price. */
export default function AgreementForm({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const { t, i18n } = useTranslation()
  const { data: meta } = useMeta()
  const { data: places } = usePlaces(booking.request?.city)
  const vi = i18n.language.startsWith('vi')
  const { register, control, handleSubmit } = useForm<Values>({ defaultValues: defaults(booking) })
  const { fields, append, remove, move } = useFieldArray({ control, name: 'stops' })

  const mutation = useMutation({
    mutationFn: (v: Values) =>
      api<Agreement>(`/bookings/${booking.id}/agreements/`, {
        body: {
          ...v,
          start_at: fromLocalInput(v.start_at),
          end_at: fromLocalInput(v.end_at),
          group_size: Number(v.group_size),
          price: Number(v.price),
          currency: booking.currency || 'VND',
        },
      }),
    onSuccess: onDone,
  })

  return (
    <form className="space-y-5" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
      <p className="text-sm text-stone-500">{t('agreement.form_intro')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('agreement.meeting_point')} hint={t('agreement.meeting_point_hint')} htmlFor="a-mp">
          <input id="a-mp" className="input" required {...register('meeting_point')} />
        </Field>
        <Field label={t('request.group_size')} htmlFor="a-gs">
          <input id="a-gs" type="number" min={1} max={meta?.max_group_size ?? 3} className="input" required {...register('group_size')} />
        </Field>
        <Field label={t('request.start')} htmlFor="a-start">
          <input id="a-start" type="datetime-local" className="input" required {...register('start_at')} />
        </Field>
        <Field label={t('request.end')} htmlFor="a-end">
          <input id="a-end" type="datetime-local" className="input" required {...register('end_at')} />
        </Field>
      </div>
      <Field label={t('agreement.scope')} hint={t('agreement.scope_hint')} htmlFor="a-scope">
        <textarea id="a-scope" className="input min-h-20" required {...register('scope')} />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="label mb-0">{t('agreement.itinerary')}</span>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => append({ time: '', place_name: '', activity: '', kind: 'SIGHTSEEING', estimated_cost: '' })}
          >
            + {t('agreement.add_stop')}
          </button>
        </div>
        <p className="mb-2 text-xs text-stone-500">{t('agreement.kind_hint')}</p>
        {!!places?.length && <p className="mb-2 text-xs text-stone-500">{t('agreement.place_hint')}</p>}
        <datalist id="place-suggestions">
          {places?.map((p) => <option key={p.slug} value={vi && p.name_vi ? p.name_vi : p.name} />)}
        </datalist>
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-xl border border-stone-200 p-3">
              <div className="grid gap-2 sm:grid-cols-[90px_1fr_160px]">
                <input className="input" placeholder="09:30" aria-label={t('agreement.time')} {...register(`stops.${index}.time`)} />
                <input className="input" placeholder={t('agreement.place')} list="place-suggestions" autoComplete="off" required {...register(`stops.${index}.place_name`)} />
                <select className="input" {...register(`stops.${index}.kind`)} aria-label={t('agreement.kind')}>
                  {(meta?.stop_kinds ?? []).map((k) => <option key={k} value={k}>{t(`stop_kind.${k}`)}</option>)}
                </select>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_200px]">
                <input className="input" placeholder={t('agreement.activity')} {...register(`stops.${index}.activity`)} />
                <input className="input" placeholder={t('agreement.estimated_cost')} {...register(`stops.${index}.estimated_cost`)} />
              </div>
              <div className="mt-2 flex justify-end gap-1">
                <button type="button" className="btn-ghost btn-sm" disabled={index === 0} onClick={() => move(index, index - 1)}>↑</button>
                <button type="button" className="btn-ghost btn-sm" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>↓</button>
                <button type="button" className="btn-ghost btn-sm text-red-600" disabled={fields.length === 1} onClick={() => remove(index)}>
                  {t('common.remove')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('agreement.price')} htmlFor="a-price">
          <input id="a-price" type="number" min={0} step={10000} className="input" required {...register('price')} />
        </Field>
        <Field label={t('agreement.price_unit')} htmlFor="a-unit">
          <select id="a-unit" className="input" {...register('price_unit')}>
            <option value="PER_GROUP">{t('price_unit.PER_GROUP')}</option>
            <option value="PER_PERSON">{t('price_unit.PER_PERSON')}</option>
          </select>
        </Field>
        <Field label={t('agreement.included')} htmlFor="a-inc">
          <textarea id="a-inc" className="input" {...register('included')} />
        </Field>
        <Field label={t('agreement.excluded')} htmlFor="a-exc">
          <textarea id="a-exc" className="input" {...register('excluded')} />
        </Field>
      </div>
      <fieldset className="rounded-xl bg-amber-50 p-4">
        <legend className="px-1 text-sm font-semibold text-amber-900">{t('agreement.extra_costs')}</legend>
        <p className="mb-3 text-xs text-amber-800">{t('agreement.extra_costs_hint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['cost_tickets', 'cost_transport', 'cost_food', 'cost_overtime', 'cost_other'] as const).map((k) => (
            <Field key={k} label={t(`agreement.${k}`)} htmlFor={`a-${k}`}>
              <input id={`a-${k}`} className="input" placeholder={t('agreement.cost_placeholder')} {...register(k)} />
            </Field>
          ))}
        </div>
      </fieldset>
      <Field label={t('agreement.cancellation_policy')} htmlFor="a-cancel">
        <textarea id="a-cancel" className="input" required placeholder={t('agreement.cancellation_placeholder')} {...register('cancellation_policy')} />
      </Field>
      <Field label={t('agreement.notes')} htmlFor="a-notes">
        <textarea id="a-notes" className="input" {...register('notes')} />
      </Field>
      <ErrorText error={mutation.error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onDone}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={mutation.isPending}>{t('agreement.send_proposal')}</button>
      </div>
    </form>
  )
}
