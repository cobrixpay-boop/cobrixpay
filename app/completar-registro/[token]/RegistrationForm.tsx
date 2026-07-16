'use client'

import { useEffect, useMemo, useState } from 'react'

type SectionData = Record<string, string | boolean | string[]>

type PublicMerchant = {
  slug: string
  name: string
  email: string
  whatsapp?: string
  status: string
  onboarding?: {
    responsiblePerson?: SectionData
    businessProfile?: SectionData
    operations?: SectionData
    banking?: SectionData
    progress?: {
      percent: number
      lastCompletedStep: number
      startedAt?: string
      lastSavedAt?: string
      submittedAt?: string
      documentationPending: boolean
    }
    invitation?: {
      id: string
      expiresAt: string
      sentAt?: string
    }
    declarations?: {
      accepted: Record<string, { acceptedAt: string; version: string }>
    }
  }
  compliance?: {
    documentationPending?: boolean
    alerts?: Array<{ code: string; message: string; createdAt: string }>
    documents?: { pending: string[] }
  }
}

type ApiResponse = {
  merchant?: PublicMerchant
  error?: string
  errors?: string[]
  message?: string
}

const STEPS = [
  'Responsable',
  'Comercio',
  'Operacion',
  'Datos bancarios',
  'Documentacion pendiente',
  'Confirmacion',
]

const RELATIONSHIPS = ['Titular', 'Socio', 'Representante legal', 'Apoderado', 'Empleado autorizado', 'Otro']
const TAXPAYER_TYPES = ['Monotributista', 'Responsable Inscripto', 'Sociedad']
const CATEGORIES = [
  'Hotel y alojamiento',
  'Restaurante',
  'Agencia de viajes',
  'Excursiones y actividades',
  'Transporte turistico',
  'Alquiler de vehiculos',
  'Comercio minorista',
  'Artesanias',
  'Servicios profesionales',
  'Otro',
]
const KNOWN_BY = ['Visita comercial', 'Recomendacion', 'Google', 'Instagram', 'Facebook', 'LinkedIn', 'Casa de cambio', 'Camara o asociacion', 'Partner', 'Otro']
const SALES_CHANNELS = ['Local fisico', 'Sitio web', 'WhatsApp', 'Instagram', 'Marketplace turistico', 'Agencia de viajes', 'Venta telefonica', 'Otro']
const ACCOUNT_TYPES = ['Cuenta corriente', 'Caja de ahorro', 'Cuenta de pago', 'Otra']
const CURRENCIES = ['ARS', 'USD', 'Otra']
const DECLARATIONS = [
  ['truthfulness', 'Declaro que la informacion proporcionada es verdadera.'],
  ['verificationAuthorization', 'Autorizo a Cobrix Pay a verificar la informacion.'],
  ['terms', 'Acepto los terminos y condiciones.'],
  ['privacy', 'Acepto la politica de privacidad.'],
  ['chargebacks', 'Acepto la politica de contracargos y reembolsos.'],
  ['changesCommitment', 'Me comprometo a informar cambios relevantes.'],
  ['representationAuthority', 'Confirmo que tengo facultades para representar al comercio.'],
]

function emptySections() {
  return {
    responsiblePerson: {} as SectionData,
    businessProfile: {} as SectionData,
    operations: {} as SectionData,
    banking: {} as SectionData,
    declarations: {} as SectionData,
  }
}

function getSectionName(step: number) {
  if (step === 1) return 'responsiblePerson'
  if (step === 2) return 'businessProfile'
  if (step === 3) return 'operations'
  if (step === 4) return 'banking'
  if (step === 5) return 'documentation'
  return 'declarations'
}

function getText(data: SectionData, key: string) {
  const value = data[key]
  return typeof value === 'string' ? value : ''
}

function getBool(data: SectionData, key: string) {
  return data[key] === true
}

function getArray(data: SectionData, key: string) {
  const value = data[key]
  return Array.isArray(value) ? value : []
}

