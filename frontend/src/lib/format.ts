import i18n from '../i18n'

function locale() {
  return i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-GB'
}

export function money(amount: number | null | undefined, currency = 'VND') {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(amount)
}

export function priceRange(min: number | null, max: number | null, currency = 'VND') {
  if (min === null) return '—'
  if (max === null || max === min) return money(min, currency)
  return `${money(min, currency)} – ${money(max, currency)}`
}

export function dateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function date(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(new Date(value))
}

export function time(value: string | null | undefined) {
  if (!value) return ''
  return new Intl.DateTimeFormat(locale(), { timeStyle: 'short' }).format(new Date(value))
}

export function relative(value: string) {
  const diff = (new Date(value).getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}

export function duration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ')
}

/** Value for <input type="datetime-local"> in the user's timezone. */
export function toLocalInput(value: string | Date) {
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value: string) {
  return new Date(value).toISOString()
}

/** Localized name for reference data that carries name / name_vi. */
export function localName(item: { name: string; name_vi?: string } | null | undefined) {
  if (!item) return ''
  return i18n.language?.startsWith('vi') && item.name_vi ? item.name_vi : item.name
}
