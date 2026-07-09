import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { getMerchantBySlug } from '../../../lib/merchants'

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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { amount, slug } = body
    const merchant = await getMerchantBySlug(slug)
    const merchantSlug = merchant?.slug || slug || 'cobrix'

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
    }

    if (!merchant) {
      return NextResponse.json({ error: `No existe el comercio "${slug}"` }, { status: 404 })
    }

    if (!merchant.stripeAccountId) {
      return NextResponse.json({ error: `El comercio "${merchantSlug}" no tiene Stripe Account ID` }, { status: 400 })
    }

    const baseUrl = getBaseUrl()
    const amountInCents = Math.round(Number(amount) * 100)
    const applicationFeePercent = merchant?.applicationFeePercent || 0
    const merchantName = merchant.name || merchantSlug
    const paymentMetadata = {
      merchantSlug,
      merchantName,
      applicationFeePercent: String(applicationFeePercent),
    }
    const applicationFeeAmount = Math.min(
      amountInCents,
      Math.max(0, Math.round((amountInCents * applicationFeePercent) / 100))
    )
    const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
      metadata: paymentMetadata,
    }

    paymentIntentData.transfer_data = {
      destination: merchant.stripeAccountId,
    }

    if (applicationFeeAmount > 0) {
      paymentIntentData.application_fee_amount = applicationFeeAmount
    }

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      client_reference_id: merchantSlug,
      metadata: paymentMetadata,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Pago a ${merchantName}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: paymentIntentData,
      success_url: `${baseUrl}/success?merchant=${encodeURIComponent(merchantSlug)}`,
      cancel_url: `${baseUrl}/cancel?merchant=${encodeURIComponent(merchantSlug)}`,
    })

    return NextResponse.json({ url: session.url })
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
