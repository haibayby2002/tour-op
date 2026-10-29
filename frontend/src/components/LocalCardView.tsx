import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { priceRange } from '../lib/format'
import type { LocalCard } from '../lib/types'
import { MatchReasons, RatingSummary, TrustBadges } from './trust'
import { Avatar, cx } from './ui'

/** Cover: the local's photo when they have one, otherwise a soft brand backdrop with their initials' avatar. */
function Cover({ local }: { local: LocalCard }) {
  return (
    <div className="relative h-36 overflow-hidden rounded-t-2xl bg-gradient-to-br from-brand-100 via-teal-50 to-amber-50 dark:from-brand-100 dark:via-stone-100 dark:to-stone-200">
      {local.cover ? (
        <img src={local.cover} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      ) : (
        <svg viewBox="0 0 400 144" className="absolute inset-0 h-full w-full text-brand-200 opacity-70" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <path d="M0 110 Q60 70 120 100 T240 95 T400 90 V144 H0Z" fill="currentColor" />
          <path d="M0 125 Q80 95 160 118 T320 112 T400 115 V144 H0Z" fill="currentColor" opacity=".6" />
          <circle cx="330" cy="38" r="16" fill="currentColor" opacity=".8" />
        </svg>
      )}
      {local.city && (
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-stone-800 shadow-sm backdrop-blur dark:text-stone-50">
          📍 {local.city}
        </span>
      )}
      {local.trust.manually_checked && (
        <span className="absolute top-3 right-3 rounded-full bg-teal-800 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">✓ Tour-op</span>
      )}
    </div>
  )
}

export default function LocalCardView({ local, compact = false, showPrice = true }: { local: LocalCard; compact?: boolean; showPrice?: boolean }) {
  const { t } = useTranslation()
  return (
    <Link
      to={`/locals/${local.id}`}
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg"
    >
      <Cover local={local} />
      <div className="relative flex flex-1 flex-col px-5 pb-5">
        <div className="-mt-8 flex items-end gap-3">
          <Avatar src={local.avatar} name={local.name} size="lg" />
          {/* The name overlaps the cover photo, so it sits on its own panel to stay readable. */}
          <div className="min-w-0 flex-1 rounded-xl bg-surface/90 px-2.5 py-1 shadow-sm backdrop-blur">
            <p className="truncate text-lg font-semibold group-hover:text-brand-800">{local.name}</p>
            <p className="text-xs text-stone-500">
              {t('profile.age_by_year', { age: local.age_by_birth_year })}
            </p>
          </div>
        </div>
        {local.is_demo && (
          <p className="mt-2"><span className="chip bg-amber-50 text-amber-800 ring-1 ring-amber-200">🧪 {t('explore.demo_label')}</span></p>
        )}
        <div className="mt-2">
          <RatingSummary trust={local.trust} />
        </div>
        <p className={cx('mt-2 text-sm text-stone-600', compact ? 'line-clamp-2' : 'line-clamp-3')}>{local.bio}</p>
        {!compact && local.areas && <p className="mt-2 truncate text-xs text-stone-500">🗺️ {local.areas}</p>}
        <div className="mt-3 flex flex-wrap gap-1">
          {local.languages.map((l) => (
            <span key={l.code} className="chip bg-stone-100 text-stone-600">{l.code.toUpperCase()}</span>
          ))}
        </div>
        {!compact && (
          <>
            <div className="mt-3">
              <TrustBadges trust={local.trust} compact />
            </div>
            <div className="mt-3 flex-1">
              <MatchReasons reasons={local.match.reasons} />
            </div>
          </>
        )}
        {showPrice && (
          <div className="mt-auto border-t border-stone-100 pt-3">
            <p className="text-xs text-stone-500">{t('explore.price_from')}</p>
            <p className="font-semibold text-stone-900">{priceRange(local.price_min, local.price_max, local.currency)}</p>
            <p className="mt-1 text-xs text-stone-500">{t('explore.price_scope')}</p>
          </div>
        )}
      </div>
    </Link>
  )
}
