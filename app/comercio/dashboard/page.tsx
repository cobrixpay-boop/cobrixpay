import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardActions } from './dashboard-actions'
import { getMerchantFromSession, MERCHANT_SESSION_COOKIE } from '@/lib/merchant-session'
import { getSiteUrl } from '@/lib/site-url'

function getPaymentLink(slug: string) {
  return `${getSiteUrl()}/pay/${slug}`
}

function getStripeDashboardUrl(stripeAccountId: string) {
  return `https://dashboard.stripe.com/connect/accounts/${stripeAccountId}`
}

function shouldShowStripeOnboarding(status?: string, stripeAccountId?: string) {
  return !stripeAccountId || status === 'pending' || status === 'incomplete'
}

export default async function MerchantDashboardPage() {
  const cookieStore = await cookies()
  const merchant = await getMerchantFromSession(cookieStore.get(MERCHANT_SESSION_COOKIE)?.value)

  if (!merchant) {
    redirect('/login')
  }

  const paymentLink = getPaymentLink(merchant.slug)
  const status = merchant.status || 'pending'

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1rem', background: '#f5f7fb', color: '#171717' }}>
      <section style={{ width: '100%', maxWidth: 820, margin: '0 auto' }}>
        <div style={{ padding: 24, border: '1px solid #e2e5ee', borderRadius: 8, background: '#fff' }}>
          <p style={{ margin: 0, color: '#5b6275', fontWeight: 700 }}>Cobrix Pay</p>
          <h1 style={{ margin: '8px 0 0', fontSize: 32, lineHeight: 1.2 }}>{merchant.name}</h1>

          <dl style={{ display: 'grid', gap: 16, margin: '24px 0 0' }}>
            <div>
              <dt style={{ color: '#5b6275', fontWeight: 700 }}>Estado</dt>
              <dd style={{ margin: '6px 0 0' }}>{status}</dd>
            </div>
            <div>
              <dt style={{ color: '#5b6275', fontWeight: 700 }}>Link permanente</dt>
              <dd style={{ margin: '6px 0 0', overflowWrap: 'anywhere' }}>{paymentLink}</dd>
            </div>
          </dl>

          <DashboardActions merchantName={merchant.name} paymentLink={paymentLink} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
            {merchant.stripeAccountId && (
              <a href={getStripeDashboardUrl(merchant.stripeAccountId)} target="_blank" rel="noreferrer" style={primaryLinkStyle}>
                Ver mi cuenta Stripe
              </a>
            )}
            {shouldShowStripeOnboarding(status, merchant.stripeAccountId) && (
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
