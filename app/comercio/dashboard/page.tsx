import Stripe from 'stripe'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardActions } from './dashboard-actions'
import { getMerchantFromSession, MERCHANT_SESSION_COOKIE } from '@/lib/merchant-session'
import { getSiteUrl } from '@/lib/site-url'

type MerchantDashboardPageProps = {
  searchParams?: Promise<{
    stripe_error?: string
  }>
}

type MonthlySummary = {
  totalProcessed: number
  paymentCount: number
  averageTicket: number
}

type MonthlyPayment = {
  id: string
  created: number
  amount: number
  status: string
}

type MonthlyDashboardData = {
  summary: MonthlySummary
  payments: MonthlyPayment[]
}

function getPaymentLink(slug: string) {
  return `${getSiteUrl()}/pay/${slug}`
}

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) return null

  return new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover',
  })
}

function getCurrentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)

  return {
    startTimestamp: Math.floor(start.getTime() / 1000),
    endTimestamp: Math.floor(now.getTime() / 1000),
  }
}

function getPaymentStatus(paymentIntent: Stripe.PaymentIntent) {
  const latestCharge =
    typeof paymentIntent.latest_charge === 'object' && paymentIntent.latest_charge ? paymentIntent.latest_charge : null

  if (latestCharge?.refunded || (latestCharge?.amount_refunded || 0) > 0) {
    return 'refunded'
  }

  return paymentIntent.status
}

async function getMonthlyDashboardData(merchantSlug: string, stripeAccountId?: string): Promise<MonthlyDashboardData> {
  const stripe = getStripe()

  if (!stripe || !stripeAccountId) {
    return {
      summary: { totalProcessed: 0, paymentCount: 0, averageTicket: 0 },
      payments: [],
    }
  }

  const { startTimestamp, endTimestamp } = getCurrentMonthRange()
  let totalProcessed = 0
  let paymentCount = 0
  const payments: MonthlyPayment[] = []

  try {
    const paymentIntents = stripe.paymentIntents.list({
      created: {
        gte: startTimestamp,
        lte: endTimestamp,
      },
      expand: ['data.latest_charge'],
      limit: 100,
    })

    for await (const paymentIntent of paymentIntents) {
      const belongsToMerchant =
        paymentIntent.metadata?.merchantSlug === merchantSlug &&
        paymentIntent.transfer_data?.destination === stripeAccountId

      if (paymentIntent.status === 'succeeded' && belongsToMerchant) {
        totalProcessed += paymentIntent.amount_received || paymentIntent.amount
        paymentCount += 1
      }

      if (belongsToMerchant && payments.length < 20) {
        payments.push({
          id: paymentIntent.id,
          created: paymentIntent.created,
          amount: paymentIntent.amount_received || paymentIntent.amount,
          status: getPaymentStatus(paymentIntent),
        })
      }
    }
  } catch {
    return {
      summary: { totalProcessed: 0, paymentCount: 0, averageTicket: 0 },
      payments: [],
    }
  }

  return {
    summary: {
      totalProcessed,
      paymentCount,
      averageTicket: paymentCount > 0 ? Math.round(totalProcessed / paymentCount) : 0,
    },
    payments,
  }
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function formatPaymentDate(timestamp: number) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(timestamp * 1000))
}

function formatPaymentTime(timestamp: number) {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000))
}

function translatePaymentStatus(status: string) {
  if (status === 'succeeded') return 'Pagado'
  if (status === 'pending' || status === 'processing' || status === 'requires_confirmation' || status === 'requires_action') {
    return 'Pendiente'
  }
  if (status === 'requires_payment_method' || status === 'canceled') return 'Fallido'
  if (status === 'refunded') return 'Reembolsado'

  return 'Pendiente'
}

function getStripeErrorMessage(error?: string) {
  if (error === 'missing_account') {
    return 'Tu comercio todavia no tiene una cuenta Stripe conectada.'
  }

  if (error === 'login_link_failed') {
    return 'No pudimos abrir tu cuenta Stripe. Intentalo nuevamente en unos minutos.'
  }

  return ''
}

