import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    request.nextUrl.pathname !== '/' &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/cadastro')
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from the login page
  if (user && (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/login')) {
    const { data: usuario } = await supabase
      .from('usuario')
      .select('perfil')
      .eq('id_usuario', user.id)
      .single()

    const url = request.nextUrl.clone()
    if (usuario?.perfil === 'SUPER_ADMIN') {
      url.pathname = '/homesuperadmin'
    } else if (usuario?.perfil === 'ADMIN') {
      url.pathname = '/homeadmin'
    } else {
      url.pathname = '/homeuser'
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
