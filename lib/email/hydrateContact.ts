import type { Contact, Membership, Booking } from '@/types'

export function hydrateContact(
  contact: Contact,
  membership?: Membership | null,
  booking?: Booking | null
): Record<string, string> {
  const today = new Date().toISOString().split('T')[0]
  const firstName = contact.name?.split(' ')[0] ?? ''

  let membershipDaysUntilExpiry = ''
  if (membership?.end_date) {
    const diff = Math.ceil(
      (new Date(membership.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    membershipDaysUntilExpiry = String(diff)
  }

  return {
    name: contact.name ?? '',
    first_name: firstName,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    organization: contact.organization ?? '',
    membership_type: membership?.membership_type ?? '',
    membership_status: membership?.status ?? '',
    membership_expiry_date: membership?.end_date ?? '',
    membership_days_until_expiry: membershipDaysUntilExpiry,
    last_booking_program: booking?.program_name ?? '',
    last_booking_date: booking?.date ?? '',
    today,
    org_name: 'Wildrock',
  }
}
