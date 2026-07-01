import Stripe from 'stripe'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getMerchantFromSession, MERCHANT_SESSION_COOKIE } from '@/lib/merchant-session'

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  return new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover',
  })
}

function dashboardErrorRedirect(request: Request, error: string) {
  const url = new URL('/comercio/dashboard', request.url)
  url.searchParams.set('stripe_error', error)

  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const merchant = await getMerchantFromSession(cookieStore.get(MERCHANT_SESSION_COOKIE)?.value)

  if (!merchant) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!merchant.stripeAccountId) {
    return dashboardErrorRedirect(request, 'missing_account')
  }

  try {
    const stripe = getStripe()
    const loginLink = await stripe.accounts.createLoginLink(merchant.stripeAccountId)

    return NextResponse.redirect(loginLink.url)
  } catch {
    return dashboardErrorRedirect(request, 'login_link_failed')
  }
}
