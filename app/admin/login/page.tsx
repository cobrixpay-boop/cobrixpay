import { loginAdmin } from './actions'

type AdminLoginPageProps = {
  searchParams?: Promise<{
    error?: string
  }>
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = await searchParams
  const hasError = params?.error === '1'

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem 1rem',
        background: '#f6f7fb',
        color: '#171717',
      }}
    >
      <form
        action={loginAdmin}
        style={{
          width: '100%',
          maxWidth: 380,
          padding: 24,
          border: '1px solid #e2e5ee',
          borderRadius: 8,
          background: '#fff',
          boxShadow: '0 10px 30px rgba(23, 23, 23, 0.08)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2 }}>Admin Cobrix Pay</h1>

        <label htmlFor="password" style={{ display: 'block', marginTop: 24, fontWeight: 600 }}>
          Contrase&ntilde;a
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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

        {hasError && (
          <p role="alert" style={{ margin: '12px 0 0', color: '#b00020' }}>
            Contrase&ntilde;a incorrecta
          </p>
        )}

        <button
          type="submit"
          style={{
            width: '100%',
            marginTop: 20,
            padding: '12px 16px',
            border: 0,
            borderRadius: 8,
            background: '#635bff',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Ingresar
        </button>
      </form>
    </main>
  )
}
