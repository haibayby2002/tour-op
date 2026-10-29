import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import en from './en'
import vi from './vi'

type Tree = { [key: string]: string | unknown[] | Tree }

// Lists (read with returnObjects) count as one key.
function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' || Array.isArray(v) ? [`${prefix}${k}`] : flatten(v, `${prefix}${k}.`),
  )
}
const normalize = (key: string) => key.replace(/_(one|other)$/, '')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'i18n' || name === 'test' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

const enKeys = new Set(flatten(en as unknown as Tree).map(normalize))
const viKeys = new Set(flatten(vi as unknown as Tree).map(normalize))

// Keys built at runtime from backend enums / codes.
const dynamic: string[] = [
  ...['TRAVELER', 'LOCAL'].flatMap((r) => [`roles.${r}`, `auth.role_hint_${r}`]),
  ...['PENDING', 'NEEDS_INFO', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'].map((s) => `request_status.${s}`),
  ...['DISCUSSING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED'].map((s) => `booking_status.${s}`),
  ...['PROPOSED', 'ACCEPTED', 'CHANGES_REQUESTED', 'WITHDRAWN', 'SUPERSEDED'].map((s) => `agreement_status.${s}`),
  ...['SIGHTSEEING', 'FOOD', 'SHOPPING', 'PARTNER', 'TRANSPORT', 'ACTIVITY', 'OTHER'].map((k) => `stop_kind.${k}`),
  ...['DISCUSSING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].flatMap((s) => [`booking.guide.${s}_TRAVELER`, `booking.guide.${s}_LOCAL`]),
  ...['avatar', 'bio', 'languages', 'interests', 'travel_style', 'wishes', 'city', 'areas', 'experience', 'pricing', 'services', 'photos'].flatMap(
    (k) => [`completion.items.${k}`, `completion.hints.${k}`],
  ),
  ...['common_language', 'shared_interests', 'offers_category', 'available_on_date', 'within_budget', 'highly_rated'].map((c) => `match.${c}`),
  ...['match', 'rating', 'price_asc', 'price_desc'].map((s) => `explore.sort_${s}`),
  ...['general', 'traveler', 'local', 'photos', 'services', 'availability', 'external'].map((s) => `profile.tabs.${s}`),
  ...['OVERCHARGING', 'ITINERARY_DEVIATION', 'INAPPROPRIATE_BEHAVIOUR', 'SAFETY', 'OFF_PLATFORM_CONTACT', 'NO_SHOW', 'FAKE_PROFILE', 'FAKE_REVIEW', 'SUSPICIOUS_REQUEST', 'OTHER'].map(
    (c) => `report.categories.${c}`,
  ),
  ...['request_accepted', 'agreement_proposed', 'agreement_accepted', 'agreement_changes_requested', 'booking_confirmed', 'booking_in_progress', 'booking_completed', 'booking_cancelled', 'booking_disputed'].map(
    (c) => `system.${c}`,
  ),
  ...['traveler', 'local'].flatMap((r) => [`completion.title_${r}`, `completion.why_${r}`]),
  ...['OPEN', 'MATCHED', 'CLOSED', 'EXPIRED'].map((s) => `wishes.status.${s}`),
  ...['PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN'].map((s) => `wishes.offer_status.${s}`),
  'system.wish_offer_accepted',
  ...['explore', 'wishes', 'requests', 'bookings', 'messages'].map((tab) => `nav.tab_${tab}`),
  ...['food', 'perspective', 'interests', 'confidence'].map((s) => `home.carousel.${s}`),
  ...['food', 'culture', 'city', 'wish'].flatMap((tile) => [`home.tiles.${tile}.title`, `home.tiles.${tile}.body`]),
  ...['dashboard', 'reports', 'locals', 'users', 'reviews', 'bookings', 'audit'].map((n) => `staff.nav.${n}`),
  ...['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'].map((s) => `staff.user_status.${s}`),
  ...['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => `staff.severity.${s}`),
  ...['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'].map((s) => `staff.report_status.${s}`),
  ...['NOT_SUBMITTED', 'PENDING', 'MANUALLY_CHECKED', 'REJECTED'].map((s) => `staff.local_status.${s}`),
  ...['UNVERIFIED', 'VERIFIED', 'REJECTED'].map((s) => `staff.external_status.${s}`),
  ...['active', 'RESOLVED', 'DISMISSED', 'all'].map((f) => `staff.reports.filter_${f}`),
  ...['all', 'low', 'reported', 'hidden'].map((f) => `staff.reviews.filter_${f}`),
]

// Every notification kind the backend emits (apps/notifications/services.py PUSH_TEXT).
const backendNotificationKinds = readFileSync(join(__dirname, '../../../backend/apps/notifications/services.py'), 'utf8')
  .match(/^\s+"([a-z_]+)": "/gm)!
  .map((line) => line.trim().split('"')[1])

describe('i18n dictionaries', () => {
  it('have the same keys in English and Vietnamese', () => {
    expect([...enKeys].filter((k) => !viKeys.has(k))).toEqual([])
    expect([...viKeys].filter((k) => !enKeys.has(k))).toEqual([])
  })

  it('define every key referenced in the source', () => {
    const namespaces = new Set(Object.keys(en))
    const used = new Set<string>(dynamic)
    for (const file of sourceFiles(join(__dirname, '..'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/'([a-z_]+(?:\.[A-Za-z_]+)+)'/g)) {
        if (namespaces.has(match[1].split('.')[0])) used.add(match[1])
      }
    }
    expect([...used].filter((k) => !enKeys.has(k)).sort()).toEqual([])
  })

  it('translate every backend notification kind', () => {
    expect(backendNotificationKinds.length).toBeGreaterThan(10)
    expect(backendNotificationKinds.filter((k) => !enKeys.has(`notification.${k}`))).toEqual([])
  })
})
