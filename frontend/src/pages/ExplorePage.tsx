import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import LocalCardView from '../components/LocalCardView'
import { cx, EmptyState, ErrorText, PageHeader, PageLoader } from '../components/ui'
import { api } from '../lib/api'
import { localName } from '../lib/format'
import { keys, useMeta } from '../lib/queries'
import type { SearchResult } from '../lib/types'

const FILTERS = ['city', 'date', 'language', 'category', 'interest', 'price_max', 'verified', 'sort', 'q', 'page'] as const

export default function ExplorePage() {
  const { t } = useTranslation()
  const { data: meta } = useMeta()
  const [params, setParams] = useSearchParams()
  const current = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ''])) as Record<(typeof FILTERS)[number], string>

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  const interests = current.interest ? current.interest.split(',') : []
  const toggleInterest = (slug: string) =>
    set('interest', (interests.includes(slug) ? interests.filter((s) => s !== slug) : [...interests, slug]).join(','))

  // Display-only and deliberately not remembered: prices start hidden on every visit.
  const [showPrices, setShowPrices] = useState(false)

  const queryParams = Object.fromEntries(Object.entries(current).filter(([, v]) => v))
  const { data, isLoading, error } = useQuery({
    queryKey: keys.search(queryParams),
    queryFn: () => api<SearchResult>('/locals/', { query: queryParams }),
  })

  const page = Number(current.page || 1)
  const pages = data ? Math.ceil(data.count / data.page_size) : 1

  return (
    <div>
      <PageHeader
        title={t('explore.title')}
        subtitle={t('explore.subtitle')}
        actions={<Link to={`/wishes/new${current.city ? `?city=${current.city}` : ''}`} className="btn-secondary">✨ {t('wishes.cta_explore')}</Link>}
      />
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-5">
          <input
            key={`q-${current.q}`}
            className="input"
            placeholder={t('explore.search_placeholder')}
            defaultValue={current.q}
            onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value)}
            onBlur={(e) => e.target.value !== current.q && set('q', e.target.value)}
          />
          <div>
            <label className="label" htmlFor="f-city">{t('explore.city')}</label>
            <select id="f-city" className="input" value={current.city} onChange={(e) => set('city', e.target.value)}>
              <option value="">{t('explore.any_city')}</option>
              {meta?.cities.map((c) => <option key={c.slug} value={c.slug}>{localName(c)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-date">{t('explore.date')}</label>
            <input id="f-date" type="date" className="input" value={current.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-lang">{t('explore.language')}</label>
            <select id="f-lang" className="input" value={current.language} onChange={(e) => set('language', e.target.value)}>
              <option value="">{t('explore.any_language')}</option>
              {meta?.languages.map((l) => <option key={l.code} value={l.code}>{localName(l)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-cat">{t('explore.category')}</label>
            <select id="f-cat" className="input" value={current.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">{t('explore.any_category')}</option>
              {meta?.service_categories.map((c) => <option key={c.slug} value={c.slug}>{localName(c)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-price">{t('explore.budget_max')}</label>
            <input
              key={`p-${current.price_max}`}
              id="f-price"
              type="number"
              step={50000}
              min={0}
              className="input"
              placeholder="1000000"
              defaultValue={current.price_max}
              onBlur={(e) => set('price_max', e.target.value)}
            />
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} />
              {t('explore.show_prices')}
            </label>
          </div>
          <div>
            <span className="label">{t('explore.interests')}</span>
            <div className="flex flex-wrap gap-1.5">
              {meta?.interests.map((i) => (
                <button
                  key={i.slug}
                  onClick={() => toggleInterest(i.slug)}
                  className={cx('chip border', interests.includes(i.slug) ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-200 bg-surface text-stone-600 hover:border-stone-300')}
                >
                  {localName(i)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={current.verified === '1'} onChange={(e) => set('verified', e.target.checked ? '1' : '')} />
            {t('explore.verified_only')}
          </label>
          {params.toString() && (
            <button className="btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}>{t('explore.clear')}</button>
          )}
        </aside>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-stone-500">{data ? t('explore.results', { count: data.count }) : ' '}</p>
            <select className="input w-auto" value={current.sort || 'match'} onChange={(e) => set('sort', e.target.value)} aria-label={t('explore.sort')}>
              {['match', 'rating', 'price_asc', 'price_desc'].map((s) => <option key={s} value={s}>{t(`explore.sort_${s}`)}</option>)}
            </select>
          </div>
          {isLoading ? (
            <PageLoader />
          ) : error ? (
            <ErrorText error={error} />
          ) : !data?.results.length ? (
            <EmptyState
              title={t('explore.empty_title')}
              action={<Link to={`/wishes/new${current.city ? `?city=${current.city}` : ''}`} className="btn-primary">{t('wishes.post')}</Link>}
            >
              {t('explore.empty_body')} {t('wishes.cta_empty')}
            </EmptyState>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.results.map((local) => <LocalCardView key={local.id} local={local} showPrice={showPrices} />)}
              </div>
              {pages > 1 && (
                <div className="mt-6 flex justify-center gap-2">
                  <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => set('page', String(page - 1))}>←</button>
                  <span className="px-3 py-1.5 text-sm">{page} / {pages}</span>
                  <button className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => set('page', String(page + 1))}>→</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
