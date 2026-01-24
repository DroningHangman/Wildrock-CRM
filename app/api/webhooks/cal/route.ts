import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    // Initialize Supabase with Service Role Key inside the handler
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const payload = await req.json()
    
    // Cal.com sends data in a 'payload' object or directly depending on the trigger
    const bookingData = payload.payload || payload
    
    if (!bookingData) {
      return NextResponse.json({ error: 'No booking data found' }, { status: 400 })
    }

    const { startTime, attendees, type: eventType, responses } = bookingData
    const attendee = attendees[0]

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
                       extractValue(responses?.PHONE) ||
                       null

    // 1. Find or Create Contact
    let contactId = null
    const { data: existingContact } = await supabaseAdmin
      .from('contacts')
      .select('id, phone')
      .eq('email', attendee.email)
      .single()

    if (existingContact) {
      contactId = existingContact.id
      // Update phone if we have it and contact doesn't have one
      if (phoneNumber && !existingContact.phone) {
        await supabaseAdmin
          .from('contacts')
          .update({ phone: phoneNumber })
          .eq('id', contactId)
      }
    } else {
      const { data: newContact, error: contactError } = await supabaseAdmin
        .from('contacts')
        .insert({
          name: attendee.name,
          email: attendee.email,
          phone: phoneNumber,
          contact_types: ['parent'], // Default to parent for Cal.com bookings
          notes: 'Added automatically via Cal.com'
        })
        .select()
        .single()

      if (contactError) throw contactError
      contactId = newContact.id
    }

    // 2. Parse Date and Timeslot
    const startDate = new Date(startTime)
    const dateStr = startDate.toISOString().split('T')[0]
    const timeStr = startDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })

    // 3. Extract Kids Count (looking for common field names in responses)
    // Cal.com custom fields appear in the 'responses' object
    const kidsCount = parseInt(responses?.kids_count || responses?.kids || '0') || 0

    // 4. Store all form responses in JSONB for flexible event-specific fields
    // This captures all custom questions/answers from Cal.com forms
    const formResponses = responses || {}

    // 5. Insert Booking
    const { error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        contact_id: contactId,
        date: dateStr,
        timeslot: timeStr,
        program_name: eventType,
        booking_type: 'cal_sync',
        kids_count: kidsCount,
        notes: `Cal.com Booking: ${eventType}`,
        form_responses: Object.keys(formResponses).length > 0 ? formResponses : null
      })

    if (bookingError) throw bookingError

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Webhook Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
