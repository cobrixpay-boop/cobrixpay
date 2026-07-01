'use client'

import { useActionState } from 'react'
import { requestMerchantLogin } from './actions'
import type { MerchantLoginState } from './actions'

const initialState: MerchantLoginState = {
  status: 'idle',
  message: '',
}

export default function MerchantLoginPage() {
  const [state, formAction, pending] = useActionState(requestMerchantLogin, initialState)

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem 1rem',
        background: '#f5f7fb',
        color: '#171717',
      }}
    >
      <form
        action={formAction}
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 24,
          border: '1px solid #e2e5ee',
          borderRadius: 8,
          background: '#fff',
          boxShadow: '0 10px 30px rgba(23, 23, 23, 0.08)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2 }}>Acceso comercios</h1>

        <label htmlFor="email" style={{ display: 'block', marginTop: 24, fontWeight: 600 }}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          style={{
            width: '100%',
            marginTop: 8,
            padding: 12,
            border: '1px solid #cfd4e2',
            borderRadius: 8,
            fontSize: 16,
          }}
        />

        <button
          type="submit"
          disabled={pending}
          style={{
            width: '100%',
            marginTop: 20,
            padding: '12px 16px',
            border: 0,
            borderRadius: 8,
            background: '#151a2d',
            color: '#fff',
            cursor: pending ? 'not-allowed' : 'pointer',
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {pending ? 'Enviando...' : 'Enviar enlace'}
        </button>

        {state.status === 'success' && (
          <p role="status" style={{ margin: '14px 0 0', color: '#1b5e20' }}>
            {state.message}
          </p>
        )}

        {state.status === 'not_found' && (
          <div role="alert" style={{ marginTop: 14 }}>
            <p style={{ margin: 0, color: '#b00020', fontWeight: 700 }}>{state.message}</p>
            <p style={{ margin: '8px 0 0', color: '#5b6275' }}>
              Verific&aacute; que est&eacute; bien escrito o contactanos para ayudarte.
            </p>
            <a
              href="https://wa.me/5491158809679"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#25d366',
                color: '#102116',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              Contactar por WhatsApp
            </a>
          </div>
        )}
      </form>
    </main>
  )
}
