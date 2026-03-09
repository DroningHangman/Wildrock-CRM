import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthPage    = path.startsWith('/login')
  const isWebhook     = path.startsWith('/api/webhooks')
  const isPublicRoot  = path === '/'
  const isAdminRoute  = path.startsWith('/admin') || path.startsWith('/api/admin')

  // Unauthenticated users can only reach /login, webhooks, and /
  if (!user && !isAuthPage && !isWebhook && !isPublicRoot) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Admin routes require the admin role (set via app_metadata in Supabase)
  if (user && isAdminRoute) {
    const role = user.app_metadata?.role
    if (role !== 'admin') {
      // API routes get a 403; page routes redirect to /bookings
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/bookings', request.url))
    }
  }

  // Logged-in users hitting /login go straight to /bookings
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/bookings', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
