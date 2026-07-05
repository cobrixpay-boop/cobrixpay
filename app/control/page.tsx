import Stripe from 'stripe'
import { ArrowUpRight, BarChart3, BriefcaseBusiness, Building2, Gauge, Target, TrendingUp } from 'lucide-react'
import { listMerchants, type Merchant } from '@/lib/merchants'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

const MONTHLY_NET_GOAL = 30000
const ACTIVE_MERCHANTS_GOAL = 25

type MerchantMetrics = {
  monthVolume: number
  monthNet: number
  previousVolume: number
  paymentCount: number
  previousPaymentCount: number
  totalKnownPayments: number
  lastPaymentAt?: number
}

type MerchantRow = Merchant & MerchantMetrics

type Opportunity = {
  title: string
  description: string
}

function centsToUsd(cents: number) {
  return cents / 100
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function getMonthRanges() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousComparableEnd = new Date(now)
  previousComparableEnd.setMonth(now.getMonth() - 1)

  return {
    monthStart: Math.floor(monthStart.getTime() / 1000),
    now: Math.floor(now.getTime() / 1000),
    previousMonthStart: Math.floor(previousMonthStart.getTime() / 1000),
    previousComparableEnd: Math.floor(previousComparableEnd.getTime() / 1000),
  }
}

function emptyMetrics(): MerchantMetrics {
  return {
    monthVolume: 0,
    monthNet: 0,
    previousVolume: 0,
    paymentCount: 0,
    previousPaymentCount: 0,
    totalKnownPayments: 0,
  }
}

function belongsToMerchant(paymentIntent: Stripe.PaymentIntent, merchant: Merchant) {
  return (
    paymentIntent.metadata?.merchantSlug === merchant.slug ||
    Boolean(merchant.stripeAccountId && paymentIntent.transfer_data?.destination === merchant.stripeAccountId)
  )
}

function applyPayment(metrics: MerchantMetrics, merchant: Merchant, paymentIntent: Stripe.PaymentIntent, period: 'month' | 'previous') {
  if (paymentIntent.status !== 'succeeded') return

  const amount = paymentIntent.amount_received || paymentIntent.amount || 0
  const net = Math.round((amount * (merchant.applicationFeePercent || 0)) / 100)

  metrics.totalKnownPayments += 1
  metrics.lastPaymentAt = Math.max(metrics.lastPaymentAt || 0, paymentIntent.created)

  if (period === 'month') {
    metrics.monthVolume += amount
    metrics.monthNet += net
    metrics.paymentCount += 1
    return
  }

  metrics.previousVolume += amount
  metrics.previousPaymentCount += 1
}

async function collectStripeMetrics(merchants: Merchant[]) {
  const metrics = new Map(merchants.map((merchant) => [merchant.slug, emptyMetrics()]))
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!stripeSecretKey) return { metrics, hasStripeData: false }

  const stripe = new Stripe(stripeSecretKey)
  const ranges = getMonthRanges()

  async function loadPeriod(period: 'month' | 'previous', gte: number, lt: number) {
    const paymentIntents = stripe.paymentIntents.list({
      created: { gte, lt },
      limit: 100,
    })

    for await (const paymentIntent of paymentIntents) {
      const merchant = merchants.find((candidate) => belongsToMerchant(paymentIntent, candidate))
      if (!merchant) continue

      const merchantMetrics = metrics.get(merchant.slug)
      if (merchantMetrics) applyPayment(merchantMetrics, merchant, paymentIntent, period)
    }
  }

  try {
    await loadPeriod('month', ranges.monthStart, ranges.now)
    await loadPeriod('previous', ranges.previousMonthStart, ranges.previousComparableEnd)
    return { metrics, hasStripeData: true }
  } catch (error) {
    console.error('No se pudieron cargar metricas de Stripe para Centro de Control:', error)
    return { metrics, hasStripeData: false }
  }
}

