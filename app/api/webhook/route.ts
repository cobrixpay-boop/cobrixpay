import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27' as any });
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  try {
    // Validamos el evento (Asegúrate de que STRIPE_WEBHOOK_SECRET sea el de 'Cuentas Conectadas')
    const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const amount = session.amount_total ? session.amount_total / 100 : 0;
      const customerEmail = session.customer_details?.email;

      // 1. Mail al Comercio (Estudio Ontivero)
      await resend.emails.send({
        from: 'Cobrix Pay <onboarding@resend.dev>', // Cámbialo por tu dominio cuando lo verifiques
        to: 'contador.ontivero@gmail.com',
        subject: '¡Nuevo cobro recibido!',
        html: `<p>Has recibido un nuevo pago de <strong>$${amount} USD</strong> a través de Cobrix Pay.</p>`
      });

      // 2. Mail al Cliente
      if (customerEmail) {
        await resend.emails.send({
          from: 'Cobrix Pay <onboarding@resend.dev>',
          to: customerEmail,
          subject: 'Recibo de tu pago',
          html: `<p>Gracias por tu pago de $${amount} USD. Tu transacción fue procesada con éxito.</p>`
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}