import crypto from 'node:crypto'
import fs from 'fs'
import path from 'path'
import { Redis } from '@upstash/redis'
import { type Merchant } from './merchants'
import { usesUpstash } from './storage'

const STORAGE_PREFIX = 'cobrix:payment-links'
const LOCK_PREFIX = 'cobrix:payment-links-lock'
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CHECKOUT_LOCK_SECONDS = 20

let upstashClient: Redis | undefined
const localLocks = new Set<string>()

export type PaymentLinkStatus = 'pending' | 'paid' | 'expired' | 'disabled'

export type PaymentLink = {
  id: string
  merchantSlug: string
  amount: number
  currency: string
  concept?: string
  status: PaymentLinkStatus
  createdAt: string
  expiresAt: string
  paidAt?: string
  stripePaymentIntentId?: string
  stripeCheckoutSessionId?: string
  stripeCheckoutSessionExpiresAt?: string
  stripeCheckoutAttempt?: number
}

function getUpstashClient() {
  if (!upstashClient) {
    upstashClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }

  return upstashClient
}

function getLocalDataPath() {
  return path.join(process.cwd(), 'data', 'payment-links.json')
}

function getStorageKey(id: string) {
  return `${STORAGE_PREFIX}:${id}`
}

function getLockKey(id: string) {
  return `${LOCK_PREFIX}:${id}`
}

function assertProductionStorage() {
  if (process.env.NODE_ENV === 'production' && !usesUpstash()) {
    throw new Error('Payment links require Upstash Redis in production')
  }
}

function ensureLocalDataFile() {
  const dataPath = getLocalDataPath()
  const dir = path.dirname(dataPath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify({}, null, 2), 'utf-8')
  }
}

function parseStorage(raw: unknown): Record<string, PaymentLink> {
  if (!raw) return {}

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, PaymentLink>
  }

  return {}
}

async function readPaymentLinkStorage() {
  assertProductionStorage()

  if (usesUpstash()) {
    return {}
  }

  ensureLocalDataFile()
  return parseStorage(JSON.parse(fs.readFileSync(getLocalDataPath(), 'utf-8') || '{}'))
}

async function writePaymentLinkStorage(data: Record<string, PaymentLink>) {
  assertProductionStorage()

  if (usesUpstash()) {
    return
  }

  ensureLocalDataFile()
  fs.writeFileSync(getLocalDataPath(), JSON.stringify(data, null, 2), 'utf-8')
}

function createPublicId() {
  return crypto.randomBytes(18).toString('base64url')
}

export function getPaymentLinkExpiresAt(now = new Date()) {
  return new Date(now.getTime() + LINK_TTL_MS).toISOString()
}

export function isPaymentLinkExpired(paymentLink: PaymentLink, now = new Date()) {
  return new Date(paymentLink.expiresAt).getTime() <= now.getTime()
}

export async function createPaymentLink(params: {
  merchant: Merchant
  amount: number
  currency: string
  concept?: string
}) {
  let id = createPublicId()
  const now = new Date()

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const paymentLink: PaymentLink = {
      id,
      merchantSlug: params.merchant.slug,
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      concept: params.concept?.trim() || undefined,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: getPaymentLinkExpiresAt(now),
    }

    if (usesUpstash()) {
      assertProductionStorage()
      const created = await getUpstashClient().set(getStorageKey(id), JSON.stringify(paymentLink), { nx: true })
      if (created === 'OK') return paymentLink
    } else {
      const links = await readPaymentLinkStorage()
      if (!links[id]) {
        links[id] = paymentLink
        await writePaymentLinkStorage(links)
        return paymentLink
      }
    }

    id = createPublicId()
  }

  throw new Error('No se pudo crear un identificador unico para el link de pago')
}

export async function getPaymentLinkById(id: string | undefined) {
  if (!id || !/^[A-Za-z0-9_-]{16,}$/.test(id)) return undefined

  let paymentLink: PaymentLink | undefined

  if (usesUpstash()) {
    assertProductionStorage()
    const raw = await getUpstashClient().get<string | PaymentLink>(getStorageKey(id))
    paymentLink = typeof raw === 'string' ? JSON.parse(raw) : raw || undefined
  } else {
    const links = await readPaymentLinkStorage()
    paymentLink = links[id]
  }

  if (!paymentLink) return undefined

  if (paymentLink.status === 'pending' && isPaymentLinkExpired(paymentLink)) {
    paymentLink.status = 'expired'
    await updatePaymentLink(paymentLink)
  }

  return paymentLink
}

export async function updatePaymentLink(paymentLink: PaymentLink) {
  if (usesUpstash()) {
    assertProductionStorage()
    await getUpstashClient().set(getStorageKey(paymentLink.id), JSON.stringify(paymentLink))
    return paymentLink
  }

  const links = await readPaymentLinkStorage()
  links[paymentLink.id] = paymentLink
  await writePaymentLinkStorage(links)
  return paymentLink
}

export async function acquirePaymentLinkCheckoutLock(id: string) {
  const token = crypto.randomBytes(12).toString('base64url')

  if (usesUpstash()) {
    assertProductionStorage()
    const acquired = await getUpstashClient().set(getLockKey(id), token, { nx: true, ex: CHECKOUT_LOCK_SECONDS })
    return acquired === 'OK' ? token : null
  }

  if (localLocks.has(id)) return null
  localLocks.add(id)
  return token
}

export async function releasePaymentLinkCheckoutLock(id: string, token: string) {
  if (usesUpstash()) {
    await getUpstashClient().eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      [getLockKey(id)],
      [token]
    )
    return
  }

  localLocks.delete(id)
}

export async function markPaymentLinkCheckoutCreated(
  id: string,
  checkoutSessionId: string,
  paymentIntentId?: string,
  checkoutSessionExpiresAt?: string,
  checkoutAttempt?: number
) {
  const paymentLink = await getPaymentLinkById(id)
  if (!paymentLink || paymentLink.status !== 'pending') return paymentLink

  return updatePaymentLink({
    ...paymentLink,
    stripeCheckoutSessionId: checkoutSessionId,
    stripePaymentIntentId: paymentIntentId || paymentLink.stripePaymentIntentId,
    stripeCheckoutSessionExpiresAt: checkoutSessionExpiresAt || paymentLink.stripeCheckoutSessionExpiresAt,
    stripeCheckoutAttempt: checkoutAttempt || paymentLink.stripeCheckoutAttempt,
  })
}

export async function markPaymentLinkPaid(id: string, paymentIntentId: string) {
  const paymentLink = await getPaymentLinkById(id)
  if (!paymentLink || paymentLink.status === 'paid') return paymentLink

  return updatePaymentLink({
    ...paymentLink,
    status: 'paid',
    paidAt: new Date().toISOString(),
    stripePaymentIntentId: paymentIntentId,
  })
}
