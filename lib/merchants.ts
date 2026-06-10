import fs from 'fs'
import path from 'path'

export type Merchant = {
  slug: string
  name: string
  email: string
  notificationEmails: string[]
  stripeAccountId?: string
}

const defaultMerchants: Record<string, Merchant> = {
  cobrix: {
    slug: 'cobrix',
    name: 'Cobrix Pay',
    email: 'notificaciones@cobrixpay.com',
    notificationEmails: ['notificaciones@cobrixpay.com'],
  },
}

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase()
}

function normalizeMerchantRecord(merchant: any, key: string): Merchant {
  const email = merchant.email || ''
  const notificationEmails = Array.isArray(merchant.notificationEmails)
    ? merchant.notificationEmails.map((value: any) => String(value).trim()).filter(Boolean)
    : email
    ? String(email)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : []

  return {
    slug: normalizeSlug(merchant.slug || key),
    name: merchant.name,
    email,
    notificationEmails,
    stripeAccountId: merchant.stripeAccountId,
  }
}

let merchants: Record<string, Merchant> = { ...defaultMerchants }

try {
  const dataPath = path.join(process.cwd(), 'data', 'merchants.json')
  if (fs.existsSync(dataPath)) {
    const raw = fs.readFileSync(dataPath, 'utf-8')
    const parsed = JSON.parse(raw)
    const loaded: Record<string, Merchant> = Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => {
        const merchant = normalizeMerchantRecord(value, key)
        return [merchant.slug, merchant]
      })
    )
    merchants = { ...merchants, ...loaded }
  }
} catch (e) {
  console.warn('No se pudo cargar merchants.json:', e)
}

export function getMerchantBySlug(slug?: string) {
  if (!slug) return undefined
  return merchants[normalizeSlug(slug)]
}

export function listMerchants() {
  return merchants
}
