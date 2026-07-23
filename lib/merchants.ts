import { readMerchantStorage, writeMerchantStorage } from './storage'

export const MERCHANT_STATUSES = [
  'pending_documents',
  'under_review',
  'active',
  'suspended',
  'rejected',
] as const

export type MerchantStatus = (typeof MERCHANT_STATUSES)[number]

export type MerchantOnboardingInvitation = {
  id: string
  tokenHash: string
  createdAt: string
  expiresAt: string
  sentAt?: string
  resentAt?: string
  revokedAt?: string
  createdBy?: string
  email: string
}

export type MerchantOnboardingProgress = {
  percent: number
  lastCompletedStep: number
  startedAt?: string
  lastSavedAt?: string
  submittedAt?: string
  documentationPending: boolean
}

export type MerchantOnboarding = {
  invitation?: MerchantOnboardingInvitation
  responsiblePerson?: Record<string, string | boolean>
  businessProfile?: Record<string, string | boolean>
  operations?: Record<string, string | boolean | string[]>
  banking?: Record<string, string>
  declarations?: {
    accepted: Record<string, { acceptedAt: string; version: string }>
    submittedBy?: string
    submittedIp?: string
    submittedUserAgent?: string
    invitationId?: string
  }
  progress: MerchantOnboardingProgress
  timestamps: {
    createdAt?: string
    startedAt?: string
    lastSavedAt?: string
    submittedAt?: string
  }
}

export type MerchantCompliance = {
  documentationPending?: boolean
  alerts?: Array<{
    code: string
    message: string
    createdAt: string
  }>
  documents?: {
    pending: string[]
  }
}

export type MerchantAuditEvent = {
  type: string
  createdAt: string
  actor?: string
  detail?: string
}

export type Merchant = {
  slug: string
  name: string
  email: string
  notificationEmails: string[]
  stripeAccountId?: string
  postPaymentUrl?: string
  whatsapp?: string
  supportEmail?: string
  supportPhone?: string
  status: MerchantStatus
  archived: boolean
  archivedReason?: 'admin' | 'compliance'
  everActive?: boolean
  onboarding?: MerchantOnboarding
  compliance?: MerchantCompliance
  auditHistory?: MerchantAuditEvent[]
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
    archived: false,
    everActive: true,
  },
}

type StoredMerchant = Partial<Omit<Merchant, 'notificationEmails' | 'status'>> & {
  notificationEmails?: unknown
  status?: unknown
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

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function optionalAuditHistory(value: unknown): MerchantAuditEvent[] | undefined {
  if (!Array.isArray(value)) return undefined

  return value
    .filter((event) => event && typeof event === 'object')
    .map((event) => event as Partial<MerchantAuditEvent>)
    .filter((event) => typeof event.type === 'string' && typeof event.createdAt === 'string')
    .map((event) => ({
      type: event.type || '',
      createdAt: event.createdAt || '',
      actor: optionalString(event.actor),
      detail: optionalString(event.detail),
    }))
}

export function isMerchantStatus(value: unknown): value is MerchantStatus {
  return typeof value === 'string' && MERCHANT_STATUSES.includes(value as MerchantStatus)
}

export function normalizeMerchantStatus(value: unknown): MerchantStatus {
  return isMerchantStatus(value) ? value : 'pending_documents'
}

export function isValidStripeAccountId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().startsWith('acct_')
}

export function canMerchantAcceptPayments(merchant: Merchant | undefined) {
  return Boolean(
    merchant &&
      !merchant.archived &&
      merchant.status === 'active' &&
      isValidStripeAccountId(merchant.stripeAccountId)
  )
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
    supportEmail: optionalString(merchant.supportEmail),
    supportPhone: optionalString(merchant.supportPhone),
    status: normalizeMerchantStatus(merchant.status),
    archived: merchant.archived === true,
    archivedReason:
      merchant.archivedReason === 'compliance' ? 'compliance' : merchant.archivedReason === 'admin' ? 'admin' : undefined,
    everActive: merchant.everActive === true || merchant.status === 'active',
    onboarding: optionalRecord(merchant.onboarding) as MerchantOnboarding | undefined,
    compliance: optionalRecord(merchant.compliance) as MerchantCompliance | undefined,
    auditHistory: optionalAuditHistory(merchant.auditHistory),
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
      const merchant = normalizeMerchantRecord(value as StoredMerchant, key)
      return [merchant.slug, merchant]
    })
  )

  return { ...defaultMerchants, ...loaded }
}

export async function saveMerchant(merchant: Merchant) {
  const merchants = await readMerchantStorage()
  merchants[merchant.slug] = {
    ...merchant,
    archived: merchant.archived === true,
    everActive: merchant.everActive === true || merchant.status === 'active',
  }
  await writeMerchantStorage(merchants)
}

export async function deleteMerchant(slug: string) {
  const merchants = await readMerchantStorage()
  delete merchants[normalizeSlug(slug)]
  await writeMerchantStorage(merchants)
}

export async function getMerchantStatusReviewReport() {
  const stored = await readMerchantStorage()
  return Object.entries(stored).map(([key, merchant]) => {
    const record = merchant as StoredMerchant
    const currentStatus = typeof record.status === 'string' && record.status ? record.status : '(sin estado)'

    return {
      slug: normalizeSlug(record.slug || key),
      name: record.name || record.slug || key,
      currentStatus,
      proposedStatus: isMerchantStatus(record.status) ? record.status : 'requiere decision manual',
    }
  })
}
