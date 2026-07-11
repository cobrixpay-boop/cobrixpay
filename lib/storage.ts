import fs from 'fs'
import path from 'path'
import { Redis } from '@upstash/redis'

const STORAGE_KEY = 'cobrix:merchants'
let upstashClient: Redis | undefined

function parseStoredMerchants(raw: unknown): Record<string, unknown> {
  if (!raw) return {}

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }

  return {}
}

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

export async function readMerchantStorage(): Promise<Record<string, unknown>> {
  if (usesUpstash()) {
    const raw = await getUpstashClient().get(STORAGE_KEY)
    return parseStoredMerchants(raw)
  }

  ensureLocalDataFile()
  const dataPath = getLocalDataPath()
  const raw = fs.readFileSync(dataPath, 'utf-8')
  return JSON.parse(raw || '{}')
}

export async function writeMerchantStorage(data: Record<string, unknown>): Promise<void> {
  if (usesUpstash()) {
    await getUpstashClient().set(STORAGE_KEY, JSON.stringify(data))
    return
  }

  ensureLocalDataFile()
  const dataPath = getLocalDataPath()
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8')
}
