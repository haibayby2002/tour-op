import { useState } from 'react'
import { View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { RequestStatusBadge } from '../../components/status'
import { RatingSummary, TrustBadges } from '../../components/trust'
import { Avatar, Badge, Button, Card, ErrorText, Field, H2, Input, Loading, Notice, Row, Screen, styles, Text } from '../../components/ui'
import { api } from '../../lib/api'
import { dateTime, localName, money } from '../../lib/format'
import type { Booking, TourRequest } from '../../lib/types'

export default function RequestDetailScreen() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'decline' | 'ask-info' | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)

  const { data: r, isLoading, error } = useQuery({
    queryKey: ['tour-requests', 'detail', Number(id)],
    queryFn: () => api<TourRequest>(`/tour-requests/${id}/`),
  })
  const action = useMutation({
    mutationFn: ({ name, body }: { name: string; body?: unknown }) =>
      name === 'update'
        ? api<TourRequest>(`/tour-requests/${id}/`, { method: 'PATCH', body })
        : api<TourRequest | Booking>(`/tour-requests/${id}/${name}/`, { method: 'POST', body: body ?? {} }),
    onSuccess: (result, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tour-requests'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setMode(null)
      setNote('')
      if (vars.name === 'accept') router.replace(`/bookings/${(result as Booking).id}`)
    },
  })

  if (isLoading) return <Loading />
  if (error || !r) return <Screen><ErrorText error={error} /></Screen>
  const isLocal = r.my_role === 'LOCAL'
  const open = r.status === 'PENDING' || r.status === 'NEEDS_INFO'
  const other = isLocal ? r.traveler : r.local
  const tp = r.traveler_profile

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar src={other.avatar} name={other.name} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 17 }}>{other.name}</Text>
          <Text style={styles.hint}>{t(isLocal ? 'roles.TRAVELER' : 'roles.LOCAL')}</Text>
        </View>
        <RequestStatusBadge status={r.status} />
      </View>

      {r.status === 'NEEDS_INFO' && <Notice tone="blue" title={t('request.local_asks')}>{r.local_note}</Notice>}
      {r.status === 'DECLINED' && r.local_note ? <Notice tone="neutral" title={t('request.decline_reason')}>{r.local_note}</Notice> : null}
      {r.booking_id && <Button title={t('request.open_booking')} onPress={() => router.push(`/bookings/${r.booking_id}`)} />}

      <Card>
        <Row label={t('request.service')} value={r.service ? `${r.service.title} · ${money(r.service.price, r.service.currency)}` : t('request.custom_experience')} />
        <Row label={t('request.when')} value={`${dateTime(r.start_at)} → ${dateTime(r.end_at)}`} />
        <Row label={t('request.where')} value={`${r.city_name}${r.area ? ` · ${r.area}` : ''}`} />
        <Row label={t('request.group_size')} value={t('requests.people', { count: r.group_size })} />
        <Row label={t('request.budget')} value={r.budget_max ? money(r.budget_max, r.currency) : '—'} />
        <Row label={t('request.interests')} value={r.interests.map(localName).join(', ') || '—'} />
        <Row label={t('request.wishes')} value={r.wishes || '—'} />
        <Row label={t('request.avoid')} value={r.avoid_notes || '—'} />
      </Card>

      {isLocal && tp && (
        <Card>
          <H2>{t('request.about_traveler')}</H2>
          <RatingSummary trust={tp.trust} />
          <TrustBadges trust={tp.trust} showMissing />
          {tp.bio ? <Text style={styles.body}>{tp.bio}</Text> : null}
          {tp.traveler && (
            <>
              <Row label={t('traveler.style')} value={tp.traveler.travel_style ? t(`travel_style.${tp.traveler.travel_style}`) : '—'} />
              <Row label={t('traveler.avoid')} value={tp.traveler.avoid_notes || '—'} />
            </>
          )}
          <View style={styles.wrap}>{tp.languages.map((l) => <Badge key={l.code} label={localName(l)} />)}</View>
          {tp.trust.completed_tours > 0 && <Text style={styles.hint}>{t('traveler.completed_tours', { count: tp.trust.completed_tours })}</Text>}
        </Card>
      )}

      {open && isLocal && !mode && (
        <Card>
          <Text style={styles.hint}>{t('request.local_decide')}</Text>
          <Button title={t('request.accept')} onPress={() => action.mutate({ name: 'accept' })} loading={action.isPending} />
          <Text style={styles.hint}>{t('request.accept_hint')}</Text>
          <Button title={t('request.ask_info')} variant="secondary" onPress={() => setMode('ask-info')} />
          <Button title={t('request.decline')} variant="ghost" onPress={() => setMode('decline')} />
        </Card>
      )}
      {mode && (
        <Card>
          <Field label={t(mode === 'decline' ? 'request.decline_note' : 'request.ask_info_note')}>
            <Input multiline value={note} onChangeText={setNote} />
          </Field>
          <Button
            title={t('common.send')}
            variant={mode === 'decline' ? 'danger' : 'primary'}
            onPress={() => action.mutate({ name: mode, body: { note } })}
            loading={action.isPending}
          />
          <Button title={t('common.cancel')} variant="ghost" onPress={() => setMode(null)} />
        </Card>
      )}
      {r.status === 'NEEDS_INFO' && !isLocal && (
        <Card>
          <Field label={t('request.answer_info')}>
            <Input multiline value={answer ?? r.wishes} onChangeText={setAnswer} />
          </Field>
          <Button title={t('request.send_update')} onPress={() => action.mutate({ name: 'update', body: { wishes: answer ?? r.wishes } })} loading={action.isPending} />
        </Card>
      )}
      {open && !isLocal && (
        <Card>
          <Text style={styles.hint}>{t('request.waiting')}</Text>
          {r.expires_at && <Text style={styles.hint}>{t('request.expires', { date: dateTime(r.expires_at) })}</Text>}
          <Button title={t('request.cancel')} variant="ghost" onPress={() => action.mutate({ name: 'cancel' })} />
        </Card>
      )}
      <ErrorText error={action.error} />
      <Button
        title={t('report.button')}
        variant="ghost"
        onPress={() => router.push({ pathname: '/report', params: { tour_request: String(r.id), category: isLocal ? 'SUSPICIOUS_REQUEST' : '' } })}
      />
    </Screen>
  )
}
