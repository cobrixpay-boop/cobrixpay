import { NextResponse } from 'next/server'
import {
  isMerchantStatus,
  isValidStripeAccountId,
  listMerchants,
  saveMerchant,
  type Merchant,
} from '../../../lib/merchants'

function isAuthorized(req: Request) {
  const adminToken = process.env.ADMIN_TOKEN
  if (!adminToken) return true

  return req.headers.get('x-admin-token') === adminToken
}

function normalizeSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
}

function normalizeNotificationEmails(notificationEmails: unknown, fallbackEmail: string) {
  if (Array.isArray(notificationEmails)) {
    return notificationEmails.map((value) => String(value).trim()).filter(Boolean)
  }

  if (typeof notificationEmails === 'string' && notificationEmails.length > 0) {
    return notificationEmails
      .split(',')
      .map((value: string) => value.trim())
      .filter(Boolean)
  }

  return fallbackEmail ? [fallbackEmail] : []
}

function normalizeApplicationFeePercent(value: unknown) {
  if (value === undefined || value === null || value === '') return 0
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return NaN
  return Math.max(0, Math.min(100, parsed))
}

function normalizeOptionalString(value: unknown) {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined
}

function isValidPostPaymentUrl(value: string) {
  if (!value) return true

  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const merchants = await listMerchants()
    return NextResponse.json(merchants)
  } catch {
    return NextResponse.json({ error: 'No se pudo leer merchants' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const { slug, name, email, stripeAccountId, notificationEmails, applicationFeePercent, postPaymentUrl, whatsapp, status } = body
    const normalizedSlug = typeof slug === 'string' ? normalizeSlug(slug) : ''
    const normalizedName = normalizeOptionalString(name)
    const normalizedEmail = normalizeOptionalString(email)
    const normalizedStripeAccountId = normalizeOptionalString(stripeAccountId)
    const normalizedApplicationFeePercent = normalizeApplicationFeePercent(applicationFeePercent)
    const normalizedPostPaymentUrl = normalizeOptionalString(postPaymentUrl)
    const normalizedWhatsapp = normalizeOptionalString(whatsapp)

    if (!normalizedSlug || !normalizedName || !normalizedEmail) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
    }

    const existingMerchants = await listMerchants()
    const existingMerchant = existingMerchants[normalizedSlug]
    const normalizedStatus = status === undefined ? existingMerchant?.status || 'pending_documents' : status

    if (normalizedStripeAccountId && !isValidStripeAccountId(normalizedStripeAccountId)) {
      return NextResponse.json({ error: 'El Stripe Account ID debe empezar con acct_' }, { status: 400 })
    }

    if (!isMerchantStatus(normalizedStatus)) {
      return NextResponse.json({ error: 'Estado de comercio invalido' }, { status: 400 })
    }

    if (normalizedStatus === 'active' && !isValidStripeAccountId(normalizedStripeAccountId)) {
      return NextResponse.json({ error: 'No se puede activar un comercio sin Stripe Account ID valido' }, { status: 400 })
    }

    if (Number.isNaN(normalizedApplicationFeePercent)) {
      return NextResponse.json({ error: 'La comision debe ser un numero' }, { status: 400 })
    }

    if (!isValidPostPaymentUrl(normalizedPostPaymentUrl)) {
      return NextResponse.json({ error: 'La URL despues del pago debe empezar con http:// o https://' }, { status: 400 })
    }

    const parsedNotificationEmails = normalizeNotificationEmails(notificationEmails, normalizedEmail)

    const merchant: Merchant = {
      ...existingMerchant,
      slug: normalizedSlug,
      name: normalizedName,
      email: normalizedEmail,
      notificationEmails: parsedNotificationEmails,
      status: normalizedStatus,
      applicationFeePercent: normalizedApplicationFeePercent,
      ...(normalizedPostPaymentUrl ? { postPaymentUrl: normalizedPostPaymentUrl } : {}),
      ...(normalizedWhatsapp ? { whatsapp: normalizedWhatsapp } : {}),
    }

    if (normalizedStripeAccountId) {
      merchant.stripeAccountId = normalizedStripeAccountId
    } else {
      delete merchant.stripeAccountId
    }

    if (!normalizedPostPaymentUrl) {
      delete merchant.postPaymentUrl
    }

    if (!normalizedWhatsapp) {
      delete merchant.whatsapp
    }

    await saveMerchant(merchant)

    return NextResponse.json({ ok: true, merchant })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) || 'Error interno' }, { status: 500 })
  }
}
