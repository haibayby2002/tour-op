import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '../../auth/AuthContext'
import { Button, colors, ErrorText, Input, styles, Text } from '../../components/ui'
import { api } from '../../lib/api'
import { time } from '../../lib/format'
import { useSocket } from '../../lib/useSocket'
import type { Message } from '../../lib/types'

interface Page {
  results: Message[]
  has_more: boolean
}

const merge = (list: Message[], m: Message) => (list.some((x) => x.id === m.id) ? list : [...list, m].sort((a, b) => a.id - b.id))

export default function ChatScreen() {
  const { t } = useTranslation()
  const { id, name, closed } = useLocalSearchParams<{ id: string; name?: string; closed?: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [typing, setTyping] = useState(false)
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastTyping = useRef(0)
  const list = useRef<FlatList<Message>>(null)
  const queryKey = ['conversations', Number(id), 'messages']

  const { data } = useQuery({ queryKey, queryFn: () => api<Page>(`/conversations/${id}/messages/`, { query: { limit: 100 } }) })
  const messages = data?.results ?? []

  const markRead = useCallback(() => {
    api(`/conversations/${id}/read/`, { method: 'POST' })
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
      .catch(() => undefined)
  }, [id, queryClient])

  const onEvent = useCallback(
    (event: Record<string, unknown>) => {
      if (event.type === 'message') {
        const m = event.message as Message
        queryClient.setQueryData<Page>(queryKey, (old) => ({ has_more: old?.has_more ?? false, results: merge(old?.results ?? [], m) }))
        if (m.kind === 'SYSTEM') queryClient.invalidateQueries({ queryKey: ['bookings'] })
        if (m.sender_id !== user?.id) {
          setTyping(false)
          markRead()
        }
      } else if (event.type === 'typing') {
        setTyping(true)
        clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setTyping(false), 3000)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, id, user?.id, markRead],
  )
  const { send, connected } = useSocket(`/ws/conversations/${id}/`, onEvent)

  useEffect(markRead, [markRead])

  const submit = async () => {
    const content = draft.trim()
    if (!content) return
    setError(null)
    try {
      const m = await api<Message>(`/conversations/${id}/messages/`, { body: { content } })
      queryClient.setQueryData<Page>(queryKey, (old) => ({ has_more: old?.has_more ?? false, results: merge(old?.results ?? [], m) }))
      setDraft('')
    } catch (e) {
      setError(e)
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: t('chat.title', { name: name ?? '' }), headerRight: () => <Text style={{ color: connected ? colors.green : colors.muted }}>● {connected ? t('chat.live') : t('chat.offline')}</Text> }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            <Text style={[styles.hint, { textAlign: 'center', backgroundColor: colors.surface, padding: 8, borderRadius: 8 }]}>🔒 {t('chat.privacy_banner')}</Text>
          }
          ListFooterComponent={typing ? <Text style={styles.hint}>{t('chat.typing', { name: name ?? '' })}</Text> : null}
          renderItem={({ item: m }) => {
            if (m.kind === 'SYSTEM') {
              return (
                <Text style={[styles.hint, { textAlign: 'center' }]}>
                  — {t(`system.${m.system_code}`, { ...m.metadata, defaultValue: m.system_code })} · {time(m.created_at)} —
                </Text>
              )
            }
            const mine = m.sender_id === user?.id
            const blocked = m.moderation_status === 'BLOCKED'
            return (
              <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View
                  style={{
                    maxWidth: '82%',
                    borderRadius: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: blocked ? colors.redLight : mine ? colors.brand : colors.surface,
                    borderWidth: mine && !blocked ? 0 : 1,
                    borderColor: blocked ? colors.redBorder : colors.border,
                  }}
                >
                  <Text style={{ color: blocked ? colors.red : mine ? colors.onBrand : colors.text }}>{m.content}</Text>
                </View>
                {blocked && <Text style={{ fontSize: 12, color: colors.red }}>⛔ {t('chat.blocked_notice')}</Text>}
                {m.moderation_status === 'WARNED' && (
                  <Text style={{ fontSize: 12, color: colors.amber }}>⚠ {t(mine ? 'chat.warned_sender' : 'chat.warned_recipient')}</Text>
                )}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={styles.hint}>{time(m.created_at)}</Text>
                  {!mine && (
                    <Pressable onPress={() => router.push({ pathname: '/report', params: { message: String(m.id), category: 'OFF_PLATFORM_CONTACT' } })}>
                      <Text style={styles.hint}>{t('chat.report')}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )
          }}
        />
        {closed ? (
          <Text style={[styles.hint, { padding: 16, textAlign: 'center' }]}>{t('chat.closed')}</Text>
        ) : (
          <View style={{ padding: 10, gap: 6, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <ErrorText error={error} />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <Input
                style={{ flex: 1, maxHeight: 120 }}
                multiline
                value={draft}
                placeholder={t('chat.placeholder')}
                onChangeText={(v) => {
                  setDraft(v)
                  if (Date.now() - lastTyping.current > 2000) {
                    lastTyping.current = Date.now()
                    send({ type: 'typing' })
                  }
                }}
              />
              <Button title={t('chat.send')} onPress={submit} disabled={!draft.trim()} />
            </View>
            <Text style={[styles.hint, { fontSize: 11 }]}>{t('chat.agreement_hint')}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
