import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia' as any,
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerEmail = session.customer_details?.email;
    const amount = session.amount_total ? session.amount_total / 100 : 0;
    const commerceName = session.metadata?.commerceName || 'Comercio';

    // 1. Mail al Comprador
    if (customerEmail) {
      await resend.emails.send({
        from: 'Cobrix Pay <pagos@tu-dominio.com>',
        to: customerEmail,
        subject: 'Tu pago ha sido aprobado ✅',
        html: `<p>Tu pago de <strong>$${amount} USD</strong> a ${commerceName} fue procesado con éxito.</p>`
      });
    }

    // 2. Mail al Comercio (tu mail o el del dueño)
    await resend.emails.send({
      from: 'Cobrix Pay <notificaciones@tu-dominio.com>',
      to: 'tu-email@comercio.com', // Aquí pones tu mail
      subject: '¡Nueva Venta Recibida! 💰',
      html: `<p>Has recibido un pago de <strong>$${amount} USD</strong> de ${customerEmail}.</p>`
    });
  }

  return NextResponse.json({ received: true });
}