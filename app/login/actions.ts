'use server'

import { Resend } from 'resend'
import { getMerchantByEmail } from '@/lib/merchants'
import { createFounderMagicLinkToken, createMerchantMagicLinkToken } from '@/lib/merchant-session'
import { getSiteUrl } from '@/lib/site-url'
import { getFounderByEmail, normalizeEmail } from '@/lib/users'

async function sendMagicLink(email: string, link: string) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: process.env.RESEND_FROM || 'Cobrix Pay <notificaciones@cobrixpay.com>',
    to: email,
    subject: 'Tu acceso a Cobrix Pay',
    text: `Hola,\n\nIngresa a tu portal de Cobrix Pay desde este enlace:\n${link}\n\nEste enlace vence en 15 minutos.\n\nCobrix Pay`,
  })
}

export type MerchantLoginState = {
  status: 'idle' | 'success' | 'not_found'
  message: string
}

export async function requestMerchantLogin(_previousState: MerchantLoginState, formData: FormData): Promise<MerchantLoginState> {
  const email = normalizeEmail(String(formData.get('email') || ''))
  const founder = getFounderByEmail(email)

  if (founder) {
    const token = await createFounderMagicLinkToken(founder.email)
    const magicLink = `${getSiteUrl()}/login/verify?token=${encodeURIComponent(token)}`

    await sendMagicLink(founder.email, magicLink)

    return {
      status: 'success',
      message: 'Te enviamos un enlace de acceso a tu correo',
    } satisfies MerchantLoginState
  }

  const merchant = await getMerchantByEmail(email)

  if (!merchant) {
    return {
      status: 'not_found',
      message: 'No encontramos una cuenta asociada a ese correo.',
    } satisfies MerchantLoginState
  }

  const token = await createMerchantMagicLinkToken(merchant.slug, merchant.email)
  const magicLink = `${getSiteUrl()}/login/verify?token=${encodeURIComponent(token)}`

  await sendMagicLink(merchant.email, magicLink)

  return {
    status: 'success',
    message: 'Te enviamos un enlace de acceso a tu correo',
  } satisfies MerchantLoginState
}
