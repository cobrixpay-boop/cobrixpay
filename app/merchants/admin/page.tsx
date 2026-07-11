'use client'

import { FormEvent, useEffect, useState } from 'react'

type MerchantStatus = 'pending_documents' | 'under_review' | 'active' | 'suspended' | 'rejected'

type Merchant = {
  slug: string
  name: string
  email: string
  notificationEmails?: string[]
  stripeAccountId?: string
  postPaymentUrl?: string
  whatsapp?: string
  status: MerchantStatus
  archived: boolean
  archivedReason?: 'admin' | 'compliance'
  everActive?: boolean
  applicationFeePercent?: number
}

type StorageStatus = {
  storage: 'upstash' | 'local-file'
  usesUpstash?: boolean
  adminAuthRequired?: boolean
}

const MERCHANT_STATUS_OPTIONS: Array<{ value: MerchantStatus; label: string }> = [
  { value: 'pending_documents', label: 'Documentacion pendiente' },
  { value: 'under_review', label: 'En revision' },
  { value: 'active', label: 'Activo' },
  { value: 'suspended', label: 'Suspendido' },
  { value: 'rejected', label: 'Rechazado' },
]

type MerchantFilter = 'all' | 'active' | 'pending_documents' | 'under_review' | 'suspended' | 'rejected' | 'archived'

const MERCHANT_FILTER_OPTIONS: Array<{ value: MerchantFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'pending_documents', label: 'Pendientes' },
  { value: 'under_review', label: 'En revision' },
  { value: 'suspended', label: 'Suspendidos' },
  { value: 'rejected', label: 'Rechazados' },
  { value: 'archived', label: 'Archivados' },
]

