import { NextResponse } from 'next/server'
import { usesUpstash } from '../../../lib/storage'

export async function GET() {
  const storage = usesUpstash() ? 'upstash' : 'local-file'
  return NextResponse.json({
    storage,
    usesUpstash: usesUpstash(),
  })
}
