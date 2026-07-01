import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  createMerchantSessionToken,
  getMerchantSessionMaxAge,
  MERCHANT_SESSION_COOKIE,
  verifyMerchantToken,
} from '@/lib/merchant-session'
import { getMerchantBySlug } from '@/lib/merchants'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const payload = await verifyMerchantToken(url.searchParams.get('token') || undefined, 'magic-link')

  if (!payload) {
    redirect('/login')
  }

  const merchant = await getMerchantBySlug(payload.slug)

  if (!merchant || merchant.email.trim().toLowerCase() !== payload.email.trim().toLowerCase()) {
    redirect('/login')
  }

  const sessionToken = await createMerchantSessionToken(merchant.slug, merchant.email)
  const cookieStore = await cookies()

  cookieStore.set(MERCHANT_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: getMerchantSessionMaxAge(),
  })

  redirect('/comercio/dashboard')
}
