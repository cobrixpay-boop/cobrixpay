import Stripe from 'stripe'
import { NextResponse } from 'next/server'

console.log('=== CHECKOUT BACKEND INICIADO ===')

// Usa tu clave LIVE real aquí (sk_live_...)
const STRIPE_KEY = 'sk_live_tuclave_real_live_aquí_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'

const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: '2026-01-28.clover',  // ← Esta es la versión que tu proyecto espera
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('Body recibido:', body)

    const { amount, slug } = body

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
    }

    console.log('Creando sesión con amount:', amount, 'slug:', slug)

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
      success_url: `${req.headers.get('origin') || 'https://cobrixpay.vercel.app'}/success`,
      cancel_url: `${req.headers.get('origin') || 'https://cobrixpay.vercel.app'}/cancel`,
    })

    console.log('Sesión creada OK:', session.id)
    console.log('URL:', session.url)

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('ERROR EN CHECKOUT:', error.message || error.toString())
    return NextResponse.json(
      { error: 'Error interno', details: error.message || 'Desconocido' },
      { status: 500 }
    )
  }
}