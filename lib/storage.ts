import fs from 'fs'
import path from 'path'
import { kv } from '@vercel/kv'
import { Redis } from '@upstash/redis'

const STORAGE_KEY = 'cobrix:merchants'
let upstashClient: Redis | undefined

function getLocalDataPath() {
  return path.join(process.cwd(), 'data', 'merchants.json')
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

export function usesKv() {
  return Boolean(process.env.VERCEL_KV_URL && process.env.VERCEL_KV_TOKEN)
}

export function usesUpstash() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

function getUpstashClient() {
  if (!upstashClient) {
    if (!usesUpstash()) {
      throw new Error('Missing Upstash Redis environment variables')
    }

    upstashClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }

  return upstashClient
}

export async function readMerchantStorage(): Promise<Record<string, any>> {
  if (usesKv()) {
    const raw = await kv.get<string | null>(STORAGE_KEY)
    if (!raw) return {}
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }

  if (usesUpstash()) {
    const raw = await getUpstashClient().get(STORAGE_KEY)
    if (!raw) return {}
    try {
      return JSON.parse(raw as string)
    } catch {
      return {}
    }
  }

  ensureLocalDataFile()
  const dataPath = getLocalDataPath()
  const raw = fs.readFileSync(dataPath, 'utf-8')
  return JSON.parse(raw || '{}')
}

export async function writeMerchantStorage(data: Record<string, any>): Promise<void> {
  if (usesKv()) {
    await kv.set(STORAGE_KEY, JSON.stringify(data))
    return
  }

  if (usesUpstash()) {
    await getUpstashClient().set(STORAGE_KEY, JSON.stringify(data))
    return
  }

  ensureLocalDataFile()
  const dataPath = getLocalDataPath()
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8')
}
