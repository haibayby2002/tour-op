import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import TravelerSummary from '../components/TravelerSummary'
import { ReportDialog } from '../components/safety'
import { RequestStatusBadge } from '../components/status'
import { Alert, Avatar, Badge, ErrorText, Field, Modal, PageLoader } from '../components/ui'
import { api } from '../lib/api'
import { dateTime, localName, money } from '../lib/format'
import { keys } from '../lib/queries'
import type { Booking, TourRequest } from '../lib/types'

export default function RequestDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const requestId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [noteFor, setNoteFor] = useState<'decline' | 'ask-info' | null>(null)
  const [note, setNote] = useState('')
  const [reporting, setReporting] = useState(false)

  const { data: r, isLoading, error } = useQuery({
    queryKey: keys.request(requestId),
    queryFn: () => api<TourRequest>(`/tour-requests/${requestId}/`),
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tour-requests'] })
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
  }
  const action = useMutation({
    mutationFn: ({ name, body }: { name: string; body?: unknown }) =>
      api<TourRequest | Booking>(`/tour-requests/${requestId}/${name}/`, { method: 'POST', body: body ?? {} }),
    onSuccess: (result, vars) => {
      refresh()
      setNoteFor(null)
      setNote('')
      if (vars.name === 'accept') navigate(`/bookings/${(result as Booking).id}`)
    },
  })

  if (isLoading) return <PageLoader />
  if (error || !r) return <ErrorText error={error} />
  const isLocal = r.my_role === 'LOCAL'
  const open = r.status === 'PENDING' || r.status === 'NEEDS_INFO'
  const other = isLocal ? r.traveler : r.local

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{t('request.detail_title')}</h1>
          <RequestStatusBadge status={r.status} />
        </div>

        {r.status === 'NEEDS_INFO' && (
          <Alert tone="blue" title={t('request.local_asks')}>{r.local_note}</Alert>
        )}
        {r.status === 'DECLINED' && r.local_note && <Alert tone="neutral" title={t('request.decline_reason')}>{r.local_note}</Alert>}
        {r.status === 'ACCEPTED' && r.booking_id && (
          <Alert tone="green" title={t('request.accepted_title')}>
            {t('request.accepted_body')} <Link to={`/bookings/${r.booking_id}`} className="link">{t('request.open_booking')}</Link>
          </Alert>
        )}

        <div className="card divide-y divide-stone-100">
          <Row label={t('request.service')}>{r.service ? `${r.service.title} · ${money(r.service.price, r.service.currency)}` : t('request.custom_experience')}</Row>
          <Row label={t('request.when')}>{dateTime(r.start_at)} → {dateTime(r.end_at)}</Row>
          <Row label={t('request.where')}>{r.city_name}{r.area && ` · ${r.area}`}</Row>
          <Row label={t('request.group_size')}>{t('requests.people', { count: r.group_size })}</Row>
          <Row label={t('request.budget')}>
            {r.budget_min || r.budget_max ? `${money(r.budget_min, r.currency)} – ${money(r.budget_max, r.currency)}` : '—'}
          </Row>
          <Row label={t('request.language')}>{r.language?.toUpperCase() ?? '—'}</Row>
          <Row label={t('request.interests')}>
            <div className="flex flex-wrap gap-1">{r.interests.map((i) => <Badge key={i.slug} tone="brand">{localName(i)}</Badge>)}</div>
          </Row>
          <Row label={t('request.wishes')}>{r.wishes || '—'}</Row>
          <Row label={t('request.avoid')}>
            {r.avoid_notes ? <span className="font-medium text-amber-800">{r.avoid_notes}</span> : '—'}
          </Row>
        </div>

        {isLocal && r.traveler_profile && (
          <div className="card p-6">
            <p className="mb-4 font-semibold">{t('request.about_traveler')}</p>
            <TravelerSummary profile={r.traveler_profile} showReviews />
          </div>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card flex items-center gap-3 p-4">
          <Avatar src={other.avatar} name={other.name} />
          <div>
            <p className="font-semibold">{other.name}</p>
            <p className="text-xs text-stone-500">{t(isLocal ? 'roles.TRAVELER' : 'roles.LOCAL')}</p>
          </div>
        </div>
        {open && isLocal && (
          <div className="card space-y-2 p-4">
            <p className="text-sm text-stone-600">{t('request.local_decide')}</p>
            <button className="btn-primary w-full" onClick={() => action.mutate({ name: 'accept' })} disabled={action.isPending}>
              {t('request.accept')}
            </button>
            <p className="text-xs text-stone-500">{t('request.accept_hint')}</p>
            <button className="btn-secondary w-full" onClick={() => setNoteFor('ask-info')}>{t('request.ask_info')}</button>
            <button className="btn-ghost w-full text-red-600" onClick={() => setNoteFor('decline')}>{t('request.decline')}</button>
          </div>
        )}
        {r.status === 'NEEDS_INFO' && !isLocal && <AnswerInfo request={r} onDone={refresh} />}
        {open && !isLocal && (
          <div className="card space-y-2 p-4">
            <p className="text-sm text-stone-600">{t('request.waiting')}</p>
            {r.expires_at && <p className="text-xs text-stone-500">{t('request.expires', { date: dateTime(r.expires_at) })}</p>}
            <button className="btn-ghost w-full text-red-600" onClick={() => action.mutate({ name: 'cancel' })} disabled={action.isPending}>
              {t('request.cancel')}
            </button>
          </div>
        )}
        <ErrorText error={action.error} />
        <button className="btn-ghost btn-sm text-stone-500" onClick={() => setReporting(true)}>{t('report.button')}</button>
      </aside>

      <Modal open={noteFor !== null} onClose={() => setNoteFor(null)} title={t(noteFor === 'decline' ? 'request.decline' : 'request.ask_info')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (noteFor) action.mutate({ name: noteFor, body: { note } })
          }}
        >
          <Field label={t(noteFor === 'decline' ? 'request.decline_note' : 'request.ask_info_note')} htmlFor="note">
            <textarea id="note" className="input min-h-24" value={note} onChange={(e) => setNote(e.target.value)} required={noteFor === 'ask-info'} />
          </Field>
          <ErrorText error={action.error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setNoteFor(null)}>{t('common.cancel')}</button>
            <button className={noteFor === 'decline' ? 'btn-danger' : 'btn-primary'} disabled={action.isPending}>{t('common.send')}</button>
          </div>
        </form>
      </Modal>
      <ReportDialog open={reporting} onClose={() => setReporting(false)} target={{ tour_request: r.id }} defaultCategory={isLocal ? 'SUSPICIOUS_REQUEST' : ''} />
    </div>
  )
}

function AnswerInfo({ request, onDone }: { request: TourRequest; onDone: () => void }) {
  const { t } = useTranslation()
  const [wishes, setWishes] = useState(request.wishes)
  const mutation = useMutation({
    mutationFn: () => api(`/tour-requests/${request.id}/`, { method: 'PATCH', body: { wishes } }),
    onSuccess: onDone,
  })
  return (
    <form
      className="card space-y-2 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        mutation.mutate()
      }}
    >
      <label className="label" htmlFor="answer">{t('request.answer_info')}</label>
      <textarea id="answer" className="input min-h-28" value={wishes} onChange={(e) => setWishes(e.target.value)} />
      <ErrorText error={mutation.error} />
      <button className="btn-primary w-full" disabled={mutation.isPending}>{t('request.send_update')}</button>
    </form>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 px-5 py-3 sm:grid-cols-[160px_1fr]">
      <span className="text-sm text-stone-500">{label}</span>
      <span className="text-sm text-stone-800">{children}</span>
    </div>
  )
}
