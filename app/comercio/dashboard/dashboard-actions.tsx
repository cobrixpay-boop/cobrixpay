'use client'

import QRCode from 'qrcode'
import { QRCodeCanvas } from 'qrcode.react'
import { jsPDF } from 'jspdf'
import { useState } from 'react'

type DashboardActionsProps = {
  merchantName: string
  paymentLink: string
  checkoutCurrency: string
}

type CreatedPaymentLink = {
  url: string
  amount: string
  currency: string
  expiresAt: string
}

const COBRIX_BLUE = '#1455d9'
const COBRIX_GREEN = '#11a36a'
const SOFT_TEXT = '#64748b'
const BRANDING_ASSETS = {
  applePay: '/branding/apple-pay.svg',
  cobrix: '/branding/cobrix-logo.png',
  googlePay: '/branding/google-pay.svg',
  stripe: '/branding/stripe.svg',
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

function getVisibleImageBounds(context: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = context.getImageData(0, 0, width, height).data
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = imageData[(y * width + x) * 4 + 3]

      if (alpha > 0) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return { x: 0, y: 0, width, height }
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

async function loadBrandingImageDataUrl(src: string, width: number, height: number, visualScale = 1) {
  try {
    const response = await fetch(src)
    if (!response.ok) return null

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)

    return await new Promise<string>((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = image.naturalWidth
        sourceCanvas.height = image.naturalHeight
        const sourceContext = sourceCanvas.getContext('2d')
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')

        if (!context || !sourceContext) {
          URL.revokeObjectURL(objectUrl)
          reject(new Error('No se pudo preparar el logo para el PDF'))
          return
        }

        sourceContext.clearRect(0, 0, image.naturalWidth, image.naturalHeight)
        sourceContext.drawImage(image, 0, 0)

        const bounds = getVisibleImageBounds(sourceContext, image.naturalWidth, image.naturalHeight)
        const containScale = Math.min((width * 0.82) / bounds.width, (height * 0.82) / bounds.height)
        const maxScale = Math.min(width / bounds.width, height / bounds.height)
        const scale = Math.min(containScale * visualScale, maxScale)
        const drawWidth = bounds.width * scale
        const drawHeight = bounds.height * scale
        const drawX = (width - drawWidth) / 2
        const drawY = (height - drawHeight) / 2

        context.clearRect(0, 0, width, height)
        context.drawImage(sourceCanvas, bounds.x, bounds.y, bounds.width, bounds.height, drawX, drawY, drawWidth, drawHeight)
        URL.revokeObjectURL(objectUrl)
        resolve(canvas.toDataURL('image/png'))
      }
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('No se pudo cargar el logo para el PDF'))
      }
      image.src = objectUrl
    })
  } catch {
    return null
  }
}

async function drawPaymentLogos(pdf: jsPDF, centerX: number, y: number) {
  const [applePayLogo, googlePayLogo] = await Promise.all([
    loadBrandingImageDataUrl(BRANDING_ASSETS.applePay, 640, 220, 1),
    loadBrandingImageDataUrl(BRANDING_ASSETS.googlePay, 640, 220, 1.3),
  ])
  const logoWidth = 44
  const logoHeight = 15
  const logoGap = 9

  if (applePayLogo && googlePayLogo) {
    pdf.addImage(applePayLogo, 'PNG', centerX - logoWidth - logoGap / 2, y - logoHeight / 2, logoWidth, logoHeight)
    pdf.addImage(googlePayLogo, 'PNG', centerX + logoGap / 2, y - logoHeight / 2, logoWidth, logoHeight)
  }
}

async function drawFooterBranding(pdf: jsPDF, centerX: number, pageHeight: number) {
  const [stripeLogo, cobrixLogo] = await Promise.all([
    loadBrandingImageDataUrl(BRANDING_ASSETS.stripe, 360, 120),
    loadBrandingImageDataUrl(BRANDING_ASSETS.cobrix, 480, 180),
  ])

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(SOFT_TEXT)
  pdf.text('Secure payment processing', centerX, pageHeight - 47, { align: 'center' })
  pdf.text('Powered by', centerX, pageHeight - 39, { align: 'center' })

  if (stripeLogo) {
    pdf.addImage(stripeLogo, 'PNG', centerX - 12, pageHeight - 35, 24, 7)
  }

  if (cobrixLogo) {
    pdf.addImage(cobrixLogo, 'PNG', centerX - 15, pageHeight - 22, 30, 10)
  }
}

