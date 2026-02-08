import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
})

const resend = new Resend(process.env.RESEND_API_KEY!)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')!

  let event

  try {
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook Error:', err.message)
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object
    const amount = paymentIntent.amount / 100

    await resend.emails.send({
      from: 'Cobrix Pay <noreply@cobrixpay.com>',
      to: 'contador.ontivero@gmail.com',
      subject: 'Pago recibido ✅',
      text: `Se recibió un pago de USD ${amount} para el comercio ${event.data.object.metadata?.slug || 'desconocido'}. ID: ${paymentIntent.id}`,
    })
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object
    const amount = paymentIntent.amount / 100
    const reason = paymentIntent.last_payment_error?.message || 'Motivo desconocido'

    await resend.emails.send({
      from: 'Cobrix Pay <noreply@cobrixpay.com>',
      to: 'contador.ontivero@gmail.com',
      subject: 'Pago rechazado ❌',
      text: `Pago de USD ${amount} rechazado. Motivo: ${reason}. ID: ${paymentIntent.id}`,
    })
  }

  return NextResponse.json({ received: true })
}