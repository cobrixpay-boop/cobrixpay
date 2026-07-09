import Link from 'next/link'
import { getMerchantBySlug } from '@/lib/merchants'

const DEFAULT_POST_PAYMENT_URL = '/landing'

type SuccessPageProps = {
  searchParams?: Promise<{
    merchant?: string
  }>
}

function isValidPostPaymentUrl(value?: string) {
  if (!value) return false

  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams
  const merchant = await getMerchantBySlug(params?.merchant)
  const merchantPostPaymentUrl = merchant?.postPaymentUrl
  const postPaymentUrl: string =
    merchantPostPaymentUrl && isValidPostPaymentUrl(merchantPostPaymentUrl)
      ? merchantPostPaymentUrl
      : DEFAULT_POST_PAYMENT_URL

  return (
    <div style={{
      padding: '3rem 1rem',
      maxWidth: '500px',
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textAlign: 'center',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <div style={{
        fontSize: '4rem',
        marginBottom: '1rem',
      }}>
        OK
      </div>

      <h1 style={{ color: '#1a1a1a', marginBottom: '1rem' }}>Pago completado</h1>

      <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '2rem', lineHeight: '1.5' }}>
        El comercio fue notificado y recibiras una confirmacion por email si ingresaste tu correo durante el pago.
      </p>

      <Link href={postPaymentUrl} style={{
        textDecoration: 'none',
        color: 'white',
        background: '#635bff',
        padding: '12px 24px',
        borderRadius: '8px',
        fontWeight: 'bold',
        display: 'inline-block',
      }}>
        Finalizar
      </Link>
    </div>
  )
}
