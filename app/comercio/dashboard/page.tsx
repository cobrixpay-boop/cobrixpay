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
    <main style={{ minHeight: '100vh', padding: '32px 16px', background: '#f5f7fb', color: '#171717' }}>
      <section style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}>
        <div style={dashboardCardStyle}>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.2 }}>{merchant.name}</h1>

          <section style={summarySectionStyle}>
            <div>
              <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>Resumen mensual</h2>
              <p style={{ margin: '6px 0 0', color: '#5b6275' }}>Desde el 1 del mes actual hasta hoy</p>
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

          <section style={paymentsSectionStyle}>
            <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>Cobros del mes</h2>

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

          {!hasStripeAccount && (
            <p style={{ margin: '18px 0 0', color: '#7a4b00', fontWeight: 700 }}>
              Completá la configuración de Stripe para poder recibir pagos.
            </p>
          )}

          <DashboardActions merchantName={merchant.name} paymentLink={paymentLink} />

          {stripeErrorMessage && (
            <p role="alert" style={{ margin: '18px 0 0', color: '#b00020', fontWeight: 700 }}>
              {stripeErrorMessage}
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
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
        </div>
      </section>
    </main>
  )
}

const dashboardCardStyle = {
  padding: 28,
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  background: '#fff',
  boxShadow: '0 10px 30px rgba(23, 23, 23, 0.05)',
} satisfies React.CSSProperties

const summarySectionStyle = {
  marginTop: 24,
  padding: 20,
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  background: '#fbfcff',
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
  fontSize: 24,
  lineHeight: 1.2,
} satisfies React.CSSProperties

const paymentsSectionStyle = {
  marginTop: 18,
  padding: 20,
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  background: '#fff',
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
