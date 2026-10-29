import { useState } from 'react'
import { Pressable, RefreshControl, Share, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import AgreementCard from '../../components/AgreementCard'
import { BookingStatusBadge } from '../../components/status'
import { Avatar, Button, Card, colors, ErrorText, Field, H2, Input, Loading, Notice, Screen, styles, Text } from '../../components/ui'
import { api } from '../../lib/api'
import { dateTime, money } from '../../lib/format'
import type { Booking, TripShare } from '../../lib/types'

export default function BookingScreen() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [declined, setDeclined] = useState<number[]>([])
  const [acknowledged, setAcknowledged] = useState(false)
  const [changeNote, setChangeNote] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState<string | null>(null)

  const { data: b, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['bookings', 'detail', Number(id)],
    queryFn: () => api<Booking>(`/bookings/${id}/`),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['bookings'] })

  const bookingAction = useMutation({
    mutationFn: ({ name, body }: { name: string; body?: unknown }) => api(`/bookings/${id}/${name}/`, { method: 'POST', body: body ?? {} }),
    onSuccess: () => {
      setCancelReason(null)
      refresh()
    },
  })
  const agreementAction = useMutation({
    mutationFn: ({ agreementId, name, body }: { agreementId: number; name: string; body?: unknown }) =>
      api(`/agreements/${agreementId}/${name}/`, { method: 'POST', body: body ?? {} }),
    onSuccess: () => {
      setDeclined([])
      setAcknowledged(false)
      setChangeNote(null)
      refresh()
    },
  })
  const share = useMutation({
    mutationFn: () => api<TripShare>(`/bookings/${id}/shares/`, { body: { include_itinerary: true } }),
    onSuccess: async (s) => {
      await Share.share({ message: `${t('share.message')} ${s.url}` })
    },
  })

  if (isLoading) return <Loading />
  if (error || !b) return <Screen><ErrorText error={error} /></Screen>

  const isLocal = b.my_role === 'LOCAL'
  const other = isLocal ? b.traveler : b.local
  const pending = b.pending_agreement
  const editable = b.status === 'DISCUSSING' || b.status === 'CONFIRMED'
  const started = new Date(b.start_at).getTime() <= Date.now()
  const canStart = b.status === 'CONFIRMED' && new Date(b.start_at).getTime() - Date.now() <= 3600_000
  const canComplete = (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') && started
  const lateCancel = b.status === 'CONFIRMED' && new Date(b.start_at).getTime() - Date.now() < 24 * 3600_000
  const guideKey = ['DISCUSSING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status) ? `booking.guide.${b.status}_${b.my_role}` : null

  return (
    <Screen refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}>
      <Stack.Screen options={{ title: b.service?.title ?? t('request.custom_experience') }} />
      <Card>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Avatar src={other.avatar} name={other.name} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>{other.name}</Text>
            <Text style={styles.hint}>{dateTime(b.start_at)} · {t('requests.people', { count: b.group_size })}</Text>
          </View>
          <BookingStatusBadge status={b.status} />
        </View>
        {b.agreed_price !== null && (
          <Text style={{ fontWeight: '700', fontSize: 18 }}>{t('booking.agreed_price')}: {money(b.agreed_price, b.currency)}</Text>
        )}
        {guideKey && <Text style={styles.hint}>{t(guideKey)}</Text>}
        {b.conversation_id && (
          <Button title={t('mobile.open_chat')} variant="secondary" onPress={() => router.push({ pathname: '/chat/[id]', params: { id: String(b.conversation_id), name: other.name, closed: b.status === 'CANCELLED' ? '1' : '' } })} />
        )}
      </Card>

      {b.status === 'DISPUTED' && <Notice tone="red" title={t('booking_status.DISPUTED')}>{t('booking.disputed_body')}</Notice>}

      {pending && (
        <>
          <H2>{t(b.current_agreement ? 'booking.proposed_change' : 'booking.proposal')}</H2>
          <AgreementCard
            agreement={pending}
            declined={declined}
            onToggleStop={!isLocal && pending.status === 'PROPOSED' ? (sid) => setDeclined((d) => (d.includes(sid) ? d.filter((x) => x !== sid) : [...d, sid])) : undefined}
          />
          {!isLocal && pending.status === 'PROPOSED' && (
            <Card>
              <Pressable onPress={() => setAcknowledged((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: acknowledged }}>
                <Text style={styles.body}>{acknowledged ? '☑' : '☐'} {t('booking.acknowledge', { total: money(pending.total_price, pending.currency) })}</Text>
              </Pressable>
              <Button
                title={t('booking.accept_proposal')}
                disabled={!acknowledged}
                loading={agreementAction.isPending}
                onPress={() => agreementAction.mutate({ agreementId: pending.id, name: 'accept', body: { declined_stop_ids: declined, acknowledge_costs: true } })}
              />
              {changeNote === null ? (
                <Button title={t('booking.request_changes')} variant="secondary" onPress={() => setChangeNote('')} />
              ) : (
                <>
                  <Field label={t('booking.changes_note')}>
                    <Input multiline value={changeNote} onChangeText={setChangeNote} />
                  </Field>
                  <Button title={t('common.send')} onPress={() => agreementAction.mutate({ agreementId: pending.id, name: 'request-changes', body: { note: changeNote } })} />
                </>
              )}
            </Card>
          )}
          {isLocal && pending.status === 'PROPOSED' && (
            <Button title={t('booking.withdraw')} variant="ghost" onPress={() => agreementAction.mutate({ agreementId: pending.id, name: 'withdraw' })} />
          )}
          {isLocal && pending.status === 'CHANGES_REQUESTED' && (
            <Notice tone="blue" title={t('booking.traveler_wants_changes')}>{pending.response_note}</Notice>
          )}
        </>
      )}
      <ErrorText error={agreementAction.error} />

      {b.current_agreement && (
        <>
          <H2>{t('booking.confirmed_agreement')}</H2>
          <AgreementCard agreement={b.current_agreement} />
        </>
      )}
      {!b.current_agreement && !pending && (
        <Notice tone="blue" title={t('booking.no_proposal_title')}>{t(isLocal ? 'booking.no_proposal_local' : 'booking.no_proposal_traveler')}</Notice>
      )}
      {isLocal && editable && (
        <Button
          title={b.current_agreement || pending ? t('booking.propose_change') : t('booking.propose')}
          onPress={() => router.push(`/propose/${b.id}`)}
        />
      )}

      {b.review_state.can_review && <Button title={t('review.submit')} onPress={() => router.push(`/review/${b.id}`)} />}
      {b.review_state.my_review && (
        <Notice tone="green" title={t('review.thanks')}>{t(b.review_state.other_party_reviewed ? 'review.published' : 'review.pending_counterpart')}</Notice>
      )}

      {!isLocal && (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') && (
        <Card>
          <Text style={{ fontWeight: '600' }}>{t('share.title')}</Text>
          <Text style={styles.hint}>{t('share.body')}</Text>
          <Button title={t('mobile.share_link')} variant="secondary" onPress={() => share.mutate()} loading={share.isPending} />
          {share.data && (
            <Button small variant="ghost" title={t('mobile.copy_link')} onPress={() => Clipboard.setStringAsync(share.data.url)} />
          )}
          <ErrorText error={share.error} />
        </Card>
      )}

      {canStart && <Button title={t('booking.start')} variant="secondary" onPress={() => bookingAction.mutate({ name: 'start' })} />}
      {canComplete && <Button title={t('booking.complete')} variant="secondary" onPress={() => bookingAction.mutate({ name: 'complete' })} />}
      {editable &&
        (cancelReason === null ? (
          <Button title={t('booking.cancel')} variant="ghost" onPress={() => setCancelReason('')} />
        ) : (
          <Card>
            {lateCancel && <Notice>{t('booking.late_cancel_warning')}</Notice>}
            <Field label={t('booking.cancel_reason')}>
              <Input multiline value={cancelReason} onChangeText={setCancelReason} />
            </Field>
            <Button title={t('booking.confirm_cancel')} variant="danger" disabled={!cancelReason.trim()} onPress={() => bookingAction.mutate({ name: 'cancel', body: { reason: cancelReason } })} />
            <Button title={t('common.back')} variant="ghost" onPress={() => setCancelReason(null)} />
          </Card>
        ))}
      <ErrorText error={bookingAction.error} />
      {b.status === 'CANCELLED' && (
        <Notice tone="neutral" title={t('booking.cancelled_title')}>{b.cancel_reason}</Notice>
      )}
      <Button
        title={t('booking.report')}
        variant="ghost"
        onPress={() =>
          router.push({
            pathname: '/report',
            params: { booking: String(b.id), dispute: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status) ? '1' : '' },
          })
        }
      />
    </Screen>
  )
}
