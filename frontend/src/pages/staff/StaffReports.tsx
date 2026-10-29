import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { FilterPills, Pager, PersonCell, ReportStatusBadge, SeverityBadge } from '../../components/staff'
import { EmptyState, ErrorText, Modal, PageHeader, PageLoader } from '../../components/ui'
import { api } from '../../lib/api'
import { dateTime, relative } from '../../lib/format'
import { staffKeys, type Paged, type ReportStatus, type Severity, type StaffReport } from '../../lib/staff'

const FILTERS = ['active', 'RESOLVED', 'DISMISSED', 'all'] as const
const SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

function ReportDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: report, isLoading, error } = useQuery({
    queryKey: staffKeys.report(id),
    queryFn: () => api<StaffReport>(`/staff/reports/${id}/`),
  })
  // null until edited, so the saved note shows once the report loads.
  const [draft, setDraft] = useState<string | null>(null)
  const note = draft ?? report?.resolution_note ?? ''

  const update = useMutation({
    mutationFn: (body: Partial<{ status: ReportStatus; severity: Severity; resolution_note: string; assign_to_me: boolean }>) =>
      api<StaffReport>(`/staff/reports/${id}/`, { method: 'PATCH', body }),
    onSuccess: (data) => {
      queryClient.setQueryData(staffKeys.report(id), data)
      queryClient.invalidateQueries({ queryKey: staffKeys.all })
    },
  })

  const closed = report && (report.status === 'RESOLVED' || report.status === 'DISMISSED')

  return (
    <Modal open onClose={onClose} wide title={report ? `${t('staff.reports.report')} #${report.id} · ${t(`report.categories.${report.category}`)}` : t('staff.reports.report')}>
      {isLoading || !report ? (
        error ? <ErrorText error={error} /> : <PageLoader />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <ReportStatusBadge status={report.status} />
            <SeverityBadge severity={report.severity} />
            {report.opened_dispute && <span className="chip bg-red-50 text-red-700 ring-1 ring-red-200">{t('staff.reports.dispute')}</span>}
            <span className="text-xs text-stone-500">{dateTime(report.created_at)}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-stone-50 p-3">
              <p className="mb-2 text-xs font-semibold text-stone-500 uppercase">{t('staff.reports.reporter')}</p>
              <PersonCell person={report.reporter} />
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="mb-2 text-xs font-semibold text-red-700 uppercase">{t('staff.reports.reported')}</p>
              <PersonCell person={report.reported_user} />
            </div>
          </div>

          <div>
            <p className="label">{t('staff.reports.what_happened')}</p>
            <p className="rounded-xl border border-stone-200 p-3 text-sm whitespace-pre-wrap text-stone-800">{report.description}</p>
          </div>

          {(report.context?.message || report.context?.review) && (
            <div>
              <p className="label">{t('staff.reports.reported_content')}</p>
              <blockquote className="rounded-xl border-l-4 border-amber-300 bg-amber-50 p-3 text-sm text-stone-800">
                {report.context.message ?? report.context.review}
              </blockquote>
            </div>
          )}

          {!!report.evidence?.length && (
            <div>
              <p className="label">{t('staff.reports.evidence')}</p>
              <ul className="flex flex-wrap gap-2">
                {report.evidence.map((e) => (
                  <li key={e.id}>
                    <a href={e.file} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">📎 {e.description || t('staff.reports.file')}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.booking_id && <p className="text-sm text-stone-500">{t('staff.reports.booking')} #{report.booking_id}</p>}

          <div className="space-y-4 border-t border-stone-200 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-stone-600">{t('staff.reports.assigned')}:</span>
              <span className="text-sm font-medium">{report.assigned_to?.name ?? t('staff.reports.nobody')}</span>
              <button className="btn-secondary btn-sm" disabled={update.isPending} onClick={() => update.mutate({ assign_to_me: true })}>
                {t('staff.reports.assign_me')}
              </button>
              <label className="ml-auto flex items-center gap-2 text-sm">
                {t('staff.reports.severity')}
                <select className="input w-auto py-1.5" value={report.severity} onChange={(e) => update.mutate({ severity: e.target.value as Severity })}>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{t(`staff.severity.${s}`)}</option>)}
                </select>
              </label>
            </div>
            <div>
              <label className="label" htmlFor="resolution">{t('staff.reports.note')}</label>
              <textarea id="resolution" rows={3} className="input" value={note} onChange={(e) => setDraft(e.target.value)} placeholder={t('staff.reports.note_hint')} />
              <p className="mt-1 text-xs text-stone-500">{t('staff.reports.note_visible')}</p>
            </div>
            <ErrorText error={update.error} />
            <div className="flex flex-wrap justify-end gap-2">
              {closed ? (
                <button className="btn-secondary" disabled={update.isPending} onClick={() => update.mutate({ status: 'IN_REVIEW' })}>{t('staff.reports.reopen')}</button>
              ) : (
                <>
                  <button className="btn-secondary" disabled={update.isPending} onClick={() => update.mutate({ status: 'DISMISSED', resolution_note: note })}>{t('staff.reports.dismiss')}</button>
                  <button className="btn-primary" disabled={update.isPending || !note.trim()} onClick={() => update.mutate({ status: 'RESOLVED', resolution_note: note })} title={!note.trim() ? t('staff.reports.note_required') : undefined}>
                    {t('staff.reports.resolve')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function StaffReports() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const filter = (params.get('status') ?? 'active') as (typeof FILTERS)[number]
  const page = Number(params.get('page') ?? 1)
  const openId = Number(params.get('id')) || null
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  const query = { status: filter, page: String(page) }
  const { data, isLoading, error } = useQuery({
    queryKey: staffKeys.list('reports', query),
    queryFn: () => api<Paged<StaffReport>>('/staff/reports/', { query }),
  })

  return (
    <div>
      <PageHeader title={t('staff.reports.title')} subtitle={t('staff.reports.subtitle')} />
      <div className="mb-4">
        <FilterPills value={filter} onChange={(v) => set({ status: v, page: null })} options={FILTERS.map((f) => ({ value: f, label: t(`staff.reports.filter_${f}`) }))} />
      </div>
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data?.results.length ? (
        <EmptyState title={filter === 'active' ? t('staff.reports.empty_active') : t('staff.empty')} />
      ) : (
        <>
          <ul className="space-y-2">
            {data.results.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => set({ id: String(r.id) })}
                  className="card flex w-full flex-col gap-3 p-4 text-left transition hover:border-brand-200 hover:shadow-md sm:flex-row sm:items-center"
                >
                  <div className="flex shrink-0 flex-wrap gap-1.5 sm:w-44 sm:flex-col sm:items-start">
                    <SeverityBadge severity={r.severity} />
                    <ReportStatusBadge status={r.status} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900">{t(`report.categories.${r.category}`)} <span className="font-normal text-stone-400">#{r.id}</span></p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-stone-600">{r.description}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {r.reporter.name} → <span className="font-medium text-stone-700">{r.reported_user?.name ?? '—'}</span> · {relative(r.created_at)}
                      {r.assigned_to && <> · 👤 {r.assigned_to.name}</>}
                    </p>
                  </div>
                  <span className="hidden text-stone-400 sm:block" aria-hidden>›</span>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={page} count={data.count} pageSize={data.page_size} onPage={(p) => set({ page: String(p) })} />
        </>
      )}
      {openId && <ReportDetail id={openId} onClose={() => set({ id: null })} />}
    </div>
  )
}
