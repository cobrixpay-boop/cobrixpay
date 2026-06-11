import { NextResponse } from 'next/server'
import { usesKv, usesUpstash } from '../../../lib/storage'

export async function GET() {
  const storage = usesKv() ? 'vercel-kv' : usesUpstash() ? 'upstash' : 'local-file'
  return NextResponse.json({
    storage,
    usesKv: usesKv(),
    usesUpstash: usesUpstash(),
  })
}
