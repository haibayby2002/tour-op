import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { ConfirmButton, FilterPills, Pager, PersonCell, TableWrap, td, th } from '../../components/staff'
import { Badge, EmptyState, ErrorText, PageHeader, PageLoader } from '../../components/ui'
import { api } from '../../lib/api'
import { date } from '../../lib/format'
import { staffKeys, type Paged, type StaffUser } from '../../lib/staff'

const ROLES = ['', 'TRAVELER', 'LOCAL'] as const

export default function StaffUsers() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const role = (params.get('role') ?? '') as (typeof ROLES)[number]
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? 1)
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in patch)) next.delete('page')
    setParams(next, { replace: true })
  }

  const query = { q, role, status, page: String(page) }
  const { data, isLoading, error } = useQuery({
    queryKey: staffKeys.list('users', query),
    queryFn: () => api<Paged<StaffUser>>('/staff/users/', { query }),
  })

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'ACTIVE' | 'SUSPENDED' }) =>
      api<StaffUser>(`/staff/users/${id}/status/`, { body: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.all }),
  })

  return (
    <div>
      <PageHeader title={t('staff.users.title')} subtitle={t('staff.users.subtitle')} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          key={q}
          className="input max-w-xs"
          type="search"
          placeholder={t('staff.users.search')}
          defaultValue={q}
          onKeyDown={(e) => e.key === 'Enter' && set({ q: (e.target as HTMLInputElement).value })}
          onBlur={(e) => e.target.value !== q && set({ q: e.target.value })}
        />
        <FilterPills value={role} onChange={(v) => set({ role: v })} options={ROLES.map((r) => ({ value: r, label: r ? t(`roles.${r}`) : t('staff.all') }))} />
        <select className="input w-auto" value={status} onChange={(e) => set({ status: e.target.value })} aria-label={t('staff.users.status')}>
          <option value="">{t('staff.users.any_status')}</option>
          {(['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'] as const).map((s) => <option key={s} value={s}>{t(`staff.user_status.${s}`)}</option>)}
        </select>
        {data && <span className="ml-auto text-sm text-stone-500">{t('staff.results', { count: data.count })}</span>}
      </div>
      <ErrorText error={setStatus.error} />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data?.results.length ? (
        <EmptyState title={t('staff.empty')} />
      ) : (
        <>
          <TableWrap>
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th className={th}>{t('staff.users.person')}</th>
                  <th className={th}>{t('staff.users.roles')}</th>
                  <th className={th}>{t('staff.users.verified')}</th>
                  <th className={th}>{t('staff.users.joined')}</th>
                  <th className={th}>{t('staff.users.reports')}</th>
                  <th className={th}><span className="sr-only">{t('staff.users.actions')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.results.map((u) => (
                  <tr key={u.id} className="hover:bg-stone-50">
                    <td className={td}>
                      <PersonCell person={u} sub={<>{u.email}{u.city && <> · {u.city}</>}</>} />
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => <Badge key={r} tone={r === 'LOCAL' ? 'brand' : 'blue'}>{t(`roles.${r}`)}</Badge>)}
                        {u.is_staff && <Badge tone="amber">{t('staff.badge')}</Badge>}
                      </div>
                    </td>
                    <td className={td}>
                      <span className="flex gap-2 text-xs">
                        <span className={u.email_verified ? 'text-emerald-700' : 'text-stone-400'}>✉ {u.email_verified ? '✓' : '✗'}</span>
                        <span className={u.phone_verified ? 'text-emerald-700' : 'text-stone-400'}>☎ {u.phone_verified ? '✓' : '✗'}</span>
                      </span>
                    </td>
                    <td className={`${td} text-stone-500`}>{date(u.date_joined)}</td>
                    <td className={td}>
                      {u.reports_received ? <Badge tone="red">{u.reports_received}</Badge> : <span className="text-stone-400">0</span>}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      {u.roles.includes('LOCAL') && <Link to={`/locals/${u.id}`} className="btn-ghost btn-sm" target="_blank">{t('staff.users.view')}</Link>}
                      {!u.is_staff && u.status === 'ACTIVE' && (
                        <ConfirmButton confirmLabel={t('staff.users.confirm_suspend')} onConfirm={() => setStatus.mutate({ id: u.id, status: 'SUSPENDED' })} disabled={setStatus.isPending}>
                          {t('staff.users.suspend')}
                        </ConfirmButton>
                      )}
                      {u.status === 'SUSPENDED' && (
                        <button className="btn-secondary btn-sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: u.id, status: 'ACTIVE' })}>
                          {t('staff.users.reactivate')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pager page={page} count={data.count} pageSize={data.page_size} onPage={(p) => set({ page: String(p) })} />
        </>
      )}
    </div>
  )
}
