import type { Me } from './types'

/** At least one verified contact (email or phone) is enough to book. */
export const canBook = (user: Pick<Me, 'email_verified' | 'phone_verified'>) => user.email_verified || user.phone_verified

/** Contact kinds still unverified; locals see these on the traveler's profile. */
export const missingContacts = (user: Pick<Me, 'email_verified' | 'phone_verified'>) =>
  [!user.email_verified && 'EMAIL', !user.phone_verified && 'PHONE'].filter(Boolean) as ('EMAIL' | 'PHONE')[]
