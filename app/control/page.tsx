import Stripe from 'stripe'
import { AlertTriangle, ArrowUpRight, BarChart3, BriefcaseBusiness, Building2, Gauge, Target, TrendingUp } from 'lucide-react'
import { listMerchants, type Merchant } from '@/lib/merchants'
import { formatStripeMoney, getStripeCurrencyCode } from '@/lib/stripe-money'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

const MONTHLY_MARGIN_GOAL_USD = 30000
const ACTIVE_MERCHANTS_GOAL = 25
const BUSINESS_TIME_ZONE = 'America/Argentina/Buenos_Aires'
const INDEPENDENT_STRIPE_FEE_CATEGORIES = new Set(['stripe_fee', 'stripe_fx_fee', 'tax_fee'])

type CurrencyTotals = Record<string, number>

type FinancialMetrics = {
  grossVolume: CurrencyTotals
  refunds: CurrencyTotals
  netVolume: CurrencyTotals
  applicationFees: CurrencyTotals
  applicationFeeRefunds: CurrencyTotals
  cobrixNetFees: CurrencyTotals
  stripeCosts: CurrencyTotals
  marginAfterStripe: CurrencyTotals
  successfulPayments: number
  refundedOperations: number
}

type MerchantMetrics = FinancialMetrics & {
  totalKnownPayments: number
  lastActivityAt?: number
}

type PlatformMetrics = FinancialMetrics & {
  unallocatedStripeCosts: CurrencyTotals
}

type MerchantRow = Merchant & MerchantMetrics

type Opportunity = {
  title: string
  description: string
}

type PeriodRange = {
  currentStart: number
  currentEnd: number
  previousStart: number
  previousComparableEnd: number
}

type StripeCollectionResult = {
  metrics: Map<string, MerchantMetrics>
  platform: PlatformMetrics
  previousPlatform: PlatformMetrics
  hasStripeData: boolean
  updatedAt?: Date
}

function emptyFinancialMetrics(): FinancialMetrics {
  return {
    grossVolume: {},
    refunds: {},
    netVolume: {},
    applicationFees: {},
    applicationFeeRefunds: {},
    cobrixNetFees: {},
    stripeCosts: {},
    marginAfterStripe: {},
    successfulPayments: 0,
    refundedOperations: 0,
  }
}

function emptyMerchantMetrics(): MerchantMetrics {
  return {
    ...emptyFinancialMetrics(),
    totalKnownPayments: 0,
  }
}

function emptyPlatformMetrics(): PlatformMetrics {
  return {
    ...emptyFinancialMetrics(),
    unallocatedStripeCosts: {},
  }
}

function normalizeCurrency(currency: string) {
  return currency.trim().toLowerCase()
}

function addCurrency(totals: CurrencyTotals, currency: string, amount: number) {
  const normalized = normalizeCurrency(currency)
  totals[normalized] = (totals[normalized] || 0) + amount
}

function subtractTotals(left: CurrencyTotals, right: CurrencyTotals) {
  const result: CurrencyTotals = {}
  const currencies = new Set([...Object.keys(left), ...Object.keys(right)])

  for (const currency of currencies) {
    const amount = (left[currency] || 0) - (right[currency] || 0)
    if (amount !== 0) result[currency] = amount
  }

  return result
}

function currencyEntries(totals: CurrencyTotals) {
  return Object.entries(totals)
    .filter(([, amount]) => amount !== 0)
    .sort(([left], [right]) => getStripeCurrencyCode(left).localeCompare(getStripeCurrencyCode(right)))
}

function formatCurrencyLines(totals: CurrencyTotals, emptyLabel = 'Sin movimientos') {
  const entries = currencyEntries(totals)
  if (entries.length === 0) return [{ key: 'empty', value: emptyLabel }]

  return entries.map(([currency, amount]) => ({
    key: currency,
    value: formatStripeMoney(amount, currency),
  }))
}

function formatInteger(value: number) {
  return new Intl.NumberFormat('es-AR').format(value)
}

function formatPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatUpdatedAt(date?: Date) {
  if (!date) return 'Datos de Stripe no disponibles'

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function getBusinessDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function argentinaLocalToUtcTimestamp(year: number, monthIndex: number, day: number, hour = 0, minute = 0, second = 0) {
  return Math.floor(Date.UTC(year, monthIndex, day, hour + 3, minute, second) / 1000)
}

function getPeriodRanges(): PeriodRange {
  const now = new Date()
  const businessNow = getBusinessDateParts(now)
  const currentStart = argentinaLocalToUtcTimestamp(businessNow.year, businessNow.month - 1, 1)
  const currentEnd = Math.floor(now.getTime() / 1000)
  const previousStart = argentinaLocalToUtcTimestamp(businessNow.year, businessNow.month - 2, 1)
  const elapsedSeconds = Math.max(0, currentEnd - currentStart)

  return {
    currentStart,
    currentEnd,
    previousStart,
    previousComparableEnd: previousStart + elapsedSeconds,
  }
}

function getObjectId(value: string | { id: string } | null | undefined) {
  if (!value) return undefined
  return typeof value === 'string' ? value : value.id
}

function getExpandedPaymentIntent(value: string | Stripe.PaymentIntent | null | undefined) {
  return value && typeof value !== 'string' ? value : undefined
}

function getExpandedCharge(value: string | Stripe.Charge | null | undefined) {
  return value && typeof value !== 'string' ? value : undefined
}

function getChargeFromPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  return getExpandedCharge(paymentIntent.latest_charge)
}

function isSucceededRefund(refund: Stripe.Refund) {
  return refund.status === 'succeeded'
}

function isInRange(timestamp: number, start: number, end: number) {
  return timestamp >= start && timestamp < end
}

function getStripeCostAmount(balanceTransaction: Stripe.BalanceTransaction) {
  if (balanceTransaction.fee > 0) return balanceTransaction.fee

  const isIndependentStripeFee =
    INDEPENDENT_STRIPE_FEE_CATEGORIES.has(balanceTransaction.type) ||
    INDEPENDENT_STRIPE_FEE_CATEGORIES.has(balanceTransaction.reporting_category)

  if (isIndependentStripeFee && balanceTransaction.net < 0) {
    return -balanceTransaction.net
  }

  return 0
}

function addActivity(metrics: MerchantMetrics, timestamp: number) {
  metrics.lastActivityAt = Math.max(metrics.lastActivityAt || 0, timestamp)
}

function recomputeDerivedFinancials(metrics: FinancialMetrics) {
  metrics.netVolume = subtractTotals(metrics.grossVolume, metrics.refunds)
  metrics.cobrixNetFees = subtractTotals(metrics.applicationFees, metrics.applicationFeeRefunds)
  metrics.marginAfterStripe = subtractTotals(metrics.cobrixNetFees, metrics.stripeCosts)
}

function recomputePlatformDerived(platform: PlatformMetrics) {
  recomputeDerivedFinancials(platform)
  platform.marginAfterStripe = subtractTotals(platform.cobrixNetFees, platform.stripeCosts)
}

function getMerchantByStripeAccount(merchants: Merchant[]) {
  const byAccount = new Map<string, Merchant>()

  for (const merchant of merchants) {
    if (merchant.stripeAccountId) byAccount.set(merchant.stripeAccountId, merchant)
  }

  return byAccount
}

function getMerchantBySlug(merchants: Merchant[]) {
  return new Map(merchants.map((merchant) => [merchant.slug, merchant]))
}

function findPaymentIntentMerchant(
  paymentIntent: Stripe.PaymentIntent,
  merchantsBySlug: Map<string, Merchant>,
  merchantsByAccount: Map<string, Merchant>
) {
  const metadataMerchant = paymentIntent.metadata?.merchantSlug
  if (metadataMerchant && merchantsBySlug.has(metadataMerchant)) return merchantsBySlug.get(metadataMerchant)

  const destination = getObjectId(paymentIntent.transfer_data?.destination)
  if (destination && merchantsByAccount.has(destination)) return merchantsByAccount.get(destination)

  return undefined
}

