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

    // 1. Find or Create Contact
    let contactId = null
    const { data: existingContact } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('email', attendee.email)
      .single()

    if (existingContact) {
      contactId = existingContact.id
    } else {
      const { data: newContact, error: contactError } = await supabaseAdmin
        .from('contacts')
        .insert({
          name: attendee.name,
          email: attendee.email,
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
