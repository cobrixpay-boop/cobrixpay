export type UserRole = 'FOUNDER' | 'MERCHANT'

export type FounderUser = {
  email: string
  role: 'FOUNDER'
}

export const FOUNDER_EMAIL = 'martin@cobrixpay.com'

export function normalizeEmail(email?: string) {
  return String(email || '').trim().toLowerCase()
}

export function getFounderByEmail(email?: string): FounderUser | undefined {
  if (normalizeEmail(email) !== FOUNDER_EMAIL) return undefined

  return {
    email: FOUNDER_EMAIL,
    role: 'FOUNDER',
  }
}
