import { useTranslation } from 'react-i18next'

import type { AgreementStatus, BookingStatus, RequestStatus } from '../lib/types'
import { Badge } from './ui'

const requestTone = {
  PENDING: 'amber',
  NEEDS_INFO: 'blue',
  ACCEPTED: 'green',
  DECLINED: 'neutral',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
} as const

const bookingTone = {
  DISCUSSING: 'blue',
  CONFIRMED: 'green',
  IN_PROGRESS: 'brand',
  COMPLETED: 'neutral',
  CANCELLED: 'neutral',
  DISPUTED: 'red',
} as const

const agreementTone = {
  PROPOSED: 'amber',
  ACCEPTED: 'green',
  CHANGES_REQUESTED: 'blue',
  WITHDRAWN: 'neutral',
  SUPERSEDED: 'neutral',
} as const

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const { t } = useTranslation()
  return <Badge tone={requestTone[status]}>{t(`request_status.${status}`)}</Badge>
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useTranslation()
  return <Badge tone={bookingTone[status]}>{t(`booking_status.${status}`)}</Badge>
}

export function AgreementStatusBadge({ status }: { status: AgreementStatus }) {
  const { t } = useTranslation()
  return <Badge tone={agreementTone[status]}>{t(`agreement_status.${status}`)}</Badge>
}
