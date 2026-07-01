import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { getMerchantBySlug } from '../../../lib/merchants'

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
  const charge = (paymentIntent as any).charges?.data?.[0]
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
  } catch (err) {
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 })
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
  const merchantName = merchant?.name || merchantSlug?.replace(/-/g, ' ') || 'Cobrix Pay'
  const buyerEmail = getBuyerEmail(paymentIntent, checkoutSession)
  const amount = paymentIntent.amount / 100

  if (event.type === 'payment_intent.succeeded') {
    const merchantPromise = sendEmail(
      merchantEmails,
      `Pago recibido ✅ - ${amount} USD`,
      `¡Hola ${merchantName}!
Se recibió un pago de USD ${amount}.
ID: ${paymentIntent.id}
Gracias por usar Cobrix Pay!
Saludos,
Martín`
    )

    const buyerPromise = buyerEmail
      ? sendEmail(
          buyerEmail,
          `Pago confirmado ✅ - ${amount} USD`,
          `¡Hola!
Tu pago de USD ${amount} fue procesado correctamente.
ID: ${paymentIntent.id}
Gracias por tu compra.
Saludos,
Martín`
        )
      : Promise.resolve()

    await sendNotifications('pago aprobado', [merchantPromise, buyerPromise])
  }

  if (event.type === 'payment_intent.payment_failed') {
    const reason = paymentIntent.last_payment_error?.message || 'Motivo desconocido'

    const failedMessage = `Hola ${merchantName}.
Un pago de USD ${amount} fue rechazado.
Motivo: ${reason}
ID: ${paymentIntent.id}
Saludos,
Martín`

    const merchantPromise = sendEmail(
      merchantEmails,
      `Pago rechazado ❌ - ${amount} USD`,
      failedMessage
    )

    const buyerPromise = buyerEmail
      ? sendEmail(
          buyerEmail,
          `Pago rechazado ❌ - ${amount} USD`,
          `Hola.
Tu pago de USD ${amount} fue rechazado.
Motivo: ${reason}
ID: ${paymentIntent.id}
Por favor intenta nuevamente o consulta a soporte.
Saludos,
Martín`
        )
      : Promise.resolve()

    await sendNotifications('pago rechazado', [merchantPromise, buyerPromise])
  }

  return NextResponse.json({ received: true })
}
