'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'

export default function PayPage() {
  const params = useParams()
  const slug = Array.isArray(params.slug) ? params.slug[0] : (params.slug as string || 'desconocido')

  const [amount, setAmount] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    const numAmount = Number(amount)

    if (!amount || numAmount <= 0) {
      alert('Ingresá un importe válido en USD (mayor a 0)')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numAmount, commerceName: slug }),
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Error al preparar el pago: ' + (data.error || 'Inténtalo de nuevo'))
        setLoading(false)
      }
    } catch (err: any) {
      console.error('Error en handlePay:', err)
      alert('Error de conexión. Reintentá en unos segundos.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      padding: '2rem 1rem',
      maxWidth: '420px',
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textAlign: 'center',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      <h1 style={{ color: '#635bff', marginBottom: '1.5rem' }}>Cobrix Pay</h1>

      <p style={{ fontSize: '1.3rem', marginBottom: '1.5rem', fontWeight: 600 }}>
        Comercio: {slug.replace(/-/g, ' ').toUpperCase()}
      </p>

      <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#444' }}>
          Monto en USD
        </label>
        <input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          step="0.01"
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '1.2rem',
            border: '2px solid #e0e0e0',
            borderRadius: '12px',
            boxSizing: 'border-box',
            outline: 'none'
          }}
        />
      </div>

      <button
        onClick={handlePay}
        disabled={loading}
        style={{
          width: '100%',
          padding: '16px',
          fontSize: '1.2rem',
          background: loading ? '#aaa' : '#635bff',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          transition: 'background 0.2s'
        }}
      >
        {loading ? 'Redirigiendo...' : 'Pagar con Stripe'}
      </button>

      <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#666' }}>
        🔒 Pago seguro procesado por Stripe
      </p>
    </div>
  )
}