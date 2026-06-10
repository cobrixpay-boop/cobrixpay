import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const dataPath = path.join(process.cwd(), 'data', 'merchants.json')

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase()
}

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase()
}

function normalizeMerchantRecord(merchant: any, key: string) {
  return {
    slug: normalizeSlug(merchant.slug || key),
    name: merchant.name,
    email: merchant.email,
    stripeAccountId: merchant.stripeAccountId,
  }
}

export async function GET() {
  try {
    if (!fs.existsSync(dataPath)) return NextResponse.json({})
    const raw = fs.readFileSync(dataPath, 'utf-8')
    const parsed = JSON.parse(raw)
    const normalized = Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => {
        const merchant = normalizeMerchantRecord(value, key)
        return [merchant.slug, merchant]
      })
    )
    return NextResponse.json(normalized)
  } catch (err) {
    return NextResponse.json({ error: 'No se pudo leer merchants' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { slug, name, email, stripeAccountId } = body
    const normalizedSlug = slug ? normalizeSlug(slug) : ''

    if (!normalizedSlug || !name || !email) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
    }

    let merchants: Record<string, any> = {}
    if (fs.existsSync(dataPath)) {
      merchants = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    }

    const prev = merchants[normalizedSlug] || {}
    merchants[normalizedSlug] = {
      slug: normalizedSlug,
      name,
      email,
      stripeAccountId: stripeAccountId?.toString().trim() || prev.stripeAccountId,
    }
    fs.writeFileSync(dataPath, JSON.stringify(merchants, null, 2), 'utf-8')

    return NextResponse.json({ ok: true, merchant: merchants[normalizedSlug] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
