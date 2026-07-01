import { readMerchantStorage, writeMerchantStorage } from './storage'

export type Merchant = {
  slug: string
  name: string
  email: string
  notificationEmails: string[]
  stripeAccountId?: string
  status?: string
  applicationFeePercent?: number
}

const defaultMerchants: Record<string, Merchant> = {
  cobrix: {
    slug: 'cobrix',
    name: 'Cobrix Pay',
    email: 'notificaciones@cobrixpay.com',
    notificationEmails: ['notificaciones@cobrixpay.com'],
    status: 'active',
  },
}

type StoredMerchant = Partial<Omit<Merchant, 'notificationEmails'>> & {
  notificationEmails?: unknown
}

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase()
}

function normalizeMerchantRecord(merchant: StoredMerchant, key: string): Merchant {
  const email = merchant.email || ''
  const notificationEmails = Array.isArray(merchant.notificationEmails)
    ? merchant.notificationEmails.map((value) => String(value).trim()).filter(Boolean)
    : email
    ? String(email)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : []

  return {
    slug: normalizeSlug(merchant.slug || key),
    name: merchant.name || merchant.slug || key,
    email,
    notificationEmails,
    stripeAccountId: merchant.stripeAccountId,
    status: merchant.status || 'pending',
    applicationFeePercent: Number(merchant.applicationFeePercent || 0),
  }
}

export async function getMerchantBySlug(slug?: string) {
  if (!slug) return undefined
  const merchants = await listMerchants()
  return merchants[normalizeSlug(slug)]
}

export async function getMerchantByEmail(email?: string) {
  if (!email) return undefined

  const normalizedEmail = email.trim().toLowerCase()
  const merchants = await listMerchants()

  return Object.values(merchants).find((merchant) => merchant.email.trim().toLowerCase() === normalizedEmail)
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
