import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { ConfirmButton, FilterPills, Pager, PersonCell } from '../../components/staff'
import { Badge, EmptyState, ErrorText, PageHeader, PageLoader, Stars } from '../../components/ui'
import { api } from '../../lib/api'
import { date } from '../../lib/format'
import { staffKeys, type Paged, type StaffReview } from '../../lib/staff'

const FILTERS = ['all', 'low', 'reported', 'hidden'] as const

export default function StaffReviews() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const filter = (params.get('filter') ?? 'all') as (typeof FILTERS)[number]
  const page = Number(params.get('page') ?? 1)

  const query = { filter, page: String(page) }
  const { data, isLoading, error } = useQuery({
    queryKey: staffKeys.list('reviews', query),
    queryFn: () => api<Paged<StaffReview>>('/staff/reviews/', { query }),
  })
  const visibility = useMutation({
    mutationFn: ({ id, is_hidden }: { id: number; is_hidden: boolean }) => api(`/staff/reviews/${id}/visibility/`, { body: { is_hidden } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.all }),
  })

  return (
    <div>
      <PageHeader title={t('staff.reviews.title')} subtitle={t('staff.reviews.subtitle')} />
      <div className="mb-4">
        <FilterPills value={filter} onChange={(v) => setParams({ filter: v }, { replace: true })} options={FILTERS.map((f) => ({ value: f, label: t(`staff.reviews.filter_${f}`) }))} />
      </div>
      <ErrorText error={visibility.error} />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data?.results.length ? (
        <EmptyState title={t('staff.empty')} />
      ) : (
        <>
          <ul className="space-y-3">
            {data.results.map((r) => (
              <li key={r.id} className={`card p-4 ${r.is_hidden ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <PersonCell person={r.reviewer} sub={t('staff.reviews.wrote')} />
                  <span className="text-stone-400" aria-hidden>→</span>
                  <PersonCell person={r.reviewee} sub={t(`roles.${r.reviewee_role}`)} />
                  <div className="ml-auto flex items-center gap-2">
                    <Stars value={r.rating} />
                    {r.reported && <Badge tone="red">{t('staff.reviews.reported')}</Badge>}
                    {r.is_hidden && <Badge tone="neutral">{t('staff.reviews.hidden')}</Badge>}
                  </div>
                </div>
                {r.comment && <p className="mt-3 text-sm text-stone-700">“{r.comment}”</p>}
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-stone-500">
                  <span>{t('staff.reports.booking')} #{r.booking_id} · {date(r.created_at)}{r.felt_safe === false && <> · ⚠ {t('staff.reviews.felt_unsafe')}</>}</span>
                  {r.is_hidden ? (
                    <button className="btn-secondary btn-sm" disabled={visibility.isPending} onClick={() => visibility.mutate({ id: r.id, is_hidden: false })}>{t('staff.reviews.unhide')}</button>
                  ) : (
                    <ConfirmButton confirmLabel={t('staff.reviews.confirm_hide')} onConfirm={() => visibility.mutate({ id: r.id, is_hidden: true })} disabled={visibility.isPending}>
                      {t('staff.reviews.hide')}
                    </ConfirmButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pager page={page} count={data.count} pageSize={data.page_size} onPage={(p) => setParams({ filter, page: String(p) }, { replace: true })} />
        </>
      )}
    </div>
  )
}
