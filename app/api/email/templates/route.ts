import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const body = await req.json()
  const { name, subject, body_html, body_text, variables } = body

  if (!name || !subject || !body_html) {
    return NextResponse.json({ error: 'name, subject, and body_html are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .insert({ name, subject, body_html, body_text: body_text ?? null, variables: variables ?? [] })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
