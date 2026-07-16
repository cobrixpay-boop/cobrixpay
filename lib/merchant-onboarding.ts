import crypto from 'crypto'
import {
  type Merchant,
  type MerchantAuditEvent,
  type MerchantCompliance,
  type MerchantOnboarding,
  type MerchantOnboardingInvitation,
} from './merchants'

export const ONBOARDING_DECLARATIONS_VERSION = '2026-07-11'
export const INVITATION_TTL_DAYS = 14

export const DOCUMENTS_PENDING_BASE = [
  'DNI frente',
  'DNI dorso',
  'Constancia de inscripcion en ARCA',
  'Constancia de Ingresos Brutos',
  'Constancia de CBU o titularidad bancaria',
]

export const DOCUMENTS_PENDING_COMPANY = [
  'Estatuto o contrato social',
  'Constancia de inscripcion',
  'Autoridades vigentes',
  'Poder, si corresponde',
]

export type OnboardingSectionName =
  | 'responsiblePerson'
  | 'businessProfile'
  | 'operations'
  | 'banking'
  | 'documentation'
  | 'declarations'

export type SectionPayload = Record<string, string | boolean | string[]>

type ValidationResult = {
  ok: boolean
  errors: string[]
}

const RESPONSIBLE_RELATIONSHIPS = new Set([
  'Titular',
  'Socio',
  'Representante legal',
  'Apoderado',
  'Empleado autorizado',
  'Otro',
])

const TAXPAYER_TYPES = new Set(['Monotributista', 'Responsable Inscripto', 'Sociedad'])

const BUSINESS_CATEGORIES = new Set([
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
])

const ACQUISITION_SOURCES = new Set([
  'Visita comercial',
  'Recomendacion',
  'Google',
  'Instagram',
  'Facebook',
  'LinkedIn',
  'Casa de cambio',
  'Camara o asociacion',
  'Partner',
  'Otro',
])

const ACCOUNT_TYPES = new Set(['Cuenta corriente', 'Caja de ahorro', 'Cuenta de pago', 'Otra'])
const CURRENCIES = new Set(['ARS', 'USD', 'Otra'])

const DECLARATION_KEYS = [
  'truthfulness',
  'verificationAuthorization',
  'terms',
  'privacy',
  'chargebacks',
  'changesCommitment',
  'representationAuthority',
]

function nowIso() {
  return new Date().toISOString()
}

export function createInvitationToken() {
  const token = crypto.randomBytes(32).toString('base64url')
  return {
    token,
    tokenHash: hashInvitationToken(token),
  }
}

export function hashInvitationToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function createInvitation(email: string, createdBy?: string): MerchantOnboardingInvitation & { token: string } {
  const { token, tokenHash } = createInvitationToken()
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  return {
    id: crypto.randomUUID(),
    token,
    tokenHash,
    createdAt,
    expiresAt,
    createdBy,
    email,
  }
}

export function getDefaultOnboarding(invitation?: MerchantOnboardingInvitation): MerchantOnboarding {
  return {
    invitation,
    progress: {
      percent: 0,
      lastCompletedStep: 0,
      documentationPending: true,
    },
    timestamps: {
      createdAt: nowIso(),
    },
  }
}

export function appendAuditEvent(merchant: Merchant, type: string, detail?: string, actor?: string): MerchantAuditEvent[] {
  return [
    ...(merchant.auditHistory || []),
    {
      type,
      detail,
      actor,
      createdAt: nowIso(),
    },
  ].slice(-100)
}

function getText(payload: SectionPayload | undefined, key: string) {
  const value = payload?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function getBoolean(payload: SectionPayload | undefined, key: string) {
  return payload?.[key] === true
}

function getStringArray(payload: SectionPayload | undefined, key: string) {
  const value = payload?.[key]
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function requireText(payload: SectionPayload | undefined, keys: string[], errors: string[]) {
  for (const key of keys) {
    if (!getText(payload, key)) errors.push(`Falta completar ${key}.`)
  }
}

function requireSet(value: string, allowed: Set<string>, label: string, errors: string[]) {
  if (!allowed.has(value)) errors.push(`${label} no es valido.`)
}

function requirePositiveNumber(payload: SectionPayload | undefined, key: string, errors: string[]) {
  const value = Number(getText(payload, key))
  if (!Number.isFinite(value) || value <= 0) errors.push(`${key} debe ser mayor que cero.`)
  return value
}

function requireNonNegativeNumber(payload: SectionPayload | undefined, key: string, errors: string[]) {
  const value = Number(getText(payload, key))
  if (!Number.isFinite(value) || value < 0) errors.push(`${key} no puede ser negativo.`)
  return value
}

function isValidOptionalUrl(value: string) {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function sanitizeSectionPayload(section: OnboardingSectionName, raw: unknown): SectionPayload {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const sanitized: SectionPayload = {}

  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => String(item).trim()).filter(Boolean)
      continue
    }

    if (typeof value === 'boolean') {
      sanitized[key] = value
      continue
    }

    if (value !== undefined && value !== null) {
      sanitized[key] = String(value).trim().slice(0, section === 'declarations' ? 200 : 1200)
    }
  }

  return sanitized
}

