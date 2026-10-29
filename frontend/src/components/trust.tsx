import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { localName } from '../lib/format'
import { useMeta } from '../lib/queries'
import type { CompletionReport, MatchReason, Trust } from '../lib/types'
import { Badge, Stars } from './ui'

/**
 * Trust signals are shown separately and never merged into a single score.
 * Email/phone verification is never presented as identity verification.
 */
/** `showMissing` adds amber badges for unverified email/phone (what a local sees about a traveler). */
export function TrustBadges({ trust, compact = false, showMissing = false }: { trust: Trust; compact?: boolean; showMissing?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-1.5">
      {trust.identity_verified && <Badge tone="green">🪪 {t('trust.identity_verified')}</Badge>}
      {trust.manually_checked && (
        <Badge tone="brand" title={t('trust.manually_checked_hint')}>
          ✔ {t('trust.manually_checked')}
        </Badge>
      )}
      {trust.email_verified && <Badge tone="blue">✉ {t('trust.email_verified')}</Badge>}
      {trust.phone_verified && <Badge tone="blue">☎ {t('trust.phone_verified')}</Badge>}
      {showMissing && !trust.email_verified && <Badge tone="amber">✉ {t('trust.email_unverified')}</Badge>}
      {showMissing && !trust.phone_verified && <Badge tone="amber">☎ {t('trust.phone_unverified')}</Badge>}
      {!compact && (
        <Badge tone={trust.profile_complete ? 'green' : 'neutral'}>
          {trust.profile_complete ? t('trust.profile_complete') : t('trust.profile_percent', { percent: trust.profile_completion })}
        </Badge>
      )}
      {trust.is_new_member && <Badge tone="amber">{t('trust.new_member')}</Badge>}
    </div>
  )
}

export function RatingSummary({ trust }: { trust: Trust }) {
  const { t } = useTranslation()
  if (!trust.review_count || trust.rating_avg === null) {
    return <span className="text-sm text-stone-500">{t('trust.no_reviews')}</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Stars value={trust.rating_avg} />
      <span className="font-semibold">{trust.rating_avg.toFixed(1)}</span>
      <span className="text-stone-500">({t('trust.review_count', { count: trust.review_count })})</span>
    </span>
  )
}

export function MatchReasons({ reasons }: { reasons: MatchReason[] }) {
  const { t } = useTranslation()
  const { data: meta } = useMeta()
  const langName = (code: string) => localName(meta?.languages.find((l) => l.code === code)) || code
  const interestName = (slug: string) => localName(meta?.interests.find((i) => i.slug === slug)) || slug
  const categoryName = (slug: string) => localName(meta?.service_categories.find((c) => c.slug === slug)) || slug

  const text = (r: MatchReason) => {
    const p = r.params
    switch (r.code) {
      case 'common_language':
        return t('match.common_language', { languages: (p.languages as string[]).map(langName).join(', ') })
      case 'shared_interests':
        return t('match.shared_interests', { interests: (p.interests as string[]).map(interestName).join(', ') })
      case 'offers_category':
        return t('match.offers_category', { category: categoryName(p.category as string) })
      case 'highly_rated':
        return t('match.highly_rated', { rating: p.rating })
      default:
        return t(`match.${r.code}`)
    }
  }
  const visible = reasons.filter((r) => !['verified_contacts', 'manually_checked', 'new_member'].includes(r.code))
  if (!visible.length) return null
  return (
    <ul className="space-y-0.5 text-xs text-brand-800">
      {visible.slice(0, 3).map((r) => (
        <li key={r.code}>✓ {text(r)}</li>
      ))}
    </ul>
  )
}

export function CompletionMeter({ report, role, editLink = true }: { report: CompletionReport; role: 'traveler' | 'local'; editLink?: boolean }) {
  const { t } = useTranslation()
  const missing = report.items.filter((i) => !i.done)
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{t(`completion.title_${role}`)}</p>
        <span className="text-sm font-semibold text-brand-800">{report.percent}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${report.percent}%` }} />
      </div>
      {missing.length > 0 ? (
        <>
          <p className="mt-3 text-sm text-stone-600">{t(`completion.why_${role}`)}</p>
          <ul className="mt-2 space-y-1.5">
            {missing.map((item) => (
              <li key={item.key} className="flex items-start justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">{t(`completion.items.${item.key}`)}</span>
                  <span className="block text-xs text-stone-500">{t(`completion.hints.${item.key}`)}</span>
                </span>
                {editLink && (
                  <Link className="link shrink-0 text-xs" to={`/profile?tab=${completionTab(item.key)}`}>
                    {t('completion.add')}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-emerald-700">{t('completion.done')}</p>
      )}
      <p className="mt-3 text-xs text-stone-400">{t('completion.disclaimer')}</p>
    </div>
  )
}

function completionTab(key: string) {
  if (key === 'photos' || key === 'avatar') return 'photos'
  if (key === 'services') return 'services'
  if (['experience', 'areas', 'pricing', 'city'].includes(key)) return 'local'
  if (['travel_style', 'wishes'].includes(key)) return 'traveler'
  return 'general'
}
