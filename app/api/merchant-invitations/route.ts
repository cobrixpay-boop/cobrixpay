import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { getSiteUrl } from '@/lib/site-url'
import {
  appendAuditEvent,
  createInvitation,
  getDefaultOnboarding,
} from '@/lib/merchant-onboarding'
import { isValidStripeAccountId, listMerchants, saveMerchant, type Merchant, type MerchantOnboardingInvitation } from '@/lib/merchants'

function isAuthorized(req: Request) {
  const adminToken = process.env.ADMIN_TOKEN
  if (!adminToken) return true

  return req.headers.get('x-admin-token') === adminToken
}

function normalizeSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
}

function normalizeOptionalString(value: unknown) {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function isValidSupportEmail(value: string) {
  if (!value) return true
  if (value.length > 120) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidSupportPhone(value: string) {
  if (!value) return true
  if (value.length > 40) return false
  return /^\+?[0-9][0-9\s().-]{5,39}$/.test(value)
}

function normalizeApplicationFeePercent(value: unknown) {
  if (value === undefined || value === null || value === '') return 0
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return NaN
  return Math.max(0, Math.min(100, parsed))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error interno'
}

function getActor(req: Request) {
  return req.headers.get('x-admin-token') ? 'admin' : 'admin-local'
}

function getInvitationLink(token: string) {
  return `${getSiteUrl()}/completar-registro/${encodeURIComponent(token)}`
}

function sanitizeMerchantForAdmin(merchant: Merchant) {
  const invitation = merchant.onboarding?.invitation
  return {
    ...merchant,
    onboarding: merchant.onboarding
      ? {
          ...merchant.onboarding,
          invitation: invitation
            ? {
                id: invitation.id,
                createdAt: invitation.createdAt,
                expiresAt: invitation.expiresAt,
                sentAt: invitation.sentAt,
                resentAt: invitation.resentAt,
                revokedAt: invitation.revokedAt,
                createdBy: invitation.createdBy,
                email: invitation.email,
              }
            : undefined,
        }
      : undefined,
  }
}

async function sendInvitationEmail(email: string, merchantName: string, invitationLink: string, expiresAt: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM || 'Cobrix Pay <notificaciones@cobrixpay.com>'

  if (!apiKey) {
    return false
  }

  const resend = new Resend(apiKey)
  const expirationDate = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(expiresAt))

  await resend.emails.send({
    from,
    to: email,
    subject: 'Completá el registro de tu comercio en Cobrix Pay',
    html: `
      <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
        <h1 style="color:#1455d9;">Cobrix Pay</h1>
        <p>Hola,</p>
        <p>Te invitamos a completar la información de <strong>${merchantName}</strong> para iniciar la revisión de tu comercio en Cobrix Pay.</p>
        <p>
          <a href="${invitationLink}" style="display:inline-block;background:#1455d9;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700;">
            Completar registro
          </a>
        </p>
        <p>El enlace vence el ${expirationDate}.</p>
        <p>Completar la información no implica aprobación automática. El equipo de Cobrix Pay revisará los datos y te contactará para continuar el proceso.</p>
        <p>Ante cualquier duda, escribinos a notificaciones@cobrixpay.com.</p>
      </div>
    `,
    text: `Hola,\n\nTe invitamos a completar la informacion de ${merchantName} para iniciar la revision de tu comercio en Cobrix Pay.\n\nCompletar registro: ${invitationLink}\n\nEl enlace vence el ${expirationDate}.\n\nCompletar la informacion no implica aprobacion automatica. El equipo de Cobrix Pay revisara los datos y te contactara para continuar el proceso.\n\nContacto: notificaciones@cobrixpay.com`,
  })
  return true
}

function toStoredInvitation(invitation: MerchantOnboardingInvitation & { token: string }): MerchantOnboardingInvitation {
  return {
    id: invitation.id,
    tokenHash: invitation.tokenHash,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    sentAt: invitation.sentAt,
    resentAt: invitation.resentAt,
    revokedAt: invitation.revokedAt,
    createdBy: invitation.createdBy,
    email: invitation.email,
  }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const action = normalizeOptionalString(body.action) || 'create'
    const merchants = await listMerchants()
    const actor = getActor(req)

    if (action === 'create') {
      const name = normalizeOptionalString(body.name)
      const email = normalizeOptionalString(body.email).toLowerCase()
      const whatsapp = normalizeOptionalString(body.whatsapp)
      const slug = normalizeSlug(normalizeOptionalString(body.slug))
      const applicationFeePercent = normalizeApplicationFeePercent(body.applicationFeePercent)
      const salesRepName = normalizeOptionalString(body.salesRepName)
      const source = normalizeOptionalString(body.source)
      const supportEmail = normalizeOptionalString(body.supportEmail)
      const supportPhone = normalizeOptionalString(body.supportPhone)

      if (!name || !email || !whatsapp || !slug) {
        return NextResponse.json({ error: 'Faltan campos para crear la invitacion.' }, { status: 400 })
      }

      if (Number.isNaN(applicationFeePercent)) {
        return NextResponse.json({ error: 'La comision debe ser un numero.' }, { status: 400 })
      }

      if (!isValidSupportEmail(supportEmail)) {
        return NextResponse.json({ error: 'El email publico de consultas no tiene un formato valido.' }, { status: 400 })
      }

      if (!isValidSupportPhone(supportPhone)) {
        return NextResponse.json({ error: 'El telefono publico debe incluir un numero internacional valido.' }, { status: 400 })
      }

      const existingMerchant = merchants[slug]
      const invitation = createInvitation(email, actor)
      const storedInvitation = toStoredInvitation(invitation)
      const merchant: Merchant = {
        ...existingMerchant,
        slug,
        name,
        email,
        notificationEmails: existingMerchant?.notificationEmails || [email],
        whatsapp,
        status: existingMerchant?.status || 'pending_documents',
        archived: existingMerchant?.archived === true,
        archivedReason: existingMerchant?.archivedReason,
        everActive: existingMerchant?.everActive,
        stripeAccountId: existingMerchant?.stripeAccountId,
        applicationFeePercent,
        supportEmail: supportEmail || existingMerchant?.supportEmail,
        supportPhone: supportPhone || existingMerchant?.supportPhone,
        salesRepName: salesRepName || existingMerchant?.salesRepName,
        source: source || existingMerchant?.source,
        onboarding: {
          ...(existingMerchant?.onboarding || getDefaultOnboarding()),
          invitation: storedInvitation,
          progress: existingMerchant?.onboarding?.progress || getDefaultOnboarding().progress,
          timestamps: {
            ...(existingMerchant?.onboarding?.timestamps || {}),
            createdAt: existingMerchant?.onboarding?.timestamps.createdAt || new Date().toISOString(),
          },
        },
        compliance: {
          ...existingMerchant?.compliance,
          documentationPending: true,
        },
        auditHistory: [
          ...(existingMerchant?.auditHistory || []),
          {
            type: 'invitation_created',
            createdAt: new Date().toISOString(),
            actor,
          },
        ],
      }

      if (!isValidStripeAccountId(merchant.stripeAccountId)) {
        delete merchant.stripeAccountId
      }

      const invitationLink = getInvitationLink(invitation.token)
      const emailSent = await sendInvitationEmail(email, name, invitationLink, invitation.expiresAt)
      const sentOnboarding = merchant.onboarding || getDefaultOnboarding(storedInvitation)
      merchant.onboarding = {
        ...sentOnboarding,
        invitation: {
          ...storedInvitation,
          sentAt: emailSent ? new Date().toISOString() : storedInvitation.sentAt,
        },
      }
      merchant.auditHistory = appendAuditEvent(
        merchant,
        emailSent ? 'invitation_sent' : 'invitation_link_generated',
        undefined,
        actor
      )
      await saveMerchant(merchant)

      return NextResponse.json({
        ok: true,
        merchant: sanitizeMerchantForAdmin(merchant),
        invitationLink,
        emailSent,
      })
    }

    const slug = normalizeSlug(normalizeOptionalString(body.slug))
    const merchant = merchants[slug]

    if (!merchant) {
      return NextResponse.json({ error: 'No existe el comercio.' }, { status: 404 })
    }

    if (action === 'revoke') {
      const invitation = merchant.onboarding?.invitation
      if (!invitation) {
        return NextResponse.json({ error: 'El comercio no tiene invitacion activa.' }, { status: 400 })
      }

      const baseOnboarding = merchant.onboarding || getDefaultOnboarding(invitation)
      const updatedMerchant: Merchant = {
        ...merchant,
        onboarding: {
          ...baseOnboarding,
          invitation: {
            ...invitation,
            revokedAt: new Date().toISOString(),
          },
        },
        auditHistory: appendAuditEvent(merchant, 'invitation_revoked', undefined, actor),
      }
      await saveMerchant(updatedMerchant)
      return NextResponse.json({ ok: true, merchant: sanitizeMerchantForAdmin(updatedMerchant) })
    }

    if (action === 'regenerate' || action === 'resend') {
      const invitation = createInvitation(merchant.email, actor)
      const storedInvitation = toStoredInvitation(invitation)
      const invitationLink = getInvitationLink(invitation.token)
      const emailSent = await sendInvitationEmail(merchant.email, merchant.name, invitationLink, invitation.expiresAt)

      const updatedMerchant: Merchant = {
        ...merchant,
        status: merchant.status === 'active' ? merchant.status : 'pending_documents',
        onboarding: {
          ...(merchant.onboarding || getDefaultOnboarding()),
          invitation: {
            ...storedInvitation,
            sentAt: emailSent ? new Date().toISOString() : undefined,
            resentAt: action === 'resend' && emailSent ? new Date().toISOString() : undefined,
          },
        },
        auditHistory: appendAuditEvent(
          merchant,
          action === 'resend' && emailSent
            ? 'invitation_resent'
            : action === 'resend'
            ? 'invitation_link_generated'
            : 'invitation_token_regenerated',
          undefined,
          actor
        ),
      }
      await saveMerchant(updatedMerchant)

      return NextResponse.json({
        ok: true,
        merchant: sanitizeMerchantForAdmin(updatedMerchant),
        invitationLink,
        emailSent,
      })
    }

    return NextResponse.json({ error: 'Accion invalida.' }, { status: 400 })
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