export default async function MerchantDashboardPage({ searchParams }: MerchantDashboardPageProps) {
  const params = await searchParams
  const stripeErrorMessage = getStripeErrorMessage(params?.stripe_error)
  const cookieStore = await cookies()
  const merchant = await getMerchantFromSession(cookieStore.get(MERCHANT_SESSION_COOKIE)?.value)

  if (!merchant) {
    redirect('/login')
  }

  const paymentLink = getPaymentLink(merchant.slug)
  const hasStripeAccount = Boolean(merchant.stripeAccountId)
  const monthlyData = await getMonthlyDashboardData(merchant.slug, merchant.stripeAccountId)
  const monthlySummary = monthlyData.summary

  return (
    <main style={pageStyle}>
      <section style={shellStyle}>
        <header style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>Portal del Comercio</p>
            <h1 style={pageTitleStyle}>{merchant.name}</h1>
          </div>
          <div style={headerMetricStyle}>
            <span style={headerMetricLabelStyle}>Cobrado este mes</span>
            <strong style={headerMetricValueStyle}>{formatCurrency(monthlySummary.totalProcessed)}</strong>
          </div>
        </header>

        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>Gu&iacute;a inicial</p>
              <h2 style={sectionTitleStyle}>Primeros pasos</h2>
            </div>
            <p style={sectionDescriptionStyle}>Prepar&aacute; Cobrix Pay para cobrar desde el celular y compartir tu QR.</p>
          </div>

          <div style={stepsGridStyle}>
            <div style={stepStyle}>
              <span style={stepIconStyle}>&#10003;</span>
              <div>
                <h3 style={stepTitleStyle}>Instalar Cobrix Pay</h3>
                <p style={stepTextStyle}>Agreg&aacute; el portal a la pantalla de inicio para abrirlo como una app.</p>
              </div>
            </div>
            <div style={stepStyle}>
              <span style={stepIconStyle}>&#10003;</span>
              <div>
                <h3 style={stepTitleStyle}>Descargar el QR</h3>
                <p style={stepTextStyle}>Guard&aacute; el QR en PDF o PNG para imprimirlo o tenerlo siempre a mano.</p>
              </div>
            </div>
            <div style={stepStyle}>
              <span style={stepIconStyle}>&#10003;</span>
              <div>
                <h3 style={stepTitleStyle}>Compartir el enlace</h3>
                <p style={stepTextStyle}>Copi&aacute; el link permanente y envialo por WhatsApp, redes o email.</p>
              </div>
            </div>
            <div style={stepStyle}>
              <span style={stepIconStyle}>&#10003;</span>
              <div>
                <h3 style={stepTitleStyle}>Realizar un cobro de prueba</h3>
                <p style={stepTextStyle}>Prob&aacute; el flujo completo para confirmar que tu comercio ya puede cobrar.</p>
              </div>
            </div>
          </div>
        </section>

          <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Bloque 1</p>
                <h2 style={sectionTitleStyle}>Resumen</h2>
              </div>
              <p style={sectionDescriptionStyle}>Desde el 1 del mes actual hasta hoy.</p>
            </div>

            <div style={summaryGridStyle}>
              <div style={summaryCardStyle}>
                <p style={summaryLabelStyle}>Total procesado</p>
                <strong style={summaryValueStyle}>{formatCurrency(monthlySummary.totalProcessed)}</strong>
              </div>
              <div style={summaryCardStyle}>
                <p style={summaryLabelStyle}>Cantidad de cobros</p>
                <strong style={summaryValueStyle}>{monthlySummary.paymentCount}</strong>
              </div>
              <div style={summaryCardStyle}>
                <p style={summaryLabelStyle}>Ticket promedio</p>
                <strong style={summaryValueStyle}>{formatCurrency(monthlySummary.averageTicket)}</strong>
              </div>
            </div>
          </section>

          <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Bloque 2</p>
                <h2 style={sectionTitleStyle}>Cobrar</h2>
              </div>
              <p style={sectionDescriptionStyle}>Us&aacute; tu QR permanente o compart&iacute; el enlace de pago del comercio.</p>
            </div>
            <DashboardActions merchantName={merchant.name} paymentLink={paymentLink} />
          </section>

          <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Bloque 3</p>
                <h2 style={sectionTitleStyle}>Actividad</h2>
              </div>
              <p style={sectionDescriptionStyle}>Consult&aacute; los cobros registrados durante el mes actual.</p>
            </div>

            {monthlyData.payments.length > 0 ? (
              <div style={{ marginTop: 16, overflowX: 'auto' }}>
                <table style={paymentsTableStyle}>
                  <thead>
                    <tr>
                      <th style={paymentsHeaderCellStyle}>Fecha</th>
                      <th style={paymentsHeaderCellStyle}>Hora</th>
                      <th style={paymentsHeaderCellStyle}>Monto</th>
                      <th style={paymentsHeaderCellStyle}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td style={paymentsCellStyle}>{formatPaymentDate(payment.created)}</td>
                        <td style={paymentsCellStyle}>{formatPaymentTime(payment.created)}</td>
                        <td style={paymentsCellStyle}>{formatCurrency(payment.amount)}</td>
                        <td style={paymentsCellStyle}>{translatePaymentStatus(payment.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ margin: '14px 0 0', color: '#5b6275' }}>
                Todav&iacute;a no registr&aacute;s cobros este mes.
                <br />
                Cuando recibas tu primer pago aparecer&aacute; aqu&iacute;.
              </p>
            )}
          </section>

          <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Bloque 4</p>
                <h2 style={sectionTitleStyle}>Mi Cuenta</h2>
              </div>
              <p style={sectionDescriptionStyle}>Acced&eacute; a la configuraci&oacute;n operativa de tu comercio.</p>
            </div>

            {!hasStripeAccount && (
              <p style={accountNoticeStyle}>Complet&aacute; la configuraci&oacute;n de Stripe para poder recibir pagos.</p>
            )}

            {stripeErrorMessage && (
              <p role="alert" style={accountErrorStyle}>
                {stripeErrorMessage}
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
              {hasStripeAccount && (
                <a href="/api/stripe/express-login" style={primaryLinkStyle}>
                  Ver mi cuenta Stripe
                </a>
              )}
              {!hasStripeAccount && (
                <a
                  href={process.env.NEXT_PUBLIC_STRIPE_ONBOARDING_URL || 'mailto:notificaciones@cobrixpay.com?subject=Completar alta Stripe'}
                  style={secondaryLinkStyle}
                >
                  Completar alta Stripe
                </a>
              )}
            </div>
          </section>
      </section>
    </main>
  )
}

const pageStyle = {
  minHeight: '100vh',
  padding: '32px 16px',
  background: '#f5f7fb',
  color: '#171717',
} satisfies React.CSSProperties

const shellStyle = {
  width: '100%',
  maxWidth: 1100,
  margin: '0 auto',
} satisfies React.CSSProperties

const headerStyle = {
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  marginBottom: 18,
} satisfies React.CSSProperties

const pageTitleStyle = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.15,
} satisfies React.CSSProperties

const headerMetricStyle = {
  minWidth: 240,
  padding: 18,
  border: '1px solid #d7dce9',
  borderRadius: 8,
  background: '#151a2d',
  color: '#fff',
} satisfies React.CSSProperties

const headerMetricLabelStyle = {
  display: 'block',
  color: '#cbd5e1',
  fontSize: 13,
  fontWeight: 700,
} satisfies React.CSSProperties

const headerMetricValueStyle = {
  display: 'block',
  marginTop: 8,
  fontSize: 30,
  lineHeight: 1.1,
} satisfies React.CSSProperties

const sectionStyle = {
  marginTop: 16,
  padding: 24,
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  background: '#fff',
  boxShadow: '0 10px 30px rgba(23, 23, 23, 0.04)',
} satisfies React.CSSProperties

const sectionHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  marginBottom: 18,
} satisfies React.CSSProperties

