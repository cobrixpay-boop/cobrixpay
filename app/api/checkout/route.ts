import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { canMerchantAcceptPayments, getMerchantBySlug, isValidStripeAccountId, type Merchant } from '../../../lib/merchants'
import { getCheckoutAmountMinorUnits, getMerchantCheckoutCurrency } from '@/lib/merchant-checkout-config'
import {
  acquirePaymentLinkCheckoutLock,
  getPaymentLinkById,
  isPaymentLinkExpired,
  markPaymentLinkCheckoutCreated,
  releasePaymentLinkCheckoutLock,
  type PaymentLink,
} from '@/lib/payment-links'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  })
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

function getApplicationFeeAmount(amountInMinorUnits: number, applicationFeePercent: number) {
  return Math.min(
    amountInMinorUnits,
    Math.max(0, Math.round((amountInMinorUnits * applicationFeePercent) / 100))
  )
}

function validateMerchant(merchant: Merchant | undefined) {
  if (!merchant) {
    return 'No existe el comercio solicitado.'
  }

  if (merchant.status !== 'active') {
    return 'Este comercio todavia no esta habilitado para recibir pagos.'
  }

  if (!isValidStripeAccountId(merchant.stripeAccountId)) {
    return 'Este comercio todavia no tiene una cuenta Stripe conectada.'
  }

  if (!canMerchantAcceptPayments(merchant)) {
    return 'Este comercio no esta habilitado para recibir pagos.'
  }

  return ''
}

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
}

function getSessionExpiresAt(session: Stripe.Checkout.Session) {
  return session.expires_at ? new Date(session.expires_at * 1000).toISOString() : undefined
}