export function validateResponsiblePerson(payload: SectionPayload | undefined): ValidationResult {
  const errors: string[] = []
  requireText(payload, [
    'firstName',
    'lastName',
    'documentType',
    'documentNumber',
    'taxId',
    'birthDate',
    'nationality',
    'email',
    'mobilePhone',
    'relationship',
  ], errors)
  requireSet(getText(payload, 'relationship'), RESPONSIBLE_RELATIONSHIPS, 'La relacion con el comercio', errors)
  if (getText(payload, 'relationship') === 'Otro') requireText(payload, ['relationshipOther'], errors)
  if (!getBoolean(payload, 'representationDeclaration')) {
    errors.push('Debe confirmar que tiene autorizacion para representar al comercio.')
  }
  return { ok: errors.length === 0, errors }
}

export function validateBusinessProfile(payload: SectionPayload | undefined): ValidationResult {
  const errors: string[] = []
  requireText(payload, [
    'tradeName',
    'legalName',
    'businessTaxId',
    'taxpayerType',
    'activityStartDate',
    'mainCategory',
    'activityDescription',
    'fiscalAddress',
    'city',
    'province',
    'postalCode',
    'country',
    'businessPhone',
    'knownBy',
  ], errors)
  requireSet(getText(payload, 'taxpayerType'), TAXPAYER_TYPES, 'El tipo de contribuyente', errors)
  requireSet(getText(payload, 'mainCategory'), BUSINESS_CATEGORIES, 'El rubro principal', errors)
  requireSet(getText(payload, 'knownBy'), ACQUISITION_SOURCES, 'Como conocio Cobrix Pay', errors)
  if (getText(payload, 'mainCategory') === 'Otro') requireText(payload, ['mainCategoryOther'], errors)
  if (getText(payload, 'knownBy') === 'Otro') requireText(payload, ['knownByOther'], errors)

  for (const key of ['website', 'instagram', 'googleMaps', 'facebook', 'linkedin', 'tourismMarketplace']) {
    if (!isValidOptionalUrl(getText(payload, key))) errors.push(`${key} debe ser una URL valida.`)
  }

  const hasCommercialPresence = ['website', 'instagram', 'googleMaps', 'tourismMarketplace'].some((key) => getText(payload, key))
  if (!hasCommercialPresence && !getText(payload, 'noPresenceExplanation')) {
    errors.push('Indique una explicacion breve si no posee presencia comercial online.')
  }

  return { ok: errors.length === 0, errors }
}

export function validateOperations(payload: SectionPayload | undefined): ValidationResult {
  const errors: string[] = []
  requireText(payload, [
    'soldProducts',
    'averageTicketUsd',
    'maxTicketUsd',
    'monthlyVolumeUsd',
    'monthlyTransactions',
    'foreignClientsPercent',
    'originCountries',
    'paymentToServiceTime',
    'acceptsFutureBookings',
    'issuesReceipts',
    'cancellationPolicy',
    'refundPolicy',
  ], errors)

  const averageTicket = requirePositiveNumber(payload, 'averageTicketUsd', errors)
  const maxTicket = requirePositiveNumber(payload, 'maxTicketUsd', errors)
  const monthlyVolume = requirePositiveNumber(payload, 'monthlyVolumeUsd', errors)
  requireNonNegativeNumber(payload, 'monthlyTransactions', errors)
  const foreignClientsPercent = requireNonNegativeNumber(payload, 'foreignClientsPercent', errors)

  if (Number.isFinite(maxTicket) && Number.isFinite(averageTicket) && maxTicket < averageTicket) {
    errors.push('El ticket maximo debe ser igual o mayor al ticket promedio.')
  }
  if (Number.isFinite(monthlyVolume) && Number.isFinite(averageTicket) && monthlyVolume < averageTicket) {
    errors.push('El volumen mensual debe ser mayor o igual al ticket promedio.')
  }
  if (Number.isFinite(foreignClientsPercent) && foreignClientsPercent > 100) {
    errors.push('El porcentaje de clientes extranjeros debe estar entre 0 y 100.')
  }
  if (getText(payload, 'acceptsFutureBookings') === 'Si') requireText(payload, ['maxAdvanceDays'], errors)
  if (getStringArray(payload, 'salesChannels').length === 0) errors.push('Debe seleccionar al menos un canal de venta.')

  return { ok: errors.length === 0, errors }
}

export function validateBanking(payload: SectionPayload | undefined): ValidationResult {
  const errors: string[] = []
  requireText(payload, ['bank', 'accountType', 'currency', 'cbu', 'alias', 'holderName', 'holderTaxId'], errors)
  requireSet(getText(payload, 'accountType'), ACCOUNT_TYPES, 'El tipo de cuenta', errors)
  requireSet(getText(payload, 'currency'), CURRENCIES, 'La moneda', errors)
  return { ok: errors.length === 0, errors }
}