function formatExpiration(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function DashboardActions({ merchantName, paymentLink, checkoutCurrency }: DashboardActionsProps) {
  const [showFixedLinkForm, setShowFixedLinkForm] = useState(false)
  const [fixedAmount, setFixedAmount] = useState('')
  const [fixedConcept, setFixedConcept] = useState('')
  const [createdLink, setCreatedLink] = useState<CreatedPaymentLink | null>(null)
  const [fixedLinkError, setFixedLinkError] = useState('')
  const [fixedLinkLoading, setFixedLinkLoading] = useState(false)

  async function copyPaymentLink() {
    await navigator.clipboard.writeText(paymentLink)
  }

  async function copyFixedPaymentLink() {
    if (!createdLink) return
    await navigator.clipboard.writeText(createdLink.url)
  }

  async function shareFixedPaymentLink() {
    if (!createdLink) return

    const shareText = `Link de pago ${createdLink.amount} generado por ${merchantName}.`

    if (navigator.share) {
      await navigator.share({
        title: `Pago a ${merchantName}`,
        text: shareText,
        url: createdLink.url,
      })
      return
    }

    await navigator.clipboard.writeText(createdLink.url)
  }

  async function createFixedPaymentLink() {
    setFixedLinkError('')
    setCreatedLink(null)
    setFixedLinkLoading(true)

    try {
      const response = await fetch('/api/payment-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(fixedAmount),
          concept: fixedConcept,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo generar el link.')
      }

      setCreatedLink(data)
    } catch (error: unknown) {
      setFixedLinkError(error instanceof Error ? error.message : 'No se pudo generar el link.')
    } finally {
      setFixedLinkLoading(false)
    }
  }

  async function downloadPng() {
    const dataUrl = await getQrDataUrl(paymentLink)
    downloadDataUrl(dataUrl, getFilename(merchantName, 'png'))
  }

  async function downloadPdf() {
    const dataUrl = await getQrDataUrl(paymentLink)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const centerX = pageWidth / 2
    const qrSize = Math.min(112, pageWidth * 0.54)
    const qrX = centerX - qrSize / 2
    const qrY = 78

    pdf.setFillColor(255, 255, 255)
    pdf.rect(0, 0, pageWidth, pageHeight, 'F')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(24)
    pdf.setTextColor(COBRIX_BLUE)
    pdf.text(merchantName.toUpperCase(), centerX, 46, { align: 'center', maxWidth: pageWidth - 32 })

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(18)
    pdf.setTextColor(COBRIX_GREEN)
    pdf.text('Scan to Pay', centerX, 58, { align: 'center' })

    pdf.addImage(dataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

    await drawPaymentLogos(pdf, centerX, qrY + qrSize + 18)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.setTextColor(SOFT_TEXT)
    pdf.text('International Cards Accepted', centerX, qrY + qrSize + 32, { align: 'center' })

    await drawFooterBranding(pdf, centerX, pageHeight)

    pdf.save(getFilename(merchantName, 'pdf'))
  }

  return (
    <section style={qrSectionStyle}>
      <h3 style={{ margin: 0, fontSize: 20, lineHeight: 1.2 }}>QR permanente</h3>

      <div style={qrWrapperStyle}>
        <QRCodeCanvas value={paymentLink} size={210} marginSize={2} level="H" />
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
        <button type="button" onClick={() => setShowFixedLinkForm((current) => !current)} style={secondaryButtonStyle}>
          Crear link de pago
        </button>
      </div>

      {showFixedLinkForm && (
        <div style={fixedLinkPanelStyle}>
          <div style={fixedLinkGridStyle}>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Monto</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={fixedAmount}
                onChange={(event) => setFixedAmount(event.target.value)}
                placeholder="Ej: 25.00"
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Moneda</span>
              <input value={checkoutCurrency.toUpperCase()} readOnly style={inputStyle} />
            </label>
            <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <span style={fieldLabelStyle}>Concepto opcional</span>
              <input
                value={fixedConcept}
                onChange={(event) => setFixedConcept(event.target.value)}
                maxLength={120}
                placeholder="Ej: Reserva, seña o factura"
                style={inputStyle}
              />
            </label>
          </div>

          {fixedLinkError && (
            <p role="alert" style={fixedLinkErrorStyle}>
              {fixedLinkError}
            </p>
          )}

          <button type="button" onClick={createFixedPaymentLink} disabled={fixedLinkLoading} style={fixedLinkLoading ? disabledButtonStyle : primaryButtonStyle}>
            {fixedLinkLoading ? 'Generando...' : 'Generar link'}
          </button>

          {createdLink && (
            <div style={createdLinkStyle}>
              <p style={paymentLinkLabelStyle}>URL generada</p>
              <p style={paymentLinkStyle}>{createdLink.url}</p>
              <p style={fixedLinkMetaStyle}>
                {createdLink.amount} fijado por el comercio. Vence el {formatExpiration(createdLink.expiresAt)}.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 12 }}>
                <button type="button" onClick={copyFixedPaymentLink} style={secondaryButtonStyle}>
                  Copiar link
                </button>
                <button type="button" onClick={shareFixedPaymentLink} style={secondaryButtonStyle}>
                  Compartir
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

const qrSectionStyle = {
  marginTop: 0,
  padding: 0,
  textAlign: 'center',
} satisfies React.CSSProperties

const qrWrapperStyle = {
  display: 'inline-flex',
  marginTop: 14,
  padding: 12,
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  background: '#fff',
} satisfies React.CSSProperties

const paymentLinkBlockStyle = {
  margin: '12px auto 0',
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
  minHeight: 44,
  padding: '11px 16px',
  border: '1px solid #635bff',
  borderRadius: 8,
  background: '#635bff',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
} satisfies React.CSSProperties

const secondaryButtonStyle = {
  minHeight: 44,
  padding: '10px 14px',
  border: '1px solid #cfd4e2',
  borderRadius: 8,
  background: '#fff',
  color: '#171717',
  cursor: 'pointer',
  fontWeight: 700,
} satisfies React.CSSProperties

const disabledButtonStyle = {
  ...primaryButtonStyle,
  background: '#9ca3af',
  borderColor: '#9ca3af',
  cursor: 'not-allowed',
} satisfies React.CSSProperties

const fixedLinkPanelStyle = {
  margin: '18px auto 0',
  maxWidth: 620,
  padding: 16,
  border: '1px solid #d7dce9',
  borderRadius: 8,
  background: '#fbfcff',
  textAlign: 'left',
} satisfies React.CSSProperties

const fixedLinkGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
} satisfies React.CSSProperties

const fieldStyle = {
  display: 'grid',
  gap: 6,
} satisfies React.CSSProperties

const fieldLabelStyle = {
  color: '#5b6275',
  fontSize: 13,
  fontWeight: 800,
} satisfies React.CSSProperties

const inputStyle = {
  minHeight: 44,
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #cfd4e2',
  borderRadius: 8,
  background: '#fff',
  color: '#171717',
  fontSize: 16,
} satisfies React.CSSProperties

const fixedLinkErrorStyle = {
  margin: '12px 0',
  padding: 12,
  border: '1px solid #f0b7c1',
  borderRadius: 8,
  background: '#fff5f7',
  color: '#b00020',
  fontWeight: 700,
} satisfies React.CSSProperties

const createdLinkStyle = {
  marginTop: 14,
  padding: 12,
  border: '1px solid #e2e5ee',
  borderRadius: 8,
  background: '#fff',
  textAlign: 'center',
} satisfies React.CSSProperties

const fixedLinkMetaStyle = {
  margin: '8px 0 0',
  color: '#475569',
  lineHeight: 1.45,
  fontWeight: 700,
} satisfies React.CSSProperties
