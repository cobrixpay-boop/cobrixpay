import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getMerchantFromSession, MERCHANT_SESSION_COOKIE } from '@/lib/merchant-session'
import { canMerchantAcceptPayments } from '@/lib/merchants'
import {
  getCheckoutAmountMinorUnits,
  getMerchantCheckoutCurrency,
  isValidCheckoutCurrency,
} from '@/lib/merchant-checkout-config'
import { createPaymentLink } from '@/lib/payment-links'
import { formatStripeMoney, getStripeCurrencyCode } from '@/lib/stripe-money'
import { getSiteUrl } from '@/lib/site-url'

function sanitizeConcept(value: unknown) {
  if (typeof value !== 'string') return undefined
  const concept = value.trim().slice(0, 120)
  return concept || undefined
}

export async function GET() {
  const cookieStore = await cookies()
  const merchant = await getMerchantFromSession(cookieStore.get(MERCHANT_SESSION_COOKIE)?.value)

  if (!merchant) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const currency = getMerchantCheckoutCurrency(merchant)

  return NextResponse.json({
    currency,
    currencyLabel: getStripeCurrencyCode(currency),
  })
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const merchant = await getMerchantFromSession(cookieStore.get(MERCHANT_SESSION_COOKIE)?.value)

  if (!merchant) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (!canMerchantAcceptPayments(merchant)) {
    return NextResponse.json({ error: 'Este comercio no está habilitado para recibir pagos.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const currency = getMerchantCheckoutCurrency(merchant)

  if (!isValidCheckoutCurrency(currency)) {
    return NextResponse.json({ error: 'No hay una moneda de cobro válida configurada para este comercio.' }, { status: 400 })
  }

  const amount = Number(body.amount)
  const amountInMinorUnits = getCheckoutAmountMinorUnits(amount, currency)

  if (!amountInMinorUnits) {
    return NextResponse.json({ error: 'Ingresá un monto válido mayor a cero.' }, { status: 400 })
  }

  const paymentLink = await createPaymentLink({
    merchant,
    amount: amountInMinorUnits,
    currency,
    concept: sanitizeConcept(body.concept),
  })

  return NextResponse.json({
    id: paymentLink.id,
    url: `${getSiteUrl()}/link/${paymentLink.id}`,
    amount: formatStripeMoney(paymentLink.amount, paymentLink.currency),
    currency: getStripeCurrencyCode(paymentLink.currency),
    expiresAt: paymentLink.expiresAt,
  })
}
