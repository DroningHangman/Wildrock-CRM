import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Verify Cal.com webhook signature using HMAC-SHA256
// Cal.com signs the raw request body with the webhook secret and sends
// the hex digest in the X-Cal-Signature-256 header.
async function verifyCalSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const secret = process.env.CAL_WEBHOOK_SECRET
  if (!secret) {
    console.error('CAL_WEBHOOK_SECRET is not set')
    return false
  }
  if (!signatureHeader) return false

  // Header format: "sha256=<hex_digest>"
  const expected = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(rawBody, 'utf8')
  const digest = hmac.digest('hex')

  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    // Buffer lengths differ → signature is invalid
    return false
  }
}

export async function POST(req: Request) {
  try {
    // Read raw body first — we need it for signature verification before parsing JSON
    const rawBody = await req.text()

    // Verify Cal.com webhook signature
    const signature = req.headers.get('X-Cal-Signature-256')
    const isValid = await verifyCalSignature(rawBody, signature)
    if (!isValid) {
      console.warn('Cal.com webhook: invalid or missing signature')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Initialize Supabase with Service Role Key inside the handler
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const payload = JSON.parse(rawBody)

    // triggerEvent is at the top level of the Cal.com payload
    const triggerEvent: string | undefined = payload.triggerEvent

    // Cal.com sends booking data in a 'payload' object or directly depending on the trigger
    const bookingData = payload.payload || payload

    if (!bookingData) {
      return NextResponse.json({ error: 'No booking data found' }, { status: 400 })
    }

    const { uid, rescheduleUid, startTime, attendees, type: eventType, responses } = bookingData

    // Handle BOOKING_CANCELLED — find by cal_uid and delete, then return early
    if (triggerEvent === 'BOOKING_CANCELLED') {
      if (uid) {
        await supabaseAdmin
          .from('bookings')
          .delete()
          .eq('cal_uid', uid)
      }
      return NextResponse.json({ success: true })
    }

    const attendee = attendees?.[0]

    if (!attendee) {
      return NextResponse.json({ error: 'No attendee found' }, { status: 400 })
    }

    // Helper function to extract value from Cal.com response format
    // Cal.com sends: {"label":"field_name","value":"actual_value","isHidden":false}
    const extractValue = (field: unknown): string | null => {
      if (!field || typeof field !== 'object') return null
      const obj = field as Record<string, unknown>
      if (typeof obj.value === 'string') return obj.value
      if (typeof obj.value === 'object' && obj.value !== null) {
        const nested = obj.value as Record<string, unknown>
        if (typeof nested.value === 'string') return nested.value
      }
      return null
    }

    // Extract phone number from responses or attendee (check common field names)
    const phoneNumber = attendee.phone ||
                       extractValue(responses?.phone) || 
                       extractValue(responses?.phone_number) || 
                       extractValue(responses?.phoneNumber) ||
                       extractValue(responses?.attendeePhoneNumber) ||
                       extractValue(responses?.PHONE) ||
                       null

    // 4. Extract Marketing Consent (common field across all forms)
    // Look for the consent field - it might be in various formats
    const extractConsent = (field: unknown): boolean => {
      if (!field || typeof field !== 'object') return false
      const obj = field as Record<string, unknown>
      if (typeof obj.value === 'boolean') return obj.value
      if (typeof obj.value === 'string') {
        const lower = obj.value.toLowerCase()
        return lower === 'true' || lower === 'yes' || lower === '1'
      }
      return false
    }
    
    // Extract marketing consent from the ecommunication radio (Cal.com field identifier: "ecommunication")
    // This is the required Yes/No field: "I consent to receive written and electronic communications from Wildrock"
    const marketingConsent = (() => {
      if (responses?.Ecommunication !== undefined) return extractConsent(responses.Ecommunication)
      if (responses?.marketingConsent !== undefined) return extractConsent(responses.marketingConsent)
      if (responses?.marketing_consent !== undefined) return extractConsent(responses.marketing_consent)
      return false
    })()

    // Derive contact type from the booked event type
    const contactTypeForEvent = eventType?.toLowerCase().includes('field-trip') ? 'Teacher' : 'Parent'

    // 1. Find or Create Contact
    let contactId = null
    const { data: existingContact } = await supabaseAdmin
      .from('contacts')
      .select('id, phone, marketing_consent, contact_types')
      .eq('email', attendee.email)
      .single()

    if (existingContact) {
      contactId = existingContact.id
      // Update phone and/or consent if we have new information
      const updates: { phone?: string; marketing_consent?: boolean; contact_types?: string[] } = {}
      if (phoneNumber && !existingContact.phone) {
        updates.phone = phoneNumber
      }
      // Update consent if provided (consent=true takes precedence, but don't overwrite existing true with false)
      if (marketingConsent !== false) {
        updates.marketing_consent = marketingConsent || existingContact.marketing_consent
      }
      // Add contact type derived from this booking if not already present
      const existingTypes: string[] = existingContact.contact_types || []
      if (!existingTypes.includes(contactTypeForEvent)) {
        updates.contact_types = [...existingTypes, contactTypeForEvent]
      }
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin
          .from('contacts')
          .update(updates)
          .eq('id', contactId)
      }
    } else {
      const { data: newContact, error: contactError } = await supabaseAdmin
        .from('contacts')
        .insert({
          name: attendee.name,
          email: attendee.email,
          phone: phoneNumber,
          marketing_consent: marketingConsent || false,
          contact_types: [contactTypeForEvent],
          notes: 'Added automatically via Cal.com'
        })
        .select()
        .single()

      if (contactError) throw contactError
      contactId = newContact.id
    }

    // 1. Parse Date and Timeslot
    const startDate = new Date(startTime)
    const dateStr = startDate.toISOString().split('T')[0]
    const timeStr = startDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })

    // 2. Extract attendee counts from standardized Cal.com field identifiers
    const extractCount = (key: string) => {
      const val = extractValue(responses?.[key])
      return val ? parseInt(val) || 0 : 0
    }
    const kidsCount       = extractCount('kids_attending')
    const adultsCount     = extractCount('adults_attending')
    const chaperonesCount = extractCount('chaperones_attending')
    const teachersCount   = extractCount('teachers_attending')

    // 3. Store all form responses in JSONB for flexible event-specific fields
    // This captures all custom questions/answers from Cal.com forms
    const formResponses = responses || {}

    // 4. Insert or Update Booking
    if (triggerEvent === 'BOOKING_RESCHEDULED' && rescheduleUid) {
      // Try to update the existing booking by its old cal_uid
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          date: dateStr,
          timeslot: timeStr,
          kids_count: kidsCount,
          cal_uid: uid,
          form_responses: Object.keys(formResponses).length > 0 ? formResponses : null
        })
        .eq('cal_uid', rescheduleUid)
        .select('id')

      if (updateError) throw updateError

      // If no matching row found, fall through to insert below
      if (updated && updated.length > 0) {
        return NextResponse.json({ success: true })
      }
    }

    // BOOKING_CREATED (or reschedule fallback — no existing row found)
    const { error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        contact_id: contactId,
        date: dateStr,
        timeslot: timeStr,
        program_name: eventType,
        booking_type: 'cal_sync',
        kids_count: kidsCount,
        cal_uid: uid ?? null,
        notes: `Cal.com Booking: ${eventType}`,
        form_responses: Object.keys(formResponses).length > 0 ? formResponses : null,
        report_data: {
          children_count: kidsCount,
          adults_count: adultsCount,
          chaperones_count: chaperonesCount,
          teachers_count: teachersCount,
        }
      })

    if (bookingError) throw bookingError

    return NextResponse.json({ success: true })
  } catch (error) {
    // Log internally but never expose internal error details to the caller
    console.error('Webhook Error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