const eyebrowStyle = {
  margin: 0,
  color: '#5b6275',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
} satisfies React.CSSProperties

const sectionTitleStyle = {
  margin: '4px 0 0',
  fontSize: 24,
  lineHeight: 1.2,
} satisfies React.CSSProperties

const sectionDescriptionStyle = {
  maxWidth: 360,
  margin: 0,
  color: '#5b6275',
  lineHeight: 1.5,
} satisfies React.CSSProperties

const stepsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
} satisfies React.CSSProperties

const stepStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: 16,
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  background: '#fbfcff',
} satisfies React.CSSProperties

const stepIconStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  flex: '0 0 28px',
  borderRadius: 999,
  background: '#11a36a',
  color: '#fff',
  fontWeight: 800,
} satisfies React.CSSProperties

const stepTitleStyle = {
  margin: 0,
  fontSize: 16,
  lineHeight: 1.3,
} satisfies React.CSSProperties

const stepTextStyle = {
  margin: '6px 0 0',
  color: '#5b6275',
  lineHeight: 1.45,
} satisfies React.CSSProperties

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
  marginTop: 16,
} satisfies React.CSSProperties

const summaryCardStyle = {
  padding: 16,
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  background: '#fff',
} satisfies React.CSSProperties

const summaryLabelStyle = {
  margin: 0,
  color: '#5b6275',
  fontWeight: 700,
} satisfies React.CSSProperties

const summaryValueStyle = {
  display: 'block',
  marginTop: 8,
  fontSize: 28,
  lineHeight: 1.2,
} satisfies React.CSSProperties

const paymentsTableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 520,
} satisfies React.CSSProperties

const paymentsHeaderCellStyle = {
  padding: '10px 8px',
  borderBottom: '1px solid #e2e5ee',
  color: '#5b6275',
  fontSize: 14,
  textAlign: 'left',
} satisfies React.CSSProperties

const paymentsCellStyle = {
  padding: '12px 8px',
  borderBottom: '1px solid #eef1f7',
  textAlign: 'left',
} satisfies React.CSSProperties

const accountNoticeStyle = {
  margin: 0,
  padding: 14,
  border: '1px solid #f3d08a',
  borderRadius: 8,
  background: '#fff8e6',
  color: '#7a4b00',
  fontWeight: 700,
} satisfies React.CSSProperties

const accountErrorStyle = {
  margin: '14px 0 0',
  padding: 14,
  border: '1px solid #f0b7c1',
  borderRadius: 8,
  background: '#fff5f7',
  color: '#b00020',
  fontWeight: 700,
} satisfies React.CSSProperties

const primaryLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '10px 14px',
  borderRadius: 8,
  background: '#635bff',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties

const secondaryLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '10px 14px',
  border: '1px solid #cfd4e2',
  borderRadius: 8,
  background: '#fff',
  color: '#171717',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties
