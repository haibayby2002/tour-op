import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { Pager, TableWrap, td, th } from '../../components/staff'
import { EmptyState, ErrorText, PageHeader, PageLoader } from '../../components/ui'
import { api } from '../../lib/api'
import { dateTime } from '../../lib/format'
import { staffKeys, type AuditEntry, type Paged } from '../../lib/staff'

export default function StaffAudit() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Number(params.get('page') ?? 1)

  const query = { q, page: String(page) }
  const { data, isLoading, error } = useQuery({
    queryKey: staffKeys.list('audit', query),
    queryFn: () => api<Paged<AuditEntry>>('/staff/audit/', { query }),
  })

  return (
    <div>
      <PageHeader title={t('staff.audit.title')} subtitle={t('staff.audit.subtitle')} />
      <input
        key={q}
        className="input mb-4 max-w-sm"
        type="search"
        placeholder={t('staff.audit.search')}
        defaultValue={q}
        onKeyDown={(e) => e.key === 'Enter' && setParams({ q: (e.target as HTMLInputElement).value }, { replace: true })}
      />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data?.results.length ? (
        <EmptyState title={t('staff.empty')} />
      ) : (
        <>
          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th className={th}>{t('staff.audit.when')}</th>
                  <th className={th}>{t('staff.audit.who')}</th>
                  <th className={th}>{t('staff.audit.action')}</th>
                  <th className={th}>{t('staff.audit.target')}</th>
                  <th className={th}>{t('staff.audit.details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.results.map((e) => (
                  <tr key={e.id} className="hover:bg-stone-50">
                    <td className={`${td} whitespace-nowrap text-stone-500`}>{dateTime(e.created_at)}</td>
                    <td className={td}>
                      {e.actor ?? <span className="text-stone-400">{t('staff.system')}</span>}
                      {e.actor_is_staff && <span className="ml-1 text-xs text-amber-700">★</span>}
                    </td>
                    <td className={`${td} font-mono text-xs`}>{e.action}</td>
                    <td className={`${td} text-stone-600`}>{e.entity_type} #{e.entity_id}</td>
                    <td className={`${td} max-w-[260px] truncate font-mono text-xs text-stone-500`} title={JSON.stringify(e.metadata)}>
                      {Object.keys(e.metadata).length ? JSON.stringify(e.metadata) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pager page={page} count={data.count} pageSize={data.page_size} onPage={(p) => setParams({ ...(q && { q }), page: String(p) }, { replace: true })} />
        </>
      )}
    </div>
  )
}
