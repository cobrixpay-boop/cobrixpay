import Link from 'next/link'
import { FixedPaymentForm } from './FixedPaymentForm'
import { canMerchantAcceptPayments, getMerchantBySlug } from '@/lib/merchants'
import { getPaymentLinkById, isPaymentLinkExpired } from '@/lib/payment-links'
import { formatStripeMoney, getStripeCurrencyCode } from '@/lib/stripe-money'

type FixedPaymentPageProps = {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <p style={eyebrowStyle}>Cobrix Pay</p>
        <h1 style={titleStyle}>{title}</h1>
        <p style={textStyle}>{text}</p>
        <Link href="/landing" style={secondaryLinkStyle}>
          Volver
        </Link>
      </section>
    </main>
  )
}

export default async function FixedPaymentPage({ params }: FixedPaymentPageProps) {
  const { id } = await params
  const paymentLink = await getPaymentLinkById(id)

  if (!paymentLink) {
    return <Notice title="Link inválido" text="No encontramos un link de pago válido para esta operación." />
  }

  if (paymentLink.status === 'paid') {
    return <Notice title="Link ya pagado" text="Este link ya fue utilizado para un cobro exitoso." />
  }

  if (paymentLink.status === 'expired' || isPaymentLinkExpired(paymentLink)) {
    return <Notice title="Link vencido" text="Este link de pago venció. Pedile al comercio que genere uno nuevo." />
  }

  const merchant = await getMerchantBySlug(paymentLink.merchantSlug)

  if (!merchant || !canMerchantAcceptPayments(merchant)) {
    return <Notice title="Comercio no disponible" text="Este comercio todavía no está habilitado para recibir pagos." />
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <p style={eyebrowStyle}>Cobrix Pay</p>
        <h1 style={titleStyle}>{merchant.name}</h1>
        {paymentLink.concept && <p style={conceptStyle}>{paymentLink.concept}</p>}

        <div style={amountBlockStyle}>
          <span style={amountLabelStyle}>Importe fijado por el comercio</span>
          <strong style={amountStyle}>{formatStripeMoney(paymentLink.amount, paymentLink.currency)}</strong>
          <span style={currencyStyle}>Moneda: {getStripeCurrencyCode(paymentLink.currency)}</span>
        </div>

        <p style={textStyle}>Vence el {formatDate(paymentLink.expiresAt)}.</p>
        <FixedPaymentForm paymentLinkId={paymentLink.id} />
      </section>
    </main>
  )
}

const pageStyle = {
  minHeight: '100vh',
  padding: '2rem 1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f5f7fb',
  color: '#171717',
  fontFamily: 'system-ui, -apple-system, sans-serif',
} satisfies React.CSSProperties

const cardStyle = {
  width: '100%',
  maxWidth: 440,
  padding: 24,
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  background: '#fff',
  boxShadow: '0 18px 45px rgba(23, 23, 23, 0.08)',
  textAlign: 'center',
} satisfies React.CSSProperties

const eyebrowStyle = {
  margin: 0,
  color: '#5b6275',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
} satisfies React.CSSProperties

const titleStyle = {
  margin: '8px 0 0',
  fontSize: 28,
  lineHeight: 1.15,
} satisfies React.CSSProperties

const conceptStyle = {
  margin: '12px 0 0',
  color: '#374151',
  lineHeight: 1.5,
} satisfies React.CSSProperties

const amountBlockStyle = {
  margin: '18px 0',
  padding: 16,
  border: '1px solid #d7dce9',
  borderRadius: 8,
  background: '#fbfcff',
} satisfies React.CSSProperties

const amountLabelStyle = {
  display: 'block',
  color: '#5b6275',
  fontSize: 13,
  fontWeight: 800,
} satisfies React.CSSProperties

const amountStyle = {
  display: 'block',
  marginTop: 8,
  fontSize: 32,
  lineHeight: 1.1,
  overflowWrap: 'anywhere',
} satisfies React.CSSProperties

const currencyStyle = {
  display: 'block',
  marginTop: 8,
  color: '#5b6275',
  fontWeight: 700,
} satisfies React.CSSProperties

const textStyle = {
  margin: '14px 0',
  color: '#5b6275',
  lineHeight: 1.5,
} satisfies React.CSSProperties

const secondaryLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '10px 14px',
  border: '1px solid #cfd4e2',
  borderRadius: 8,
  background: '#fff',
  color: '#171717',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties
