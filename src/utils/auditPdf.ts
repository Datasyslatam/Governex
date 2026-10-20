import {
  PDFDocument, StandardFonts, rgb, PDFFont
} from 'pdf-lib'
import { Auditoria } from '../services'

const PAGE_WIDTH  = 841.89 // A4 Landscape
const PAGE_HEIGHT = 595.28
const MARGIN      = 40

export function descargarBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return ['—']
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const width = font.widthOfTextAtSize(testLine, fontSize)
    if (width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) {
    lines.push(currentLine)
  }
  return lines.length > 0 ? lines : ['—']
}

export async function generarAuditoriasPDF(
  auditorias: Auditoria[],
  empresaNombre = 'Governex - Sistema de Gestión de la Calidad'
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Colors
  const headerBg = rgb(0.12, 0.23, 0.43) // Primary dark blue (#1f3a6d)
  const headerText = rgb(1, 1, 1)
  const rowAltBg = rgb(0.96, 0.97, 0.99)
  const rowBorder = rgb(0.85, 0.88, 0.92)
  const textColor = rgb(0.15, 0.17, 0.22)
  const mutedText = rgb(0.45, 0.48, 0.55)

  // Column widths: Total table width = 841.89 - 80 = 761.89
  // Columns: Fecha (75), Proceso (120), Requisito Norma (140), Auditado (120), Auditor (120), Observación (186)
  const colWidths = [75, 120, 140, 120, 120, 186]
  const colHeaders = [
    'Fecha',
    'Proceso',
    'Requisito de Norma',
    'Auditado',
    'Auditor',
    'Observación'
  ]

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  const drawHeader = () => {
    // Header Banner
    currentPage.drawRectangle({
      x: MARGIN,
      y: y - 48,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 48,
      color: headerBg,
    })

    currentPage.drawText('PLAN Y PROGRAMA DE AUDITORÍAS INTERNAS', {
      x: MARGIN + 14,
      y: y - 22,
      size: 13,
      font: fontBold,
      color: headerText,
    })

    const subText = `${empresaNombre}  |  Conforme a ISO 9001:2015 (§9.2) & ISO 19011:2018  |  Fecha de emisión: ${new Date().toLocaleDateString('es-ES')}`
    currentPage.drawText(subText, {
      x: MARGIN + 14,
      y: y - 38,
      size: 8.5,
      font,
      color: rgb(0.85, 0.9, 1),
    })

    y -= 62
  }

  const drawTableHeader = () => {
    const tableHeaderHeight = 22
    let curX = MARGIN

    currentPage.drawRectangle({
      x: MARGIN,
      y: y - tableHeaderHeight,
      width: PAGE_WIDTH - MARGIN * 2,
      height: tableHeaderHeight,
      color: rgb(0.2, 0.3, 0.48),
    })

    for (let i = 0; i < colHeaders.length; i++) {
      currentPage.drawText(colHeaders[i], {
        x: curX + 6,
        y: y - 15,
        size: 8.5,
        font: fontBold,
        color: headerText,
      })
      curX += colWidths[i]
    }

    y -= tableHeaderHeight
  }

  drawHeader()
  drawTableHeader()

  const fontSize = 8
  const lineHeight = 10
  const cellPaddingY = 5

  for (let rowIndex = 0; rowIndex < auditorias.length; rowIndex++) {
    const aud = auditorias[rowIndex]

    // Formatear fecha
    let fechaStr = '—'
    if (aud.fecha_inicio) {
      const parts = aud.fecha_inicio.split('-')
      if (parts.length === 3) fechaStr = `${parts[2]}/${parts[1]}/${parts[0]}`
      else fechaStr = aud.fecha_inicio
    }

    const cellTexts = [
      fechaStr,
      aud.proceso_nombre || '—',
      aud.requisito_norma || 'ISO 9001:2015',
      aud.auditado || '—',
      aud.auditor_lider || '—',
      aud.observacion || '—'
    ]

    // Wrap each cell
    const wrappedCells = cellTexts.map((text, i) => wrapText(text, font, fontSize, colWidths[i] - 12))
    const maxLines = Math.max(...wrappedCells.map(c => c.length))
    const rowHeight = Math.max(22, maxLines * lineHeight + cellPaddingY * 2)

    // Check page break
    if (y - rowHeight < MARGIN + 20) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
      drawTableHeader()
    }

    // Row background (alternating)
    if (rowIndex % 2 === 1) {
      currentPage.drawRectangle({
        x: MARGIN,
        y: y - rowHeight,
        width: PAGE_WIDTH - MARGIN * 2,
        height: rowHeight,
        color: rowAltBg,
      })
    }

    // Cell bottom border
    currentPage.drawLine({
      start: { x: MARGIN, y: y - rowHeight },
      end: { x: PAGE_WIDTH - MARGIN, y: y - rowHeight },
      thickness: 0.5,
      color: rowBorder,
    })

    // Draw text in columns
    let cellX = MARGIN
    for (let c = 0; c < wrappedCells.length; c++) {
      const lines = wrappedCells[c]
      let textY = y - cellPaddingY - fontSize + 1
      for (const line of lines) {
        currentPage.drawText(line, {
          x: cellX + 6,
          y: textY,
          size: fontSize,
          font: c === 0 || c === 1 ? fontBold : font,
          color: c === 0 ? rgb(0.1, 0.2, 0.4) : textColor,
        })
        textY -= lineHeight
      }
      cellX += colWidths[c]
    }

    y -= rowHeight
  }

  // Add footer to all pages
  const pages = pdfDoc.getPages()
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    p.drawLine({
      start: { x: MARGIN, y: MARGIN + 14 },
      end: { x: PAGE_WIDTH - MARGIN, y: MARGIN + 14 },
      thickness: 0.5,
      color: rgb(0.8, 0.85, 0.9),
    })

    p.drawText(`Página ${i + 1} de ${pages.length} — Governex Auditorías Internas`, {
      x: MARGIN,
      y: MARGIN + 4,
      size: 7.5,
      font,
      color: mutedText,
    })

    p.drawText('Documento controlado emitido conforme a la directriz ISO 19011:2018', {
      x: PAGE_WIDTH - MARGIN - 260,
      y: MARGIN + 4,
      size: 7.5,
      font,
      color: mutedText,
    })
  }

  return await pdfDoc.save()
}
