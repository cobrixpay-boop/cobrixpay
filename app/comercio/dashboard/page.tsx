import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardActions } from './dashboard-actions'
import { MonthlyReportActions } from './monthly-report-actions'
import { getMerchantFromSession, MERCHANT_SESSION_COOKIE } from '@/lib/merchant-session'
import { canMerchantAcceptPayments, type MerchantStatus } from '@/lib/merchants'
import { getMerchantCheckoutCurrency } from '@/lib/merchant-checkout-config'
import {
  getCurrentMonthKey,
  getMonthlyDashboardData,
  getNextMerchantPayout,
  type MerchantMonthlySummary,
  type NextPayoutResult,
} from '@/lib/merchant-stripe-data'
import { formatStripeMoney } from '@/lib/stripe-money'
import { getSiteUrl } from '@/lib/site-url'

type MerchantDashboardPageProps = {
  searchParams?: Promise<{
    stripe_error?: string
  }>
}

function getPaymentLink(slug: string) {
  return `${getSiteUrl()}/pay/${slug}`
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

function formatPayoutDate(timestamp: number) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(timestamp * 1000))
}

function formatMonthTitle(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)

  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
  }).format(new Date(year, month - 1, 1))
}

function getMonthOptions() {
  const now = new Date()

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = new Intl.DateTimeFormat('es-AR', {
      month: 'long',
      year: 'numeric',
    }).format(date)

    return { value, label }
  })
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

function translatePayoutStatus(status: string) {
  if (status === 'pending') return 'Pendiente'
  if (status === 'in_transit') return 'En tránsito'
  if (status === 'paid') return 'Acreditada'
  if (status === 'failed') return 'Fallida'
  if (status === 'canceled') return 'Cancelada'

  return status
}

function getStripeErrorMessage(error?: string) {
  if (error === 'missing_account') {
    return 'Tu comercio todavía no tiene una cuenta Stripe conectada.'
  }

  if (error === 'login_link_failed') {
    return 'No pudimos abrir tu cuenta Stripe. Intentalo nuevamente en unos minutos.'
  }

  return ''
}

function translateMerchantStatus(status: MerchantStatus) {
  if (status === 'pending_documents') return 'Documentación pendiente'
  if (status === 'under_review') return 'En revisión'
  if (status === 'active') return 'Activo'
  if (status === 'suspended') return 'Suspendido'
  return 'Rechazado'
}

function formatCurrencyGroup(values: Record<string, number>, fallbackCurrency: string) {
  const entries = Object.entries(values)

  if (entries.length === 0) return formatStripeMoney(0, fallbackCurrency)

  return entries.map(([currency, amount]) => formatStripeMoney(amount, currency)).join(' / ')
}

function renderNextPayout(result: NextPayoutResult) {
  if (result.status === 'error') {
    return (
      <>
        <strong style={summaryValueStyle}>Sin fecha informada</strong>
        <span style={payoutHelpStyle}>No pudimos consultar la próxima acreditación.</span>
      </>
    )
  }

  if (result.status === 'missing_stripe' || !result.payout) {
    return (
      <>
        <strong style={summaryValueStyle}>Sin fecha informada</strong>
        <span style={payoutHelpStyle}>Stripe todavía no informó una próxima acreditación.</span>
      </>
    )
  }

  return (
    <>
      <strong style={summaryValueStyle}>{formatStripeMoney(result.payout.amount, result.payout.currency)}</strong>
      <span style={payoutHelpStyle}>Moneda: {result.payout.currency.toUpperCase()}</span>
      <span style={payoutHelpStyle}>Fecha: {formatPayoutDate(result.payout.arrivalDate)}</span>
      <span style={statusPillStyle}>{translatePayoutStatus(result.payout.status)}</span>
    </>
  )
}

