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

// Verify the caller is an authenticated admin before doing anything
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

// GET /api/admin/users — list all users with their admin status
export async function GET(req: NextRequest) {
  const role = await getCallerRole(req)
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = adminClient()
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) {
    console.error('listUsers error:', error.message)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    name: (u.user_metadata?.full_name as string) ?? (u.user_metadata?.name as string) ?? '',
    isAdmin: u.app_metadata?.role === 'admin',
  }))

  return NextResponse.json({ users })
}

// PATCH /api/admin/users — grant or revoke admin role
// Body: { userId: string, makeAdmin: boolean }
export async function PATCH(req: NextRequest) {
  const role = await getCallerRole(req)
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { userId?: string; makeAdmin?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { userId, makeAdmin } = body
  if (!userId || typeof makeAdmin !== 'boolean') {
    return NextResponse.json({ error: 'userId and makeAdmin required' }, { status: 400 })
  }

  const supabase = adminClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role: makeAdmin ? 'admin' : null },
  })

  if (error) {
    console.error('updateUserById error:', error.message)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
