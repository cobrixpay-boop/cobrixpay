import Stripe from 'stripe'
import { NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { amount, slug } = body

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Pago a ${slug || 'Cobrix Pay'}`,
            },
            unit_amount: Math.round(Number(amount) * 100),
          },
          quantity: 1,
        },
      ],
      success_url: 'https://cobrixpay.vercel.app/success',
      cancel_url: 'https://cobrixpay.vercel.app/cancel',
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Error en checkout:', error.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}