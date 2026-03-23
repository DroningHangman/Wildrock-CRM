import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { hydrateContact } from '@/lib/email/hydrateContact'
import { resolveTemplate } from '@/lib/email/resolveTemplate'
import { GenericTemplate } from '@/emails/GenericTemplate'
import type { Contact, Membership, Booking } from '@/types'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { contactId, templateId } = await req.json()

  if (!contactId || !templateId) {
    return NextResponse.json({ error: 'contactId and templateId are required' }, { status: 400 })
  }

  // Fetch contact with memberships and latest booking
  const [contactRes, templateRes] = await Promise.all([
    supabaseAdmin
      .from('contacts')
      .select('*, memberships(*), bookings(id, program_name, date)')
      .eq('id', contactId)
      .order('start_date', { foreignTable: 'memberships', ascending: false })
      .order('date', { foreignTable: 'bookings', ascending: false })
      .limit(1, { foreignTable: 'bookings' })
      .single(),
    supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single(),
  ])

  if (contactRes.error) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }
  if (templateRes.error) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const contact = contactRes.data as Contact & { memberships: Membership[]; bookings: Booking[] }
  const template = templateRes.data

  if (!contact.email) {
    return NextResponse.json({ error: 'Contact has no email address' }, { status: 400 })
  }

  const latestMembership = contact.memberships?.[0] ?? null
  const latestBooking = contact.bookings?.[0] ?? null

  const vars = hydrateContact(contact, latestMembership, latestBooking)
  const resolved = resolveTemplate(template, vars)

  let status = 'sent'
  let resendMessageId: string | null = null
  let errorMessage: string | null = null
  let sentAt: string | null = null

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: contact.email,
      subject: resolved.subject,
      react: GenericTemplate({ subject: resolved.subject, bodyHtml: resolved.body_html }),
    })

    if (result.error) {
      throw new Error(result.error.message)
    }

    resendMessageId = result.data?.id ?? null
    sentAt = new Date().toISOString()
  } catch (err) {
    status = 'failed'
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  const { error: insertError } = await supabaseAdmin.from('email_sends').insert({
    contact_id: contactId,
    template_id: templateId,
    to_email: contact.email,
    subject: resolved.subject,
    status,
    resend_message_id: resendMessageId,
    error_message: errorMessage,
    sent_at: sentAt,
  })

  if (insertError) {
    console.error('Failed to record email send:', insertError.message)
  }

  if (status === 'failed') {
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }

  return NextResponse.json({ success: true, messageId: resendMessageId })
}
