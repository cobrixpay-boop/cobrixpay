import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { getMerchantBySlug, type Merchant } from '../../../lib/merchants'
import { markPaymentLinkPaid } from '@/lib/payment-links'
import { formatStripeMoney } from '@/lib/stripe-money'

type EmailParams = {
  to: string | string[]
  subject: string
  text: string
  html?: string
  replyTo?: string
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  })
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('Missing STRIPE_WEBHOOK_SECRET')
  }
  return secret
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getSafeTelHref(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, '')
  return normalized ? `tel:${normalized}` : ''
}

function getBuyerEmail(paymentIntent: Stripe.PaymentIntent, session?: Stripe.Checkout.Session, charge?: Stripe.Charge) {
  return paymentIntent.receipt_email || charge?.billing_details?.email || session?.customer_details?.email || session?.customer_email
}

async function getCheckoutSession(stripe: Stripe, paymentIntent: Stripe.PaymentIntent) {
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntent.id,
    limit: 1,
  })

  return sessions.data[0]
}

async function getSuccessfulCharge(stripe: Stripe, paymentIntent: Stripe.PaymentIntent) {
  const latestCharge = paymentIntent.latest_charge

  if (typeof latestCharge === 'string') {
    const charge = await stripe.charges.retrieve(latestCharge)
    return charge.paid ? charge : undefined
  }

  if (latestCharge && typeof latestCharge === 'object' && latestCharge.paid) {
    return latestCharge
  }

  const charges = await stripe.charges.list({
    payment_intent: paymentIntent.id,
    limit: 10,
  })

  return charges.data.find((charge) => charge.paid)
}

async function getMerchantSlug(stripe: Stripe, paymentIntent: Stripe.PaymentIntent, session?: Stripe.Checkout.Session) {
  const metadataSlug = paymentIntent.metadata?.merchantSlug
  if (metadataSlug) return metadataSlug

  const checkoutSession = session || (await getCheckoutSession(stripe, paymentIntent))
  return checkoutSession?.metadata?.merchantSlug || checkoutSession?.client_reference_id || undefined
}

function getMerchantName(paymentIntent: Stripe.PaymentIntent, session?: Stripe.Checkout.Session) {
  return paymentIntent.metadata?.merchantName || session?.metadata?.merchantName
}

function formatPaymentDate(timestamp: number) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(timestamp * 1000))
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function getWalletLabel(walletType?: string | null) {
  if (walletType === 'apple_pay') return 'Apple Pay'
  if (walletType === 'google_pay') return 'Google Pay'
  return ''
}

function getPaymentMethodLabel(charge?: Stripe.Charge) {
  const details = charge?.payment_method_details
  if (!details || details.type !== 'card') return ''

  const card = details.card
  if (!card?.brand || !card.last4) return ''

  const cardLabel = `${titleCase(card.brand)} terminada en ${card.last4}`
  const walletLabel = getWalletLabel(card.wallet?.type)

  return walletLabel ? `${walletLabel} · ${cardLabel}` : cardLabel
}

