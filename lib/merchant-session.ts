import { getMerchantBySlug } from './merchants'
import { getFounderByEmail, normalizeEmail, type UserRole } from './users'

export const MERCHANT_SESSION_COOKIE = 'merchant_session'

const MAGIC_LINK_MAX_AGE_SECONDS = 15 * 60
const MERCHANT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

type MerchantAuthPayload = {
  slug?: string
  email: string
  exp: number
  purpose: 'magic-link' | 'session'
  role?: UserRole
}

function getMerchantAuthSecret() {
  return process.env.MERCHANT_AUTH_SECRET || process.env.ADMIN_TOKEN || ''
}

function toBase64Url(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

async function sign(value: string) {
  const secret = getMerchantAuthSecret()
  if (!secret) return ''

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))

  return toBase64Url(new Uint8Array(signature))
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false

  let mismatch = 0
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return mismatch === 0
}

async function createToken(payload: MerchantAuthPayload) {
  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = await sign(encodedPayload)

  return `${encodedPayload}.${signature}`
}

export async function createMerchantMagicLinkToken(slug: string, email: string) {
  return createToken({
    slug,
    email,
    role: 'MERCHANT',
    purpose: 'magic-link',
    exp: Math.floor(Date.now() / 1000) + MAGIC_LINK_MAX_AGE_SECONDS,
  })
}

export async function createMerchantSessionToken(slug: string, email: string) {
  return createToken({
    slug,
    email,
    role: 'MERCHANT',
    purpose: 'session',
    exp: Math.floor(Date.now() / 1000) + MERCHANT_SESSION_MAX_AGE_SECONDS,
  })
}

export async function createFounderMagicLinkToken(email: string) {
  return createToken({
    email,
    role: 'FOUNDER',
    purpose: 'magic-link',
    exp: Math.floor(Date.now() / 1000) + MAGIC_LINK_MAX_AGE_SECONDS,
  })
}

export async function createFounderSessionToken(email: string) {
  return createToken({
    email,
    role: 'FOUNDER',
    purpose: 'session',
    exp: Math.floor(Date.now() / 1000) + MERCHANT_SESSION_MAX_AGE_SECONDS,
  })
}

export async function verifyMerchantToken(token: string | undefined, purpose: MerchantAuthPayload['purpose']) {
  if (!token) return null

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  const expectedSignature = await sign(encodedPayload)
  if (!expectedSignature || !constantTimeEqual(signature, expectedSignature)) return null

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as MerchantAuthPayload

    if (payload.purpose !== purpose || payload.exp < Math.floor(Date.now() / 1000)) return null

    return {
      ...payload,
      role: payload.role || 'MERCHANT',
    }
  } catch {
    return null
  }
}

export async function getSessionUser(sessionToken: string | undefined) {
  const payload = await verifyMerchantToken(sessionToken, 'session')
  if (!payload) return null

  if (payload.role === 'FOUNDER') {
    return getFounderByEmail(payload.email) || null
  }

  if (!payload.slug) return null

  const merchant = await getMerchantBySlug(payload.slug)
  if (!merchant || normalizeEmail(merchant.email) !== normalizeEmail(payload.email)) return null

  return {
    ...merchant,
    role: 'MERCHANT' as const,
  }
}

export async function getMerchantFromSession(sessionToken: string | undefined) {
  const payload = await verifyMerchantToken(sessionToken, 'session')
  if (!payload || payload.role !== 'MERCHANT' || !payload.slug) return null

  const merchant = await getMerchantBySlug(payload.slug)
  if (!merchant || normalizeEmail(merchant.email) !== normalizeEmail(payload.email)) return null

  return merchant
}

export function getMerchantSessionMaxAge() {
  return MERCHANT_SESSION_MAX_AGE_SECONDS
}
