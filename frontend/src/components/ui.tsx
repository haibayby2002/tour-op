import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../lib/api'
import { ImageUploadError } from '../lib/images'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={cx('animate-spin text-brand-700 dark:text-teal-400', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: ReactNode
  error?: string
  hint?: ReactNode
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

type Tone = 'neutral' | 'brand' | 'green' | 'amber' | 'red' | 'blue'

const toneClass: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-700',
  brand: 'bg-brand-50 text-brand-800 ring-1 ring-brand-200',
  green: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  blue: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200',
}

export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={cx('chip', toneClass[tone])} title={title}>
      {children}
    </span>
  )
}

export function Alert({ tone = 'amber', title, children }: { tone?: Tone; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={cx('rounded-xl px-4 py-3 text-sm', toneClass[tone])} role="status">
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
    </div>
  )
}

/** Shows a translated API error (by code) or its message. */
export function ErrorText({ error }: { error: unknown }) {
  const { t } = useTranslation()
  if (!error) return null
  let message = t('errors.generic')
  if (error instanceof ApiError) {
    message = error.code && t(`errors.${error.code}`, { defaultValue: '' }) ? t(`errors.${error.code}`) : error.firstMessage
  } else if (error instanceof ImageUploadError) {
    message = t(`errors.${error.code}`)
  } else if (error instanceof Error) {
    message = error.message
  }
  return <Alert tone="red">{message}</Alert>
}

export function EmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-base font-semibold text-stone-800">{title}</p>
      {children && <div className="max-w-md text-sm text-stone-500">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Avatar({ src, name, size = 'md' }: { src?: string | null; name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const dims = { sm: 'h-8 w-8 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl' }[size]
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(-2)
    .join('')
    .toUpperCase()
  return src ? (
    <img src={src} alt={name} className={cx(dims, 'shrink-0 rounded-full object-cover ring-2 ring-surface')} />
  ) : (
    <span
      className={cx(dims, 'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800 ring-2 ring-surface')}
      aria-hidden
    >
      {initials}
    </span>
  )
}

export function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  return (
    <span className={cx('inline-flex text-amber-500', size === 'lg' ? 'text-xl' : 'text-sm')} aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(value) ? '' : 'text-stone-300'}>
          ★
        </span>
      ))}
    </span>
  )
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1 text-3xl" role="radiogroup">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          type="button"
          key={i}
          role="radio"
          aria-checked={value === i}
          aria-label={`${i}`}
          onClick={() => onChange(i)}
          className={i <= value ? 'text-amber-500' : 'text-stone-300 hover:text-amber-300'}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-6 shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-ghost btn-sm -mr-2" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T
  onChange: (v: T) => void
  tabs: { value: T; label: ReactNode; count?: number }[]
}) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-stone-200">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cx(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap',
            value === tab.value ? 'border-brand-700 text-brand-800' : 'border-transparent text-stone-500 hover:text-stone-800',
          )}
        >
          {tab.label}
          {tab.count ? <span className="ml-1.5 rounded-full bg-brand-700 px-1.5 text-xs text-white">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
