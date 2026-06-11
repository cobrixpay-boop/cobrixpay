'use client'

import { FormEvent, useEffect, useState } from 'react'

type Merchant = {
  slug: string
  name: string
  email: string
  notificationEmails?: string[]
  stripeAccountId?: string
}

type StorageStatus = {
  storage: 'upstash' | 'local-file'
  usesUpstash?: boolean
  adminAuthRequired?: boolean
}

export default function AdminMerchants() {
  const [merchants, setMerchants] = useState<Record<string, Merchant>>({})
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null)
  const [adminToken, setAdminToken] = useState('')
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notificationEmails, setNotificationEmails] = useState('')
  const [stripeAccountId, setStripeAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  function getAdminHeaders(): Record<string, string> {
    return adminToken ? { 'x-admin-token': adminToken } : {}
  }

  async function fetchMerchants(token = adminToken) {
    const headers: Record<string, string> = token ? { 'x-admin-token': token } : {}
    const res = await fetch('/api/merchants', { headers })

    if (res.ok) {
      const data = await res.json()
      setMerchants(data || {})
      return
    }

    if (res.status === 401) {
      setMerchants({})
      setMessage('Ingresa el token de administrador para ver y crear comercios.')
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
    const storedToken = window.localStorage.getItem('cobrix-admin-token') || ''
    setAdminToken(storedToken)
    fetchStorageStatus()
    fetchMerchants(storedToken)
  }, [])

  function handleTokenChange(value: string) {
    setAdminToken(value)
    window.localStorage.setItem('cobrix-admin-token', value)
  }

  function normalizeSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ slug, name, email, notificationEmails, stripeAccountId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')

      setSlug('')
      setName('')
      setEmail('')
      setNotificationEmails('')
      setStripeAccountId('')
      await fetchMerchants()
      setMessage(`Comercio creado: /pay/${data.merchant.slug}`)
    } catch (err: any) {
      setMessage('Error: ' + (err.message || 'No se pudo crear el comercio'))
    }

    setLoading(false)
  }

  return (
    <div style={{ padding: '2rem 1rem', maxWidth: 760, margin: '0 auto' }}>
      <h1>Administrar Comercios</h1>

      <form onSubmit={handleCreate} style={{ marginTop: 16 }}>
        {storageStatus && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: storageStatus.usesUpstash ? '#e8f5e9' : '#fff3e0',
              border: storageStatus.usesUpstash ? '1px solid #4caf50' : '1px solid #ff9800',
            }}
          >
            <strong>Modo de persistencia:</strong>{' '}
            {storageStatus.storage === 'upstash' ? 'Upstash Redis' : 'Archivo local'}
            <div style={{ marginTop: 4, color: '#333', fontSize: '0.9em' }}>
              {storageStatus.usesUpstash && 'Los comercios se guardaran en Upstash Redis. Funciona en produccion.'}
              {!storageStatus.usesUpstash && (
                <>
                  Los comercios se guardan localmente en <code>data/merchants.json</code>.
                  <br />
                  <strong>Para produccion:</strong> configura Upstash Redis en Vercel.
                </>
              )}
            </div>
          </div>
        )}

        {storageStatus?.adminAuthRequired && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Token de administrador</label>
            <input
              value={adminToken}
              onChange={(e) => handleTokenChange(e.target.value)}
              type="password"
              placeholder="ADMIN_TOKEN"
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
            />
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(normalizeSlug(e.target.value))}
            placeholder="mi-comercio"
            required
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del comercio"
            required
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="contacto@comercio.com"
            required
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Emails de notificacion</label>
          <input
            value={notificationEmails}
            onChange={(e) => setNotificationEmails(e.target.value)}
            placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
          />
          <small style={{ color: '#666' }}>Separa multiples correos con comas. Si lo dejas vacio se usa el email principal.</small>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Stripe Account ID</label>
          <input
            value={stripeAccountId}
            onChange={(e) => setStripeAccountId(e.target.value.trim())}
            placeholder="acct_..."
            required
            pattern="acct_.+"
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
        {message && <p style={{ marginTop: 12, color: message.startsWith('Error') ? '#b00020' : '#1b5e20' }}>{message}</p>}
      </form>

      <section style={{ marginTop: 32 }}>
        <h2>Comercios existentes</h2>
        <div style={{ marginTop: 12 }}>
          {Object.keys(merchants).length === 0 && <p>No hay comercios.</p>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {Object.values(merchants).map((merchant) => (
              <li key={merchant.slug} style={{ marginBottom: 12, padding: 12, background: '#f8f9ff', borderRadius: 10 }}>
                <strong>{merchant.name}</strong>
                <div>{merchant.email}</div>
                {merchant.notificationEmails && merchant.notificationEmails.length > 0 && (
                  <div style={{ color: '#555' }}>Notificaciones: {merchant.notificationEmails.join(', ')}</div>
                )}
                {merchant.stripeAccountId && <div style={{ color: '#555' }}>Stripe: {merchant.stripeAccountId}</div>}
                <div style={{ color: '#555' }}>slug: {merchant.slug}</div>
                <div style={{ color: '#555' }}>link: /pay/{merchant.slug}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
