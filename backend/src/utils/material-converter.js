import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

/**
 * Converts plain text into a valid PDF document with pagination and formatted headings.
 * @param {string} title 
 * @param {string} content 
 * @returns {Promise<Buffer>}
 */
export async function textToPdfBuffer(title, content) {
  const pdfDoc = await PDFDocument.create()
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const margin = 50
  const pageWidth = 595.28 // A4
  const pageHeight = 841.89
  const textWidth = pageWidth - margin * 2

  const lines = []
  const rawParagraphs = content.split('\n')

  for (const rawPara of rawParagraphs) {
    const trimmed = rawPara.trim()
    if (!trimmed) {
      lines.push({ text: '', isBlank: true })
      continue
    }

    const isHeading = trimmed.startsWith('# ') || trimmed.startsWith('## ') || trimmed.toUpperCase() === trimmed && trimmed.length < 50
    const cleanText = trimmed.replace(/^#+\s*/, '')
    const font = isHeading ? helveticaBold : helvetica
    const size = isHeading ? 14 : 10

    // Simple word wrapping
    const words = cleanText.split(/\s+/)
    let currentLine = ''

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word
      const measured = font.widthOfTextAtSize(candidate, size)
      if (measured <= textWidth) {
        currentLine = candidate
      } else {
        if (currentLine) lines.push({ text: currentLine, isHeading, font, size })
        currentLine = word
      }
    }
    if (currentLine) {
      lines.push({ text: currentLine, isHeading, font, size })
    }
  }

  // Paginate lines
  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  // Draw Title on first page
  page.drawText(title.slice(0, 80), {
    x: margin,
    y: y - 10,
    size: 18,
    font: helveticaBold,
    color: rgb(0.1, 0.2, 0.4),
  })
  y -= 40

  for (const item of lines) {
    if (item.isBlank) {
      y -= 12
      if (y < margin + 20) {
        page = pdfDoc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }
      continue
    }

    const lineHeight = item.isHeading ? 22 : 14
    if (y - lineHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }

    page.drawText(item.text, {
      x: margin,
      y: y - (item.isHeading ? 16 : 10),
      size: item.size,
      font: item.font,
      color: item.isHeading ? rgb(0.15, 0.25, 0.45) : rgb(0.15, 0.15, 0.15),
    })
    y -= lineHeight
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

/**
 * Extracts readable text from an HTML document string.
 * @param {string} html 
 * @returns {string}
 */
export function extractTextFromHtml(html) {
  if (!html) return ''
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n## $1\n\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n\n$1\n\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n* $1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+\n/g, '\n\n')
    .trim()
}
