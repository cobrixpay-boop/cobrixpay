import Stripe from 'stripe'
import { type Merchant } from './merchants'

export type MerchantMonthlySummary = {
  totalsByCurrency: Record<string, number>
  approvedPaymentCount: number
  averageTicketByCurrency: Record<string, number>
}

export type MerchantMonthlyPayment = {
  id: string
  created: number
  amount: number
  currency: string
  status: string
}

export type MerchantMonthlyDashboardData = {
  summary: MerchantMonthlySummary
  payments: MerchantMonthlyPayment[]
}

export type MerchantPayout = {
  id: string
  amount: number
  currency: string
  arrivalDate: number
  status: string
}

export type NextPayoutResult =
  | { status: 'ok'; payout: MerchantPayout | null }
  | { status: 'missing_stripe' }
  | { status: 'error' }

export type MerchantMonthlyReportData = {
  payouts: MerchantPayout[]
  sales: MerchantMonthlyPayment[]
  salesSummary: MerchantMonthlySummary
  refundedPaymentCount: number
}

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) return null

  return new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover',
  })
}

export function getMonthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0))
  const end = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0))

  return {
    startTimestamp: Math.floor(start.getTime() / 1000),
    endTimestamp: Math.floor(end.getTime() / 1000),
  }
}

export function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function isValidMonthKey(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false

  const [year, monthNumber] = month.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, monthNumber - 1, 1))

  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === monthNumber - 1
}

export function getPaymentStatus(paymentIntent: Stripe.PaymentIntent) {
  const latestCharge =
    typeof paymentIntent.latest_charge === 'object' && paymentIntent.latest_charge ? paymentIntent.latest_charge : null

  if (latestCharge?.refunded || (latestCharge?.amount_refunded || 0) > 0) {
    return 'refunded'
  }

  return paymentIntent.status
}

function belongsToMerchant(paymentIntent: Stripe.PaymentIntent, merchant: Merchant) {
  return (
    paymentIntent.metadata?.merchantSlug === merchant.slug &&
    paymentIntent.transfer_data?.destination === merchant.stripeAccountId
  )
}

function emptyMonthlyData(): MerchantMonthlyDashboardData {
  return {
    summary: { totalsByCurrency: {}, approvedPaymentCount: 0, averageTicketByCurrency: {} },
    payments: [],
  }
}

function summarizeSales(payments: MerchantMonthlyPayment[]): MerchantMonthlySummary {
  const approvedPayments = payments.filter((payment) => payment.status === 'succeeded')
  const totalsByCurrency: Record<string, number> = {}
  const countsByCurrency: Record<string, number> = {}

  approvedPayments.forEach((payment) => {
    const currency = payment.currency.toLowerCase()
    totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + payment.amount
    countsByCurrency[currency] = (countsByCurrency[currency] || 0) + 1
  })

  return {
    totalsByCurrency,
    approvedPaymentCount: approvedPayments.length,
    averageTicketByCurrency: Object.fromEntries(
      Object.entries(totalsByCurrency).map(([currency, total]) => [
        currency,
        Math.round(total / (countsByCurrency[currency] || 1)),
      ])
    ),
  }
}

export async function getMonthlyDashboardData(merchant: Merchant): Promise<MerchantMonthlyDashboardData> {
  const stripe = getStripe()

  if (!stripe || !merchant.stripeAccountId) return emptyMonthlyData()

  const { startTimestamp, endTimestamp } = getMonthRange(getCurrentMonthKey())
  const payments: MerchantMonthlyPayment[] = []
  const summaryPayments: MerchantMonthlyPayment[] = []

  try {
    const paymentIntents = stripe.paymentIntents.list({
      created: {
        gte: startTimestamp,
        lt: endTimestamp,
      },
      expand: ['data.latest_charge'],
      limit: 100,
    })

    for await (const paymentIntent of paymentIntents) {
      if (!belongsToMerchant(paymentIntent, merchant)) continue

      const payment = {
        id: paymentIntent.id,
        created: paymentIntent.created,
        amount: paymentIntent.amount_received || paymentIntent.amount,
        currency: paymentIntent.currency,
        status: getPaymentStatus(paymentIntent),
      }

      summaryPayments.push(payment)

      if (payments.length < 20) {
        payments.push(payment)
      }
    }
  } catch {
    return emptyMonthlyData()
  }

  return {
    summary: summarizeSales(summaryPayments),
    payments,
  }
}

function toMerchantPayout(payout: Stripe.Payout): MerchantPayout {
  return {
    id: payout.id,
    amount: payout.amount,
    currency: payout.currency,
    arrivalDate: payout.arrival_date,
    status: payout.status,
  }
}

export async function getNextMerchantPayout(stripeAccountId?: string): Promise<NextPayoutResult> {
  const stripe = getStripe()

  if (!stripe || !stripeAccountId) return { status: 'missing_stripe' }

  try {
    const payouts = await stripe.payouts.list(
      {
        limit: 100,
      },
      {
        stripeAccount: stripeAccountId,
      }
    )
    const nextPayout =
      payouts.data
        .filter((payout) => payout.status === 'pending' || payout.status === 'in_transit')
        .sort((a, b) => a.arrival_date - b.arrival_date)[0] || null

    return { status: 'ok', payout: nextPayout ? toMerchantPayout(nextPayout) : null }
  } catch {
    return { status: 'error' }
  }
}

export async function getMonthlyReportData(merchant: Merchant, month: string): Promise<MerchantMonthlyReportData> {
  const stripe = getStripe()
  const { startTimestamp, endTimestamp } = getMonthRange(month)

  if (!stripe || !merchant.stripeAccountId) {
    return {
      payouts: [],
      sales: [],
      salesSummary: { totalsByCurrency: {}, approvedPaymentCount: 0, averageTicketByCurrency: {} },
      refundedPaymentCount: 0,
    }
  }

  const payouts: MerchantPayout[] = []
  const sales: MerchantMonthlyPayment[] = []

  const payoutList = stripe.payouts.list(
    {
      arrival_date: {
        gte: startTimestamp,
        lt: endTimestamp,
      },
      limit: 100,
    },
    {
      stripeAccount: merchant.stripeAccountId,
    }
  )

  for await (const payout of payoutList) {
    if (payout.status === 'paid') {
      payouts.push(toMerchantPayout(payout))
    }
  }

  const paymentIntents = stripe.paymentIntents.list({
    created: {
      gte: startTimestamp,
      lt: endTimestamp,
    },
    expand: ['data.latest_charge'],
    limit: 100,
  })

  for await (const paymentIntent of paymentIntents) {
    if (!belongsToMerchant(paymentIntent, merchant)) continue

    sales.push({
      id: paymentIntent.id,
      created: paymentIntent.created,
      amount: paymentIntent.amount_received || paymentIntent.amount,
      currency: paymentIntent.currency,
      status: getPaymentStatus(paymentIntent),
    })
  }

  return {
    payouts: payouts.sort((a, b) => a.arrivalDate - b.arrivalDate),
    sales: sales.sort((a, b) => b.created - a.created),
    salesSummary: summarizeSales(sales),
    refundedPaymentCount: sales.filter((payment) => payment.status === 'refunded').length,
  }
}
