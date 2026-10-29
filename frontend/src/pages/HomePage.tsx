import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import HeroCarousel from '../components/HeroCarousel'
import LocalCardView from '../components/LocalCardView'
import { api } from '../lib/api'
import { localName } from '../lib/format'
import { keys, useMeta } from '../lib/queries'
import type { SearchResult } from '../lib/types'

const STEPS = ['know', 'match', 'communicate', 'protect', 'experience'] as const
const FEARS = [
  { key: 'overcharge', icon: '💸' },
  { key: 'detour', icon: '🧭' },
  { key: 'fake', icon: '🪪' },
  { key: 'privacy', icon: '🔒' },
  { key: 'safety', icon: '🛡️' },
  { key: 'dispute', icon: '⚖️' },
] as const

/** Illustrated entry points, cropped from the carousel artwork (public/home/tile-*.webp). */
const TILES = [
  { id: 'food', img: '/home/tile-food.webp', to: '/explore?category=food' },
  { id: 'culture', img: '/home/tile-culture.webp', to: '/explore?category=culture' },
  { id: 'city', img: '/home/tile-city.webp', to: '/explore?interest=coffee,photography' },
  { id: 'wish', img: '/home/tile-meet.webp', to: '/wishes/new' },
] as const

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export default function HomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: meta } = useMeta()
  const navigate = useNavigate()
  const [city, setCity] = useState('')
  const [date, setDate] = useState('')

  const topParams = { sort: 'rating', page_size: '8' }
  const { data: top } = useQuery({
    queryKey: keys.search(topParams),
    queryFn: () => api<SearchResult>('/locals/', { query: topParams }),
  })

  return (
    <div className="space-y-16">
      <div>
        <HeroCarousel />
        <form
          className="relative z-10 mx-auto -mt-6 grid max-w-4xl gap-2 rounded-2xl border border-stone-200 bg-surface p-2.5 shadow-xl sm:-mt-10 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            const params = new URLSearchParams()
            if (city) params.set('city', city)
            if (date) params.set('date', date)
            navigate(`/explore?${params}`)
          }}
        >
          <label className="flex items-center gap-2 rounded-xl px-3 hover:bg-stone-50">
            <span aria-hidden>📍</span>
            <select className="input border-0 bg-transparent px-0 shadow-none focus:ring-0" value={city} onChange={(e) => setCity(e.target.value)} aria-label={t('explore.city')}>
              <option value="">{t('home.where')}</option>
              {meta?.cities.map((c) => (
                <option key={c.slug} value={c.slug}>{localName(c)}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl px-3 hover:bg-stone-50 sm:border-l sm:border-stone-200">
            <span aria-hidden>📅</span>
            <input
              type="date"
              className="input border-0 bg-transparent px-0 shadow-none focus:ring-0"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              aria-label={t('explore.date')}
            />
          </label>
          <button className="btn-primary rounded-xl px-6 py-3">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></svg>
            {t('home.search')}
          </button>
        </form>
        <p className="mt-3 text-center text-sm text-stone-500">
          {t('home.or_wish')}{' '}
          <Link to={user ? '/wishes/new' : '/register'} className="link">{t('home.post_wish')}</Link>
        </p>
      </div>

      <section>
        <SectionHeader title={t('home.tiles_title')} subtitle={t('home.tiles_subtitle')} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {TILES.map((tile) => (
            <Link key={tile.id} to={tile.id === 'wish' && !user ? '/register' : tile.to} className="group relative aspect-square overflow-hidden rounded-2xl shadow-sm ring-1 ring-stone-200">
              <img src={tile.img} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                <p className="text-base font-semibold text-white sm:text-lg">{t(`home.tiles.${tile.id}.title`)}</p>
                <p className="mt-0.5 hidden text-xs text-white/85 sm:block">{t(`home.tiles.${tile.id}.body`)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {!!top?.results.length && (
        <section>
          <SectionHeader
            title={t('home.top_title')}
            subtitle={t('home.top_subtitle')}
            action={<Link to="/explore?sort=rating" className="link text-sm">{t('home.see_all')} →</Link>}
          />
          <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
            {top.results.map((local) => (
              <div key={local.id} className="w-72 shrink-0 snap-start">
                <LocalCardView local={local} compact showPrice={false} />
              </div>
            ))}
          </div>
        </section>
      )}

      {!!meta?.cities.length && (
        <section>
          <SectionHeader title={t('home.cities_title')} />
          <div className="flex flex-wrap gap-2">
            {meta.cities.map((c) => (
              <Link key={c.slug} to={`/explore?city=${c.slug}`} className="rounded-full border border-stone-200 bg-surface px-4 py-2 text-sm font-medium text-stone-700 shadow-xs transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800">
                {localName(c)}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl bg-stone-50 p-6 ring-1 ring-stone-200 sm:p-10">
        <h2 className="text-center text-2xl font-bold">{t('home.fears_title')}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-stone-500">{t('home.fears_subtitle')}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEARS.map(({ key, icon }) => (
            <div key={key} className="card flex gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl" aria-hidden>{icon}</span>
              <div>
                <p className="text-sm font-semibold text-stone-500">“{t(`home.fears.${key}.fear`)}”</p>
                <p className="mt-1.5 text-sm font-medium text-stone-900">{t(`home.fears.${key}.answer`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title={t('home.how_title')} />
        <ol className="grid gap-4 md:grid-cols-5">
          {STEPS.map((step, i) => (
            <li key={step} className="card relative p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">{i + 1}</span>
              <p className="mt-3 font-semibold">{t(`home.steps.${step}.title`)}</p>
              <p className="mt-1 text-sm text-stone-500">{t(`home.steps.${step}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid items-center gap-8 overflow-hidden rounded-3xl bg-teal-800 text-white md:grid-cols-[1.2fr_1fr]">
        <div className="p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-white">{t('home.locals_title')}</h2>
          <p className="mt-2 text-teal-50">{t('home.locals_body')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {user ? (
              <Link to="/profile?tab=local" className="btn bg-white text-teal-900 hover:bg-teal-50">{t('home.locals_cta_member')}</Link>
            ) : (
              <Link to="/register?role=LOCAL" className="btn bg-white text-teal-900 hover:bg-teal-50">{t('home.locals_cta')}</Link>
            )}
            <Link to="/explore" className="btn border border-white/40 text-white hover:bg-white/10">{t('home.browse')}</Link>
          </div>
        </div>
        <img src="/home/slide-perspective-960.webp" alt="" loading="lazy" className="hidden h-full w-full object-cover object-right md:block" />
      </section>

      <p className="mx-auto max-w-3xl text-center text-xs text-stone-500">{t('home.disclaimer')}</p>
    </div>
  )
}