function buildBuyerEmail(params: {
  merchantName: string
  amount: string
  paymentDate: string
  paymentMethod?: string
  paymentIntentId: string
  merchant?: Merchant
}) {
  const contactLines = [
    params.merchant?.supportEmail ? `Email: ${params.merchant.supportEmail}` : '',
    params.merchant?.supportPhone ? `Teléfono: ${params.merchant.supportPhone}` : '',
  ].filter(Boolean)
  const paymentMethodLine = params.paymentMethod ? `Medio de pago: ${params.paymentMethod}\n` : ''
  const contactText =
    contactLines.length > 0
      ? `
Consultas sobre tu compra
${contactLines.join('\n')}
`
      : ''
  const text = `Pago confirmado

Tu pago a ${params.merchantName} fue procesado correctamente.

Monto: ${params.amount}
Fecha: ${params.paymentDate}
${paymentMethodLine}ID de operación Stripe: ${params.paymentIntentId}
${contactText}
Pago procesado de forma segura por Cobrix Pay.

Este mensaje confirma el procesamiento del pago. El comprobante fiscal correspondiente, si aplica, es emitido por el comercio.`

  const safeMerchantName = escapeHtml(params.merchantName)
  const safeAmount = escapeHtml(params.amount)
  const safePaymentDate = escapeHtml(params.paymentDate)
  const safePaymentMethod = params.paymentMethod ? escapeHtml(params.paymentMethod) : ''
  const safePaymentIntentId = escapeHtml(params.paymentIntentId)
  const supportEmail = params.merchant?.supportEmail
  const supportPhone = params.merchant?.supportPhone
  const contactHtml =
    supportEmail || supportPhone
      ? `<div style="margin-top:24px;padding-top:18px;border-top:1px solid #e5e7eb;">
          <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Consultas sobre tu compra</h2>
          ${
            supportEmail
              ? `<p style="margin:6px 0;color:#374151;">Email: <a href="mailto:${escapeHtml(supportEmail)}" style="color:#1455d9;">${escapeHtml(supportEmail)}</a></p>`
              : ''
          }
          ${
            supportPhone
              ? `<p style="margin:6px 0;color:#374151;">Teléfono: <a href="${escapeHtml(getSafeTelHref(supportPhone))}" style="color:#1455d9;">${escapeHtml(supportPhone)}</a></p>`
              : ''
          }
        </div>`
      : ''
  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;">
        <p style="margin:0 0 8px;color:#1455d9;font-weight:700;">Cobrix Pay</p>
        <h1 style="margin:0;font-size:24px;line-height:1.2;">Pago confirmado</h1>
        <p style="margin:18px 0 0;color:#374151;line-height:1.5;">Tu pago a <strong>${safeMerchantName}</strong> fue procesado correctamente.</p>
        <div style="margin-top:22px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#fbfcff;">
          <p style="margin:0 0 8px;color:#374151;"><strong>Monto:</strong> ${safeAmount}</p>
          <p style="margin:0 0 8px;color:#374151;"><strong>Fecha:</strong> ${safePaymentDate}</p>
          ${safePaymentMethod ? `<p style="margin:0 0 8px;color:#374151;"><strong>Medio de pago:</strong> ${safePaymentMethod}</p>` : ''}
          <p style="margin:0;color:#374151;"><strong>ID de operación Stripe:</strong> ${safePaymentIntentId}</p>
        </div>
        ${contactHtml}
        <p style="margin:24px 0 0;color:#374151;line-height:1.5;">Pago procesado de forma segura por Cobrix Pay.</p>
        <p style="margin:12px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">Este mensaje confirma el procesamiento del pago. El comprobante fiscal correspondiente, si aplica, es emitido por el comercio.</p>
      </div>
    </div>
  </body>
</html>`

  return { text, html }
}

async function sendEmail({ to, subject, text, html, replyTo }: EmailParams) {
  const resend = getResend()
  return resend.emails.send({
    from: 'Cobrix Pay <notificaciones@cobrixpay.com>',
    to,
    subject,
    text,
    html,
    ...(replyTo ? { reply_to: replyTo } : {}),
  })
}

async function sendNotifications(label: string, notifications: Array<Promise<unknown>>) {
  const results = await Promise.allSettled(notifications)
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error(`Error enviando email de ${label}:`, result.reason)
    }
  })
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')!
  const stripe = getStripe()

  let event

  try {
    const body = await req.text()
    const webhookSecret = getWebhookSecret()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 })
  }

  if (event.type !== 'payment_intent.succeeded' && event.type !== 'payment_intent.payment_failed') {
    return NextResponse.json({ received: true })
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const checkoutSession = await getCheckoutSession(stripe, paymentIntent)
  const successfulCharge = event.type === 'payment_intent.succeeded' ? await getSuccessfulCharge(stripe, paymentIntent) : undefined
  const merchantSlug = await getMerchantSlug(stripe, paymentIntent, checkoutSession)
  const merchant = await getMerchantBySlug(merchantSlug)
  const merchantEmails =
    merchant?.notificationEmails && merchant.notificationEmails.length > 0
      ? merchant.notificationEmails
      : merchant?.email
      ? [merchant.email]
      : [process.env.DEFAULT_MERCHANT_EMAIL || 'cobrixpay@gmail.com']
  const merchantName = merchant?.name || getMerchantName(paymentIntent, checkoutSession) || merchantSlug?.replace(/-/g, ' ') || 'Cobrix Pay'
  const buyerEmail = getBuyerEmail(paymentIntent, checkoutSession, successfulCharge)
  const amount = formatStripeMoney(paymentIntent.amount_received || paymentIntent.amount, paymentIntent.currency)
  const paymentDate = formatPaymentDate(successfulCharge?.created || paymentIntent.created)

  if (event.type === 'payment_intent.succeeded') {
    const paymentLinkId = paymentIntent.metadata?.paymentLinkId || checkoutSession?.metadata?.paymentLinkId

    if (paymentLinkId) {
      await markPaymentLinkPaid(paymentLinkId, paymentIntent.id)
    }

    const merchantPromise = sendEmail({
      to: merchantEmails,
      subject: `Nuevo cobro recibido - ${amount}`,
      text: `Nuevo cobro recibido

Comercio: ${merchantName}
Monto: ${amount}
Fecha y hora: ${paymentDate}
ID de operación Stripe: ${paymentIntent.id}

Este cobro ya fue procesado correctamente.

Cobrix Pay`,
    })

    const buyerPromise = buyerEmail
      ? sendEmail({
          to: buyerEmail,
          subject: `Pago confirmado – ${merchantName}`,
          ...buildBuyerEmail({
            merchantName,
            amount,
            paymentDate,
            paymentMethod: getPaymentMethodLabel(successfulCharge),
            paymentIntentId: paymentIntent.id,
            merchant,
          }),
          replyTo: merchant?.supportEmail,
        })
      : Promise.resolve()

    await sendNotifications('pago aprobado', [merchantPromise, buyerPromise])
  }

  if (event.type === 'payment_intent.payment_failed') {
    const reason = paymentIntent.last_payment_error?.message || 'No pudimos procesar el pago.'

    const failedMessage = `Pago no procesado

Comercio: ${merchantName}
Monto: ${amount}
Fecha y hora: ${paymentDate}
ID de operación Stripe: ${paymentIntent.id}

El pago no pudo completarse.
Motivo: ${reason}

Cobrix Pay`

    const merchantPromise = sendEmail({
      to: merchantEmails,
      subject: `Pago no procesado - ${amount}`,
      text: failedMessage,
    })

    const buyerPromise = buyerEmail
      ? sendEmail({
          to: buyerEmail,
          subject: `No pudimos procesar tu pago en ${merchantName}`,
          text: `Pago no procesado

No pudimos procesar tu pago a ${merchantName}.

Monto: ${amount}
Fecha y hora: ${paymentDate}
ID de operación Stripe: ${paymentIntent.id}

Motivo: ${reason}

Por favor intentá nuevamente o consultá al comercio si necesitás ayuda.

Cobrix Pay`,
        })
      : Promise.resolve()

    await sendNotifications('pago rechazado', [merchantPromise, buyerPromise])
  }

  return NextResponse.json({ received: true })
}