function buildOpportunities(rows: MerchantRow[]): Opportunity[] {
  const nowSeconds = Date.now() / 1000
  const thirtyDaysSeconds = 30 * 24 * 60 * 60
  const opportunities: Opportunity[] = []

  for (const merchant of rows) {
    if (opportunities.length >= 5) break

    if (merchant.totalKnownPayments === 0) {
      opportunities.push({
        title: `${merchant.name} nunca cobro`,
        description: 'Puede ser buen momento para revisar activacion, QR visible y primer cobro asistido.',
      })
      continue
    }

    if (merchant.lastPaymentAt && nowSeconds - merchant.lastPaymentAt > thirtyDaysSeconds) {
      opportunities.push({
        title: `${merchant.name} lleva 30 dias sin cobros`,
        description: 'Conviene contactar al comercio y entender si necesita soporte operativo o comercial.',
      })
      continue
    }

    if (merchant.previousVolume > 0 && merchant.monthVolume < merchant.previousVolume * 0.5) {
      opportunities.push({
        title: `${merchant.name} bajo su actividad`,
        description: 'El volumen viene por debajo del mismo periodo anterior y puede requerir seguimiento.',
      })
      continue
    }

    if (merchant.monthVolume > 100000) {
      opportunities.push({
        title: `${merchant.name} muestra muy buen rendimiento`,
        description: 'Buen candidato para caso de exito, mayor acompanamiento o expansion comercial.',
      })
    }
  }

  return opportunities
}

export default async function ControlPage() {
  const merchantsRecord = await listMerchants()
  const merchants = Object.values(merchantsRecord)
  const { metrics, hasStripeData } = await collectStripeMetrics(merchants)
  const rows: MerchantRow[] = merchants.map((merchant) => ({ ...merchant, ...(metrics.get(merchant.slug) || emptyMetrics()) }))

  const activeMerchants = rows.filter((merchant) => merchant.status === 'active' || merchant.stripeAccountId).length
  const monthVolume = rows.reduce((total, merchant) => total + merchant.monthVolume, 0)
  const monthNet = rows.reduce((total, merchant) => total + merchant.monthNet, 0)
  const previousVolume = rows.reduce((total, merchant) => total + merchant.previousVolume, 0)
  const goalProgress = Math.min(100, (centsToUsd(monthNet) / MONTHLY_NET_GOAL) * 100)
  const activeProgress = Math.min(100, (activeMerchants / ACTIVE_MERCHANTS_GOAL) * 100)
  const volumeVariation = previousVolume > 0 ? ((monthVolume - previousVolume) / previousVolume) * 100 : null
  const opportunities = buildOpportunities(rows)

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1>Centro de Control</h1>
          <p>Hoy</p>
        </div>
        <div className={styles.headerBadge}>Founder view</div>
      </header>

      <section className={styles.copilotCard}>
        <div className={styles.copilotIcon}>
          <TrendingUp size={28} aria-hidden="true" />
        </div>
        <div>
          <p className={styles.eyebrow}>Copiloto Empresarial</p>
          <h2>Buen dia, Martin.</h2>
          <p className={styles.copilotText}>
            Este mes Cobrix Pay lleva {formatMoney(centsToUsd(monthNet))} de ganancia neta. Estas al{' '}
            {goalProgress.toFixed(0)}% del objetivo mensual de {formatMoney(MONTHLY_NET_GOAL)}. Detectamos{' '}
            {opportunities.length} oportunidades para seguir creciendo.
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
            <Metric label="Ganancia neta del mes" value={formatMoney(centsToUsd(monthNet))} />
            <Metric label="Avance mensual" value={`${goalProgress.toFixed(0)}%`} />
            <Metric label="Comercios activos" value={String(activeMerchants)} />
            <Metric label="Volumen procesado del mes" value={formatMoney(centsToUsd(monthVolume))} />
          </div>
          {volumeVariation === null ? (
            <p className={styles.emptyText}>
              A medida que Cobrix Pay procese mas actividad, el Centro de Control comenzara a generar comparaciones
              automaticas.
            </p>
          ) : (
            <p className={volumeVariation >= 0 ? styles.positiveText : styles.warningText}>
              Variacion frente al mismo periodo del mes anterior: {formatPercent(volumeVariation)}.
            </p>
          )}
          {!hasStripeData && <p className={styles.mutedText}>Metricas conectadas a Stripe pendientes de datos disponibles.</p>}
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionTitle}>
            <Target size={20} aria-hidden="true" />
            <h2>Objetivos</h2>
          </div>
          <Progress label="USD 30.000 mensuales" value={goalProgress} caption={formatMoney(centsToUsd(monthNet))} />
          <Progress label="Comercios activos" value={activeProgress} caption={`${activeMerchants}/${ACTIVE_MERCHANTS_GOAL}`} />
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
        <span>Ultimo hito</span>
        <strong>PWA publicada</strong>
        <p>El Centro de Control ya esta preparado para instalarse como app interna.</p>
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
                <th>Comision Cobrix</th>
                <th>Volumen del mes</th>
                <th>Ganancia neta</th>
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
                  <td>{formatMoney(centsToUsd(merchant.monthVolume))}</td>
                  <td>{formatMoney(centsToUsd(merchant.monthNet))}</td>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
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
