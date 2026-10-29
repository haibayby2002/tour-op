import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { dateTime, money } from '../lib/format'
import type { Agreement, Stop, StopKind } from '../lib/types'
import { AgreementStatusBadge } from './status'
import { Badge, cx } from './ui'

const kindTone: Record<StopKind, 'neutral' | 'amber' | 'red' | 'brand' | 'blue'> = {
  SIGHTSEEING: 'brand',
  FOOD: 'blue',
  SHOPPING: 'amber',
  PARTNER: 'red',
  TRANSPORT: 'neutral',
  ACTIVITY: 'brand',
  OTHER: 'neutral',
}

export function StopKindBadge({ kind }: { kind: StopKind }) {
  const { t } = useTranslation()
  return <Badge tone={kindTone[kind]}>{t(`stop_kind.${kind}`)}</Badge>
}

/**
 * Read-only rendering of an itinerary + price agreement. When `selectable`
 * is passed, declinable stops (shopping/food/partner) get a checkbox.
 */
export default function AgreementView({
  agreement,
  selectable,
}: {
  agreement: Agreement
  selectable?: { declined: number[]; toggle: (id: number) => void }
}) {
  const { t } = useTranslation()
  const costs = (['cost_tickets', 'cost_transport', 'cost_food', 'cost_overtime', 'cost_other'] as const).filter((k) => agreement[k])
  const hasCommercial = agreement.stops.some((s) => s.is_commercial)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{t('agreement.version', { version: agreement.version })}</span>
        <AgreementStatusBadge status={agreement.status} />
        <span className="text-xs text-stone-400">{dateTime(agreement.created_at)}</span>
      </div>

      <div className="rounded-xl bg-brand-50 p-4 ring-1 ring-brand-100">
        <p className="text-xs font-semibold tracking-wide text-brand-800 uppercase">{t('agreement.total')}</p>
        <p className="text-2xl font-bold text-brand-900">{money(agreement.total_price, agreement.currency)}</p>
        <p className="text-xs text-brand-800">
          {money(agreement.price, agreement.currency)} {t(`price_unit.${agreement.price_unit}`)} · {t('requests.people', { count: agreement.group_size })}
        </p>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Item label={t('agreement.when')}>{dateTime(agreement.start_at)} → {dateTime(agreement.end_at)}</Item>
        <Item label={t('agreement.meeting_point')}>{agreement.meeting_point}</Item>
        <Item label={t('agreement.scope')} wide>{agreement.scope}</Item>
        {agreement.included && <Item label={`✓ ${t('agreement.included')}`}>{agreement.included}</Item>}
        {agreement.excluded && <Item label={`✗ ${t('agreement.excluded')}`}>{agreement.excluded}</Item>}
      </dl>

      {costs.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="mb-2 text-sm font-semibold text-amber-900">{t('agreement.extra_costs')}</p>
          <ul className="space-y-1 text-sm text-amber-900">
            {costs.map((k) => (
              <li key={k}><span className="font-medium">{t(`agreement.${k}`)}:</span> {agreement[k]}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold">{t('agreement.itinerary')}</p>
        {hasCommercial && <p className="mb-2 text-xs text-amber-700">⚠ {t('agreement.commercial_warning')}</p>}
        <ol className="relative space-y-3 border-l-2 border-stone-200 pl-5">
          {agreement.stops.map((stop) => (
            <StopRow key={stop.id} stop={stop} selectable={selectable} />
          ))}
        </ol>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Item label={t('agreement.cancellation_policy')} wide>{agreement.cancellation_policy}</Item>
        {agreement.notes && <Item label={t('agreement.notes')} wide>{agreement.notes}</Item>}
        {agreement.response_note && <Item label={t('agreement.traveler_feedback')} wide>{agreement.response_note}</Item>}
      </dl>
    </div>
  )
}

function StopRow({ stop, selectable }: { stop: Stop; selectable?: { declined: number[]; toggle: (id: number) => void } }) {
  const { t } = useTranslation()
  const declined = stop.declined_by_traveler || selectable?.declined.includes(stop.id)
  return (
    <li className={cx('relative', declined && 'opacity-60')}>
      <span className="absolute top-1.5 -left-[27px] h-3 w-3 rounded-full border-2 border-surface bg-brand-600 ring-1 ring-brand-200" />
      <div className="flex flex-wrap items-center gap-2">
        {stop.time && <span className="font-mono text-xs text-stone-500">{stop.time}</span>}
        <span className={cx('font-medium', declined && 'line-through')}>{stop.place_name}</span>
        {stop.place?.latitude && stop.place.longitude && (
          <a
            className="link text-xs"
            href={`https://www.google.com/maps/search/?api=1&query=${stop.place.latitude},${stop.place.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('agreement.map')}
          </a>
        )}
        <StopKindBadge kind={stop.kind} />
        {stop.declined_by_traveler && <Badge tone="neutral">{t('agreement.declined_stop')}</Badge>}
      </div>
      {stop.activity && <p className="text-sm text-stone-600">{stop.activity}</p>}
      {stop.estimated_cost && <p className="text-xs text-stone-500">{t('agreement.estimated_cost')}: {stop.estimated_cost}</p>}
      {selectable && stop.declinable && (
        <label className="mt-1 inline-flex items-center gap-1.5 text-xs text-stone-700">
          <input type="checkbox" checked={selectable.declined.includes(stop.id)} onChange={() => selectable.toggle(stop.id)} />
          {t('agreement.decline_this_stop')}
        </label>
      )}
    </li>
  )
}

function Item({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-semibold text-stone-500">{label}</dt>
      <dd className="whitespace-pre-line text-stone-800">{children}</dd>
    </div>
  )
}
