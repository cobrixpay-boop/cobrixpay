import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import {
  appendAuditEvent,
  buildComplianceForOnboarding,
  buildSubmittedDeclarations,
  getDefaultOnboarding,
  hashInvitationToken,
  markSaved,
  markStarted,
  markSubmitted,
  sanitizeSectionPayload,
  validateSection,
  validateSubmission,
  type OnboardingSectionName,
} from '@/lib/merchant-onboarding'
import { listMerchants, saveMerchant, type Merchant, type MerchantOnboarding } from '@/lib/merchants'

type RouteContext = {
  params: Promise<{ token: string }>
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error interno'
}

function rateLimit(req: Request, token: string, action: string) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  const key = `${action}:${ip}:${token.slice(0, 12)}`
  const now = Date.now()
  const existing = rateLimitStore.get(key)

  if (!existing || existing.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 60_000 })
    return false
  }

  existing.count += 1
  return existing.count > 40
}

function isSectionName(value: unknown): value is OnboardingSectionName {
  return (
    value === 'responsiblePerson' ||
    value === 'businessProfile' ||
    value === 'operations' ||
    value === 'banking' ||
    value === 'documentation' ||
    value === 'declarations'
  )
}

async function findMerchantByToken(token: string) {
  const tokenHash = hashInvitationToken(token)
  const merchants = await listMerchants()
  const merchant = Object.values(merchants).find((candidate) => candidate.onboarding?.invitation?.tokenHash === tokenHash)
  return merchant
}

function getInvalidLinkResponse() {
  return NextResponse.json(
    {
      error:
        'El enlace no es valido o ya no se encuentra disponible. Solicita a Cobrix Pay un nuevo enlace para completar el registro.',
    },
    { status: 404 }
  )
}

function validateInvitation(merchant: Merchant | undefined) {
  if (!merchant) return 'invalid'
  const invitation = merchant.onboarding?.invitation
  if (!invitation) return 'invalid'
  if (merchant.archived) return 'archived'
  if (invitation.revokedAt) return 'revoked'
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return 'expired'
  return 'valid'
}

function publicMerchantPayload(merchant: Merchant) {
  const invitation = merchant.onboarding?.invitation
  return {
    slug: merchant.slug,
    name: merchant.name,
    email: merchant.email,
    whatsapp: merchant.whatsapp,
    status: merchant.status,
    archived: merchant.archived,
    onboarding: {
      ...merchant.onboarding,
      invitation: invitation
        ? {
            id: invitation.id,
            createdAt: invitation.createdAt,
            expiresAt: invitation.expiresAt,
            sentAt: invitation.sentAt,
            resentAt: invitation.resentAt,
            revokedAt: invitation.revokedAt,
            email: invitation.email,
          }
        : undefined,
    },
    compliance: merchant.compliance,
  }
}

