import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { PhotoGrid } from '../components/photos'
import ReviewList from '../components/ReviewList'
import { BlockButton, ReportDialog } from '../components/safety'
import { RatingSummary, TrustBadges } from '../components/trust'
import { Avatar, Badge, ErrorText, PageLoader } from '../components/ui'
import { api } from '../lib/api'
import { dateTime, duration, localName, money, priceRange } from '../lib/format'
import { keys } from '../lib/queries'
import type { PublicProfile } from '../lib/types'

export default function LocalProfilePage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const userId = Number(id)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [reporting, setReporting] = useState(false)
  const { data: p, isLoading, error } = useQuery({
    queryKey: keys.publicProfile(userId, 'LOCAL'),
    queryFn: () => api<PublicProfile>(`/users/${userId}/`, { query: { role: 'LOCAL' } }),
  })

  if (isLoading) return <PageLoader />
  if (error || !p) return <ErrorText error={error} />
  const local = p.local!
  const isMe = user?.id === p.id

  const requestButton = isMe ? (
    <Link to="/profile?tab=local" className="btn-secondary w-full">{t('profile.edit')}</Link>
  ) : local.is_accepting_requests ? (
    <button
      className="btn-primary w-full"
      onClick={() => navigate(user ? `/locals/${p.id}/request` : '/login', { state: { from: `/locals/${p.id}/request` } })}
    >
      {t('local.send_request')}
    </button>
  ) : (
    <p className="text-center text-sm text-stone-500">{t('local.not_accepting')}</p>
  )

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar src={p.avatar} name={p.name} size="xl" />
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{p.name}</h1>
            <p className="text-stone-500">
              {t('profile.age_by_year', { age: p.age_by_birth_year })} · {p.city ? localName(p.city) : ''}
             
            </p>
            <RatingSummary trust={p.trust} />
            <TrustBadges trust={p.trust} />
          </div>
        </section>

        {p.bio && <p className="whitespace-pre-line text-stone-700">{p.bio}</p>}

        <section className="grid gap-4 sm:grid-cols-2">
          <InfoCard title={t('local.experience')}>{local.experience_summary || '—'}</InfoCard>
          <InfoCard title={t('local.areas')}>{local.areas_description || '—'}</InfoCard>
          <InfoCard title={t('local.skills')}>{local.support_skills || '—'}</InfoCard>
          <InfoCard title={t('local.languages')}>
            <div className="flex flex-wrap gap-1.5">
              {p.languages.map((l) => <Badge key={l.code}>{localName(l)} · {t(`proficiency.${l.proficiency}`)}</Badge>)}
            </div>
          </InfoCard>
        </section>

        {p.interests.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">{t('local.interests')}</h2>
            <div className="flex flex-wrap gap-1.5">
              {p.interests.map((i) => <Badge key={i.slug} tone="brand">{localName(i)}</Badge>)}
            </div>
          </section>
        )}

        {p.photos.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">{t('local.photos')}</h2>
            <PhotoGrid photos={p.photos} />
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('local.services')}</h2>
          {p.services?.length ? (
            <div className="space-y-3">
              {p.services.map((s) => (
                <div key={s.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{s.title}</p>
                      <p className="text-xs text-stone-500">
                        {localName(s.category_detail)} · {duration(s.duration_minutes)} · {t('local.max_group', { count: s.max_group_size })}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {money(s.price, s.currency)} <span className="text-xs font-normal text-stone-500">{t(`price_unit.${s.price_unit}`)}</span>
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-stone-600">{s.description}</p>
                  {s.photos.length > 0 && (
                    <PhotoGrid
                      photos={s.photos.map((ph) => ({ ...ph, caption: s.title }))}
                      className="mt-3 flex gap-2 overflow-x-auto pb-1 *:shrink-0"
                      imageClassName="h-24 w-24 shrink-0 rounded-lg sm:h-28 sm:w-28"
                      showCaptions={false}
                    />
                  )}
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    {s.included && <p><span className="font-medium text-emerald-700">✓ {t('agreement.included')}:</span> {s.included}</p>}
                    {s.excluded && <p><span className="font-medium text-amber-700">✗ {t('agreement.excluded')}:</span> {s.excluded}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-500">{t('local.no_services')}</p>
          )}
        </section>

        {!!p.external_reviews?.length && (
          <section>
            <h2 className="mb-1 text-lg font-semibold">{t('local.external_reviews')}</h2>
            <p className="mb-3 text-xs text-stone-500">{t('local.external_reviews_hint')}</p>
            <ul className="space-y-2">
              {p.external_reviews.map((r) => (
                <li key={r.id} className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <span>
                    <span className="font-semibold">{t(`platform.${r.platform}`)}</span>
                    {r.rating_text && <span className="text-stone-600"> · {r.rating_text}</span>}
                    {r.note && <span className="block text-xs text-stone-500">{r.note}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    {r.status === 'VERIFIED' ? <Badge tone="green">{t('local.source_checked')}</Badge> : <Badge tone="amber">{t('local.source_unverified')}</Badge>}
                    {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="link text-xs">{t('local.open_link')}</a>}
                    {r.screenshot && <a href={r.screenshot} target="_blank" rel="noopener noreferrer" className="link text-xs">{t('local.screenshot')}</a>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('local.reviews_title')}</h2>
          <ReviewList reviews={p.reviews} />
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card space-y-4 p-5">
          <div>
            <p className="text-xs text-stone-500">{t('local.price_range')}</p>
            <p className="text-xl font-bold">{priceRange(local.price_min, local.price_max, local.currency)}</p>
            <p className="mt-1 text-xs text-stone-500">{t('local.price_scope')}</p>
            {local.pricing_note && <p className="mt-1 text-xs text-stone-500">{local.pricing_note}</p>}
          </div>
          {requestButton}
          <ul className="space-y-1.5 text-xs text-stone-600">
            <li>✓ {t('local.promise_price')}</li>
            <li>✓ {t('local.promise_itinerary')}</li>
            <li>✓ {t('local.promise_chat')}</li>
          </ul>
        </div>
        {!!p.availability?.length && (
          <div className="card p-5">
            <p className="mb-2 font-semibold">{t('local.availability')}</p>
            <ul className="space-y-1 text-sm text-stone-600">
              {p.availability.slice(0, 6).map((a) => <li key={a.id}>{dateTime(a.start_at)} → {dateTime(a.end_at)}</li>)}
            </ul>
          </div>
        )}
        {user && !isMe && (
          <div className="flex justify-between">
            <button className="btn-ghost btn-sm text-stone-500" onClick={() => setReporting(true)}>{t('report.button')}</button>
            <BlockButton userId={p.id} onBlocked={() => navigate('/explore')} />
          </div>
        )}
      </aside>
      <ReportDialog open={reporting} onClose={() => setReporting(false)} target={{ reported_user: p.id }} defaultCategory="FAKE_PROFILE" />
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-4">
      <p className="mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase">{title}</p>
      <div className="text-sm whitespace-pre-line text-stone-700">{children}</div>
    </div>
  )
}
