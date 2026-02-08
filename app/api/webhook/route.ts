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

  let event: Stripe.Event

  try {
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: unknown) {
    const error = err as Error
    console.error('Webhook Error:', error.message)
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const amount = paymentIntent.amount / 100
    const id = paymentIntent.id

    console.log(`Pago aprobado: ${amount} USD - ID: ${id}`)

    await resend.emails.send({
      from: 'Cobrix Pay <noreply@cobrixpay.com>',
      to: 'contador.ontivero@gmail.com',
      subject: `Pago recibido con éxito ✅ - ${amount} USD`,
      text: `¡Hola!
Se recibió un pago de USD ${amount} en tu cuenta Cobrix Pay.
ID: ${id}
Gracias por usar Cobrix Pay!
Saludos,
Martín
`,
    })
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const amount = paymentIntent.amount / 100
    const id = paymentIntent.id
    const reason = paymentIntent.last_payment_error?.message || 'Motivo desconocido'

    console.log(`Pago rechazado: ${amount} USD - ID: ${id} - Motivo: ${reason}`)

    await resend.emails.send({
      from: 'Cobrix Pay <noreply@cobrixpay.com>',
      to: 'contador.ontivero@gmail.com',
      subject: `Pago rechazado ❌ - ${amount} USD`,
      text: `Hola,
Un pago de USD ${amount} fue rechazado.
Motivo: ${reason}
ID: ${id}
Intenta de nuevo o revisa con el cliente.
Saludos,
Martín
`,
    })
  }

  return NextResponse.json({ received: true })
}