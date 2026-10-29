import { useTranslation } from 'react-i18next'

import type { AgreementStatus, BookingStatus, RequestStatus, StopKind } from '../lib/types'
import { Badge } from './ui'

const requestTone = { PENDING: 'amber', NEEDS_INFO: 'blue', ACCEPTED: 'green', DECLINED: 'neutral', CANCELLED: 'neutral', EXPIRED: 'neutral' } as const
const bookingTone = { DISCUSSING: 'blue', CONFIRMED: 'green', IN_PROGRESS: 'brand', COMPLETED: 'neutral', CANCELLED: 'neutral', DISPUTED: 'red' } as const
const agreementTone = { PROPOSED: 'amber', ACCEPTED: 'green', CHANGES_REQUESTED: 'blue', WITHDRAWN: 'neutral', SUPERSEDED: 'neutral' } as const
const stopTone = { SIGHTSEEING: 'brand', FOOD: 'blue', SHOPPING: 'amber', PARTNER: 'red', TRANSPORT: 'neutral', ACTIVITY: 'brand', OTHER: 'neutral' } as const

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const { t } = useTranslation()
  return <Badge tone={requestTone[status]} label={t(`request_status.${status}`)} />
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useTranslation()
  return <Badge tone={bookingTone[status]} label={t(`booking_status.${status}`)} />
}

export function AgreementStatusBadge({ status }: { status: AgreementStatus }) {
  const { t } = useTranslation()
  return <Badge tone={agreementTone[status]} label={t(`agreement_status.${status}`)} />
}

export function StopKindBadge({ kind }: { kind: StopKind }) {
  const { t } = useTranslation()
  return <Badge tone={stopTone[kind]} label={t(`stop_kind.${kind}`)} />
}
