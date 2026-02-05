import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// He cambiado la versión a '2026-01-28.clover' para que coincida con lo que te pide Vercel
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover' as any,
})

export async function POST(req: Request) {
  try {
    const { amount, commerceName } = await req.json()
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Pago a ${commerceName || 'Comercio'}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pay/${commerceName}`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error("Error de Stripe:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}