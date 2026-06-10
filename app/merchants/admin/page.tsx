'use client'

import { FormEvent, useEffect, useState } from 'react'

type Merchant = { slug: string; name: string; email: string; stripeAccountId?: string }

export default function AdminMerchants() {
  const [merchants, setMerchants] = useState<Record<string, Merchant>>({})
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [stripeAccountId, setStripeAccountId] = useState('')
  const [loading, setLoading] = useState(false)

  async function fetchMerchants() {
    const res = await fetch('/api/merchants')
    if (res.ok) {
      const data = await res.json()
      setMerchants(data || {})
    }
  }

  useEffect(() => {
    fetchMerchants()
  }, [])

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name, email, stripeAccountId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setSlug('')
      setName('')
      setEmail('')
      setStripeAccountId('')
      await fetchMerchants()
      alert('Comercio creado')
    } catch (err: any) {
      alert('Error: ' + (err.message || ''))
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '2rem 1rem', maxWidth: 760, margin: '0 auto' }}>
      <h1>Administrar Comercios</h1>

      <form onSubmit={handleCreate} style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Stripe Account ID</label>
          <input
            value={stripeAccountId}
            onChange={(e) => setStripeAccountId(e.target.value)}
            placeholder="acct_..."
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 20px',
            background: '#635bff',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Guardando...' : 'Crear Comercio'}
        </button>
      </form>

      <section style={{ marginTop: 32 }}>
        <h2>Comercios existentes</h2>
        <div style={{ marginTop: 12 }}>
          {Object.keys(merchants).length === 0 && <p>No hay comercios.</p>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {Object.entries(merchants).map(([_, merchant]) => (
              <li key={merchant.slug} style={{ marginBottom: 12, padding: 12, background: '#f8f9ff', borderRadius: 10 }}>
                <strong>{merchant.name}</strong>
                <div>{merchant.email}</div>
                {merchant.stripeAccountId && <div style={{ color: '#555' }}>Stripe: {merchant.stripeAccountId}</div>}
                <div style={{ color: '#555' }}>slug: {merchant.slug}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