async function createCheckoutSession(params: {
  merchant: Merchant
  amountInMinorUnits: number
  currency: string
  concept?: string
  paymentLink?: PaymentLink
  checkoutAttempt?: number
}) {
  const baseUrl = getBaseUrl()
  const merchantSlug = params.merchant.slug
  const merchantName = params.merchant.name || merchantSlug
  const applicationFeePercent = params.merchant.applicationFeePercent || 0
  const paymentMetadata: Record<string, string> = {
    merchantSlug,
    merchantName,
    applicationFeePercent: String(applicationFeePercent),
    paymentSource: params.paymentLink ? 'payment_link' : 'permanent_qr',
  }

  if (params.paymentLink) {
    paymentMetadata.paymentLinkId = params.paymentLink.id
  }

  if (params.concept) {
    paymentMetadata.concept = params.concept
  }

  const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
    metadata: paymentMetadata,
    transfer_data: {
      destination: params.merchant.stripeAccountId!,
    },
  }
  const applicationFeeAmount = getApplicationFeeAmount(params.amountInMinorUnits, applicationFeePercent)

  if (applicationFeeAmount > 0) {
    paymentIntentData.application_fee_amount = applicationFeeAmount
  }

  const stripe = getStripe()
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: ['card'],
    client_reference_id: params.paymentLink?.id || merchantSlug,
    metadata: paymentMetadata,
    line_items: [
      {
        price_data: {
          currency: params.currency,
          product_data: {
            name: params.concept || `Pago a ${merchantName}`,
          },
          unit_amount: params.amountInMinorUnits,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: paymentIntentData,
    success_url: params.paymentLink
      ? `${baseUrl}/success?merchant=${encodeURIComponent(merchantSlug)}&link=${encodeURIComponent(params.paymentLink.id)}`
      : `${baseUrl}/success?merchant=${encodeURIComponent(merchantSlug)}`,
    cancel_url: params.paymentLink
      ? `${baseUrl}/link/${encodeURIComponent(params.paymentLink.id)}`
      : `${baseUrl}/cancel?merchant=${encodeURIComponent(merchantSlug)}`,
  }
  const requestOptions = params.paymentLink
    ? {
        idempotencyKey: `payment-link:${params.paymentLink.id}:checkout:${params.checkoutAttempt || 1}`,
      }
    : undefined

  return stripe.checkout.sessions.create(sessionParams, requestOptions)
}

async function createPermanentQrCheckout(body: Record<string, unknown>) {
  const slug = typeof body.slug === 'string' ? body.slug : ''
  const merchant = await getMerchantBySlug(slug)
  const merchantError = validateMerchant(merchant)

  if (merchantError || !merchant) {
    return NextResponse.json({ error: merchantError || `No existe el comercio "${slug}"` }, { status: merchant ? 403 : 404 })
  }

  const currency = getMerchantCheckoutCurrency(merchant)
  const amountInMinorUnits = getCheckoutAmountMinorUnits(Number(body.amount), currency)

  if (!amountInMinorUnits) {
    return NextResponse.json({ error: 'Monto invalido' }, { status: 400 })
  }

  const session = await createCheckoutSession({
    merchant,
    amountInMinorUnits,
    currency,
  })

  return NextResponse.json({ url: session.url })
}

async function resolveExistingPaymentLinkSession(paymentLink: PaymentLink) {
  if (!paymentLink.stripeCheckoutSessionId) return null

  const existingSession = await getStripe().checkout.sessions.retrieve(paymentLink.stripeCheckoutSessionId)

  if (existingSession.status === 'open' && existingSession.url) {
    return NextResponse.json({ url: existingSession.url })
  }

  if (existingSession.status === 'complete') {
    return NextResponse.json(
      { error: 'Este link ya tiene un pago completado en Stripe. Estamos esperando la confirmacion final.' },
      { status: 409 }
    )
  }

  if (existingSession.status !== 'expired') {
    return NextResponse.json({ error: 'Este link ya tiene un intento de pago iniciado.' }, { status: 409 })
  }

  return null
}

async function createFixedLinkCheckout(body: Record<string, unknown>) {
  const paymentLinkId = typeof body.paymentLinkId === 'string' ? body.paymentLinkId : ''
  const paymentLink = await getPaymentLinkById(paymentLinkId)

  if (!paymentLink) {
    return NextResponse.json({ error: 'Link de pago invalido.' }, { status: 404 })
  }

  if (paymentLink.status === 'paid') {
    return NextResponse.json({ error: 'Este link ya fue pagado.' }, { status: 409 })
  }

  if (paymentLink.status !== 'pending' || isPaymentLinkExpired(paymentLink)) {
    return NextResponse.json({ error: 'Este link de pago vencio o ya no esta disponible.' }, { status: 410 })
  }

  const merchant = await getMerchantBySlug(paymentLink.merchantSlug)
  const merchantError = validateMerchant(merchant)

  if (merchantError || !merchant) {
    return NextResponse.json({ error: merchantError || 'Comercio no disponible.' }, { status: merchant ? 403 : 404 })
  }

  const lockToken = await acquirePaymentLinkCheckoutLock(paymentLink.id)

  if (!lockToken) {
    return NextResponse.json({ error: 'El link esta preparando un pago. Intenta nuevamente en unos segundos.' }, { status: 409 })
  }

  try {
    const latestPaymentLink = await getPaymentLinkById(paymentLink.id)

    if (!latestPaymentLink) {
      return NextResponse.json({ error: 'Link de pago invalido.' }, { status: 404 })
    }

    if (latestPaymentLink.status === 'paid') {
      return NextResponse.json({ error: 'Este link ya fue pagado.' }, { status: 409 })
    }

    if (latestPaymentLink.status !== 'pending' || isPaymentLinkExpired(latestPaymentLink)) {
      return NextResponse.json({ error: 'Este link de pago vencio o ya no esta disponible.' }, { status: 410 })
    }

    const existingSessionResponse = await resolveExistingPaymentLinkSession(latestPaymentLink)
    if (existingSessionResponse) return existingSessionResponse

    const checkoutAttempt = (latestPaymentLink.stripeCheckoutAttempt || 0) + 1
    const session = await createCheckoutSession({
      merchant,
      amountInMinorUnits: latestPaymentLink.amount,
      currency: latestPaymentLink.currency,
      concept: latestPaymentLink.concept,
      paymentLink: latestPaymentLink,
      checkoutAttempt,
    })

    await markPaymentLinkCheckoutCreated(
      paymentLink.id,
      session.id,
      getPaymentIntentId(session),
      getSessionExpiresAt(session),
      checkoutAttempt
    )

    return NextResponse.json({ url: session.url })
  } finally {
    await releasePaymentLinkCheckoutLock(paymentLink.id, lockToken)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    if (typeof body.paymentLinkId === 'string') {
      return createFixedLinkCheckout(body)
    }

    return createPermanentQrCheckout(body)
  } catch (error: unknown) {
    const stripeError = error as {
      message?: string
      type?: string
      code?: string
      decline_code?: string
      param?: string
      statusCode?: number
    }

    console.error('Error en checkout:', {
      message: stripeError.message,
      type: stripeError.type,
      code: stripeError.code,
      decline_code: stripeError.decline_code,
      param: stripeError.param,
    })

    return NextResponse.json(
      { error: stripeError.message || 'No se pudo crear la sesion de pago' },
      { status: stripeError.statusCode || 500 }
    )
  }
}
