import { useTranslation } from 'react-i18next'

import { localName } from '../lib/format'
import type { PublicProfile } from '../lib/types'
import ReviewList from './ReviewList'
import { RatingSummary, TrustBadges } from './trust'
import { Avatar, Badge } from './ui'

/** What a local sees about a traveler before accepting (PRD E2). */
export default function TravelerSummary({ profile: p, showReviews = true }: { profile: PublicProfile; showReviews?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar src={p.avatar} name={p.name} size="lg" />
        <div className="space-y-1">
          <p className="text-xl font-semibold">{p.name}</p>
          <p className="text-sm text-stone-500">
            {t('profile.age_by_year', { age: p.age_by_birth_year })}
            {p.city && <> · {localName(p.city)}</>}
          </p>
          <RatingSummary trust={p.trust} />
        </div>
      </div>
      <TrustBadges trust={p.trust} showMissing />
      {p.trust.completed_tours > 0 && (
        <p className="text-sm text-stone-600">{t('traveler.completed_tours', { count: p.trust.completed_tours })}</p>
      )}
      {p.bio && <p className="text-sm whitespace-pre-line text-stone-700">{p.bio}</p>}
      {p.traveler ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase">{t('traveler.style')}</p>
            <p className="text-sm">{p.traveler.travel_style ? t(`travel_style.${p.traveler.travel_style}`) : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase">{t('traveler.wishes')}</p>
            <p className="text-sm">{p.traveler.wishes || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase">{t('traveler.avoid')}</p>
            <p className="text-sm">{p.traveler.avoid_notes || '—'}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-stone-500">{t('traveler.private_details')}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {p.languages.map((l) => <Badge key={l.code}>{localName(l)}</Badge>)}
        {p.interests.map((i) => <Badge key={i.slug} tone="brand">{localName(i)}</Badge>)}
      </div>
      {showReviews && (
        <div>
          <p className="mb-2 font-semibold">{t('traveler.reviews_from_locals')}</p>
          <ReviewList reviews={p.reviews} />
        </div>
      )}
    </div>
  )
}