function renderAverageTicket(summary: MerchantMonthlySummary, fallbackCurrency: string) {
  return formatCurrencyGroup(summary.averageTicketByCurrency, fallbackCurrency)
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
  const canAcceptPayments = canMerchantAcceptPayments(merchant)
  const checkoutCurrency = getMerchantCheckoutCurrency(merchant)
  const [monthlyData, nextPayout] = await Promise.all([
    getMonthlyDashboardData(merchant),
    getNextMerchantPayout(merchant.stripeAccountId),
  ])
  const currentMonth = getCurrentMonthKey()
  const currentMonthLabel = formatMonthTitle(currentMonth)

  return (
    <main style={pageStyle}>
      <section style={shellStyle}>
        <header style={headerStyle}>
          <div style={titleBlockStyle}>
            <p style={eyebrowStyle}>Portal del comercio</p>
            <h1 style={pageTitleStyle}>{merchant.name}</h1>
          </div>
        </header>

        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Ventas de {currentMonthLabel}</h2>
            </div>
            <p style={sectionDescriptionStyle}>
              Ventas en la moneda original del cobro. Las acreditaciones bancarias usan la moneda informada por Stripe.
            </p>
          </div>

          <div style={summaryGridStyle}>
            <div style={summaryCardStyle}>
              <p style={summaryLabelStyle}>Ventas del mes</p>
              <strong style={summaryValueStyle}>{formatCurrencyGroup(monthlyData.summary.totalsByCurrency, checkoutCurrency)}</strong>
            </div>
            <div style={summaryCardStyle}>
              <p style={summaryLabelStyle}>Cobros aprobados</p>
              <strong style={summaryValueStyle}>{monthlyData.summary.approvedPaymentCount}</strong>
            </div>
            <div style={summaryCardStyle}>
              <p style={summaryLabelStyle}>Ticket promedio</p>
              <strong style={summaryValueStyle}>{renderAverageTicket(monthlyData.summary, checkoutCurrency)}</strong>
            </div>
            <div style={payoutSummaryCardStyle}>
              <p style={summaryLabelStyle}>Próxima acreditación</p>
              {renderNextPayout(nextPayout)}
            </div>
          </div>
        </section>

        <details style={detailsStyle}>
          <summary style={detailsSummaryStyle}>Primeros pasos</summary>
          <div style={stepsGridStyle}>
            <div style={stepStyle}>
              <span style={stepIconStyle}>1</span>
              <div>
                <h3 style={stepTitleStyle}>Instalar Cobrix Pay</h3>
                <p style={stepTextStyle}>Agregá el portal a la pantalla de inicio para abrirlo como una app.</p>
              </div>
            </div>
            <div style={stepStyle}>
              <span style={stepIconStyle}>2</span>
              <div>
                <h3 style={stepTitleStyle}>Descargar el QR</h3>
                <p style={stepTextStyle}>Guardá el QR en PDF o PNG para imprimirlo o tenerlo siempre a mano.</p>
              </div>
            </div>
            <div style={stepStyle}>
              <span style={stepIconStyle}>3</span>
              <div>
                <h3 style={stepTitleStyle}>Compartir el enlace</h3>
                <p style={stepTextStyle}>Copiá el link permanente y envialo por WhatsApp, redes o email.</p>
              </div>
            </div>
            <div style={stepStyle}>
              <span style={stepIconStyle}>4</span>
              <div>
                <h3 style={stepTitleStyle}>Realizar un cobro de prueba</h3>
                <p style={stepTextStyle}>Probá el flujo completo para confirmar que tu comercio ya puede cobrar.</p>
              </div>
            </div>
          </div>
        </details>

        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Cobrar con Cobrix Pay</h2>
            </div>
            <p style={sectionDescriptionStyle}>Usá tu QR permanente o compartí el enlace de pago del comercio.</p>
          </div>
          {!canAcceptPayments && (
            <p style={accountNoticeStyle}>
              Tu cuenta figura como {translateMerchantStatus(merchant.status)}. El enlace de pago se habilitará cuando
              Cobrix Pay complete la revisión y active el comercio.
            </p>
          )}
          {canAcceptPayments && (
            <DashboardActions merchantName={merchant.name} paymentLink={paymentLink} checkoutCurrency={checkoutCurrency} />
          )}
        </section>

        <section style={sectionStyle}>
          <div style={salesHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Últimas ventas</h2>
              <p style={{ ...sectionDescriptionStyle, marginTop: 8 }}>
                Consultá los cobros registrados durante el mes actual.
              </p>
            </div>
            <MonthlyReportActions months={getMonthOptions()} />
          </div>

          {monthlyData.payments.length > 0 ? (
            <div style={tableScrollStyle}>
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
                      <td style={paymentsCellStyle}>{formatStripeMoney(payment.amount, payment.currency)}</td>
                      <td style={paymentsCellStyle}>{translatePaymentStatus(payment.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={emptyStateStyle}>
              Todavía no registrás cobros este mes.
              <br />
              Cuando recibas tu primer pago aparecerá aquí.
            </p>
          )}
        </section>

        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Mi comercio</h2>
            </div>
            <p style={sectionDescriptionStyle}>Accedé a la configuración operativa de tu comercio.</p>
          </div>

          {!hasStripeAccount && (
            <p style={accountNoticeStyle}>Completá la configuración de Stripe para poder recibir pagos.</p>
          )}

          {stripeErrorMessage && (
            <p role="alert" style={accountErrorStyle}>
              {stripeErrorMessage}
            </p>
          )}

          <div style={accountActionsStyle}>
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
  padding: '28px 14px',
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
  gap: 16,
  alignItems: 'stretch',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  marginBottom: 16,
} satisfies React.CSSProperties

const titleBlockStyle = {
  flex: '1 1 300px',
  minWidth: 0,
} satisfies React.CSSProperties

const pageTitleStyle = {
  margin: 0,
  fontSize: 'clamp(28px, 5vw, 38px)',
  lineHeight: 1.12,
} satisfies React.CSSProperties

const sectionStyle = {
  marginTop: 14,
  padding: 'clamp(16px, 3vw, 24px)',
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
  marginBottom: 16,
} satisfies React.CSSProperties

const salesHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
  marginBottom: 16,
} satisfies React.CSSProperties

const eyebrowStyle = {
  margin: 0,
  color: '#5b6275',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
} satisfies React.CSSProperties

const sectionTitleStyle = {
  margin: 0,
  fontSize: 'clamp(21px, 4vw, 26px)',
  lineHeight: 1.2,
} satisfies React.CSSProperties

const sectionDescriptionStyle = {
  maxWidth: 430,
  margin: 0,
  color: '#5b6275',
  lineHeight: 1.5,
} satisfies React.CSSProperties

const detailsStyle = {
  marginTop: 14,
  padding: '16px clamp(16px, 3vw, 24px)',
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  background: '#fff',
  boxShadow: '0 10px 30px rgba(23, 23, 23, 0.04)',
} satisfies React.CSSProperties

const detailsSummaryStyle = {
  cursor: 'pointer',
  fontSize: 20,
  fontWeight: 800,
} satisfies React.CSSProperties

const stepsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  gap: 12,
  marginTop: 16,
} satisfies React.CSSProperties

const stepStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: 14,
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
  background: '#eef2ff',
  color: '#1455d9',
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(158px, 1fr))',
  gap: 12,
  marginTop: 16,
} satisfies React.CSSProperties

