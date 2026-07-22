const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
])

export function getStripeCurrencyCode(currency: string) {
  return currency.trim().toUpperCase()
}

export function getStripeCurrencyDivisor(currency: string) {
  return STRIPE_ZERO_DECIMAL_CURRENCIES.has(currency.trim().toLowerCase()) ? 1 : 100
}

export function formatStripeMoney(amount: number, currency: string) {
  const normalizedCurrency = getStripeCurrencyCode(currency)

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: normalizedCurrency,
    currencyDisplay: 'code',
  }).format(amount / getStripeCurrencyDivisor(currency))
}
