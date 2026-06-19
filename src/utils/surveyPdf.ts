import {
  PDFDocument, StandardFonts, rgb, PDFFont, PDFRadioGroup, PDFTextField,
} from 'pdf-lib'
import type { EncuestaGenerada } from '../services'

const PAGE_WIDTH  = 595.28 // A4
const PAGE_HEIGHT = 841.89
const MARGIN      = 50

/* ── Descarga genérica de bytes como archivo ───────────────────── */
export function descargarBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/* ══════════════════════════════════════════════════════════════
   1. GENERAR ENCUESTA INTERACTIVA (PDF con AcroForm)
   ══════════════════════════════════════════════════════════════ */
export async function generarEncuestaPDF(
  encuesta: EncuestaGenerada,
  variant: 'cliente' | 'proveedor',
  nombreEmpresa?: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const form   = pdfDoc.getForm()
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const accent = variant === 'cliente' ? rgb(0.18, 0.53, 0.87) : rgb(0.09, 0.64, 0.29)

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
    }
  }

  const drawWrapped = (text: string, x: number, size: number, f: PDFFont, maxWidth: number, color = rgb(0.15, 0.15, 0.15)) => {
    const words = text.split(' ')
    let line = ''
    const lines: string[] = []
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (f.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w }
      else line = test
    }
    if (line) lines.push(line)
    for (const l of lines) {
      ensureSpace(size + 6)
      page.drawText(l, { x, y, size, font: f, color })
      y -= size + 6
    }
  }

  /* Header */
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 90, width: PAGE_WIDTH, height: 90, color: accent })
  page.drawText(encuesta.titulo, { x: MARGIN, y: PAGE_HEIGHT - 42, size: 15, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText(
    variant === 'cliente' ? 'Encuesta de Satisfacción — Cliente' : 'Encuesta de Evaluación — Proveedor',
    { x: MARGIN, y: PAGE_HEIGHT - 62, size: 9.5, font, color: rgb(1, 1, 1) }
  )
  if (nombreEmpresa) {
    page.drawText(nombreEmpresa, { x: MARGIN, y: PAGE_HEIGHT - 78, size: 8.5, font, color: rgb(0.9, 0.95, 1) })
  }
  y = PAGE_HEIGHT - 112

  drawWrapped(encuesta.introduccion, MARGIN, 9.5, font, PAGE_WIDTH - MARGIN * 2, rgb(0.35, 0.35, 0.35))
  y -= 8

  /* Datos del encuestado */
  ensureSpace(60)
  page.drawText('Datos del encuestado', { x: MARGIN, y, size: 10.5, font: fontBold, color: accent })
  y -= 16
  page.drawText('Nombre / Razón social:', { x: MARGIN, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) })
  page.drawText('Fecha:', { x: MARGIN + 260, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) })
  const nombreField = form.createTextField('encuestado_nombre')
  nombreField.addToPage(page, { x: MARGIN, y: y - 16, width: 240, height: 16, borderWidth: 0.5 })
  const fechaField = form.createTextField('encuestado_fecha')
  fechaField.addToPage(page, { x: MARGIN + 260, y: y - 16, width: 110, height: 16, borderWidth: 0.5 })
  y -= 36

  /* Categorías y preguntas */
  for (const cat of encuesta.categorias) {
    ensureSpace(30)
    page.drawRectangle({ x: MARGIN, y: y - 4, width: PAGE_WIDTH - MARGIN * 2, height: 20, color: rgb(0.94, 0.96, 0.99) })
    page.drawText(cat.categoria, { x: MARGIN + 6, y: y + 1, size: 10.5, font: fontBold, color: accent })
    y -= 28

    for (const p of cat.preguntas) {
      ensureSpace(46)
      drawWrapped(p.texto, MARGIN, 9.5, font, PAGE_WIDTH - MARGIN * 2)

      if (p.tipo === 'escala') {
        ensureSpace(24)
        const radioGroup = form.createRadioGroup(p.id)
        let x = MARGIN
        for (let val = 1; val <= 5; val++) {
          radioGroup.addOptionToPage(String(val), page, { x, y: y - 2, width: 12, height: 12, borderWidth: 1 })
          page.drawText(String(val), { x: x + 16, y, size: 9, font })
          x += 40
        }
        page.drawText('(1 = Muy insatisfecho   5 = Muy satisfecho)', { x: x + 10, y, size: 7.5, font, color: rgb(0.55, 0.55, 0.55) })
        y -= 26
      } else {
        ensureSpace(44)
        const textField = form.createTextField(p.id)
        textField.enableMultiline()
        textField.addToPage(page, { x: MARGIN, y: y - 34, width: PAGE_WIDTH - MARGIN * 2, height: 34, borderWidth: 0.5 })
        y -= 44
      }
      y -= 4
    }
    y -= 6
  }

  try { form.updateFieldAppearances(font) } catch { /* no-op */ }

  return pdfDoc.save()
}

