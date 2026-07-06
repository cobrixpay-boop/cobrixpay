import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from './lib/admin-session'
import { MERCHANT_SESSION_COOKIE, getSessionUser } from './lib/merchant-session'

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/merchants/admin')) {
    const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
    const isAdminSessionValid = await isValidAdminSession(sessionValue)

    if (isAdminSessionValid) {
      return NextResponse.next()
    }

    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const sessionToken = request.cookies.get(MERCHANT_SESSION_COOKIE)?.value
  const sessionUser = await getSessionUser(sessionToken)

  if (request.nextUrl.pathname.startsWith('/control')) {
    if (sessionUser?.role === 'FOUNDER') {
      return NextResponse.next()
    }

    if (sessionUser?.role === 'MERCHANT') {
      return NextResponse.redirect(new URL('/comercio/dashboard', request.url))
    }

    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (sessionUser?.role === 'MERCHANT') {
    return NextResponse.next()
  }

  if (sessionUser?.role === 'FOUNDER') {
    return NextResponse.redirect(new URL('/control', request.url))
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/merchants/admin', '/merchants/admin/:path*', '/control', '/control/:path*', '/comercio/dashboard', '/comercio/dashboard/:path*'],
}
