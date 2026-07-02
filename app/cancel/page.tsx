'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function getSafeMerchantSlug(value: string | null) {
  if (!value) return ''
  return value.replace(/[^a-z0-9-_]/gi, '').toLowerCase()
}

function CancelContent() {
  const searchParams = useSearchParams()
  const merchantSlug = getSafeMerchantSlug(searchParams.get('merchant'))
  const retryHref = merchantSlug ? `/pay/${merchantSlug}` : '/landing'
  const retryLabel = merchantSlug ? 'Volver a intentar' : 'Volver al inicio'

  return (
    <div style={{
      padding: '3rem 1rem',
      maxWidth: '500px',
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textAlign: 'center',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <h1 style={{ color: '#1a1a1a', marginBottom: '1rem' }}>Pago cancelado</h1>

      <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '2rem', lineHeight: '1.5' }}>
        No se realizó ningún cargo.
      </p>

      <Link href={retryHref} style={{
        textDecoration: 'none',
        color: 'white',
        background: '#635bff',
        padding: '12px 24px',
        borderRadius: '8px',
        fontWeight: 'bold',
        display: 'inline-block',
      }}>
        {retryLabel}
      </Link>
    </div>
  )
}

export default function CancelPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <CancelContent />
    </Suspense>
  )
}