export function validateDeclarations(payload: SectionPayload | undefined): ValidationResult {
  const errors: string[] = []
  for (const key of DECLARATION_KEYS) {
    if (!getBoolean(payload, key)) errors.push(`Debe aceptar ${key}.`)
  }
  return { ok: errors.length === 0, errors }
}

export function validateSection(section: OnboardingSectionName, payload: SectionPayload | undefined): ValidationResult {
  if (section === 'responsiblePerson') return validateResponsiblePerson(payload)
  if (section === 'businessProfile') return validateBusinessProfile(payload)
  if (section === 'operations') return validateOperations(payload)
  if (section === 'banking') return validateBanking(payload)
  if (section === 'declarations') return validateDeclarations(payload)
  return { ok: true, errors: [] }
}

export function validateSubmission(onboarding: MerchantOnboarding | undefined): ValidationResult {
  const errors = [
    ...validateResponsiblePerson(onboarding?.responsiblePerson).errors,
    ...validateBusinessProfile(onboarding?.businessProfile).errors,
    ...validateOperations(onboarding?.operations).errors,
    ...validateBanking(onboarding?.banking).errors,
    ...validateDeclarations(
      Object.fromEntries(
        Object.keys(onboarding?.declarations?.accepted || {}).map((key) => [key, true])
      )
    ).errors,
  ]
  return { ok: errors.length === 0, errors }
}

export function calculateProgress(onboarding: MerchantOnboarding | undefined) {
  const completed = [
    validateResponsiblePerson(onboarding?.responsiblePerson).ok,
    validateBusinessProfile(onboarding?.businessProfile).ok,
    validateOperations(onboarding?.operations).ok,
    validateBanking(onboarding?.banking).ok,
    true,
    Boolean(onboarding?.progress.submittedAt),
  ]
  const lastCompletedStep = completed.reduce((last, isComplete, index) => (isComplete ? index + 1 : last), 0)
  const percent = Math.round((completed.filter(Boolean).length / 6) * 100)

  return {
    percent,
    lastCompletedStep,
  }
}

export function buildComplianceForOnboarding(merchant: Merchant): MerchantCompliance {
  const taxpayerType = String(merchant.onboarding?.businessProfile?.taxpayerType || '')
  const pending = taxpayerType === 'Sociedad'
    ? [...DOCUMENTS_PENDING_BASE, ...DOCUMENTS_PENDING_COMPANY]
    : DOCUMENTS_PENDING_BASE
  const alerts = [...(merchant.compliance?.alerts || [])]
  const businessTaxId = String(merchant.onboarding?.businessProfile?.businessTaxId || '').replace(/\D/g, '')
  const holderTaxId = String(merchant.onboarding?.banking?.holderTaxId || '').replace(/\D/g, '')

  if (businessTaxId && holderTaxId && businessTaxId !== holderTaxId) {
    const alreadyExists = alerts.some((alert) => alert.code === 'bank_holder_tax_id_mismatch')
    if (!alreadyExists) {
      alerts.push({
        code: 'bank_holder_tax_id_mismatch',
        message: 'El CUIT del comercio no coincide con el CUIT del titular bancario.',
        createdAt: nowIso(),
      })
    }
  }

  return {
    ...merchant.compliance,
    documentationPending: true,
    documents: { pending },
    alerts,
  }
}

export function markStarted(onboarding: MerchantOnboarding) {
  const timestamp = nowIso()
  return {
    ...onboarding,
    progress: {
      ...onboarding.progress,
      startedAt: onboarding.progress.startedAt || timestamp,
    },
    timestamps: {
      ...onboarding.timestamps,
      startedAt: onboarding.timestamps.startedAt || timestamp,
    },
  }
}

export function markSaved(onboarding: MerchantOnboarding) {
  const timestamp = nowIso()
  const progress = calculateProgress(onboarding)
  return {
    ...onboarding,
    progress: {
      ...onboarding.progress,
      ...progress,
      startedAt: onboarding.progress.startedAt || timestamp,
      lastSavedAt: timestamp,
      documentationPending: true,
    },
    timestamps: {
      ...onboarding.timestamps,
      startedAt: onboarding.timestamps.startedAt || timestamp,
      lastSavedAt: timestamp,
    },
  }
}

export function buildSubmittedDeclarations(payload: SectionPayload, invitationId: string | undefined, request: Request) {
  const acceptedAt = nowIso()
  return {
    accepted: Object.fromEntries(
      DECLARATION_KEYS.map((key) => [
        key,
        {
          acceptedAt,
          version: ONBOARDING_DECLARATIONS_VERSION,
        },
      ])
    ),
    submittedBy: String(payload.submittedBy || ''),
    submittedIp: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
    submittedUserAgent: request.headers.get('user-agent') || undefined,
    invitationId,
  }
}

export function markSubmitted(onboarding: MerchantOnboarding) {
  const timestamp = nowIso()
  return {
    ...onboarding,
    progress: {
      ...onboarding.progress,
      percent: 100,
      lastCompletedStep: 6,
      submittedAt: timestamp,
      documentationPending: true,
    },
    timestamps: {
      ...onboarding.timestamps,
      submittedAt: timestamp,
      lastSavedAt: timestamp,
    },
  }
}
