'use client'

import QRCode from 'qrcode'
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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
      <button type="button" onClick={copyPaymentLink} style={buttonStyle}>
        Copiar link
      </button>
      <button type="button" onClick={downloadPng} style={buttonStyle}>
        Descargar QR PNG
      </button>
      <button type="button" onClick={downloadPdf} style={buttonStyle}>
        Descargar QR PDF
      </button>
    </div>
  )
}

const buttonStyle = {
  padding: '10px 14px',
  border: '1px solid #cfd4e2',
  borderRadius: 8,
  background: '#fff',
  color: '#171717',
  cursor: 'pointer',
  fontWeight: 700,
} satisfies React.CSSProperties