function formatDate(value?: string) {
  if (!value) return 'Pendiente'
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function RegistrationForm({ token }: { token: string }) {
  const [merchant, setMerchant] = useState<PublicMerchant | null>(null)
  const [sections, setSections] = useState(emptySections)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submitted = Boolean(merchant?.onboarding?.progress?.submittedAt)
  const progress = merchant?.onboarding?.progress?.percent || Math.round(((step - 1) / STEPS.length) * 100)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await fetch(`/api/merchant-registration/${encodeURIComponent(token)}`)
      const data = (await res.json().catch(() => ({}))) as ApiResponse
      if (!res.ok || !data.merchant) {
        setError(data.error || 'El enlace no se encuentra disponible. Solicita a Cobrix Pay un nuevo enlace.')
        setLoading(false)
        return
      }

      setMerchant(data.merchant)
      setSections({
        responsiblePerson: data.merchant.onboarding?.responsiblePerson || {},
        businessProfile: data.merchant.onboarding?.businessProfile || {},
        operations: data.merchant.onboarding?.operations || {},
        banking: data.merchant.onboarding?.banking || {},
        declarations: {},
      })
      setLoading(false)
    }

    load()
  }, [token])

  useEffect(() => {
    if (!dirty || submitted || step === 6) return
    const timeout = window.setTimeout(() => {
      saveDraft(false)
    }, 900)
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, dirty, step, submitted])

  const currentSection = useMemo(() => getSectionName(step), [step])

  function updateSection(section: keyof ReturnType<typeof emptySections>, key: string, value: string | boolean | string[]) {
    setSections((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }))
    setDirty(true)
  }

  function toggleArray(section: keyof ReturnType<typeof emptySections>, key: string, value: string) {
    const values = getArray(sections[section], key)
    updateSection(section, key, values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  async function saveDraft(showMessage = true) {
    if (submitted || saving) return
    setSaving(true)
    setError('')
    const section = currentSection
    const payload = section === 'documentation' ? {} : sections[section as keyof ReturnType<typeof emptySections>]
    const res = await fetch(`/api/merchant-registration/${encodeURIComponent(token)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, data: payload }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResponse
    if (!res.ok) {
      setError(data.error || 'No se pudo guardar el borrador.')
    } else if (data.merchant) {
      setMerchant(data.merchant)
      setDirty(false)
      if (showMessage) setMessage('Borrador guardado.')
    }
    setSaving(false)
  }

  async function submitRegistration() {
    if (submitted) return
    setSaving(true)
    setError('')
    setMessage('')
    const res = await fetch(`/api/merchant-registration/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        declarations: {
          ...sections.declarations,
          submittedBy: `${getText(sections.responsiblePerson, 'firstName')} ${getText(sections.responsiblePerson, 'lastName')}`.trim(),
        },
      }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResponse
    if (!res.ok) {
      setError([data.error, ...(data.errors || [])].filter(Boolean).join(' '))
    } else if (data.merchant) {
      setMerchant(data.merchant)
      setMessage(data.message || 'Registro enviado.')
      setStep(6)
    }
    setSaving(false)
  }

  function nextStep() {
    if (step < 6) setStep((current) => current + 1)
  }

  function previousStep() {
    if (step > 1) setStep((current) => current - 1)
  }

  if (loading) {
    return <main style={shellStyle}>Cargando registro...</main>
  }

  if (error && !merchant) {
    return (
      <main style={shellStyle}>
        <section style={panelStyle}>
          <h1>Completar registro</h1>
          <p style={errorStyle}>{error}</p>
        </section>
      </main>
    )
  }

  if (submitted) {
    return (
      <main style={shellStyle}>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Registro enviado</p>
          <h1>En revision</h1>
          <p>
            Recibimos la informacion de tu comercio. El equipo de Cobrix Pay revisara los datos y te contactara para
            completar la documentacion necesaria.
          </p>
          <p style={mutedStyle}>Enviado: {formatDate(merchant?.onboarding?.progress?.submittedAt)}</p>
        </section>
      </main>
    )
  }

  return (
    <main style={shellStyle}>
      <section style={panelStyle}>
        <p style={eyebrowStyle}>Completar registro</p>
        <h1 style={{ marginTop: 4 }}>{merchant?.name || 'Tu comercio'}</h1>
        <div style={progressHeaderStyle}>
          <span>Paso {step} de {STEPS.length}: {STEPS[step - 1]}</span>
          <strong>{progress}%</strong>
        </div>
        <div style={trackStyle}><span style={{ ...barStyle, width: `${Math.max(progress, Math.round((step / STEPS.length) * 100))}%` }} /></div>

        {step === 1 && (
          <StepResponsible data={sections.responsiblePerson} update={(key, value) => updateSection('responsiblePerson', key, value)} />
        )}
        {step === 2 && (
          <StepBusiness data={sections.businessProfile} update={(key, value) => updateSection('businessProfile', key, value)} />
        )}
        {step === 3 && (
          <StepOperations
            data={sections.operations}
            update={(key, value) => updateSection('operations', key, value)}
            toggle={(key, value) => toggleArray('operations', key, value)}
          />
        )}
        {step === 4 && (
          <StepBanking data={sections.banking} update={(key, value) => updateSection('banking', key, value)} />
        )}
        {step === 5 && <StepDocumentation taxpayerType={getText(sections.businessProfile, 'taxpayerType')} />}
        {step === 6 && (
          <StepConfirmation
            sections={sections}
            setStep={setStep}
            update={(key, value) => updateSection('declarations', key, value)}
          />
        )}

        {error && <p style={errorStyle}>{error}</p>}
        {message && <p style={successStyle}>{message}</p>}

        <div style={actionsStyle}>
          <button type="button" onClick={previousStep} disabled={step === 1 || saving} style={secondaryButtonStyle}>
            Anterior
          </button>
          <button type="button" onClick={() => saveDraft(true)} disabled={saving || step === 6} style={secondaryButtonStyle}>
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </button>
          <button type="button" onClick={() => saveDraft(true)} disabled={saving || step === 6} style={secondaryButtonStyle}>
            Guardar y continuar despues
          </button>
          {step < 6 && (
            <button type="button" onClick={nextStep} disabled={saving} style={primaryButtonStyle}>
              Siguiente
            </button>
          )}
          {step === 6 && (
            <button type="button" onClick={submitRegistration} disabled={saving} style={primaryButtonStyle}>
              {saving ? 'Enviando...' : 'Enviar registro'}
            </button>
          )}
        </div>
      </section>
    </main>
  )
}

function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label style={fieldStyle}>
      <span>{label}{required ? ' *' : ''}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} />
    </label>
  )
}

