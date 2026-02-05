import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { slug, domain = 'http://127.0.0.1:3000' } = body // domain para producción

    if (!slug) {
      return NextResponse.json({ error: 'Slug requerido' }, { status: 400 })
    }

    const url = `${domain}/pay/${slug}`

    // Generar QR como data URL
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })

    // Crear PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // Título
    doc.setFontSize(20)
    doc.setTextColor(99, 91, 255) // #635bff
    doc.text('Cobrix Pay', 105, 20, { align: 'center' })

    // Nombre comercio
    doc.setFontSize(16)
    doc.setTextColor(0)
    doc.text(`Comercio: ${slug.replace(/-/g, ' ').toUpperCase()}`, 105, 35, { align: 'center' })

    // QR
    doc.addImage(qrDataUrl, 'PNG', 55, 50, 100, 100)

    // Instrucciones
    doc.setFontSize(12)
    doc.text('Escanea este QR con tu celular', 105, 165, { align: 'center' })
    doc.text('Ingresa el monto y paga con tarjeta, Apple Pay o Google Pay', 105, 175, { align: 'center' })

    // Footer
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text('Cobrix Pay - Pagos simples y seguros', 105, 190, { align: 'center' })
    doc.text('Soporte: tu@email.com', 105, 198, { align: 'center' })

    const pdfBuffer = doc.output('arraybuffer')

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=qr-${slug}.pdf`,
      },
    })
  } catch (error) {
    console.error('Error generando PDF QR:', error)
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 })
  }
}