async function collectStripeMetrics(merchants: Merchant[]): Promise<StripeCollectionResult> {
  const metrics = new Map(merchants.map((merchant) => [merchant.slug, emptyMerchantMetrics()]))
  const platform = emptyPlatformMetrics()
  const previousPlatform = emptyPlatformMetrics()
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!stripeSecretKey) return { metrics, platform, previousPlatform, hasStripeData: false }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-02-25.clover' })
  const ranges = getPeriodRanges()
  const merchantsBySlug = getMerchantBySlug(merchants)
  const merchantsByAccount = getMerchantByStripeAccount(merchants)
  const sourceMerchantSlug = new Map<string, string>()
  const paymentIntentCache = new Map<string, Stripe.PaymentIntent>()

  function rememberSource(sourceId: string | undefined, merchant: Merchant | undefined) {
    if (sourceId && merchant) sourceMerchantSlug.set(sourceId, merchant.slug)
  }

  function addGrossPayment(paymentIntent: Stripe.PaymentIntent, periodMetrics: FinancialMetrics, merchantMetrics?: MerchantMetrics) {
    if (paymentIntent.status !== 'succeeded') return

    const amount = paymentIntent.amount_received || paymentIntent.amount || 0
    if (amount <= 0) return

    addCurrency(periodMetrics.grossVolume, paymentIntent.currency, amount)
    periodMetrics.successfulPayments += 1

    if (merchantMetrics) {
      addCurrency(merchantMetrics.grossVolume, paymentIntent.currency, amount)
      merchantMetrics.successfulPayments += 1
      merchantMetrics.totalKnownPayments += 1
      addActivity(merchantMetrics, paymentIntent.created)
    }
  }

  async function getPaymentIntent(id: string) {
    if (paymentIntentCache.has(id)) return paymentIntentCache.get(id)

    const paymentIntent = await stripe.paymentIntents.retrieve(id, {
      expand: ['latest_charge'],
    })
    paymentIntentCache.set(id, paymentIntent)
    return paymentIntent
  }

  async function findRefundMerchant(refund: Stripe.Refund) {
    const expandedPaymentIntent = getExpandedPaymentIntent(refund.payment_intent)
    if (expandedPaymentIntent) {
      paymentIntentCache.set(expandedPaymentIntent.id, expandedPaymentIntent)
      return findPaymentIntentMerchant(expandedPaymentIntent, merchantsBySlug, merchantsByAccount)
    }

    const paymentIntentId = getObjectId(refund.payment_intent)
    if (paymentIntentId) {
      const paymentIntent = await getPaymentIntent(paymentIntentId)
      if (paymentIntent) return findPaymentIntentMerchant(paymentIntent, merchantsBySlug, merchantsByAccount)
    }

    const charge = getExpandedCharge(refund.charge)
    const chargePaymentIntentId = getObjectId(charge?.payment_intent)
    if (chargePaymentIntentId) {
      const paymentIntent = await getPaymentIntent(chargePaymentIntentId)
      if (paymentIntent) return findPaymentIntentMerchant(paymentIntent, merchantsBySlug, merchantsByAccount)
    }

    return undefined
  }

  function addRefund(refund: Stripe.Refund, periodMetrics: FinancialMetrics, merchantMetrics?: MerchantMetrics) {
    if (!isSucceededRefund(refund) || refund.amount <= 0) return

    addCurrency(periodMetrics.refunds, refund.currency, refund.amount)
    periodMetrics.refundedOperations += 1

    if (merchantMetrics) {
      addCurrency(merchantMetrics.refunds, refund.currency, refund.amount)
      merchantMetrics.refundedOperations += 1
      addActivity(merchantMetrics, refund.created)
    }
  }

  function addApplicationFee(fee: Stripe.ApplicationFee, periodMetrics: FinancialMetrics, merchantMetrics?: MerchantMetrics) {
    if (fee.amount <= 0) return

    addCurrency(periodMetrics.applicationFees, fee.currency, fee.amount)

    if (merchantMetrics) {
      addCurrency(merchantMetrics.applicationFees, fee.currency, fee.amount)
      addActivity(merchantMetrics, fee.created)
    }
  }

  function addApplicationFeeRefund(
    fee: Stripe.ApplicationFee,
    refund: Stripe.FeeRefund,
    periodMetrics: FinancialMetrics,
    merchantMetrics?: MerchantMetrics
  ) {
    if (refund.amount <= 0) return

    addCurrency(periodMetrics.applicationFeeRefunds, fee.currency, refund.amount)

    if (merchantMetrics) {
      addCurrency(merchantMetrics.applicationFeeRefunds, fee.currency, refund.amount)
      addActivity(merchantMetrics, refund.created)
    }
  }

  async function loadPayments(start: number, end: number, periodMetrics: FinancialMetrics, includeMerchantRows: boolean) {
    for await (const paymentIntent of stripe.paymentIntents.list({
      created: { gte: start, lt: end },
      expand: ['data.latest_charge'],
      limit: 100,
    })) {
      if (paymentIntent.status !== 'succeeded') continue

      paymentIntentCache.set(paymentIntent.id, paymentIntent)
      const merchant = findPaymentIntentMerchant(paymentIntent, merchantsBySlug, merchantsByAccount)
      if (!merchant) continue

      const merchantMetrics = includeMerchantRows && merchant ? metrics.get(merchant.slug) : undefined
      const charge = getChargeFromPaymentIntent(paymentIntent)

      rememberSource(paymentIntent.id, merchant)
      rememberSource(charge?.id, merchant)
      rememberSource(getObjectId(charge?.balance_transaction), merchant)
      addGrossPayment(paymentIntent, periodMetrics, merchantMetrics)
    }
  }

  async function loadRefunds(start: number, end: number, periodMetrics: FinancialMetrics, includeMerchantRows: boolean) {
    for await (const refund of stripe.refunds.list({
      created: { gte: start, lt: end },
      expand: ['data.charge', 'data.payment_intent'],
      limit: 100,
    })) {
      if (!isSucceededRefund(refund)) continue

      const merchant = await findRefundMerchant(refund)
      if (!merchant) continue

      const merchantMetrics = includeMerchantRows && merchant ? metrics.get(merchant.slug) : undefined

      rememberSource(refund.id, merchant)
      rememberSource(getObjectId(refund.balance_transaction), merchant)
      rememberSource(getObjectId(refund.transfer_reversal), merchant)
      rememberSource(getObjectId(refund.source_transfer_reversal), merchant)
      addRefund(refund, periodMetrics, merchantMetrics)
    }
  }

  async function findApplicationFeeMerchant(fee: Stripe.ApplicationFee) {
    const accountId = getObjectId(fee.account)
    if (accountId && merchantsByAccount.has(accountId)) return merchantsByAccount.get(accountId)

    const charge = getExpandedCharge(fee.charge)
    const chargePaymentIntentId = getObjectId(charge?.payment_intent)
    if (chargePaymentIntentId) {
      const paymentIntent = await getPaymentIntent(chargePaymentIntentId)
      if (paymentIntent) return findPaymentIntentMerchant(paymentIntent, merchantsBySlug, merchantsByAccount)
    }

    return undefined
  }

  async function loadApplicationFees(start: number, end: number, periodMetrics: FinancialMetrics, includeMerchantRows: boolean) {
    for await (const fee of stripe.applicationFees.list({
      created: { gte: start, lt: end },
      expand: ['data.charge', 'data.balance_transaction'],
      limit: 100,
    })) {
      const merchant = await findApplicationFeeMerchant(fee)
      if (!merchant) continue

      const merchantMetrics = includeMerchantRows && merchant ? metrics.get(merchant.slug) : undefined

      rememberSource(fee.id, merchant)
      rememberSource(getObjectId(fee.balance_transaction), merchant)
      addApplicationFee(fee, periodMetrics, merchantMetrics)
    }
  }

  async function loadApplicationFeeRefunds(start: number, end: number, periodMetrics: FinancialMetrics, includeMerchantRows: boolean) {
    for await (const fee of stripe.applicationFees.list({
      created: { lt: end },
      expand: ['data.charge'],
      limit: 100,
    })) {
      const merchant = await findApplicationFeeMerchant(fee)
      if (!merchant) continue

      const merchantMetrics = includeMerchantRows && merchant ? metrics.get(merchant.slug) : undefined

      for await (const feeRefund of stripe.applicationFees.listRefunds(fee.id, { limit: 100 })) {
        if (!isInRange(feeRefund.created, start, end)) continue

        rememberSource(feeRefund.id, merchant)
        rememberSource(getObjectId(feeRefund.balance_transaction), merchant)
        addApplicationFeeRefund(fee, feeRefund, periodMetrics, merchantMetrics)
      }
    }
  }

  async function loadStripeCosts(start: number, end: number, periodMetrics: PlatformMetrics, includeMerchantRows: boolean) {
    for await (const balanceTransaction of stripe.balanceTransactions.list({
      created: { gte: start, lt: end },
      limit: 100,
    })) {
      const stripeCostAmount = getStripeCostAmount(balanceTransaction)
      if (stripeCostAmount <= 0) continue

      addCurrency(periodMetrics.stripeCosts, balanceTransaction.currency, stripeCostAmount)

      const sourceId = getObjectId(balanceTransaction.source)
      const sourceSlug = sourceId ? sourceMerchantSlug.get(sourceId) : undefined
      const balanceTransactionSlug = sourceMerchantSlug.get(balanceTransaction.id)
      const merchantMetrics = includeMerchantRows
        ? metrics.get(sourceSlug || balanceTransactionSlug || '')
        : undefined

      if (merchantMetrics) {
        addCurrency(merchantMetrics.stripeCosts, balanceTransaction.currency, stripeCostAmount)
      } else {
        addCurrency(periodMetrics.unallocatedStripeCosts, balanceTransaction.currency, stripeCostAmount)
      }
    }
  }

  try {
    await loadPayments(ranges.currentStart, ranges.currentEnd, platform, true)
    await loadRefunds(ranges.currentStart, ranges.currentEnd, platform, true)
    await loadApplicationFees(ranges.currentStart, ranges.currentEnd, platform, true)
    await loadApplicationFeeRefunds(ranges.currentStart, ranges.currentEnd, platform, true)
    await loadStripeCosts(ranges.currentStart, ranges.currentEnd, platform, true)

    await loadPayments(ranges.previousStart, ranges.previousComparableEnd, previousPlatform, false)
    await loadRefunds(ranges.previousStart, ranges.previousComparableEnd, previousPlatform, false)
    await loadApplicationFees(ranges.previousStart, ranges.previousComparableEnd, previousPlatform, false)
    await loadApplicationFeeRefunds(ranges.previousStart, ranges.previousComparableEnd, previousPlatform, false)
    await loadStripeCosts(ranges.previousStart, ranges.previousComparableEnd, previousPlatform, false)

    for (const merchantMetrics of metrics.values()) {
      recomputeDerivedFinancials(merchantMetrics)
    }

    recomputePlatformDerived(platform)
    recomputePlatformDerived(previousPlatform)

    return { metrics, platform, previousPlatform, hasStripeData: true, updatedAt: new Date() }
  } catch (error) {
    console.error('No se pudieron cargar datos reales de Stripe para Centro de Control:', {
      message: error instanceof Error ? error.message : 'Error desconocido',
    })
    return { metrics, platform, previousPlatform, hasStripeData: false }
  }
}

