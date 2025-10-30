import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

function createSupabase(req: NextRequest, res: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createServerClient(url, anon, {
    cookies: {
      get(name) {
        return req.cookies.get(name)?.value
      },
      set(name, value, options) {
        const opts: CookieOptions = { ...options, sameSite: 'lax' }
        res.cookies.set({ name, value, ...opts })
      },
      remove(name, options) {
        const opts: CookieOptions = { ...options, sameSite: 'lax' }
        res.cookies.set({ name, value: '', ...opts, maxAge: 0 })
      }
    }
  })
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } })
  const supabase = createSupabase(req, res)

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/app')) {
    if (!session) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
    if (pathname.startsWith('/app/sales/catalog')) {
      const { data: me } = await supabase.from('profiles').select('role').maybeSingle()
      const role = me?.role || 'sales_rep'
      if (!(role === 'manager' || role === 'admin')) {
        const url = req.nextUrl.clone()
        url.pathname = '/app/sales'
        return NextResponse.redirect(url)
      }
    }
  }

  if (pathname === '/login' && session) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: ['/app/:path*', '/login']
}
