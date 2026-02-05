'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'

export default function PayPage() {
  const params = useParams()
  const slug = typeof params?.slug === 'string' ? params.slug : 'comercio'
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    if (!amount || Number(amount) <= 0) return alert('Monto inválido')
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), commerceName: slug }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Error en el servidor')
        setLoading(false)
      }
    } catch (err) {
      alert('Error de red')
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <h1>Pagar a {slug.toUpperCase()}</h1>
      <input 
        type="number" 
        value={amount} 
        onChange={(e) => setAmount(e.target.value)} 
        placeholder="Monto USD"
        style={{ padding: '10px', display: 'block', margin: '10px auto' }}
      />
      <button 
        onClick={handlePay} 
        disabled={loading}
        style={{ padding: '10px 20px', background: 'blue', color: 'white' }}
      >
        {loading ? 'Cargando...' : 'Pagar'}
      </button>
    </div>
  )
}