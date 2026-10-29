import i18n from '../i18n'

const locale = () => (i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-GB')

export function money(amount: number | null | undefined, currency = 'VND') {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat(locale(), { style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2 }).format(amount)
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

export function time(value: string) {
  return new Intl.DateTimeFormat(locale(), { timeStyle: 'short' }).format(new Date(value))
}

export function relative(value: string) {
  // Hermes on Android has no Intl.RelativeTimeFormat; constructing it crashes release builds.
  if (typeof Intl.RelativeTimeFormat !== 'function') return dateTime(value)
  const diff = (new Date(value).getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}

export function localName(item: { name: string; name_vi?: string } | null | undefined) {
  if (!item) return ''
  return i18n.language?.startsWith('vi') && item.name_vi ? item.name_vi : item.name
}
