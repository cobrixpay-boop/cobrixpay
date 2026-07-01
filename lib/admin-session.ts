export const ADMIN_SESSION_COOKIE = 'admin_session'

const SESSION_MESSAGE = 'cobrix-pay-admin-session-v1'

function toBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createAdminSessionValue(adminToken: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(adminToken),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(SESSION_MESSAGE))

  return toBase64Url(new Uint8Array(signature))
}

export async function isValidAdminSession(sessionValue: string | undefined) {
  const adminToken = process.env.ADMIN_TOKEN

  if (!adminToken || !sessionValue) return false

  const expectedValue = await createAdminSessionValue(adminToken)

  return sessionValue === expectedValue
}
