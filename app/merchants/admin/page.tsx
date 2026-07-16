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
  onboarding?: {
    invitation?: {
      id: string
      createdAt: string
      expiresAt: string
      sentAt?: string
      resentAt?: string
      revokedAt?: string
      email: string
    }
    responsiblePerson?: Record<string, string | boolean>
    businessProfile?: Record<string, string | boolean>
    operations?: Record<string, string | boolean | string[]>
    banking?: Record<string, string>
    declarations?: {
      accepted: Record<string, { acceptedAt: string; version: string }>
      submittedBy?: string
      submittedIp?: string
      submittedUserAgent?: string
      invitationId?: string
    }
    progress?: {
      percent: number
      lastCompletedStep: number
      startedAt?: string
      lastSavedAt?: string
      submittedAt?: string
      documentationPending: boolean
    }
  }
  compliance?: {
    documentationPending?: boolean
    alerts?: Array<{ code: string; message: string; createdAt: string }>
    documents?: { pending: string[] }
  }
  auditHistory?: Array<{ type: string; createdAt: string; actor?: string; detail?: string }>
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
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteWhatsapp, setInviteWhatsapp] = useState('')
  const [inviteSlug, setInviteSlug] = useState('')
  const [inviteFee, setInviteFee] = useState('0')
  const [inviteSalesRep, setInviteSalesRep] = useState('')
  const [inviteSource, setInviteSource] = useState('')
  const [lastInvitationLinks, setLastInvitationLinks] = useState<Record<string, string>>({})
  const [selectedRegistrationSlug, setSelectedRegistrationSlug] = useState('')

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

  async function createInvitation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/merchant-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({
          action: 'create',
          name: inviteName,
          email: inviteEmail,
          whatsapp: inviteWhatsapp,
          slug: inviteSlug,
          applicationFeePercent: inviteFee,
          salesRepName: inviteSalesRep,
          source: inviteSource,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la invitacion')

      setMerchants((current) => ({ ...current, [data.merchant.slug]: data.merchant }))
      if (data.invitationLink) {
        setLastInvitationLinks((current) => ({ ...current, [data.merchant.slug]: data.invitationLink }))
        await navigator.clipboard.writeText(data.invitationLink).catch(() => undefined)
      }
      setInviteName('')
      setInviteEmail('')
      setInviteWhatsapp('')
      setInviteSlug('')
      setInviteFee('0')
      setInviteSalesRep('')
      setInviteSource('')
      setMessage(
        data.emailSent
          ? `Invitacion enviada y enlace copiado: ${data.merchant.slug}`
          : `Invitacion generada y enlace copiado: ${data.merchant.slug}. Email no enviado porque falta RESEND_API_KEY.`
      )
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'No se pudo crear la invitacion'
      setMessage('Error: ' + errorMessage)
    }

    setLoading(false)
  }

  async function updateInvitation(merchant: Merchant, action: 'resend' | 'revoke' | 'regenerate') {
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/merchant-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ action, slug: merchant.slug }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar la invitacion')

      setMerchants((current) => ({ ...current, [data.merchant.slug]: data.merchant }))
      if (data.invitationLink) {
        setLastInvitationLinks((current) => ({ ...current, [data.merchant.slug]: data.invitationLink }))
        await navigator.clipboard.writeText(data.invitationLink).catch(() => undefined)
      }
      setMessage(
        action === 'revoke'
          ? `Invitacion revocada: ${merchant.slug}`
          : data.emailSent
          ? `Invitacion enviada y enlace copiado: ${merchant.slug}`
          : `Enlace generado y copiado: ${merchant.slug}. Email no enviado porque falta RESEND_API_KEY.`
      )
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'No se pudo actualizar la invitacion'
      setMessage('Error: ' + errorMessage)
    }

    setLoading(false)
  }

  async function copyInvitationLink(merchant: Merchant) {
    const link = lastInvitationLinks[merchant.slug]
    if (!link) {
      setMessage('Genera un nuevo enlace para copiarlo. Por seguridad no guardamos el token completo.')
      return
    }

    await navigator.clipboard.writeText(link)
    setMessage(`Enlace copiado: ${merchant.slug}`)
  }

  function formatDate(value?: string) {
    if (!value) return 'Pendiente'
    return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  }

  function readText(record: Record<string, string | boolean | string[]> | undefined, key: string) {
    const value = record?.[key]
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'boolean') return value ? 'Si' : 'No'
    return value || ''
  }

  const visibleMerchants = getVisibleMerchants()
  const selectedRegistration = selectedRegistrationSlug ? merchants[selectedRegistrationSlug] : undefined

  return (
    <div style={{ padding: '2rem 1rem', maxWidth: 760, margin: '0 auto' }}>
      <h1>Administrar Comercios</h1>

      {storageStatus && (
        <div
          style={{
            marginTop: 16,
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
        <div style={{ marginTop: 12 }}>
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

      <section style={{ marginTop: 16, padding: 16, border: '1px solid #dfe4ee', borderRadius: 8, background: '#fff' }}>
        <h2 style={{ marginTop: 0 }}>Invitar comercio</h2>
        <form onSubmit={createInvitation}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <label>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Nombre comercial preliminar</span>
              <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} required style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }} />
            </label>
            <label>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email</span>
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" required style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }} />
            </label>
            <label>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Telefono o WhatsApp</span>
              <input value={inviteWhatsapp} onChange={(e) => setInviteWhatsapp(e.target.value)} required style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }} />
            </label>
            <label>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Slug</span>
              <input value={inviteSlug} onChange={(e) => setInviteSlug(normalizeSlug(e.target.value))} required style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }} />
            </label>
            <label>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Comision Cobrix (%)</span>
              <input value={inviteFee} onChange={(e) => setInviteFee(e.target.value)} type="number" min="0" max="100" step="0.01" required style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }} />
            </label>
            <label>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Vendedor responsable</span>
              <input value={inviteSalesRep} onChange={(e) => setInviteSalesRep(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }} />
            </label>
            <label>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Canal interno</span>
              <input value={inviteSource} onChange={(e) => setInviteSource(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc' }} />
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 12,
              padding: '12px 20px',
              background: '#1455d9',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
            }}
          >
            {loading ? 'Enviando...' : 'Invitar comercio'}
          </button>
        </form>
      </section>
      {message && <p style={{ marginTop: 12, color: message.startsWith('Error') ? '#b00020' : '#1b5e20' }}>{message}</p>}

      {editingSlug && (
      <form onSubmit={handleCreate} style={{ marginTop: 16, padding: 16, border: '1px solid #dfe4ee', borderRadius: 8, background: '#fff' }}>
        <h2 style={{ marginTop: 0 }}>Editar comercio</h2>
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
      </form>
      )}

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
                <div style={{ marginTop: 8, padding: 10, border: '1px solid #e2e5ee', borderRadius: 8, background: '#fff' }}>
                  <strong>Registro:</strong> {merchant.onboarding?.progress?.percent || 0}% completado
                  <div style={{ color: merchant.onboarding?.invitation?.revokedAt ? '#b00020' : '#555' }}>
                    Invitacion:{' '}
                    {merchant.onboarding?.invitation?.revokedAt
                      ? `Revocada (${formatDate(merchant.onboarding.invitation.revokedAt)})`
                      : merchant.onboarding?.invitation
                      ? 'Activa'
                      : 'Sin invitacion'}
                  </div>
                  <div style={{ color: '#555' }}>Invitacion enviada: {formatDate(merchant.onboarding?.invitation?.sentAt)}</div>
                  <div style={{ color: '#555' }}>Creada: {formatDate(merchant.onboarding?.invitation?.createdAt)}</div>
                  <div style={{ color: '#555' }}>Vence: {formatDate(merchant.onboarding?.invitation?.expiresAt)}</div>
                  <div style={{ color: '#555' }}>Registro iniciado: {formatDate(merchant.onboarding?.progress?.startedAt)}</div>
                  <div style={{ color: '#555' }}>Ultima actualizacion: {formatDate(merchant.onboarding?.progress?.lastSavedAt)}</div>
                  <div style={{ color: '#555' }}>Registro enviado: {formatDate(merchant.onboarding?.progress?.submittedAt)}</div>
                  <div style={{ color: merchant.compliance?.documentationPending ? '#7a4b00' : '#555' }}>
                    Documentacion: {merchant.compliance?.documentationPending ? 'Pendiente' : 'Sin pendientes registrados'}
                  </div>
                </div>
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
                      cursor:
                        loading || !merchant.onboarding?.invitation || Boolean(merchant.onboarding.invitation.revokedAt)
                          ? 'not-allowed'
                          : 'pointer',
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
                  <button
                    type="button"
                    onClick={() => copyInvitationLink(merchant)}
                    disabled={loading || !lastInvitationLinks[merchant.slug]}
                    title={
                      lastInvitationLinks[merchant.slug]
                        ? 'Copiar el ultimo enlace generado'
                        : 'Genera o regenera un enlace para copiarlo'
                    }
                    style={{
                      padding: '8px 12px',
                      background: '#fff',
                      border: '1px solid #cfd4e2',
                      borderRadius: 8,
                      cursor: loading || !lastInvitationLinks[merchant.slug] ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Copiar enlace
                  </button>
                  <button
                    type="button"
                    onClick={() => updateInvitation(merchant, 'resend')}
                    disabled={loading || !merchant.onboarding?.invitation || Boolean(merchant.onboarding.invitation.revokedAt)}
                    style={{
                      padding: '8px 12px',
                      background: '#fff',
                      border: '1px solid #cfd4e2',
                      borderRadius: 8,
                      cursor:
                        loading || !merchant.onboarding?.invitation || Boolean(merchant.onboarding.invitation.revokedAt)
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    Reenviar invitacion
                  </button>
                  <button
                    type="button"
                    onClick={() => updateInvitation(merchant, 'revoke')}
                    disabled={loading || !merchant.onboarding?.invitation || Boolean(merchant.onboarding.invitation.revokedAt)}
                    style={{
                      padding: '8px 12px',
                      background: '#fff',
                      border: '1px solid #f0b7c1',
                      borderRadius: 8,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Revocar invitacion
                  </button>
                  <button
                    type="button"
                    onClick={() => updateInvitation(merchant, 'regenerate')}
                    disabled={loading}
                    style={{
                      padding: '8px 12px',
                      background: '#fff',
                      border: '1px solid #94a3b8',
                      borderRadius: 8,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Regenerar enlace
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRegistrationSlug(selectedRegistrationSlug === merchant.slug ? '' : merchant.slug)}
                    style={{
                      padding: '8px 12px',
                      background: '#fff',
                      border: '1px solid #1455d9',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    Ver registro
                  </button>
                </div>
                {selectedRegistration?.slug === merchant.slug && (
                  <div style={{ marginTop: 12, padding: 12, border: '1px solid #dfe4ee', borderRadius: 8, background: '#fff' }}>
                    <h3 style={{ marginTop: 0 }}>Registro del comercio</h3>
                    <RegistrationBlock
                      title="Responsable"
                      rows={[
                        ['Nombre', `${readText(merchant.onboarding?.responsiblePerson, 'firstName')} ${readText(merchant.onboarding?.responsiblePerson, 'lastName')}`],
                        ['Documento', `${readText(merchant.onboarding?.responsiblePerson, 'documentType')} ${readText(merchant.onboarding?.responsiblePerson, 'documentNumber')}`],
                        ['CUIT/CUIL', readText(merchant.onboarding?.responsiblePerson, 'taxId')],
                        ['Email', readText(merchant.onboarding?.responsiblePerson, 'email')],
                        ['Relacion', readText(merchant.onboarding?.responsiblePerson, 'relationship')],
                      ]}
                    />
                    <RegistrationBlock
                      title="Comercio"
                      rows={[
                        ['Nombre comercial', readText(merchant.onboarding?.businessProfile, 'tradeName')],
                        ['Razon social', readText(merchant.onboarding?.businessProfile, 'legalName')],
                        ['CUIT', readText(merchant.onboarding?.businessProfile, 'businessTaxId')],
                        ['Rubro', readText(merchant.onboarding?.businessProfile, 'mainCategory')],
                        ['Como conocio Cobrix Pay', readText(merchant.onboarding?.businessProfile, 'knownBy')],
                      ]}
                    />
                    <RegistrationBlock
                      title="Operacion"
                      rows={[
                        ['Servicios', readText(merchant.onboarding?.operations, 'soldProducts')],
                        ['Ticket promedio', readText(merchant.onboarding?.operations, 'averageTicketUsd')],
                        ['Ticket maximo', readText(merchant.onboarding?.operations, 'maxTicketUsd')],
                        ['Volumen mensual', readText(merchant.onboarding?.operations, 'monthlyVolumeUsd')],
                        ['Canales', readText(merchant.onboarding?.operations, 'salesChannels')],
                      ]}
                    />
                    <RegistrationBlock
                      title="Banco"
                      rows={[
                        ['Banco', readText(merchant.onboarding?.banking, 'bank')],
                        ['Tipo de cuenta', readText(merchant.onboarding?.banking, 'accountType')],
                        ['Moneda', readText(merchant.onboarding?.banking, 'currency')],
                        ['Titular', readText(merchant.onboarding?.banking, 'holderName')],
                        ['CUIT titular', readText(merchant.onboarding?.banking, 'holderTaxId')],
                      ]}
                    />
                    <RegistrationBlock
                      title="Declaraciones"
                      rows={[
                        ['Enviado por', merchant.onboarding?.declarations?.submittedBy || 'Pendiente'],
                        ['Fecha de envio', formatDate(merchant.onboarding?.progress?.submittedAt)],
                        ['Version', Object.values(merchant.onboarding?.declarations?.accepted || {})[0]?.version || 'Pendiente'],
                        ['User agent', merchant.onboarding?.declarations?.submittedUserAgent || 'Pendiente'],
                      ]}
                    />
                    {(merchant.compliance?.alerts || []).length > 0 && (
                      <div>
                        <h4>Alertas internas</h4>
                        <ul>{merchant.compliance?.alerts?.map((alert) => <li key={alert.code}>{alert.message}</li>)}</ul>
                      </div>
                    )}
                    <div>
                      <h4>Documentacion pendiente</h4>
                      <ul>{(merchant.compliance?.documents?.pending || ['Pendiente de definir']).map((item) => <li key={item}>{item}</li>)}</ul>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

function RegistrationBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section style={{ marginTop: 12 }}>
      <h4 style={{ margin: '0 0 6px' }}>{title}</h4>
      <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) 1fr', gap: '6px 12px', margin: 0 }}>
        {rows.map(([label, value]) => (
          <FragmentRow key={`${title}-${label}`} label={label} value={value || 'Pendiente'} />
        ))}
      </dl>
    </section>
  )
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={{ color: '#5b6275', fontWeight: 700 }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </>
  )
}
