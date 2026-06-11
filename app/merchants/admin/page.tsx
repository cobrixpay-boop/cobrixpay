'use client'

import { FormEvent, useEffect, useState } from 'react'

type Merchant = { slug: string; name: string; email: string; notificationEmails?: string[]; stripeAccountId?: string }

type StorageStatus = {
  storage: 'vercel-kv' | 'upstash' | 'local-file'
  usesKv: boolean
  usesUpstash?: boolean
}

export default function AdminMerchants() {
  const [merchants, setMerchants] = useState<Record<string, Merchant>>({})
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null)
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notificationEmails, setNotificationEmails] = useState('')
  const [stripeAccountId, setStripeAccountId] = useState('')
  const [loading, setLoading] = useState(false)

  async function fetchMerchants() {
    const res = await fetch('/api/merchants')
    if (res.ok) {
      const data = await res.json()
      setMerchants(data || {})
    }
  }

  async function fetchStorageStatus() {
    const res = await fetch('/api/storage-status')
    if (res.ok) {
      const data = await res.json()
      setStorageStatus(data)
    }
  }

  useEffect(() => {
    fetchMerchants()
    fetchStorageStatus()
  }, [])

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name, email, notificationEmails, stripeAccountId }),
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
        {storageStatus && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: storageStatus.usesKv || storageStatus.usesUpstash ? '#e8f5e9' : '#fff3e0', border: storageStatus.usesKv || storageStatus.usesUpstash ? '1px solid #4caf50' : '1px solid #ff9800' }}>
            <strong>Modo de persistencia:</strong> {storageStatus.storage === 'vercel-kv' ? 'Vercel KV' : storageStatus.storage === 'upstash' ? 'Upstash Redis' : 'Archivo local'}
            <div style={{ marginTop: 4, color: '#333', fontSize: '0.9em' }}>
              {storageStatus.usesKv && 'Los comercios se guardarán en Vercel KV. Funciona en producción.'}
              {storageStatus.usesUpstash && 'Los comercios se guardarán en Upstash Redis. Funciona en producción.'}
              {!storageStatus.usesKv && !storageStatus.usesUpstash && (
                <>
                  Los comercios se guardan localmente en <code>data/merchants.json</code>.
                  <br />
                  <strong>Para producción:</strong> cargá comercios aquí en local, commitea y pusea a Vercel. En producción serán de lectura.
                </>
              )}
            </div>
          </div>
        )}

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
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Emails de notificación</label>
          <input
            value={notificationEmails}
            onChange={(e) => setNotificationEmails(e.target.value)}
            placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
          />
          <small style={{ color: '#666' }}>Separá múltiples correos con comas.</small>
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
                {merchant.notificationEmails && merchant.notificationEmails.length > 0 && (
                  <div style={{ color: '#555' }}>
                    Notificaciones: {merchant.notificationEmails.join(', ')}
                  </div>
                )}
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