const summaryCardStyle = {
  minWidth: 0,
  padding: 16,
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  background: '#fff',
} satisfies React.CSSProperties

const payoutSummaryCardStyle = {
  ...summaryCardStyle,
  border: '1px solid #b9c6ff',
  boxShadow: 'inset 4px 0 0 #635bff',
} satisfies React.CSSProperties

const summaryLabelStyle = {
  margin: 0,
  color: '#5b6275',
  fontWeight: 700,
} satisfies React.CSSProperties

const summaryValueStyle = {
  display: 'block',
  marginTop: 8,
  fontSize: 'clamp(22px, 4vw, 28px)',
  lineHeight: 1.2,
  overflowWrap: 'anywhere',
} satisfies React.CSSProperties

const payoutHelpStyle = {
  display: 'block',
  marginTop: 6,
  color: '#475569',
  fontSize: 14,
  lineHeight: 1.4,
} satisfies React.CSSProperties

const statusPillStyle = {
  display: 'inline-flex',
  marginTop: 8,
  padding: '5px 9px',
  borderRadius: 999,
  background: '#e8f5e9',
  color: '#1b5e20',
  fontSize: 12,
  fontWeight: 800,
} satisfies React.CSSProperties

const tableScrollStyle = {
  marginTop: 16,
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
} satisfies React.CSSProperties

const paymentsTableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 540,
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

const emptyStateStyle = {
  margin: '14px 0 0',
  color: '#5b6275',
  lineHeight: 1.5,
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

const accountActionsStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 18,
} satisfies React.CSSProperties

const primaryLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
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
  minHeight: 44,
  padding: '10px 14px',
  border: '1px solid #cfd4e2',
  borderRadius: 8,
  background: '#fff',
  color: '#171717',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties
