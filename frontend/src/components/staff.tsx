import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import type { ReportStatus, Severity, StaffPerson } from '../lib/staff'
import { Avatar, Badge, cx } from './ui'

export function PersonCell({ person, sub }: { person: StaffPerson | null; sub?: ReactNode }) {
  const { t } = useTranslation()
  if (!person) return <span className="text-stone-400">—</span>
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar src={person.avatar} name={person.name} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-stone-900">
          {person.name}
          {person.status !== 'ACTIVE' && (
            <span className="ml-1.5 align-middle"><Badge tone="red">{t(`staff.user_status.${person.status}`)}</Badge></span>
          )}
        </p>
        <p className="truncate text-xs text-stone-500">{sub ?? person.email}</p>
      </div>
    </div>
  )
}

const severityTone = { LOW: 'neutral', MEDIUM: 'amber', HIGH: 'red', CRITICAL: 'red' } as const
export function SeverityBadge({ severity }: { severity: Severity }) {
  const { t } = useTranslation()
  return <Badge tone={severityTone[severity]}>{severity === 'CRITICAL' ? '⚠ ' : ''}{t(`staff.severity.${severity}`)}</Badge>
}

const reportTone = { OPEN: 'amber', IN_REVIEW: 'blue', RESOLVED: 'green', DISMISSED: 'neutral' } as const
export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const { t } = useTranslation()
  return <Badge tone={reportTone[status]}>{t(`staff.report_status.${status}`)}</Badge>
}

/** Segmented filter, e.g. Open / Resolved / All. */
export function FilterPills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition',
            value === o.value ? 'bg-surface text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800',
          )}
          aria-pressed={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Pager({ page, count, pageSize, onPage }: { page: number; count: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (pages <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">←</button>
      <span className="px-2 text-stone-500">{page} / {pages}</span>
      <button className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">→</button>
    </div>
  )
}

export function StatCard({ label, value, hint, to, tone = 'neutral' }: { label: ReactNode; value: number | string; hint?: ReactNode; to?: string; tone?: 'neutral' | 'alert' }) {
  const body = (
    <>
      <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</p>
      <p className={cx('mt-1 text-3xl font-bold tabular-nums', tone === 'alert' && Number(value) > 0 ? 'text-red-600' : 'text-stone-900')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </>
  )
  const cls = 'card block p-4 transition'
  return to ? <Link to={to} className={cx(cls, 'hover:border-brand-200 hover:shadow-md')}>{body}</Link> : <div className={cls}>{body}</div>
}

/**
 * A button that asks "Are you sure?" inline instead of a browser dialog. Used for actions that affect
 * a real person (suspending, hiding a review).
 */
export function ConfirmButton({
  children,
  confirmLabel,
  onConfirm,
  className = 'btn-secondary btn-sm',
  disabled,
}: {
  children: ReactNode
  confirmLabel: ReactNode
  onConfirm: () => void
  className?: string
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return <button type="button" className={className} disabled={disabled} onClick={() => setAsking(true)}>{children}</button>
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" className="btn-danger btn-sm" disabled={disabled} onClick={() => { setAsking(false); onConfirm() }}>{confirmLabel}</button>
      <button type="button" className="btn-ghost btn-sm" onClick={() => setAsking(false)}>{t('common.cancel')}</button>
    </span>
  )
}

/** Wraps wide tables so only the table scrolls on a phone, not the page. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="card overflow-x-auto">{children}</div>
}

export const th = 'px-4 py-3 text-left text-xs font-semibold tracking-wide text-stone-500 uppercase'
export const td = 'px-4 py-3 align-middle text-sm'
