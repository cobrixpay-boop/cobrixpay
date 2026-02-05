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
      alert('Ingresá un importe válido')
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
        alert('Error: ' + (data.error || 'Inténtalo de nuevo'))
        setLoading(false)
      }
    } catch (err) {
      alert('Error de conexión. Verifica tu internet.')
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
      <h1>Cobrix Pay</h1>
      <p>Comercio: {slug.toUpperCase()}</p>
      <input 
        type="number" 
        value={amount} 
        onChange={(e) => setAmount(e.target.value)} 
        style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
      />
      <button 
        onClick={handlePay} 
        disabled={loading}
        style={{ width: '100%', padding: '10px', background: '#635bff', color: 'white', border: 'none' }}
      >
        {loading ? 'Redirigiendo...' : 'Pagar con Stripe'}
      </button>
    </div>
  )
}