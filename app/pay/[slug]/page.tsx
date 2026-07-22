import { canMerchantAcceptPayments, getMerchantBySlug } from '@/lib/merchants'
import { PayForm } from './PayForm'
import { getMerchantCheckoutCurrency } from '@/lib/merchant-checkout-config'

type PayPageProps = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ amount?: string }>
}

export const dynamic = 'force-dynamic'

export default async function PayPage({ params, searchParams }: PayPageProps) {
  const { slug } = await params
  const query = await searchParams
  const merchant = await getMerchantBySlug(slug)

  if (!merchant || !canMerchantAcceptPayments(merchant)) {
    return (
      <div style={pageStyle}>
        <h1 style={brandStyle}>Cobrix Pay</h1>
        <section style={noticeStyle}>
          <p style={eyebrowStyle}>Cuenta en preparacion</p>
          <h2 style={titleStyle}>Este comercio todavia no esta habilitado para recibir pagos.</h2>
          <p style={textStyle}>
            La cuenta esta siendo revisada por Cobrix Pay. Cuando el alta quede aprobada, el enlace de pago volvera a
            estar disponible.
          </p>
        </section>
      </div>
    )
  }

  return <PayForm slug={merchant.slug} initialAmount={query?.amount || ''} currency={getMerchantCheckoutCurrency(merchant)} />
}

const pageStyle = {
  padding: '2rem 1rem',
  maxWidth: '520px',
  margin: '0 auto',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  textAlign: 'center',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  color: '#171717',
} satisfies React.CSSProperties

const brandStyle = {
  color: '#1455d9',
  marginBottom: '1.5rem',
} satisfies React.CSSProperties

const noticeStyle = {
  border: '1px solid #d7dce9',
  borderRadius: 8,
  padding: 24,
  background: '#fff',
  boxShadow: '0 18px 45px rgba(23, 23, 23, 0.08)',
} satisfies React.CSSProperties

const eyebrowStyle = {
  margin: 0,
  color: '#5b6275',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
} satisfies React.CSSProperties

const titleStyle = {
  margin: '10px 0 0',
  fontSize: 24,
  lineHeight: 1.2,
} satisfies React.CSSProperties

const textStyle = {
  margin: '14px 0 0',
  color: '#5b6275',
  lineHeight: 1.5,
} satisfies React.CSSProperties
