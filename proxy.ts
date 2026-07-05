import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from './lib/admin-session'
import { MERCHANT_SESSION_COOKIE, verifyMerchantToken } from './lib/merchant-session'

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/merchants/admin') || request.nextUrl.pathname.startsWith('/control')) {
    const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
    const isAdminSessionValid = await isValidAdminSession(sessionValue)

    if (isAdminSessionValid) {
      return NextResponse.next()
    }

    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const merchantSession = request.cookies.get(MERCHANT_SESSION_COOKIE)?.value
  const isMerchantSessionValid = await verifyMerchantToken(merchantSession, 'session')

  if (isMerchantSessionValid) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/merchants/admin', '/merchants/admin/:path*', '/control', '/control/:path*', '/comercio/dashboard', '/comercio/dashboard/:path*'],
}
