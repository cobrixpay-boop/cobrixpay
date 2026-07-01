const TEMPORARY_SITE_URL_FALLBACK = 'https://cobrixpay.vercel.app'

export function getSiteUrl() {
  return (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || TEMPORARY_SITE_URL_FALLBACK).replace(/\/$/, '')
}