function buildOpportunities(rows: MerchantRow[]): Opportunity[] {
  const nowSeconds = Date.now() / 1000
  const thirtyDaysSeconds = 30 * 24 * 60 * 60
  const opportunities: Opportunity[] = []

  for (const merchant of rows) {
    if (opportunities.length >= 5) break

    if (merchant.status === 'active' && merchant.totalKnownPayments === 0) {
      opportunities.push({
        title: `${merchant.name} no tuvo pagos exitosos`,
        description: 'Puede ser buen momento para revisar activacion, QR visible y primer cobro asistido.',
      })
      continue
    }

    if (merchant.lastActivityAt && nowSeconds - merchant.lastActivityAt > thirtyDaysSeconds) {
      opportunities.push({
        title: `${merchant.name} lleva 30 dias sin actividad`,
        description: 'Conviene contactar al comercio y entender si necesita soporte operativo o comercial.',
      })
    }
  }

  return opportunities
}

function usdMinorUnitsFrom(totals: CurrencyTotals) {
  return totals.usd || 0
}

export default async function ControlPage() {
  const merchantsRecord = await listMerchants()
  const merchants = Object.values(merchantsRecord)
  const { metrics, platform, previousPlatform, hasStripeData, updatedAt } = await collectStripeMetrics(merchants)
  const rows: MerchantRow[] = merchants.map((merchant) => ({ ...merchant, ...(metrics.get(merchant.slug) || emptyMerchantMetrics()) }))

  const activeMerchants = rows.filter((merchant) => merchant.status === 'active').length
  const activeMerchantsWithActivity = rows.filter((merchant) => merchant.successfulPayments > 0 || merchant.refundedOperations > 0).length
  const activeProgress = Math.min(100, (activeMerchants / ACTIVE_MERCHANTS_GOAL) * 100)
  const marginUsd = usdMinorUnitsFrom(platform.marginAfterStripe)
  const goalProgress = Math.min(100, (marginUsd / 100 / MONTHLY_MARGIN_GOAL_USD) * 100)
  const previousMarginUsd = usdMinorUnitsFrom(previousPlatform.marginAfterStripe)
  const marginVariation = previousMarginUsd !== 0 ? ((marginUsd - previousMarginUsd) / Math.abs(previousMarginUsd)) * 100 : null
  const opportunities = buildOpportunities(rows)

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1>Centro de Control</h1>
          <p>Datos financieros reales agrupados desde Stripe</p>
        </div>
        <div className={styles.headerStatus}>
          <span>PROVISORIO</span>
          <strong>Datos en vivo de Stripe</strong>
          <small>Actualizado con Stripe: {formatUpdatedAt(updatedAt)}</small>
        </div>
      </header>

      {!hasStripeData && (
        <section className={styles.unavailableCard}>
          <AlertTriangle size={22} aria-hidden="true" />
          <div>
            <strong>Datos de Stripe no disponibles</strong>
            <p>No se muestran ceros estimados porque los importes financieros deben provenir de Stripe.</p>
          </div>
        </section>
      )}

      <section className={styles.copilotCard}>
        <div className={styles.copilotIcon}>
          <TrendingUp size={28} aria-hidden="true" />
        </div>
        <div>
          <p className={styles.eyebrow}>Copiloto Empresarial</p>
          <h2>Buen dia, Martin.</h2>
          <p className={styles.copilotText}>
            Este mes Cobrix Pay muestra un margen despues de Stripe provisorio de{' '}
            {hasStripeData ? formatCurrencyInline(platform.marginAfterStripe) : 'datos no disponibles'}. El objetivo mensual
            usa solo margen efectivo en USD y mantiene otras monedas separadas.
          </p>
          <div className={styles.actionRow}>
            <button type="button">
              <BarChart3 size={18} aria-hidden="true" />
              Ver analisis
            </button>
            <button type="button" className={styles.secondaryButton}>
              <ArrowUpRight size={18} aria-hidden="true" />
              Ver oportunidades
            </button>
          </div>
        </div>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.sectionTitle}>
            <Gauge size={20} aria-hidden="true" />
            <h2>Estado del negocio</h2>
          </div>
          <div className={styles.metricGrid}>
            <Metric label="Margen despues de Stripe" totals={hasStripeData ? platform.marginAfterStripe : undefined} />
            <Metric label="Comision Cobrix neta" totals={hasStripeData ? platform.cobrixNetFees : undefined} />
            <Metric label="Costos Stripe" totals={hasStripeData ? platform.stripeCosts : undefined} />
            <Metric label="Volumen neto" totals={hasStripeData ? platform.netVolume : undefined} />
          </div>
          <div className={styles.secondaryMetricGrid}>
            <SecondaryMetric label="Volumen bruto" totals={hasStripeData ? platform.grossVolume : undefined} />
            <SecondaryMetric label="Reembolsos" totals={hasStripeData ? platform.refunds : undefined} />
            <SecondaryMetric label="Pagos exitosos" value={hasStripeData ? formatInteger(platform.successfulPayments) : 'Sin datos'} />
            <SecondaryMetric label="Operaciones reembolsadas" value={hasStripeData ? formatInteger(platform.refundedOperations) : 'Sin datos'} />
            <SecondaryMetric label="Comercios habilitados" value={formatInteger(activeMerchants)} />
            <SecondaryMetric label="Comercios con actividad" value={hasStripeData ? formatInteger(activeMerchantsWithActivity) : 'Sin datos'} />
          </div>
          {marginVariation === null ? (
            <p className={styles.emptyText}>
              No hay datos suficientes para comparar el mismo periodo transcurrido del mes anterior sin producir una
              variacion enganosa.
            </p>
          ) : (
            <p className={marginVariation >= 0 ? styles.positiveText : styles.warningText}>
              Variacion del margen USD frente al mismo periodo del mes anterior: {formatPercent(marginVariation)}.
            </p>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionTitle}>
            <Target size={20} aria-hidden="true" />
            <h2>Objetivos</h2>
          </div>
          <Progress
            label="Objetivo mensual de margen despues de Stripe: USD 30.000"
            value={hasStripeData ? goalProgress : 0}
            caption={hasStripeData ? formatStripeMoney(marginUsd, 'usd') : 'Sin datos de Stripe'}
          />
          <Progress label="Comercios habilitados" value={activeProgress} caption={`${activeMerchants}/${ACTIVE_MERCHANTS_GOAL}`} />
          {currencyEntries(platform.unallocatedStripeCosts).length > 0 && hasStripeData && (
            <div className={styles.unallocatedBox}>
              <span>Costos no asignados</span>
              <CurrencyLines totals={platform.unallocatedStripeCosts} />
            </div>
          )}
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionTitle}>
          <BriefcaseBusiness size={20} aria-hidden="true" />
          <h2>Oportunidades</h2>
        </div>
        {opportunities.length === 0 ? (
          <p className={styles.emptyText}>No hay oportunidades detectadas en este momento.</p>
        ) : (
          <div className={styles.opportunityList}>
            {opportunities.map((opportunity) => (
              <article key={opportunity.title} className={styles.opportunity}>
                <div>
                  <h3>{opportunity.title}</h3>
                  <p>{opportunity.description}</p>
                </div>
                <button type="button">Ver detalle</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.milestone}>
        <span>Estado del resultado</span>
        <strong>PROVISORIO</strong>
        <p>El margen puede cambiar por reembolsos, disputas, ajustes y costos posteriores informados por Stripe.</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionTitle}>
          <Building2 size={20} aria-hidden="true" />
          <h2>Comercios</h2>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Ciudad</th>
                <th>Pais</th>
                <th>Origen</th>
                <th>Vendedor</th>
                <th>Partner Comercial</th>
                <th>Comision configurada</th>
                <th>Volumen bruto</th>
                <th>Reembolsos</th>
                <th>Volumen neto</th>
                <th>Comision Cobrix neta</th>
                <th>Costos Stripe</th>
                <th>Margen despues de Stripe</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((merchant) => (
                <tr key={merchant.slug}>
                  <td>
                    <strong>{merchant.name}</strong>
                    <span>{merchant.slug}</span>
                  </td>
                  <td>{merchant.city || ''}</td>
                  <td>{merchant.country || ''}</td>
                  <td>{merchant.source || ''}</td>
                  <td>{merchant.salesRepName || ''}</td>
                  <td>{merchant.commercialPartnerName || ''}</td>
                  <td>{merchant.applicationFeePercent || 0}%</td>
                  <td><CurrencyLines totals={hasStripeData ? merchant.grossVolume : undefined} /></td>
                  <td><CurrencyLines totals={hasStripeData ? merchant.refunds : undefined} /></td>
                  <td><CurrencyLines totals={hasStripeData ? merchant.netVolume : undefined} /></td>
                  <td><CurrencyLines totals={hasStripeData ? merchant.cobrixNetFees : undefined} /></td>
                  <td><CurrencyLines totals={hasStripeData ? merchant.stripeCosts : undefined} /></td>
                  <td><CurrencyLines totals={hasStripeData ? merchant.marginAfterStripe : undefined} /></td>
                  <td>
                    <a href="/merchants/admin">Gestionar</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function formatCurrencyInline(totals: CurrencyTotals) {
  const entries = currencyEntries(totals)
  if (entries.length === 0) return 'sin movimientos'

  return entries.map(([currency, amount]) => formatStripeMoney(amount, currency)).join(' / ')
}

function CurrencyLines({ totals }: { totals?: CurrencyTotals }) {
  if (!totals) return <span className={styles.noData}>Sin datos</span>

  return (
    <span className={styles.currencyLines}>
      {formatCurrencyLines(totals).map((line) => (
        <span key={line.key}>{line.value}</span>
      ))}
    </span>
  )
}

function Metric({ label, totals }: { label: string; totals?: CurrencyTotals }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>
        <CurrencyLines totals={totals} />
      </strong>
    </div>
  )
}

function SecondaryMetric({ label, totals, value }: { label: string; totals?: CurrencyTotals; value?: string }) {
  return (
    <div className={styles.secondaryMetric}>
      <span>{label}</span>
      <strong>{value || <CurrencyLines totals={totals} />}</strong>
    </div>
  )
}

function Progress({ label, value, caption }: { label: string; value: number; caption: string }) {
  return (
    <div className={styles.progressBlock}>
      <div>
        <span>{label}</span>
        <strong>{caption}</strong>
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}
