import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { FilterPills, Pager, PersonCell } from '../../components/staff'
import { Badge, EmptyState, ErrorText, PageHeader, PageLoader } from '../../components/ui'
import { api } from '../../lib/api'
import { priceRange, relative } from '../../lib/format'
import { staffKeys, type LocalReviewStatus, type Paged, type StaffExternalReview, type StaffLocal } from '../../lib/staff'

const TABS = ['PENDING', 'MANUALLY_CHECKED', 'REJECTED', 'ALL'] as const
const statusTone = { NOT_SUBMITTED: 'neutral', PENDING: 'amber', MANUALLY_CHECKED: 'green', REJECTED: 'red' } as const
const extTone = { UNVERIFIED: 'amber', VERIFIED: 'green', REJECTED: 'red' } as const

export default function StaffLocals() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') ?? 'PENDING') as (typeof TABS)[number]
  const page = Number(params.get('page') ?? 1)

  const query = { review_status: tab, page: String(page) }
  const { data, isLoading, error } = useQuery({
    queryKey: staffKeys.list('locals', query),
    queryFn: () => api<Paged<StaffLocal>>('/staff/locals/', { query }),
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: staffKeys.all })
  const decide = useMutation({
    mutationFn: ({ id, review_status }: { id: number; review_status: LocalReviewStatus }) =>
      api(`/staff/locals/${id}/review/`, { body: { review_status } }),
    onSuccess: invalidate,
  })
  const checkSource = useMutation({
    mutationFn: ({ id, status }: { id: number; status: StaffExternalReview['status'] }) => api(`/staff/external-reviews/${id}/`, { body: { status } }),
    onSuccess: invalidate,
  })

  return (
    <div>
      <PageHeader title={t('staff.locals.title')} subtitle={t('staff.locals.subtitle')} />
      <div className="mb-4">
        <FilterPills
          value={tab}
          onChange={(v) => setParams({ tab: v }, { replace: true })}
          options={TABS.map((s) => ({ value: s, label: s === 'ALL' ? t('staff.all') : t(`staff.local_status.${s}`) }))}
        />
      </div>
      <ErrorText error={decide.error || checkSource.error} />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data?.results.length ? (
        <EmptyState title={tab === 'PENDING' ? t('staff.locals.empty_pending') : t('staff.empty')} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.results.map((l) => (
              <article key={l.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <PersonCell person={l} sub={<>{l.email}{l.city && <> · {l.city}</>}</>} />
                  <Badge tone={statusTone[l.review_status]}>{t(`staff.local_status.${l.review_status}`)}</Badge>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-stone-50 p-2">
                    <dt className="text-[11px] text-stone-500 uppercase">{t('staff.locals.completion')}</dt>
                    <dd className="font-semibold">{l.completion}%</dd>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-2">
                    <dt className="text-[11px] text-stone-500 uppercase">{t('staff.locals.years')}</dt>
                    <dd className="font-semibold">{l.years_experience}</dd>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-2">
                    <dt className="text-[11px] text-stone-500 uppercase">{t('staff.locals.services')}</dt>
                    <dd className="font-semibold">{l.service_count}</dd>
                  </div>
                </dl>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100" aria-hidden>
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${l.completion}%` }} />
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  {l.bio && <p className="line-clamp-3 text-stone-700">{l.bio}</p>}
                  {l.experience_summary && <p className="line-clamp-3 text-stone-500 italic">“{l.experience_summary}”</p>}
                  <p className="text-xs text-stone-500">
                    🗺️ {l.areas || '—'} · 💰 {priceRange(l.price_min, l.price_max, l.currency)} · ✉ {l.email_verified ? '✓' : '✗'} ☎ {l.phone_verified ? '✓' : '✗'}
                  </p>
                </div>

                {!!l.external_reviews.length && (
                  <div className="mt-4 space-y-2 rounded-xl border border-stone-200 p-3">
                    <p className="text-xs font-semibold text-stone-500 uppercase">{t('staff.locals.external')}</p>
                    {l.external_reviews.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{t(`platform.${s.platform}`)}</span>
                        {s.rating_text && <span className="text-stone-500">{s.rating_text}</span>}
                        {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="link text-xs">{t('staff.locals.open_link')} ↗</a>}
                        {s.screenshot && <a href={s.screenshot} target="_blank" rel="noreferrer" className="link text-xs">{t('staff.locals.screenshot')} ↗</a>}
                        <span className="ml-auto flex items-center gap-1">
                          <Badge tone={extTone[s.status]}>{t(`staff.external_status.${s.status}`)}</Badge>
                          {s.status !== 'VERIFIED' && (
                            <button className="btn-ghost btn-sm text-emerald-700" disabled={checkSource.isPending} onClick={() => checkSource.mutate({ id: s.id, status: 'VERIFIED' })}>✓</button>
                          )}
                          {s.status !== 'REJECTED' && (
                            <button className="btn-ghost btn-sm text-red-600" disabled={checkSource.isPending} onClick={() => checkSource.mutate({ id: s.id, status: 'REJECTED' })}>✗</button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                  <Link to={`/locals/${l.id}`} target="_blank" className="btn-ghost btn-sm">{t('staff.locals.view_profile')} ↗</Link>
                  <span className="text-xs text-stone-400">{relative(l.updated_at)}</span>
                  <span className="ml-auto flex gap-2">
                    {l.review_status !== 'REJECTED' && (
                      <button className="btn-secondary btn-sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: l.id, review_status: 'REJECTED' })}>
                        {t('staff.locals.reject')}
                      </button>
                    )}
                    {l.review_status !== 'MANUALLY_CHECKED' && (
                      <button className="btn-primary btn-sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: l.id, review_status: 'MANUALLY_CHECKED' })}>
                        ✓ {t('staff.locals.approve')}
                      </button>
                    )}
                  </span>
                </div>
              </article>
            ))}
          </div>
          <Pager page={page} count={data.count} pageSize={data.page_size} onPage={(p) => setParams({ tab, page: String(p) }, { replace: true })} />
        </>
      )}
    </div>
  )
}
