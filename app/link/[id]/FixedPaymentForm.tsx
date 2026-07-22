'use client'

import { useState } from 'react'

type FixedPaymentFormProps = {
  paymentLinkId: string
}

export function FixedPaymentForm({ paymentLinkId }: FixedPaymentFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePay() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentLinkId }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo preparar el pago.')
      }

      if (data.url) {
        window.location.href = data.url
        return
      }

      throw new Error('No se pudo preparar el pago.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo preparar el pago.')
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      )}
      <button type="button" onClick={handlePay} disabled={loading} style={loading ? disabledButtonStyle : buttonStyle}>
        {loading ? 'Redirigiendo...' : 'Pagar con Stripe'}
      </button>
    </>
  )
}

const buttonStyle = {
  width: '100%',
  minHeight: 48,
  padding: '12px 16px',
  border: 'none',
  borderRadius: 8,
  background: '#635bff',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 18,
  fontWeight: 800,
} satisfies React.CSSProperties

const disabledButtonStyle = {
  ...buttonStyle,
  background: '#9ca3af',
  cursor: 'not-allowed',
} satisfies React.CSSProperties

const errorStyle = {
  margin: '0 0 14px',
  padding: 12,
  border: '1px solid #f0b7c1',
  borderRadius: 8,
  background: '#fff5f7',
  color: '#b00020',
  fontWeight: 700,
} satisfies React.CSSProperties
