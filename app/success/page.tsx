'use client'

import Link from 'next/link'
import { Suspense } from 'react'

function SuccessContent() {
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
      justifyContent: 'center'
    }}>
      <div style={{
        fontSize: '4rem',
        marginBottom: '1rem'
      }}>✅</div>
      
      <h1 style={{ color: '#1a1a1a', marginBottom: '1rem' }}>¡Pago Completado!</h1>
      
      <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '2rem', lineHeight: '1.5' }}>
        Muchas gracias por tu compra. Hemos recibido tu pago correctamente y el comercio ha sido notificado.
      </p>

      <div style={{
        background: '#f8f9fa',
        padding: '1.5rem',
        borderRadius: '12px',
        marginBottom: '2rem'
      }}>
        <p style={{ margin: 0, fontWeight: 'bold', color: '#635bff' }}>
          Recibirás un comprobante en tu email en unos instantes.
        </p>
      </div>

      <Link href="/" style={{
        textDecoration: 'none',
        color: 'white',
        background: '#635bff',
        padding: '12px 24px',
        borderRadius: '8px',
        fontWeight: 'bold',
        display: 'inline-block'
      }}>
        Volver al inicio
      </Link>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <SuccessContent />
    </Suspense>
  )
}