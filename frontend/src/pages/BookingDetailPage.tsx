import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import AgreementForm from '../components/AgreementForm'
import AgreementView from '../components/AgreementView'
import Chat from '../components/Chat'
import ReviewForm from '../components/ReviewForm'
import SharePanel from '../components/SharePanel'
import { ReportDialog } from '../components/safety'
import { AgreementStatusBadge, BookingStatusBadge } from '../components/status'
import { Alert, Avatar, ErrorText, Field, Modal, PageLoader } from '../components/ui'
import { api } from '../lib/api'
import { dateTime, money } from '../lib/format'
import { keys } from '../lib/queries'
import type { Agreement, Booking } from '../lib/types'

export default function BookingDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const bookingId = Number(id)
  const queryClient = useQueryClient()
  const [proposing, setProposing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [changesFor, setChangesFor] = useState<Agreement | null>(null)
  const [changeNote, setChangeNote] = useState('')
  const [declined, setDeclined] = useState<number[]>([])
  const [acknowledged, setAcknowledged] = useState(false)

  const { data: b, isLoading, error } = useQuery({
    queryKey: keys.booking(bookingId),
    queryFn: () => api<Booking>(`/bookings/${bookingId}/`),
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
    queryClient.invalidateQueries({ queryKey: keys.messages(b?.conversation_id ?? 0) })
  }

  const bookingAction = useMutation({
    mutationFn: ({ name, body }: { name: string; body?: unknown }) =>
      api<Booking>(`/bookings/${bookingId}/${name}/`, { method: 'POST', body: body ?? {} }),
    onSuccess: () => {
      setCancelling(false)
      refresh()
    },
  })

  const agreementAction = useMutation({
    mutationFn: ({ agreementId, name, body }: { agreementId: number; name: string; body?: unknown }) =>
      api(`/agreements/${agreementId}/${name}/`, { method: 'POST', body: body ?? {} }),
    onSuccess: () => {
      setChangesFor(null)
      setChangeNote('')
      setDeclined([])
      setAcknowledged(false)
      refresh()
    },
  })

  if (isLoading) return <PageLoader />
  if (error || !b) return <ErrorText error={error} />

  const isLocal = b.my_role === 'LOCAL'
  const other = isLocal ? b.traveler : b.local
  const pending = b.pending_agreement
  const editable = b.status === 'DISCUSSING' || b.status === 'CONFIRMED'
  const started = new Date(b.start_at).getTime() <= Date.now()
  const canStart = b.status === 'CONFIRMED' && new Date(b.start_at).getTime() - Date.now() <= 3600_000
  const canComplete = (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') && started
  const canCancel = b.status === 'DISCUSSING' || b.status === 'CONFIRMED'
  const lateCancel = b.status === 'CONFIRMED' && new Date(b.start_at).getTime() - Date.now() < 24 * 3600_000

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar src={other.avatar} name={other.name} size="lg" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{b.service?.title ?? t('request.custom_experience')}</h1>
              <BookingStatusBadge status={b.status} />
            </div>
            <p className="text-sm text-stone-500">
              {t(isLocal ? 'booking.with_traveler' : 'booking.with_local', { name: other.name })} · {dateTime(b.start_at)} · {t('requests.people', { count: b.group_size })}
            </p>
            {!isLocal && <Link to={`/locals/${b.local.id}`} className="link text-xs">{t('booking.view_profile')}</Link>}
            {isLocal && <Link to={`/requests/${b.request.id}`} className="link text-xs">{t('booking.view_request')}</Link>}
          </div>
          {b.agreed_price !== null && (
            <div className="text-right">
              <p className="text-xs text-stone-500">{t('booking.agreed_price')}</p>
              <p className="text-xl font-bold">{money(b.agreed_price, b.currency)}</p>
            </div>
          )}
        </div>

        <StatusGuide booking={b} />

        {pending && (
          <section className="card border-amber-300 p-6 ring-2 ring-amber-100">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{t(b.current_agreement ? 'booking.proposed_change' : 'booking.proposal')}</h2>
              <AgreementStatusBadge status={pending.status} />
            </div>
            <AgreementView
              agreement={pending}
              selectable={
                !isLocal && pending.status === 'PROPOSED'
                  ? { declined, toggle: (sid) => setDeclined((d) => (d.includes(sid) ? d.filter((x) => x !== sid) : [...d, sid])) }
                  : undefined
              }
            />
            {!isLocal && pending.status === 'PROPOSED' && (
              <div className="mt-6 space-y-3 border-t border-stone-100 pt-4">
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
                  <span>{t('booking.acknowledge', { total: money(pending.total_price, pending.currency) })}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-primary"
                    disabled={!acknowledged || agreementAction.isPending}
                    onClick={() =>
                      agreementAction.mutate({
                        agreementId: pending.id,
                        name: 'accept',
                        body: { declined_stop_ids: declined, acknowledge_costs: acknowledged },
                      })
                    }
                  >
                    {t('booking.accept_proposal')}
                  </button>
                  <button className="btn-secondary" onClick={() => setChangesFor(pending)}>{t('booking.request_changes')}</button>
                </div>
              </div>
            )}
            {isLocal && pending.status === 'PROPOSED' && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4">
                <p className="text-sm text-stone-500">{t('booking.waiting_traveler')}</p>
                <button className="btn-ghost btn-sm text-red-600" onClick={() => agreementAction.mutate({ agreementId: pending.id, name: 'withdraw' })}>
                  {t('booking.withdraw')}
                </button>
              </div>
            )}
            {isLocal && pending.status === 'CHANGES_REQUESTED' && (
              <Alert tone="blue" title={t('booking.traveler_wants_changes')}>{pending.response_note}</Alert>
            )}
            <div className="mt-3"><ErrorText error={agreementAction.error} /></div>
          </section>
        )}

        {b.current_agreement && (
          <section className="card p-6">
            <h2 className="mb-4 text-lg font-semibold">{t('booking.confirmed_agreement')}</h2>
            <AgreementView agreement={b.current_agreement} />
          </section>
        )}

        {!b.current_agreement && !pending && (
          <Alert tone="blue" title={t('booking.no_proposal_title')}>
            {t(isLocal ? 'booking.no_proposal_local' : 'booking.no_proposal_traveler')}
          </Alert>
        )}

        {isLocal && editable && (
          <button className="btn-primary" onClick={() => setProposing(true)}>
            {b.current_agreement || pending ? t('booking.propose_change') : t('booking.propose')}
          </button>
        )}

        {b.agreement_history.length > 1 && (
          <details className="card p-4 text-sm">
            <summary className="cursor-pointer font-semibold">{t('booking.history')}</summary>
            <ul className="mt-3 space-y-1">
              {b.agreement_history.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <span>v{a.version}</span>
                  <AgreementStatusBadge status={a.status} />
                  <span>{money(a.total_price, a.currency)}</span>
                  <span className="text-xs text-stone-400">{dateTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {b.review_state.can_review && (
          <section className="card p-6">
            <ReviewForm booking={b} onDone={refresh} />
          </section>
        )}
        {b.review_state.my_review && (
          <Alert tone="green" title={t('review.thanks')}>
            {t(b.review_state.other_party_reviewed ? 'review.published' : 'review.pending_counterpart')}
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          {canStart && (
            <button className="btn-secondary" onClick={() => bookingAction.mutate({ name: 'start' })}>{t('booking.start')}</button>
          )}
          {canComplete && (
            <button className="btn-secondary" onClick={() => bookingAction.mutate({ name: 'complete' })}>{t('booking.complete')}</button>
          )}
          {canCancel && (
            <button className="btn-ghost text-red-600" onClick={() => setCancelling(true)}>{t('booking.cancel')}</button>
          )}
          <button className="btn-ghost text-stone-500" onClick={() => setReporting(true)}>{t('booking.report')}</button>
        </div>
        <ErrorText error={bookingAction.error} />
        {b.status === 'CANCELLED' && (
          <Alert tone="neutral" title={t('booking.cancelled_title')}>
            {b.cancel_reason}
            {b.late_cancellation && <p className="mt-1 font-medium">{t('booking.late_cancel_recorded')}</p>}
          </Alert>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        {b.conversation_id && <Chat conversationId={b.conversation_id} closed={b.status === 'CANCELLED'} otherName={other.name} />}
        {!isLocal && (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') && <SharePanel bookingId={b.id} />}
      </aside>

      <Modal open={proposing} onClose={() => setProposing(false)} title={t('booking.propose')} wide>
        <AgreementForm
          booking={b}
          onDone={() => {
            setProposing(false)
            refresh()
          }}
        />
      </Modal>

      <Modal open={cancelling} onClose={() => setCancelling(false)} title={t('booking.cancel')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            bookingAction.mutate({ name: 'cancel', body: { reason } })
          }}
        >
          {lateCancel && <Alert tone="amber">{t('booking.late_cancel_warning')}</Alert>}
          <Field label={t('booking.cancel_reason')} htmlFor="reason">
            <textarea id="reason" className="input min-h-24" required value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <ErrorText error={bookingAction.error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCancelling(false)}>{t('common.back')}</button>
            <button className="btn-danger" disabled={bookingAction.isPending}>{t('booking.confirm_cancel')}</button>
          </div>
        </form>
      </Modal>

      <Modal open={changesFor !== null} onClose={() => setChangesFor(null)} title={t('booking.request_changes')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (changesFor) agreementAction.mutate({ agreementId: changesFor.id, name: 'request-changes', body: { note: changeNote } })
          }}
        >
          <Field label={t('booking.changes_note')} htmlFor="changes">
            <textarea id="changes" className="input min-h-28" required value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
          </Field>
          <ErrorText error={agreementAction.error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setChangesFor(null)}>{t('common.cancel')}</button>
            <button className="btn-primary" disabled={agreementAction.isPending}>{t('common.send')}</button>
          </div>
        </form>
      </Modal>

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        target={{ booking: b.id }}
        allowDispute={['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status)}
      />
    </div>
  )
}

function StatusGuide({ booking }: { booking: Booking }) {
  const { t } = useTranslation()
  const steps = ['DISCUSSING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] as const
  const index = steps.indexOf(booking.status as (typeof steps)[number])
  if (index === -1) {
    return booking.status === 'DISPUTED' ? <Alert tone="red" title={t('booking_status.DISPUTED')}>{t('booking.disputed_body')}</Alert> : null
  }
  return (
    <div className="card p-4">
      <ol className="flex items-center gap-2 text-xs">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold ${i <= index ? 'bg-brand-700 text-white' : 'bg-stone-200 text-stone-500'}`}>
              {i + 1}
            </span>
            <span className={i <= index ? 'font-semibold text-stone-800' : 'text-stone-400'}>{t(`booking_status.${s}`)}</span>
            {i < steps.length - 1 && <span className="hidden h-px flex-1 bg-stone-200 sm:block" />}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-stone-600">{t(`booking.guide.${booking.status}_${booking.my_role}`)}</p>
    </div>
  )
}
