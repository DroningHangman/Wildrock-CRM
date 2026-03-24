import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hydrateContact } from '@/lib/email/hydrateContact'
import { resolveTemplate } from '@/lib/email/resolveTemplate'
import { render } from '@react-email/components'
import { GenericTemplate } from '@/emails/GenericTemplate'
import type { Contact, Membership, Booking } from '@/types'

export async function POST(req: NextRequest) {
  const { subject, body_html, contact_id } = await req.json()

  if (!subject || !body_html) {
    return NextResponse.json({ error: 'subject and body_html are required' }, { status: 400 })
  }

  let vars: Record<string, string> = {}

  if (contact_id) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('*, memberships(*), bookings(id, program_name, date)')
      .eq('id', contact_id)
      .order('start_date', { foreignTable: 'memberships', ascending: false })
      .order('date', { foreignTable: 'bookings', ascending: false })
      .limit(1, { foreignTable: 'bookings' })
      .single()

    if (error) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const contact = data as Contact & { memberships: Membership[]; bookings: Booking[] }
    const latestMembership = contact.memberships?.[0] ?? null
    const latestBooking = contact.bookings?.[0] ?? null
    vars = hydrateContact(contact, latestMembership, latestBooking)
  }

  const resolved = resolveTemplate({ subject, body_html }, vars)
  const html = await render(GenericTemplate({ subject: resolved.subject, bodyHtml: resolved.body_html }))

  return NextResponse.json({ subject: resolved.subject, html })
}
