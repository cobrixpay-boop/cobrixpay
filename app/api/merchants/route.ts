import { NextResponse } from 'next/server'
import { listMerchants, saveMerchant } from '../../../lib/merchants'

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase()
}

function normalizeNotificationEmails(notificationEmails: any, fallbackEmail: string) {
  if (Array.isArray(notificationEmails)) {
    return notificationEmails.map((value: any) => String(value).trim()).filter(Boolean)
  }

  if (typeof notificationEmails === 'string' && notificationEmails.length > 0) {
    return notificationEmails
      .split(',')
      .map((value: string) => value.trim())
      .filter(Boolean)
  }

  return fallbackEmail ? [fallbackEmail] : []
}

export async function GET() {
  try {
    const merchants = await listMerchants()
    return NextResponse.json(merchants)
  } catch (err) {
    return NextResponse.json({ error: 'No se pudo leer merchants' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { slug, name, email, stripeAccountId, notificationEmails } = body
    const normalizedSlug = slug ? normalizeSlug(slug) : ''

    if (!normalizedSlug || !name || !email) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
    }

    const merchants = await listMerchants()
    const prev = merchants[normalizedSlug]
    const parsedNotificationEmails = normalizeNotificationEmails(notificationEmails, email)

    const merchant = {
      slug: normalizedSlug,
      name,
      email,
      notificationEmails: parsedNotificationEmails,
      stripeAccountId: stripeAccountId?.toString().trim() || prev?.stripeAccountId,
    }

    await saveMerchant(merchant)

    return NextResponse.json({ ok: true, merchant })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
