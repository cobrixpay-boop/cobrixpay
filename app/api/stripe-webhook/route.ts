import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { getMerchantBySlug } from '../../../lib/merchants'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
})

const resend = new Resend(process.env.RESEND_API_KEY!)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

function getBuyerEmail(paymentIntent: Stripe.PaymentIntent) {
  const charge = (paymentIntent as any).charges?.data?.[0]
  return paymentIntent.receipt_email || charge?.billing_details?.email
}

async function sendEmail(to: string, subject: string, text: string) {
  return resend.emails.send({
    from: 'Cobrix Pay <notificaciones@cobrixpay.com>',
    to,
    subject,
    text,
  })
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')!

  let event

  try {
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 })
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const merchantSlug = paymentIntent.metadata?.merchantSlug as string | undefined
  const merchant = getMerchantBySlug(merchantSlug)
  const merchantEmail = merchant?.email || process.env.DEFAULT_MERCHANT_EMAIL || 'cobrixpay@gmail.com'
  const merchantName = merchant?.name || merchantSlug?.replace(/-/g, ' ') || 'Cobrix Pay'
  const buyerEmail = getBuyerEmail(paymentIntent)
  const amount = paymentIntent.amount / 100

  if (event.type === 'payment_intent.succeeded') {
    const merchantPromise = sendEmail(
      merchantEmail,
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

    await Promise.all([merchantPromise, buyerPromise])
  }

  if (event.type === 'payment_intent.payment_failed') {
    const reason = paymentIntent.last_payment_error?.message || 'Motivo desconocido'

    const merchantPromise = sendEmail(
      merchantEmail,
      `Pago rechazado ❌ - ${amount} USD`,
      `Hola ${merchantName}.
Un pago de USD ${amount} fue rechazado.
Motivo: ${reason}
ID: ${paymentIntent.id}
Saludos,
Martín`
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

    await Promise.all([merchantPromise, buyerPromise])
  }

  return NextResponse.json({ received: true })
}