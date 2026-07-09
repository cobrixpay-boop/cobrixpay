import { readMerchantStorage, writeMerchantStorage } from './storage'

export type Merchant = {
  slug: string
  name: string
  email: string
  notificationEmails: string[]
  stripeAccountId?: string
  postPaymentUrl?: string
  whatsapp?: string
  status?: string
  applicationFeePercent?: number
  phone?: string
  websiteOrInstagram?: string
  city?: string
  country?: string
  source?: string
  salesRepName?: string
  salesRepCommissionPercent?: number
  salesRepCommissionStartDate?: string
  salesRepCommissionEndDate?: string
  commercialPartnerName?: string
  commercialPartnerType?: string
  commercialPartnerCommissionPercent?: number
  commercialPartnerCommissionStartDate?: string
  commercialPartnerCommissionEndDate?: string
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

function optionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
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
    postPaymentUrl: optionalString(merchant.postPaymentUrl),
    whatsapp: optionalString(merchant.whatsapp),
    status: merchant.status || 'pending',
    applicationFeePercent: Number(merchant.applicationFeePercent || 0),
    phone: optionalString(merchant.phone),
    websiteOrInstagram: optionalString(merchant.websiteOrInstagram),
    city: optionalString(merchant.city),
    country: optionalString(merchant.country),
    source: optionalString(merchant.source),
    salesRepName: optionalString(merchant.salesRepName),
    salesRepCommissionPercent: optionalNumber(merchant.salesRepCommissionPercent),
    salesRepCommissionStartDate: optionalString(merchant.salesRepCommissionStartDate),
    salesRepCommissionEndDate: optionalString(merchant.salesRepCommissionEndDate),
    commercialPartnerName: optionalString(merchant.commercialPartnerName),
    commercialPartnerType: optionalString(merchant.commercialPartnerType),
    commercialPartnerCommissionPercent: optionalNumber(merchant.commercialPartnerCommissionPercent),
    commercialPartnerCommissionStartDate: optionalString(merchant.commercialPartnerCommissionStartDate),
    commercialPartnerCommissionEndDate: optionalString(merchant.commercialPartnerCommissionEndDate),
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