function SelectField({ label, value, options, onChange, required = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label style={fieldStyle}>
      <span>{label}{required ? ' *' : ''}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle}>
        <option value="">Seleccionar</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

function TextArea({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label style={fieldStyle}>
      <span>{label}{required ? ' *' : ''}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} style={inputStyle} />
    </label>
  )
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label style={checkboxStyle}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function StepResponsible({ data, update }: { data: SectionData; update: (key: string, value: string | boolean) => void }) {
  return (
    <div style={gridStyle}>
      <Field label="Nombre" required value={getText(data, 'firstName')} onChange={(value) => update('firstName', value)} />
      <Field label="Apellido" required value={getText(data, 'lastName')} onChange={(value) => update('lastName', value)} />
      <Field label="Tipo de documento" required value={getText(data, 'documentType')} onChange={(value) => update('documentType', value)} />
      <Field label="Numero de documento" required value={getText(data, 'documentNumber')} onChange={(value) => update('documentNumber', value)} />
      <Field label="CUIT o CUIL" required value={getText(data, 'taxId')} onChange={(value) => update('taxId', value)} />
      <Field label="Fecha de nacimiento" required type="date" value={getText(data, 'birthDate')} onChange={(value) => update('birthDate', value)} />
      <Field label="Nacionalidad" required value={getText(data, 'nationality')} onChange={(value) => update('nationality', value)} />
      <Field label="Email" required type="email" value={getText(data, 'email')} onChange={(value) => update('email', value)} />
      <Field label="Telefono celular" required value={getText(data, 'mobilePhone')} onChange={(value) => update('mobilePhone', value)} />
      <SelectField label="Relacion con el comercio" required value={getText(data, 'relationship')} options={RELATIONSHIPS} onChange={(value) => update('relationship', value)} />
      {getText(data, 'relationship') === 'Otro' && (
        <Field label="Descripcion de la relacion" required value={getText(data, 'relationshipOther')} onChange={(value) => update('relationshipOther', value)} />
      )}
      <div style={{ gridColumn: '1 / -1' }}>
        <Checkbox label="Declaro que tengo autorizacion para representar al comercio y completar este registro." checked={getBool(data, 'representationDeclaration')} onChange={(value) => update('representationDeclaration', value)} />
      </div>
    </div>
  )
}

function StepBusiness({ data, update }: { data: SectionData; update: (key: string, value: string) => void }) {
  return (
    <div style={gridStyle}>
      <Field label="Nombre comercial" required value={getText(data, 'tradeName')} onChange={(value) => update('tradeName', value)} />
      <Field label="Razon social o nombre fiscal" required value={getText(data, 'legalName')} onChange={(value) => update('legalName', value)} />
      <Field label="CUIT" required value={getText(data, 'businessTaxId')} onChange={(value) => update('businessTaxId', value)} />
      <SelectField label="Tipo de contribuyente" required value={getText(data, 'taxpayerType')} options={TAXPAYER_TYPES} onChange={(value) => update('taxpayerType', value)} />
      <Field label="Fecha de inicio de actividad" required type="date" value={getText(data, 'activityStartDate')} onChange={(value) => update('activityStartDate', value)} />
      <SelectField label="Rubro principal" required value={getText(data, 'mainCategory')} options={CATEGORIES} onChange={(value) => update('mainCategory', value)} />
      {getText(data, 'mainCategory') === 'Otro' && <Field label="Especificacion del rubro" required value={getText(data, 'mainCategoryOther')} onChange={(value) => update('mainCategoryOther', value)} />}
      <TextArea label="Descripcion de la actividad" required value={getText(data, 'activityDescription')} onChange={(value) => update('activityDescription', value)} />
      <Field label="Domicilio fiscal" required value={getText(data, 'fiscalAddress')} onChange={(value) => update('fiscalAddress', value)} />
      <Field label="Ciudad" required value={getText(data, 'city')} onChange={(value) => update('city', value)} />
      <Field label="Provincia" required value={getText(data, 'province')} onChange={(value) => update('province', value)} />
      <Field label="Codigo postal" required value={getText(data, 'postalCode')} onChange={(value) => update('postalCode', value)} />
      <Field label="Pais" required value={getText(data, 'country')} onChange={(value) => update('country', value)} />
      <Field label="Telefono comercial" required value={getText(data, 'businessPhone')} onChange={(value) => update('businessPhone', value)} />
      <Field label="Sitio web" value={getText(data, 'website')} onChange={(value) => update('website', value)} />
      <Field label="Instagram" value={getText(data, 'instagram')} onChange={(value) => update('instagram', value)} />
      <Field label="Google Maps" value={getText(data, 'googleMaps')} onChange={(value) => update('googleMaps', value)} />
      <Field label="Facebook" value={getText(data, 'facebook')} onChange={(value) => update('facebook', value)} />
      <Field label="LinkedIn" value={getText(data, 'linkedin')} onChange={(value) => update('linkedin', value)} />
      <Field label="Marketplace turistico" value={getText(data, 'tourismMarketplace')} onChange={(value) => update('tourismMarketplace', value)} />
      <TextArea label="Si no posee presencia online, explique brevemente" value={getText(data, 'noPresenceExplanation')} onChange={(value) => update('noPresenceExplanation', value)} />
      <SelectField label="Como conocio Cobrix Pay" required value={getText(data, 'knownBy')} options={KNOWN_BY} onChange={(value) => update('knownBy', value)} />
      {getText(data, 'knownBy') === 'Otro' && <Field label="Especificacion" required value={getText(data, 'knownByOther')} onChange={(value) => update('knownByOther', value)} />}
    </div>
  )
}

function StepOperations({ data, update, toggle }: { data: SectionData; update: (key: string, value: string) => void; toggle: (key: string, value: string) => void }) {
  return (
    <div style={gridStyle}>
      <TextArea label="Productos o servicios vendidos" required value={getText(data, 'soldProducts')} onChange={(value) => update('soldProducts', value)} />
      <Field label="Ticket promedio estimado en USD" required type="number" value={getText(data, 'averageTicketUsd')} onChange={(value) => update('averageTicketUsd', value)} />
      <Field label="Ticket maximo esperado en USD" required type="number" value={getText(data, 'maxTicketUsd')} onChange={(value) => update('maxTicketUsd', value)} />
      <Field label="Volumen mensual esperado en USD" required type="number" value={getText(data, 'monthlyVolumeUsd')} onChange={(value) => update('monthlyVolumeUsd', value)} />
      <Field label="Cantidad mensual estimada de operaciones" required type="number" value={getText(data, 'monthlyTransactions')} onChange={(value) => update('monthlyTransactions', value)} />
      <Field label="Porcentaje estimado de clientes extranjeros" required type="number" value={getText(data, 'foreignClientsPercent')} onChange={(value) => update('foreignClientsPercent', value)} />
      <Field label="Principales paises de origen" required value={getText(data, 'originCountries')} onChange={(value) => update('originCountries', value)} />
      <Field label="Tiempo promedio entre pago y prestacion" required value={getText(data, 'paymentToServiceTime')} onChange={(value) => update('paymentToServiceTime', value)} />
      <SelectField label="Acepta reservas futuras" required value={getText(data, 'acceptsFutureBookings')} options={['Si', 'No']} onChange={(value) => update('acceptsFutureBookings', value)} />
      {getText(data, 'acceptsFutureBookings') === 'Si' && <Field label="Plazo maximo de anticipacion en dias" required type="number" value={getText(data, 'maxAdvanceDays')} onChange={(value) => update('maxAdvanceDays', value)} />}
      <SelectField label="Entrega factura o comprobante" required value={getText(data, 'issuesReceipts')} options={['Si', 'No']} onChange={(value) => update('issuesReceipts', value)} />
      <TextArea label="Politica de cancelacion" required value={getText(data, 'cancellationPolicy')} onChange={(value) => update('cancellationPolicy', value)} />
      <TextArea label="Politica de reembolso" required value={getText(data, 'refundPolicy')} onChange={(value) => update('refundPolicy', value)} />
      <div style={{ gridColumn: '1 / -1' }}>
        <strong>Canal de venta *</strong>
        <div style={checkboxGridStyle}>
          {SALES_CHANNELS.map((channel) => (
            <Checkbox key={channel} label={channel} checked={getArray(data, 'salesChannels').includes(channel)} onChange={() => toggle('salesChannels', channel)} />
          ))}
        </div>
      </div>
      {getArray(data, 'salesChannels').includes('Otro') && <Field label="Especificar otro canal" value={getText(data, 'salesChannelOther')} onChange={(value) => update('salesChannelOther', value)} />}
    </div>
  )
}

function StepBanking({ data, update }: { data: SectionData; update: (key: string, value: string) => void }) {
  return (
    <div style={gridStyle}>
      <Field label="Banco" required value={getText(data, 'bank')} onChange={(value) => update('bank', value)} />
      <SelectField label="Tipo de cuenta" required value={getText(data, 'accountType')} options={ACCOUNT_TYPES} onChange={(value) => update('accountType', value)} />
      <SelectField label="Moneda" required value={getText(data, 'currency')} options={CURRENCIES} onChange={(value) => update('currency', value)} />
      <Field label="CBU" required value={getText(data, 'cbu')} onChange={(value) => update('cbu', value)} />
      <Field label="Alias" required value={getText(data, 'alias')} onChange={(value) => update('alias', value)} />
      <Field label="Titular" required value={getText(data, 'holderName')} onChange={(value) => update('holderName', value)} />
      <Field label="CUIT del titular" required value={getText(data, 'holderTaxId')} onChange={(value) => update('holderTaxId', value)} />
    </div>
  )
}

function StepDocumentation({ taxpayerType }: { taxpayerType: string }) {
  const documents = taxpayerType === 'Sociedad'
    ? ['DNI frente', 'DNI dorso', 'Constancia de inscripcion en ARCA', 'Constancia de Ingresos Brutos', 'Constancia de CBU o titularidad bancaria', 'Estatuto o contrato social', 'Constancia de inscripcion', 'Autoridades vigentes', 'Poder, si corresponde']
    : ['DNI frente', 'DNI dorso', 'Constancia de inscripcion en ARCA', 'Constancia de Ingresos Brutos', 'Constancia de CBU o titularidad bancaria']

  return (
    <div>
      <p style={mutedStyle}>La carga segura de documentacion se habilitara en el siguiente paso del proceso.</p>
      <ul>
        {documents.map((document) => <li key={document}>{document}</li>)}
      </ul>
      <p style={successStyle}>Podés continuar sin archivos en esta etapa.</p>
    </div>
  )
}

function StepConfirmation({ sections, setStep, update }: { sections: ReturnType<typeof emptySections>; setStep: (step: number) => void; update: (key: string, value: boolean) => void }) {
  return (
    <div>
      <h2>Resumen</h2>
      <Summary title="Responsable" onEdit={() => setStep(1)} lines={[getText(sections.responsiblePerson, 'firstName') + ' ' + getText(sections.responsiblePerson, 'lastName'), getText(sections.responsiblePerson, 'email'), getText(sections.responsiblePerson, 'relationship')]} />
      <Summary title="Comercio" onEdit={() => setStep(2)} lines={[getText(sections.businessProfile, 'tradeName'), getText(sections.businessProfile, 'legalName'), getText(sections.businessProfile, 'businessTaxId')]} />
      <Summary title="Operacion" onEdit={() => setStep(3)} lines={[getText(sections.operations, 'soldProducts'), `Ticket promedio: ${getText(sections.operations, 'averageTicketUsd')} USD`, `Canales: ${getArray(sections.operations, 'salesChannels').join(', ')}`]} />
      <Summary title="Banco" onEdit={() => setStep(4)} lines={[getText(sections.banking, 'bank'), getText(sections.banking, 'holderName'), getText(sections.banking, 'holderTaxId')]} />
      <Summary title="Documentacion" onEdit={() => setStep(5)} lines={['Documentacion pendiente para la siguiente etapa.']} />
      <div style={{ marginTop: 18 }}>
        {DECLARATIONS.map(([key, label]) => (
          <Checkbox key={key} label={label} checked={getBool(sections.declarations, key)} onChange={(value) => update(key, value)} />
        ))}
      </div>
    </div>
  )
}

function Summary({ title, lines, onEdit }: { title: string; lines: string[]; onEdit: () => void }) {
  return (
    <section style={summaryStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button type="button" onClick={onEdit} style={linkButtonStyle}>Editar</button>
      </div>
      {lines.filter(Boolean).map((line) => <p key={line} style={mutedStyle}>{line}</p>)}
    </section>
  )
}

const shellStyle = {
  minHeight: '100vh',
  padding: '32px 16px',
  background: '#f5f7fb',
  color: '#171717',
  fontFamily: 'system-ui, -apple-system, sans-serif',
} satisfies React.CSSProperties

const panelStyle = {
  maxWidth: 980,
  margin: '0 auto',
  padding: 24,
  border: '1px solid #dfe4ee',
  borderRadius: 8,
  background: '#fff',
} satisfies React.CSSProperties

const eyebrowStyle = {
  margin: 0,
  color: '#5b6275',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
} satisfies React.CSSProperties

const progressHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 18,
  fontWeight: 700,
} satisfies React.CSSProperties

const trackStyle = {
  height: 10,
  background: '#e8ecf4',
  borderRadius: 999,
  overflow: 'hidden',
  margin: '8px 0 22px',
} satisfies React.CSSProperties

const barStyle = {
  display: 'block',
  height: '100%',
  background: '#1455d9',
} satisfies React.CSSProperties

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 14,
} satisfies React.CSSProperties

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontWeight: 700,
} satisfies React.CSSProperties

