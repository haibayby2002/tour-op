/** Types for the staff console API (/api/v1/staff/, backend apps/staff). */

export interface Paged<T> {
  count: number
  page: number
  page_size: number
  results: T[]
}

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED'

export interface StaffPerson {
  id: number
  name: string
  display_name: string
  email: string
  avatar: string | null
  status: UserStatus
}

export interface AuditEntry {
  id: number
  actor: string | null
  actor_is_staff: boolean
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface StaffOverview {
  users: { total: number; travelers: number; locals: number; new_this_week: number; suspended: number }
  queues: {
    open_reports: number
    critical_reports: number
    pending_locals: number
    unverified_external_reviews: number
    disputed_bookings: number
  }
  bookings: Record<string, number>
  recent_activity: AuditEntry[]
}

export interface StaffUser extends StaffPerson {
  phone: string | null
  roles: ('TRAVELER' | 'LOCAL')[]
  is_staff: boolean
  date_joined: string
  last_login: string | null
  email_verified: boolean
  phone_verified: boolean
  city: string | null
  reports_received: number
}

export type ReportStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface StaffReport {
  id: number
  category: string
  severity: Severity
  status: ReportStatus
  description: string
  reporter: StaffPerson
  reported_user: StaffPerson | null
  assigned_to: StaffPerson | null
  booking_id: number | null
  opened_dispute: boolean
  resolution_note: string
  created_at: string
  resolved_at: string | null
  evidence?: { id: number; file: string; description: string; created_at: string }[]
  context?: { message: string | null; review: string | null; tour_request_id: number | null }
}

export type LocalReviewStatus = 'NOT_SUBMITTED' | 'PENDING' | 'MANUALLY_CHECKED' | 'REJECTED'

export interface StaffExternalReview {
  id: number
  platform: string
  url: string
  rating_text: string
  status: 'UNVERIFIED' | 'VERIFIED' | 'REJECTED'
  screenshot: string | null
}

export interface StaffLocal extends StaffPerson {
  city: string | null
  bio: string
  experience_summary: string
  areas: string
  years_experience: number
  price_min: number | null
  price_max: number | null
  currency: string
  completion: number
  review_status: LocalReviewStatus
  reviewed_at: string | null
  service_count: number
  email_verified: boolean
  phone_verified: boolean
  external_reviews: StaffExternalReview[]
  updated_at: string
}

export interface StaffReview {
  id: number
  booking_id: number
  reviewer: StaffPerson
  reviewee: StaffPerson
  reviewee_role: 'TRAVELER' | 'LOCAL'
  rating: number
  comment: string
  felt_safe: boolean | null
  is_hidden: boolean
  reported: boolean
  created_at: string
}

export interface StaffBooking {
  id: number
  status: string
  traveler: StaffPerson
  local: StaffPerson
  service: string | null
  start_at: string
  group_size: number
  agreed_price: number | null
  currency: string
}

export const staffKeys = {
  all: ['staff'] as const,
  overview: ['staff', 'overview'] as const,
  list: (name: string, params: Record<string, string>) => ['staff', name, params] as const,
  report: (id: number) => ['staff', 'report', id] as const,
}

/** Django admin, for raw data edits the console doesn't cover. It lives on the API host. */
export const DJANGO_ADMIN_URL = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/admin/`
