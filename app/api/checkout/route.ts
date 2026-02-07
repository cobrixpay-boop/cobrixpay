import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27' as any,
});

// BASE DE DATOS DE COMERCIOS
const COMERCIOS: Record<string, { stripeId: string; nombre: string; email: string; comision: number }> = {
  "estudio-ontivero": {
    stripeId: "acct_1S74Q2KNskANs8tN",
    nombre: "Estudio Ontivero",
    email: "contador.ontivero@gmail.com",
    comision: 0.04 // 4% de comisión para Cobrix Pay
  },
  // Para agregar más, solo copias el bloque anterior aquí abajo
};

export async function POST(req: Request) {
  try {
    const { amount, slug } = await req.json();
    const comercio = COMERCIOS[slug];

    if (!comercio) {
      return NextResponse.json({ error: 'Comercio no encontrado' }, { status: 404 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `Pago a ${comercio.nombre}`,
            description: "Servicio procesado por Cobrix Pay",
          },
        },
        quantity: 1,
      }],
      payment_intent_data: {
        // Cálculo automático de tu comisión
        application_fee_amount: Math.round((amount * 100) * comercio.comision),
        transfer_data: {
          destination: comercio.stripeId,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}&slug=${slug}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pay/${slug}`,
    });

    return NextResponse.json({ id: session.id });
  } catch (err: any) {
    console.error("Error en Checkout:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}