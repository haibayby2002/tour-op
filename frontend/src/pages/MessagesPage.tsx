import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { BookingStatusBadge } from '../components/status'
import { Avatar, EmptyState, ErrorText, PageHeader, PageLoader } from '../components/ui'
import { api } from '../lib/api'
import { relative } from '../lib/format'
import { keys } from '../lib/queries'
import type { ConversationSummary } from '../lib/types'

export default function MessagesPage() {
  const { t } = useTranslation()
  const { data, isLoading, error } = useQuery({
    queryKey: keys.conversations,
    queryFn: () => api<ConversationSummary[]>('/conversations/'),
    refetchInterval: 30_000,
  })

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('messages.title')} subtitle={t('messages.subtitle')} />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data?.length ? (
        <EmptyState title={t('messages.empty_title')}>{t('messages.empty_body')}</EmptyState>
      ) : (
        <ul className="card divide-y divide-stone-100">
          {data.map((c) => {
            const last = c.last_message
            const preview = !last
              ? t('messages.no_messages')
              : last.kind === 'SYSTEM'
                ? t(`system.${last.system_code}`, { ...last.metadata, defaultValue: last.system_code })
                : last.content
            return (
              <li key={c.id}>
                <Link to={`/bookings/${c.booking_id}`} className="flex items-center gap-3 p-4 hover:bg-stone-50">
                  <Avatar src={c.other.avatar} name={c.other.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{c.other.name}</p>
                      <BookingStatusBadge status={c.booking_status} />
                    </div>
                    <p className={`truncate text-sm ${c.unread_count ? 'font-semibold text-stone-900' : 'text-stone-500'}`}>{preview}</p>
                  </div>
                  <div className="text-right text-xs text-stone-400">
                    {last && relative(last.created_at)}
                    {c.unread_count > 0 && (
                      <span className="mt-1 block rounded-full bg-brand-700 px-2 text-center text-white">{c.unread_count}</span>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
