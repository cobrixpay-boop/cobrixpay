import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { getMerchantBySlug } from '../../../lib/merchants'
import { markPaymentLinkPaid } from '@/lib/payment-links'
import { formatStripeMoney } from '@/lib/stripe-money'

type PaymentIntentWithCharges = Stripe.PaymentIntent & {
  charges?: {
    data?: Array<{
      billing_details?: {
        email?: string | null
      }
    }>
  }
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  })
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('Missing STRIPE_WEBHOOK_SECRET')
  }
  return secret
}

function getBuyerEmail(paymentIntent: Stripe.PaymentIntent, session?: Stripe.Checkout.Session) {
  const charge = (paymentIntent as PaymentIntentWithCharges).charges?.data?.[0]
  return paymentIntent.receipt_email || charge?.billing_details?.email || session?.customer_details?.email || session?.customer_email
}

async function getCheckoutSession(stripe: Stripe, paymentIntent: Stripe.PaymentIntent) {
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntent.id,
    limit: 1,
  })

  return sessions.data[0]
}

async function getMerchantSlug(stripe: Stripe, paymentIntent: Stripe.PaymentIntent, session?: Stripe.Checkout.Session) {
  const metadataSlug = paymentIntent.metadata?.merchantSlug
  if (metadataSlug) return metadataSlug

  const checkoutSession = session || (await getCheckoutSession(stripe, paymentIntent))
  return checkoutSession?.metadata?.merchantSlug || checkoutSession?.client_reference_id || undefined
}

function getMerchantName(paymentIntent: Stripe.PaymentIntent, session?: Stripe.Checkout.Session) {
  return paymentIntent.metadata?.merchantName || session?.metadata?.merchantName
}

function formatPaymentDate(timestamp: number) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(timestamp * 1000))
}

async function sendEmail(to: string | string[], subject: string, text: string) {
  const resend = getResend()
  return resend.emails.send({
    from: 'Cobrix Pay <notificaciones@cobrixpay.com>',
    to,
    subject,
    text,
  })
}

async function sendNotifications(label: string, notifications: Array<Promise<unknown>>) {
  const results = await Promise.allSettled(notifications)
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error(`Error enviando email de ${label}:`, result.reason)
    }
  })
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')!
  const stripe = getStripe()

  let event

  try {
    const body = await req.text()
    const webhookSecret = getWebhookSecret()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 })
  }

  if (event.type !== 'payment_intent.succeeded' && event.type !== 'payment_intent.payment_failed') {
    return NextResponse.json({ received: true })
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const checkoutSession = await getCheckoutSession(stripe, paymentIntent)
  const merchantSlug = await getMerchantSlug(stripe, paymentIntent, checkoutSession)
  const merchant = await getMerchantBySlug(merchantSlug)
  const merchantEmails =
    merchant?.notificationEmails && merchant.notificationEmails.length > 0
      ? merchant.notificationEmails
      : merchant?.email
      ? [merchant.email]
      : [process.env.DEFAULT_MERCHANT_EMAIL || 'cobrixpay@gmail.com']
  const merchantName = merchant?.name || getMerchantName(paymentIntent, checkoutSession) || merchantSlug?.replace(/-/g, ' ') || 'Cobrix Pay'
  const buyerEmail = getBuyerEmail(paymentIntent, checkoutSession)
  const amount = formatStripeMoney(paymentIntent.amount_received || paymentIntent.amount, paymentIntent.currency)
  const paymentDate = formatPaymentDate(paymentIntent.created)

  if (event.type === 'payment_intent.succeeded') {
    const paymentLinkId = paymentIntent.metadata?.paymentLinkId || checkoutSession?.metadata?.paymentLinkId

    if (paymentLinkId) {
      await markPaymentLinkPaid(paymentLinkId, paymentIntent.id)
    }

    const merchantPromise = sendEmail(
      merchantEmails,
      `Nuevo cobro recibido - ${amount}`,
      `Nuevo cobro recibido

Comercio: ${merchantName}
Monto: ${amount}
Fecha y hora: ${paymentDate}
ID de operación Stripe: ${paymentIntent.id}

Este cobro ya fue procesado correctamente.

Cobrix Pay`
    )

    const buyerPromise = buyerEmail
      ? sendEmail(
          buyerEmail,
          `Pago confirmado en ${merchantName}`,
          `Pago confirmado

Tu pago a ${merchantName} fue procesado correctamente.

Monto: ${amount}
Fecha y hora: ${paymentDate}
ID de operación Stripe: ${paymentIntent.id}

Pago procesado de forma segura por Cobrix Pay.

Cobrix Pay`
        )
      : Promise.resolve()

    await sendNotifications('pago aprobado', [merchantPromise, buyerPromise])
  }

  if (event.type === 'payment_intent.payment_failed') {
    const reason = paymentIntent.last_payment_error?.message || 'No pudimos procesar el pago.'

    const failedMessage = `Pago no procesado

Comercio: ${merchantName}
Monto: ${amount}
Fecha y hora: ${paymentDate}
ID de operación Stripe: ${paymentIntent.id}

El pago no pudo completarse.
Motivo: ${reason}

Cobrix Pay`

    const merchantPromise = sendEmail(merchantEmails, `Pago no procesado - ${amount}`, failedMessage)

    const buyerPromise = buyerEmail
      ? sendEmail(
          buyerEmail,
          `No pudimos procesar tu pago en ${merchantName}`,
          `Pago no procesado

No pudimos procesar tu pago a ${merchantName}.

Monto: ${amount}
Fecha y hora: ${paymentDate}
ID de operación Stripe: ${paymentIntent.id}

Motivo: ${reason}

Por favor intentá nuevamente o consultá al comercio si necesitás ayuda.

Cobrix Pay`
        )
      : Promise.resolve()

    await sendNotifications('pago rechazado', [merchantPromise, buyerPromise])
  }

  return NextResponse.json({ received: true })
}
