import { readMerchantStorage, writeMerchantStorage } from './storage'

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

export async function getMerchantBySlug(slug?: string) {
  if (!slug) return undefined
  const merchants = await listMerchants()
  return merchants[normalizeSlug(slug)]
}

export async function listMerchants() {
  const stored = await readMerchantStorage()
  const loaded: Record<string, Merchant> = Object.fromEntries(
    Object.entries(stored).map(([key, value]) => {
      const merchant = normalizeMerchantRecord(value, key)
      return [merchant.slug, merchant]
    })
  )

  return { ...defaultMerchants, ...loaded }
}

export async function saveMerchant(merchant: Merchant) {
  const merchants = await readMerchantStorage()
  merchants[merchant.slug] = merchant
  await writeMerchantStorage(merchants)
}
