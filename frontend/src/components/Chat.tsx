import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { time } from '../lib/format'
import { keys } from '../lib/queries'
import { useSocket } from '../lib/useSocket'
import type { Message } from '../lib/types'
import { ReportDialog } from './safety'
import { Alert, cx, ErrorText, Spinner } from './ui'

interface Page {
  results: Message[]
  has_more: boolean
}

function mergeMessages(list: Message[], incoming: Message) {
  if (list.some((m) => m.id === incoming.id)) return list
  return [...list, incoming].sort((a, b) => a.id - b.id)
}

export default function Chat({ conversationId, closed, otherName }: { conversationId: number; closed: boolean; otherName: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [typing, setTyping] = useState(false)
  const [reporting, setReporting] = useState<number | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastTypingSent = useRef(0)

  const queryKey = keys.messages(conversationId)
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => api<Page>(`/conversations/${conversationId}/messages/`, { query: { limit: 100 } }),
  })
  const messages = data?.results ?? []

  const markRead = useCallback(() => {
    api(`/conversations/${conversationId}/read/`, { method: 'POST' })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: keys.unread })
        queryClient.invalidateQueries({ queryKey: keys.conversations })
      })
      .catch(() => undefined)
  }, [conversationId, queryClient])

  const onEvent = useCallback(
    (event: Record<string, unknown>) => {
      if (event.type === 'message') {
        const message = event.message as Message
        queryClient.setQueryData<Page>(queryKey, (old) => ({ has_more: old?.has_more ?? false, results: mergeMessages(old?.results ?? [], message) }))
        if (message.kind === 'SYSTEM') queryClient.invalidateQueries({ queryKey: ['bookings'] })
        if (message.sender_id !== user?.id) {
          setTyping(false)
          markRead()
        }
      } else if (event.type === 'typing') {
        setTyping(true)
        clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setTyping(false), 3000)
      }
    },
    [queryClient, queryKey, user?.id, markRead],
  )
  const { send, connected } = useSocket(`/ws/conversations/${conversationId}/`, onEvent)

  useEffect(() => {
    markRead()
  }, [markRead])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, typing])

  const submit = async () => {
    const content = draft.trim()
    if (!content) return
    setError(null)
    try {
      // REST gives us the authoritative result (incl. moderation) even if the socket is down.
      const message = await api<Message>(`/conversations/${conversationId}/messages/`, { body: { content } })
      queryClient.setQueryData<Page>(queryKey, (old) => ({ has_more: old?.has_more ?? false, results: mergeMessages(old?.results ?? [], message) }))
      setDraft('')
    } catch (e) {
      setError(e)
    }
  }

  const onType = (value: string) => {
    setDraft(value)
    if (Date.now() - lastTypingSent.current > 2000) {
      lastTypingSent.current = Date.now()
      send({ type: 'typing' })
    }
  }

  return (
    <div className="card flex h-[600px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <p className="font-semibold">{t('chat.title', { name: otherName })}</p>
        <span className={cx('flex items-center gap-1.5 text-xs', connected ? 'text-emerald-600' : 'text-stone-400')}>
          <span className={cx('h-2 w-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-stone-300')} />
          {connected ? t('chat.live') : t('chat.offline')}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto bg-stone-50 px-4 py-4">
        <p className="mx-auto max-w-sm rounded-lg bg-surface px-3 py-2 text-center text-xs text-stone-500 ring-1 ring-stone-200">
          🔒 {t('chat.privacy_banner')}
        </p>
        {isLoading && <Spinner />}
        {messages.map((m) => {
          if (m.kind === 'SYSTEM') {
            return (
              <p key={m.id} className="py-1 text-center text-xs text-stone-500">
                — {t(`system.${m.system_code}`, { ...m.metadata, defaultValue: m.system_code })} · {time(m.created_at)} —
              </p>
            )
          }
          const mine = m.sender_id === user?.id
          return (
            <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className="max-w-[80%]">
                <div
                  className={cx(
                    'rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line',
                    m.moderation_status === 'BLOCKED'
                      ? 'bg-red-50 text-red-800 ring-1 ring-red-200'
                      : mine
                        ? 'bg-brand-700 text-white'
                        : 'bg-surface text-stone-800 ring-1 ring-stone-200',
                  )}
                >
                  {m.content}
                </div>
                {m.moderation_status === 'BLOCKED' && <p className="mt-1 text-xs text-red-700">⛔ {t('chat.blocked_notice')}</p>}
                {m.moderation_status === 'WARNED' && (
                  <p className="mt-1 text-xs text-amber-700">⚠ {t(mine ? 'chat.warned_sender' : 'chat.warned_recipient')}</p>
                )}
                <p className={cx('mt-0.5 flex gap-2 text-[11px] text-stone-400', mine ? 'justify-end' : 'justify-start')}>
                  {time(m.created_at)}
                  {!mine && (
                    <button className="hover:text-red-600" onClick={() => setReporting(m.id)}>{t('chat.report')}</button>
                  )}
                </p>
              </div>
            </div>
          )
        })}
        {typing && <p className="text-xs text-stone-400 italic">{t('chat.typing', { name: otherName })}</p>}
        <div ref={bottom} />
      </div>
      {closed ? (
        <div className="border-t border-stone-100 p-3">
          <Alert tone="neutral">{t('chat.closed')}</Alert>
        </div>
      ) : (
        <form
          className="border-t border-stone-100 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          {error ? <div className="mb-2"><ErrorText error={error} /></div> : null}
          <div className="flex gap-2">
            <textarea
              className="input max-h-32 min-h-10 resize-none"
              rows={1}
              value={draft}
              placeholder={t('chat.placeholder')}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            <button className="btn-primary" disabled={!draft.trim()}>{t('chat.send')}</button>
          </div>
          <p className="mt-1.5 text-[11px] text-stone-400">{t('chat.agreement_hint')}</p>
        </form>
      )}
      <ReportDialog
        open={reporting !== null}
        onClose={() => setReporting(null)}
        target={{ message: reporting ?? undefined }}
        defaultCategory="OFF_PLATFORM_CONTACT"
      />
    </div>
  )
}
