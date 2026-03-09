import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getCallerRole(req: NextRequest): Promise<string | null> {
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          response.cookies.set({ name, value, ...options })
        },
        remove: (name: string, options: CookieOptions) => {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return (user?.app_metadata?.role as string) ?? null
}

// POST /api/admin/invite — send a Supabase invite email to a new user
// Body: { email: string }
export async function POST(req: NextRequest) {
  const role = await getCallerRole(req)
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const supabase = adminClient()
  const { error } = await supabase.auth.admin.inviteUserByEmail(email)

  if (error) {
    console.error('inviteUserByEmail error:', error.message)
    // Surface "User already registered" so the UI can show a helpful message
    if (error.message.toLowerCase().includes('already')) {
      return NextResponse.json({ error: 'A user with that email already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to send invite.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