export default function AdminMerchants() {
  const [merchants, setMerchants] = useState<Record<string, Merchant>>({})
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null)
  const [adminToken, setAdminToken] = useState(() =>
    typeof window === 'undefined' ? '' : window.localStorage.getItem('cobrix-admin-token') || ''
  )
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notificationEmails, setNotificationEmails] = useState('')
  const [stripeAccountId, setStripeAccountId] = useState('')
  const [status, setStatus] = useState<MerchantStatus>('pending_documents')
  const [postPaymentUrl, setPostPaymentUrl] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [applicationFeePercent, setApplicationFeePercent] = useState('0')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [baseUrl] = useState(() => (typeof window === 'undefined' ? '' : window.location.origin))
  const [editingSlug, setEditingSlug] = useState('')
  const [filter, setFilter] = useState<MerchantFilter>('all')

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
      return
    }

    setMessage('No se pudieron cargar los comercios.')
  }

  async function fetchStorageStatus() {
    const res = await fetch('/api/storage-status')
    if (res.ok) {
      const data = await res.json()
      setStorageStatus(data)
    }
  }

  useEffect(() => {
    const token = adminToken
    window.setTimeout(() => {
      fetchStorageStatus()
      fetchMerchants(token)
    }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleTokenChange(value: string) {
    setAdminToken(value)
    window.localStorage.setItem('cobrix-admin-token', value)
    fetchMerchants(value)
  }

  function normalizeSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
  }

  function fillForm(merchant: Merchant) {
    setEditingSlug(merchant.slug)
    setSlug(merchant.slug)
    setName(merchant.name)
    setEmail(merchant.email)
    setNotificationEmails(merchant.notificationEmails?.join(', ') || '')
    setStripeAccountId(merchant.stripeAccountId || '')
    setStatus(merchant.status)
    setPostPaymentUrl(merchant.postPaymentUrl || '')
    setWhatsapp(merchant.whatsapp || '')
    setApplicationFeePercent(String(merchant.applicationFeePercent || 0))
    setMessage(`Editando comercio: ${merchant.slug}`)
  }

  function resetForm() {
    setEditingSlug('')
    setSlug('')
    setName('')
    setEmail('')
    setNotificationEmails('')
    setStripeAccountId('')
    setStatus('pending_documents')
    setPostPaymentUrl('')
    setWhatsapp('')
    setApplicationFeePercent('0')
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (status === 'active' && !hasValidStripeAccountId(stripeAccountId)) {
      setLoading(false)
      setMessage('No se puede activar: falta un Stripe Account ID valido.')
      return
    }

    try {
      const res = await fetch('/api/merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({
          slug,
          name,
          email,
          notificationEmails,
          stripeAccountId,
          status,
          postPaymentUrl,
          whatsapp,
          applicationFeePercent,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')

      resetForm()
      setMerchants((current) => ({ ...current, [data.merchant.slug]: data.merchant }))
      await fetchMerchants()
      setMessage(`${editingSlug ? 'Comercio actualizado' : 'Comercio creado'}: /pay/${data.merchant.slug}`)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'No se pudo crear el comercio'
      setMessage('Error: ' + errorMessage)
    }

    setLoading(false)
  }

  function getStatusLabel(value: MerchantStatus) {
    return MERCHANT_STATUS_OPTIONS.find((option) => option.value === value)?.label || value
  }

  function hasValidStripeAccountId(value?: string) {
    return Boolean(value?.trim().startsWith('acct_'))
  }

  function getStatusStyle(value: MerchantStatus): React.CSSProperties {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 8px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
    }

    if (value === 'active') return { ...base, background: '#e8f5e9', color: '#1b5e20' }
    if (value === 'under_review') return { ...base, background: '#e3f2fd', color: '#0d47a1' }
    if (value === 'suspended') return { ...base, background: '#fff3e0', color: '#7a4b00' }
    if (value === 'rejected') return { ...base, background: '#ffebee', color: '#b00020' }
    return { ...base, background: '#f1f5f9', color: '#475569' }
  }

  function getVisibleMerchants() {
    return Object.values(merchants).filter((merchant) => {
      if (filter === 'archived') return merchant.archived
      if (merchant.archived) return false
      if (filter === 'all') return true
      return merchant.status === filter
    })
  }

  function canShowDeleteButton(merchant: Merchant) {
    return (
      !merchant.everActive &&
      merchant.status !== 'active' &&
      !hasValidStripeAccountId(merchant.stripeAccountId) &&
      merchant.archivedReason !== 'compliance'
    )
  }

  async function updateMerchantStatus(merchant: Merchant, nextStatus: MerchantStatus) {
    if (merchant.archived && nextStatus === 'active') {
      setMessage('No se puede activar: el comercio esta archivado. Restauralo primero.')
      return
    }

    if (nextStatus === 'active' && !hasValidStripeAccountId(merchant.stripeAccountId)) {
      setMessage('No se puede activar: falta un Stripe Account ID valido.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({
          ...merchant,
          status: nextStatus,
          archived: merchant.archived,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')

      setMerchants((current) => ({ ...current, [data.merchant.slug]: data.merchant }))
      setMessage(`Estado actualizado: ${merchant.slug} -> ${getStatusLabel(nextStatus)}`)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'No se pudo actualizar el estado'
      setMessage('Error: ' + errorMessage)
    }

    setLoading(false)
  }

  async function updateMerchantArchived(merchant: Merchant, archived: boolean) {
    if (archived) {
      const confirmed = window.confirm('Deseas archivar este comercio?\n\nPodra restaurarse posteriormente.')
      if (!confirmed) return
    }

    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({
          ...merchant,
          archived,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')

      setMerchants((current) => ({ ...current, [data.merchant.slug]: data.merchant }))
      setMessage(`${archived ? 'Comercio archivado' : 'Comercio restaurado'}: ${merchant.slug}`)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'No se pudo actualizar el archivo'
      setMessage('Error: ' + errorMessage)
    }

    setLoading(false)
  }

  async function deleteMerchantPermanently(merchant: Merchant) {
    const confirmationSlug = window.prompt(`Para confirmar escribi:\n\n${merchant.slug}`)
    if (confirmationSlug === null) return

    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/merchants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({
          slug: merchant.slug,
          confirmationSlug,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar el comercio')

      setMerchants((current) => {
        const next = { ...current }
        delete next[merchant.slug]
        return next
      })
      setMessage(`Comercio eliminado definitivamente: ${merchant.slug}`)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'No se pudo eliminar el comercio'
      setMessage('Error: ' + errorMessage)
    }

    setLoading(false)
  }

  const visibleMerchants = getVisibleMerchants()

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
            disabled={Boolean(editingSlug)}
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
            pattern="acct_.+"
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
          />
          <small style={{ color: '#666' }}>Opcional. Es obligatorio solo para activar el comercio.</small>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MerchantStatus)}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc', background: '#fff' }}
          >
            {MERCHANT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small style={{ color: '#666' }}>
            Un comercio solo puede cobrar cuando esta activo y tiene Stripe conectado.
          </small>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>URL despues del pago</label>
          <input
            value={postPaymentUrl}
            onChange={(e) => setPostPaymentUrl(e.target.value)}
            type="url"
            pattern="https?://.+"
            placeholder="https://www.comercio.com"
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
          />
          <small style={{ color: '#666' }}>Opcional. Debe empezar con http:// o https://.</small>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>WhatsApp del comercio</label>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            type="text"
            placeholder="+54 9 11 1234-5678"
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Comision Cobrix (%)</label>
          <input
            value={applicationFeePercent}
            onChange={(e) => setApplicationFeePercent(e.target.value)}
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="0"
            required
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
          />
          <small style={{ color: '#666' }}>Se aplica como application_fee_amount en cada pago.</small>
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
          {loading ? 'Guardando...' : editingSlug ? 'Guardar cambios' : 'Crear Comercio'}
        </button>
        {editingSlug && (
          <button
            type="button"
            onClick={resetForm}
            style={{
              marginLeft: 8,
              padding: '12px 20px',
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Cancelar edicion
          </button>
        )}
        {message && <p style={{ marginTop: 12, color: message.startsWith('Error') ? '#b00020' : '#1b5e20' }}>{message}</p>}
      </form>

      <section style={{ marginTop: 32 }}>
        <h2>Comercios existentes</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {MERCHANT_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              style={{
                padding: '8px 12px',
                background: filter === option.value ? '#171717' : '#fff',
                color: filter === option.value ? '#fff' : '#171717',
                border: '1px solid #ccc',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => fetchMerchants()}
          style={{
            marginTop: 4,
            padding: '8px 12px',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Actualizar lista
        </button>
        <div style={{ marginTop: 12 }}>
          {visibleMerchants.length === 0 && <p>No hay comercios para este filtro.</p>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {visibleMerchants.map((merchant) => (
              <li key={merchant.slug} style={{ marginBottom: 12, padding: 12, background: '#f8f9ff', borderRadius: 10 }}>
                <strong>{merchant.name}</strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <span style={getStatusStyle(merchant.status)}>{getStatusLabel(merchant.status)}</span>
                  {merchant.archived && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 8px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 800,
                        background: '#eceff3',
                        color: '#334155',
                      }}
                    >
                      Archivado
                    </span>
                  )}
                  <span
                    style={{
                      ...getStatusStyle(hasValidStripeAccountId(merchant.stripeAccountId) ? 'active' : 'pending_documents'),
                      background: hasValidStripeAccountId(merchant.stripeAccountId) ? '#e8f5e9' : '#fff3e0',
                      color: hasValidStripeAccountId(merchant.stripeAccountId) ? '#1b5e20' : '#7a4b00',
                    }}
                  >
                    {hasValidStripeAccountId(merchant.stripeAccountId) ? 'Stripe conectado' : 'Stripe pendiente'}
                  </span>
                </div>
                <div>{merchant.email}</div>
                {merchant.notificationEmails && merchant.notificationEmails.length > 0 && (
                  <div style={{ color: '#555' }}>Notificaciones: {merchant.notificationEmails.join(', ')}</div>
                )}
                {merchant.stripeAccountId && <div style={{ color: '#555' }}>Stripe: {merchant.stripeAccountId}</div>}
                {merchant.postPaymentUrl && <div style={{ color: '#555' }}>URL post-pago: {merchant.postPaymentUrl}</div>}
                {merchant.whatsapp && <div style={{ color: '#555' }}>WhatsApp: {merchant.whatsapp}</div>}
                <div style={{ color: '#555' }}>Comision Cobrix: {merchant.applicationFeePercent || 0}%</div>
                <div style={{ color: '#555' }}>slug: {merchant.slug}</div>
                <div style={{ color: '#555' }}>link: {baseUrl}/pay/{merchant.slug}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => fillForm(merchant)}
                    style={{
                      padding: '8px 12px',
                      background: '#fff',
                      border: '1px solid #ccc',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMerchantStatus(merchant, 'active')}
                    disabled={loading || merchant.archived || !hasValidStripeAccountId(merchant.stripeAccountId)}
                    title={
                      merchant.archived
                        ? 'No se puede activar un comercio archivado'
                        : hasValidStripeAccountId(merchant.stripeAccountId)
                        ? 'Activar comercio'
                        : 'No se puede activar sin Stripe Account ID valido'
                    }
                    style={{
                      padding: '8px 12px',
                      background:
                        !merchant.archived && hasValidStripeAccountId(merchant.stripeAccountId) ? '#1b5e20' : '#e5e7eb',
                      color: !merchant.archived && hasValidStripeAccountId(merchant.stripeAccountId) ? '#fff' : '#6b7280',
                      border: '1px solid #ccc',
                      borderRadius: 8,
                      cursor: !merchant.archived && hasValidStripeAccountId(merchant.stripeAccountId) ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Activar
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMerchantStatus(merchant, 'suspended')}
                    disabled={loading}
                    style={{
                      padding: '8px 12px',
                      background: '#fff',
                      border: '1px solid #f3d08a',
                      borderRadius: 8,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Suspender
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMerchantStatus(merchant, 'rejected')}
                    disabled={loading}
                    style={{
                      padding: '8px 12px',
                      background: '#fff',
                      border: '1px solid #f0b7c1',
                      borderRadius: 8,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Rechazar
                  </button>
                  {!merchant.archived && (
                    <button
                      type="button"
                      onClick={() => updateMerchantArchived(merchant, true)}
                      disabled={loading}
                      style={{
                        padding: '8px 12px',
                        background: '#fff',
                        border: '1px solid #94a3b8',
                        borderRadius: 8,
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Archivar
                    </button>
                  )}
                  {merchant.archived && (
                    <button
                      type="button"
                      onClick={() => updateMerchantArchived(merchant, false)}
                      disabled={loading}
                      style={{
                        padding: '8px 12px',
                        background: '#fff',
                        border: '1px solid #4caf50',
                        borderRadius: 8,
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Restaurar
                    </button>
                  )}
                  {canShowDeleteButton(merchant) && (
                    <button
                      type="button"
                      onClick={() => deleteMerchantPermanently(merchant)}
                      disabled={loading}
                      style={{
                        padding: '8px 12px',
                        background: '#fff5f7',
                        color: '#b00020',
                        border: '1px solid #f0b7c1',
                        borderRadius: 8,
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Eliminar definitivamente
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