const inputStyle = {
  width: '100%',
  padding: 12,
  border: '1px solid #cfd4e2',
  borderRadius: 8,
  font: 'inherit',
  fontWeight: 400,
} satisfies React.CSSProperties

const checkboxStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  marginTop: 10,
  lineHeight: 1.4,
} satisfies React.CSSProperties

const checkboxGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 6,
  marginTop: 8,
} satisfies React.CSSProperties

const actionsStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 24,
} satisfies React.CSSProperties

const primaryButtonStyle = {
  padding: '11px 16px',
  border: '1px solid #1455d9',
  borderRadius: 8,
  background: '#1455d9',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 800,
} satisfies React.CSSProperties

const secondaryButtonStyle = {
  padding: '10px 14px',
  border: '1px solid #cfd4e2',
  borderRadius: 8,
  background: '#fff',
  color: '#171717',
  cursor: 'pointer',
  fontWeight: 700,
} satisfies React.CSSProperties

const linkButtonStyle = {
  border: 0,
  background: 'transparent',
  color: '#1455d9',
  cursor: 'pointer',
  fontWeight: 800,
} satisfies React.CSSProperties

const summaryStyle = {
  padding: 14,
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  marginTop: 12,
} satisfies React.CSSProperties

const mutedStyle = {
  color: '#5b6275',
  lineHeight: 1.5,
} satisfies React.CSSProperties

const errorStyle = {
  padding: 12,
  border: '1px solid #f0b7c1',
  borderRadius: 8,
  background: '#fff5f7',
  color: '#b00020',
  fontWeight: 700,
} satisfies React.CSSProperties

const successStyle = {
  padding: 12,
  border: '1px solid #9fd8b5',
  borderRadius: 8,
  background: '#f0fff6',
  color: '#1b5e20',
  fontWeight: 700,
} satisfies React.CSSProperties