async function sendAdminSubmissionNotification(merchant: Merchant) {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL || process.env.RESEND_ADMIN_EMAIL
  if (!apiKey || !adminEmail) return

  const resend = new Resend(apiKey)
  await resend.emails.send({
    from: process.env.RESEND_FROM || 'Cobrix Pay <notificaciones@cobrixpay.com>',
    to: adminEmail,
    subject: `Registro enviado: ${merchant.name}`,
    text: `El comercio ${merchant.name} (${merchant.slug}) envio su registro y quedo en revision.\n\nDocumentacion pendiente: si`,
  })
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const { token } = await context.params
    if (rateLimit(req, token, 'read')) {
      return NextResponse.json({ error: 'Demasiados intentos. Proba nuevamente en unos minutos.' }, { status: 429 })
    }

    const merchant = await findMerchantByToken(token)
    if (validateInvitation(merchant) !== 'valid' || !merchant) return getInvalidLinkResponse()

    if (!merchant.onboarding?.progress.submittedAt && !merchant.onboarding?.progress.startedAt) {
      const onboarding = markStarted(merchant.onboarding || getDefaultOnboarding())
      const updatedMerchant: Merchant = {
        ...merchant,
        onboarding,
        auditHistory: appendAuditEvent(merchant, 'registration_started'),
      }
      await saveMerchant(updatedMerchant)
      return NextResponse.json({ merchant: publicMerchantPayload(updatedMerchant) })
    }

    return NextResponse.json({ merchant: publicMerchantPayload(merchant) })
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { token } = await context.params
    if (rateLimit(req, token, 'save')) {
      return NextResponse.json({ error: 'Demasiados guardados. Proba nuevamente en unos minutos.' }, { status: 429 })
    }

    const merchant = await findMerchantByToken(token)
    if (validateInvitation(merchant) !== 'valid' || !merchant) return getInvalidLinkResponse()
    if (merchant.onboarding?.progress.submittedAt) {
      return NextResponse.json({ error: 'El registro ya fue enviado y no puede modificarse libremente.' }, { status: 409 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const section = body.section
    if (!isSectionName(section)) {
      return NextResponse.json({ error: 'Seccion invalida.' }, { status: 400 })
    }

    const payload = sanitizeSectionPayload(section, body.data)
    const currentOnboarding: MerchantOnboarding = merchant.onboarding || getDefaultOnboarding()
    const nextOnboarding: MerchantOnboarding =
      section === 'documentation'
        ? currentOnboarding
        : {
            ...currentOnboarding,
            [section]: payload,
          }
    const savedOnboarding = markSaved(nextOnboarding)
    const updatedMerchant: Merchant = {
      ...merchant,
      onboarding: savedOnboarding,
      compliance: buildComplianceForOnboarding({ ...merchant, onboarding: savedOnboarding }),
      auditHistory: appendAuditEvent(merchant, 'registration_step_saved', section),
    }

    await saveMerchant(updatedMerchant)

    return NextResponse.json({
      ok: true,
      merchant: publicMerchantPayload(updatedMerchant),
      sectionValidation: validateSection(section, payload),
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const { token } = await context.params
    if (rateLimit(req, token, 'submit')) {
      return NextResponse.json({ error: 'Demasiados intentos. Proba nuevamente en unos minutos.' }, { status: 429 })
    }

    const merchant = await findMerchantByToken(token)
    if (validateInvitation(merchant) !== 'valid' || !merchant) return getInvalidLinkResponse()
    if (merchant.onboarding?.progress.submittedAt) {
      return NextResponse.json({ error: 'El registro ya fue enviado.' }, { status: 409 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const declarationsPayload = sanitizeSectionPayload('declarations', body.declarations)
    const declarationsValidation = validateSection('declarations', declarationsPayload)
    if (!declarationsValidation.ok) {
      return NextResponse.json({ error: 'Faltan declaraciones obligatorias.', errors: declarationsValidation.errors }, { status: 400 })
    }

    const onboarding: MerchantOnboarding = {
      ...(merchant.onboarding || getDefaultOnboarding()),
      declarations: buildSubmittedDeclarations(declarationsPayload, merchant.onboarding?.invitation?.id, req),
    }
    const submissionValidation = validateSubmission(onboarding)
    if (!submissionValidation.ok) {
      return NextResponse.json({ error: 'Faltan datos obligatorios para enviar el registro.', errors: submissionValidation.errors }, { status: 400 })
    }

    const submittedOnboarding = markSubmitted(onboarding)
    const updatedMerchant: Merchant = {
      ...merchant,
      status: 'under_review',
      onboarding: submittedOnboarding,
      compliance: buildComplianceForOnboarding({ ...merchant, onboarding: submittedOnboarding }),
      auditHistory: appendAuditEvent(merchant, 'registration_submitted'),
    }

    await saveMerchant(updatedMerchant)
    await sendAdminSubmissionNotification(updatedMerchant).catch(() => undefined)

    return NextResponse.json({
      ok: true,
      merchant: publicMerchantPayload(updatedMerchant),
      message:
        'Recibimos la informacion de tu comercio. El equipo de Cobrix Pay revisara los datos y te contactara para completar la documentacion necesaria.',
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
