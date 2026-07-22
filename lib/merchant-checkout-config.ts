import { type Merchant } from './merchants'

export const DEFAULT_CHECKOUT_CURRENCY = 'usd'

export function getMerchantCheckoutCurrency(merchant: Merchant) {
  void merchant
  return DEFAULT_CHECKOUT_CURRENCY
}

export function isValidCheckoutCurrency(currency: string | undefined) {
  return /^[a-z]{3}$/.test(currency || '')
}

export function getCheckoutAmountMinorUnits(amount: number, currency: string) {
  if (!Number.isFinite(amount) || amount <= 0) return null
  if (!isValidCheckoutCurrency(currency)) return null

  return Math.round(amount * 100)
}