/* ══════════════════════════════════════════════════════════════
   2. LEER RESPUESTAS DE UN PDF DILIGENCIADO
   ══════════════════════════════════════════════════════════════ */
export interface RespuestasPDF {
  campos: Record<string, string>
  nombre: string
  fecha:  string
}

export async function leerRespuestasPDF(file: File): Promise<RespuestasPDF> {
  const bytes  = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form   = pdfDoc.getForm()
  const campos: Record<string, string> = {}

  for (const field of form.getFields()) {
    const name = field.getName()
    try {
      if (field instanceof PDFRadioGroup) {
        campos[name] = field.getSelected() ?? ''
      } else if (field instanceof PDFTextField) {
        campos[name] = field.getText() ?? ''
      }
    } catch { campos[name] = '' }
  }

  return {
    campos,
    nombre: campos['encuestado_nombre'] || '',
    fecha:  campos['encuestado_fecha']  || '',
  }
}

/* ══════════════════════════════════════════════════════════════
   3. GENERAR PDF DE UNA PQRS
   ══════════════════════════════════════════════════════════════ */
export interface PqrsParaPDF {
  id: number; tipo: string; origen: string; fecha: string
  descripcion: string; estado: string
}

export async function generarPqrsPDF(pqrs: PqrsParaPDF, nombreEmpresa?: string): Promise<Uint8Array> {
  const pdfDoc   = await PDFDocument.create()
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const page     = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const { width, height } = page.getSize()
  let y = height - 110

  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: rgb(0.11, 0.23, 0.42) })
  page.drawText('Registro de PQRS', { x: MARGIN, y: height - 42, size: 17, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText(`Código interno: PQRS-${pqrs.id}`, { x: MARGIN, y: height - 62, size: 9, font, color: rgb(0.85, 0.9, 0.97) })
  if (nombreEmpresa) page.drawText(nombreEmpresa, { x: MARGIN, y: height - 78, size: 9, font, color: rgb(0.85, 0.9, 0.97) })

  const rows: [string, string][] = [
    ['Tipo',                  pqrs.tipo],
    ['Cliente / Proveedor',   pqrs.origen],
    ['Fecha',                 pqrs.fecha],
    ['Estado',                pqrs.estado],
  ]
  for (const [label, val] of rows) {
    page.drawText(`${label}:`, { x: MARGIN, y, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(val, { x: MARGIN + 160, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) })
    y -= 22
  }
  y -= 8
  page.drawText('Descripción:', { x: MARGIN, y, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
  y -= 18

  const words = pqrs.descripcion.split(' ')
  let line = ''
  const maxWidth = width - MARGIN * 2
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(test, 10) > maxWidth && line) {
      page.drawText(line, { x: MARGIN, y, size: 10, font, color: rgb(0.25, 0.25, 0.25) })
      y -= 16; line = w
    } else line = test
  }
  if (line) page.drawText(line, { x: MARGIN, y, size: 10, font, color: rgb(0.25, 0.25, 0.25) })

  return pdfDoc.save()
}