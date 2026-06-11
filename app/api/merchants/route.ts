import { NextResponse } from 'next/server'
import { listMerchants, saveMerchant } from '../../../lib/merchants'

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

function normalizeApplicationFeePercent(value: any) {
  if (value === undefined || value === null || value === '') return 0
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return NaN
  return Math.max(0, Math.min(100, parsed))
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const merchants = await listMerchants()
    return NextResponse.json(merchants)
  } catch (err) {
    return NextResponse.json({ error: 'No se pudo leer merchants' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { slug, name, email, stripeAccountId, notificationEmails, applicationFeePercent } = body
    const normalizedSlug = slug ? normalizeSlug(slug) : ''
    const normalizedStripeAccountId = stripeAccountId?.toString().trim() || ''
    const normalizedApplicationFeePercent = normalizeApplicationFeePercent(applicationFeePercent)

    if (!normalizedSlug || !name || !email || !normalizedStripeAccountId) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
    }

    if (!normalizedStripeAccountId.startsWith('acct_')) {
      return NextResponse.json({ error: 'El Stripe Account ID debe empezar con acct_' }, { status: 400 })
    }

    if (Number.isNaN(normalizedApplicationFeePercent)) {
      return NextResponse.json({ error: 'La comision debe ser un numero' }, { status: 400 })
    }

    const merchants = await listMerchants()
    const parsedNotificationEmails = normalizeNotificationEmails(notificationEmails, email)

    const merchant = {
      slug: normalizedSlug,
      name,
      email,
      notificationEmails: parsedNotificationEmails,
      stripeAccountId: normalizedStripeAccountId,
      applicationFeePercent: normalizedApplicationFeePercent,
    }

    await saveMerchant(merchant)

    return NextResponse.json({ ok: true, merchant })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
