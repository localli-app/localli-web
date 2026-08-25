import QRCode from 'qrcode'

/**
 * QR assets for the "Your link" screen.
 *
 * The print PDF matters more than it looks: handing an owner a printable
 * counter card with their own name on it is a physical artefact they leave the
 * meeting holding (planning/10-build-order.md).
 *
 * The PDF is written by hand rather than with a PDF library. The QR is drawn as
 * vector rectangles from the module matrix, and the text uses Helvetica, one of
 * the 14 standard fonts every reader has built in, so nothing needs embedding.
 * That keeps it genuinely resolution-independent and avoids a heavy dependency.
 */

export async function qrPngBuffer(url: string, sizePx = 1024): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: 'png',
    width: sizePx,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#201C18FF', light: '#FFFFFFFF' },
  })
}

/** A5 at 72pt/inch: 420 x 595 points. */
const A5_WIDTH = 419.53
const A5_HEIGHT = 595.28

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

export async function qrPrintPdf(input: {
  url: string
  businessName: string
  caption?: string
}): Promise<Buffer> {
  const { url, businessName, caption = 'Book with us' } = input

  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' })
  const modules = qr.modules
  const moduleCount = modules.size

  // Centre a generous QR block on the page.
  const qrSide = 260
  const originX = (A5_WIDTH - qrSide) / 2
  const originY = 250
  const cell = qrSide / moduleCount

  const rects: string[] = []
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!modules.get(row, col)) continue
      // PDF's origin is bottom-left, so rows count downward from the top edge.
      const x = originX + col * cell
      const y = originY + qrSide - (row + 1) * cell
      // +0.5 closes hairline seams between adjacent modules when rasterised.
      rects.push(`${x.toFixed(3)} ${y.toFixed(3)} ${(cell + 0.5).toFixed(3)} ${(cell + 0.5).toFixed(3)} re`)
    }
  }

  const linkText = url.replace(/^https?:\/\//, '')
  const footer = 'Scan to book. No app, no account.'

  /** One centred line of text. PDF has no centring operator, so compute x. */
  const line = (
    text: string,
    font: 'F1' | 'F2',
    size: number,
    y: number,
    rgb: string,
  ): string => {
    const x = (A5_WIDTH - approxWidth(text, size)) / 2
    return `BT /${font} ${size} Tf ${rgb} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`
  }

  const content = [
    line(businessName, 'F1', 26, A5_HEIGHT - 90, '0.125 0.109 0.094'),
    line(caption, 'F2', 15, A5_HEIGHT - 118, '0.37 0.34 0.31'),
    '0.125 0.109 0.094 rg',
    ...rects,
    'f',
    line(linkText, 'F2', 12, 200, '0.37 0.34 0.31'),
    line(footer, 'F2', 9, 60, '0.55 0.52 0.49'),
  ].join('\n')

  return assemblePdf(content)
}

/**
 * Helvetica averages roughly 0.52em per character. Exact centring would need
 * the full AFM width table; for a business name on a counter card, close is
 * genuinely close enough and it keeps the font table out of the bundle.
 */
function approxWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.52
}

function assemblePdf(contentStream: string): Buffer {
  const objects: string[] = []

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'
  objects[3] =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A5_WIDTH.toFixed(2)} ${A5_HEIGHT.toFixed(2)}] ` +
    '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>'
  objects[4] = `<< /Length ${Buffer.byteLength(contentStream, 'binary')} >>\nstream\n${contentStream}\nendstream`
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  objects[6] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []

  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, 'binary')
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`
  }

  const xrefOffset = Buffer.byteLength(pdf, 'binary')
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'binary')
}

export interface ChannelLink {
  key: string
  label: string
  url: string
}

/** Every link is attributed, because Google will not report custom-link performance. */
export function channelLinks(baseUrl: string, slug: string): ChannelLink[] {
  const base = `${baseUrl.replace(/\/$/, '')}/${slug}`
  return [
    { key: 'gmb', label: 'Google Business Profile', url: `${base}?s=gmb` },
    { key: 'qr', label: 'QR code', url: `${base}?s=qr` },
    { key: 'ig', label: 'Instagram bio', url: `${base}?s=ig` },
    { key: 'web', label: 'Your website', url: `${base}?s=web` },
  ]
}
