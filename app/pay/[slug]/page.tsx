'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'

export default function PayPage() {
  const params = useParams()
  const slug = params?.slug || 'comercio'
  const [amount, setAmount] = useState('')

  const handlePay = async () => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), commerceName: slug }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      alert('Error de red')
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Pago a {String(slug)}</h1>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button onClick={handlePay}>Pagar con Stripe</button>
    </div>
  )
}