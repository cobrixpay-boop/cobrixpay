import { jsPDF } from 'jspdf'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getMerchantFromSession, MERCHANT_SESSION_COOKIE } from '@/lib/merchant-session'
import { getMonthlyReportData, isValidMonthKey, type MerchantPayout } from '@/lib/merchant-stripe-data'
import { formatStripeMoney, getStripeCurrencyCode } from '@/lib/stripe-money'

function formatReportMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1, 1)

  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(timestamp * 1000))
}

function translatePayoutStatus(status: string) {
  if (status === 'pending') return 'Programada'
  if (status === 'in_transit') return 'En camino'
  if (status === 'paid') return 'Acreditada'
  if (status === 'failed') return 'Fallida'
  if (status === 'canceled') return 'Cancelada'

  return status
}

function translatePaymentStatus(status: string) {
  if (status === 'succeeded') return 'Pagado'
  if (status === 'pending' || status === 'processing' || status === 'requires_confirmation' || status === 'requires_action') {
    return 'Pendiente'
  }
  if (status === 'requires_payment_method' || status === 'canceled') return 'Fallido'
  if (status === 'refunded') return 'Reembolsado'

  return status
}

function sumPayoutsByCurrency(payouts: MerchantPayout[]) {
  return payouts.reduce<Record<string, number>>((totals, payout) => {
    const currency = payout.currency.toLowerCase()
    totals[currency] = (totals[currency] || 0) + payout.amount
    return totals
  }, {})
}

function drawLine(pdf: jsPDF, y: number) {
  pdf.setDrawColor(226, 229, 238)
  pdf.line(14, y, 196, y)
}

function addPageIfNeeded(pdf: jsPDF, y: number) {
  if (y < 278) return y

  pdf.addPage()
  return 18
}

function text(pdf: jsPDF, value: string, x: number, y: number, options?: { maxWidth?: number }) {
  pdf.text(value, x, y, options)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const month = url.searchParams.get('month') || ''

  if (!isValidMonthKey(month)) {
    return NextResponse.json({ error: 'Mes invalido. Usá el formato YYYY-MM.' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const merchant = await getMerchantFromSession(cookieStore.get(MERCHANT_SESSION_COOKIE)?.value)

  if (!merchant) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const report = await getMonthlyReportData(merchant, month)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const monthLabel = formatReportMonth(month)
    const payoutTotals = sumPayoutsByCurrency(report.payouts)
    let y = 18

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    text(pdf, `Resumen mensual de acreditaciones — ${monthLabel}`, 14, y, { maxWidth: 182 })

    y += 10
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'normal')
    text(pdf, merchant.name, 14, y)

    y += 10
    drawLine(pdf, y)
    y += 9

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    text(pdf, 'Resumen principal', 14, y)

    y += 8
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)

    if (Object.keys(payoutTotals).length === 0) {
      text(pdf, 'Total efectivamente acreditado: Sin acreditaciones pagadas durante el mes.', 14, y)
      y += 6
      text(pdf, 'Cantidad de acreditaciones: 0', 14, y)
    } else {
      Object.entries(payoutTotals).forEach(([currency, total]) => {
        text(pdf, `Total efectivamente acreditado (${getStripeCurrencyCode(currency)}): ${formatStripeMoney(total, currency)}`, 14, y)
        y += 6
      })
      text(pdf, `Cantidad de acreditaciones: ${report.payouts.length}`, 14, y)
      y += 6
      text(pdf, `Moneda: ${Object.keys(payoutTotals).map(getStripeCurrencyCode).join(', ')}`, 14, y)
    }

    y += 10
    drawLine(pdf, y)
    y += 9

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    text(pdf, 'Detalle de acreditaciones', 14, y)
    y += 8
    pdf.setFontSize(9)

    if (report.payouts.length === 0) {
      pdf.setFont('helvetica', 'normal')
      text(pdf, 'No hay acreditaciones pagadas con fecha de acreditación dentro del mes seleccionado.', 14, y, {
        maxWidth: 182,
      })
      y += 8
    } else {
      pdf.setFont('helvetica', 'bold')
      text(pdf, 'Fecha', 14, y)
      text(pdf, 'Monto', 45, y)
      text(pdf, 'Moneda', 86, y)
      text(pdf, 'Estado', 112, y)
      text(pdf, 'ID Stripe', 140, y)
      y += 5
      drawLine(pdf, y)
      y += 6

      pdf.setFont('helvetica', 'normal')
      report.payouts.forEach((payout) => {
        y = addPageIfNeeded(pdf, y)
        text(pdf, formatDate(payout.arrivalDate), 14, y)
        text(pdf, formatStripeMoney(payout.amount, payout.currency), 45, y)
        text(pdf, getStripeCurrencyCode(payout.currency), 86, y)
        text(pdf, translatePayoutStatus(payout.status), 112, y)
        text(pdf, payout.id, 140, y)
        y += 6
      })
    }

    y += 6
    y = addPageIfNeeded(pdf, y)
    drawLine(pdf, y)
    y += 9

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    text(pdf, 'Ventas procesadas durante el período', 14, y)
    y += 8
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)

    const salesCurrencies = Object.keys(report.salesSummary.totalsByCurrency)
    if (salesCurrencies.length === 0) {
      text(pdf, 'Total vendido: Sin ventas aprobadas durante el período.', 14, y)
      y += 6
    } else {
      salesCurrencies.forEach((currency) => {
        text(pdf, `Total vendido (${getStripeCurrencyCode(currency)}): ${formatStripeMoney(report.salesSummary.totalsByCurrency[currency], currency)}`, 14, y)
        y += 6
        text(pdf, `Ticket promedio (${getStripeCurrencyCode(currency)}): ${formatStripeMoney(report.salesSummary.averageTicketByCurrency[currency], currency)}`, 14, y)
        y += 6
      })
    }

    text(pdf, `Cantidad de operaciones aprobadas: ${report.salesSummary.approvedPaymentCount}`, 14, y)
    y += 6
    text(pdf, `Operaciones reembolsadas: ${report.refundedPaymentCount}`, 14, y)
    y += 10

    if (report.sales.length > 0) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      text(pdf, 'Fecha', 14, y)
      text(pdf, 'ID', 45, y)
      text(pdf, 'Monto', 118, y)
      text(pdf, 'Estado', 160, y)
      y += 5
      drawLine(pdf, y)
      y += 6
      pdf.setFont('helvetica', 'normal')

      report.sales.forEach((payment) => {
        y = addPageIfNeeded(pdf, y)
        text(pdf, formatDate(payment.created), 14, y)
        text(pdf, payment.id, 45, y)
        text(pdf, formatStripeMoney(payment.amount, payment.currency), 118, y)
        text(pdf, translatePaymentStatus(payment.status), 160, y)
        y += 6
      })
    }

    y += 6
    y = addPageIfNeeded(pdf, y)
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(9)
    text(
      pdf,
      'Las ventas y las acreditaciones pueden corresponder a períodos diferentes debido a los plazos de procesamiento y liquidación de Stripe.',
      14,
      y,
      { maxWidth: 182 }
    )

    const buffer = Buffer.from(pdf.output('arraybuffer'))

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cobrix-pay-acreditaciones-${month}.pdf"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo generar el informe mensual.' }, { status: 500 })
  }
}
