'use client'

import QRCode from 'qrcode'
import { QRCodeCanvas } from 'qrcode.react'
import { jsPDF } from 'jspdf'

type DashboardActionsProps = {
  merchantName: string
  paymentLink: string
}

async function getQrDataUrl(paymentLink: string) {
  return QRCode.toDataURL(paymentLink, {
    width: 1024,
    margin: 2,
    errorCorrectionLevel: 'H',
  })
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

function getFilename(merchantName: string, extension: string) {
  const safeName = merchantName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')

  return `cobrix-pay-${safeName || 'comercio'}-qr.${extension}`
}

export function DashboardActions({ merchantName, paymentLink }: DashboardActionsProps) {
  async function copyPaymentLink() {
    await navigator.clipboard.writeText(paymentLink)
  }

  async function downloadPng() {
    const dataUrl = await getQrDataUrl(paymentLink)
    downloadDataUrl(dataUrl, getFilename(merchantName, 'png'))
  }

  async function downloadPdf() {
    const dataUrl = await getQrDataUrl(paymentLink)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    pdf.setFontSize(18)
    pdf.text(merchantName, 105, 28, { align: 'center' })
    pdf.setFontSize(12)
    pdf.text(paymentLink, 105, 38, { align: 'center', maxWidth: 180 })
    pdf.addImage(dataUrl, 'PNG', 55, 52, 100, 100)
    pdf.save(getFilename(merchantName, 'pdf'))
  }

  return (
    <section style={qrSectionStyle}>
      <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>Mi QR permanente</h2>

      <div style={qrWrapperStyle}>
        <QRCodeCanvas value={paymentLink} size={260} marginSize={2} level="H" />
      </div>

      <div style={paymentLinkBlockStyle}>
        <p style={paymentLinkLabelStyle}>Enlace permanente</p>
        <p style={paymentLinkStyle}>{paymentLink}</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 18 }}>
        <button type="button" onClick={downloadPdf} style={primaryButtonStyle}>
          Descargar QR PDF
        </button>
        <button type="button" onClick={copyPaymentLink} style={secondaryButtonStyle}>
          Copiar link
        </button>
        <button type="button" onClick={downloadPng} style={secondaryButtonStyle}>
          Descargar QR PNG
        </button>
      </div>
    </section>
  )
}

const qrSectionStyle = {
  marginTop: 24,
  padding: 24,
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  background: '#fbfcff',
  textAlign: 'center',
} satisfies React.CSSProperties

const qrWrapperStyle = {
  display: 'inline-flex',
  marginTop: 18,
  padding: 14,
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  background: '#fff',
} satisfies React.CSSProperties

const paymentLinkBlockStyle = {
  margin: '16px auto 0',
  maxWidth: 620,
} satisfies React.CSSProperties

const paymentLinkLabelStyle = {
  margin: 0,
  color: '#5b6275',
  fontSize: 13,
  fontWeight: 700,
} satisfies React.CSSProperties

const paymentLinkStyle = {
  margin: '6px 0 0',
  color: '#6b7280',
  fontSize: 13,
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
} satisfies React.CSSProperties

const primaryButtonStyle = {
  padding: '11px 16px',
  border: '1px solid #635bff',
  borderRadius: 8,
  background: '#635bff',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
} satisfies React.CSSProperties

const secondaryButtonStyle = {
  padding: '10px 14px',
  border: '1px solid #cfd4e2',
  borderRadius: 8,
  background: '#fff',
  color: '#171717',
  cursor: 'pointer',
  fontWeight: 700,
} satisfies React.CSSProperties
