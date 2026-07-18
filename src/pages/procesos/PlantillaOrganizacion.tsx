/**
 * PlantillaOrganizacion.tsx  –  Governex · ISO 9001:2015
 *
 * Genera la plantilla PDF en el cliente (pdf-lib) con AcroForm rellenable.
 * Secciones: 1 – Identidad, 2 – Contexto Operacional.
 * Tras cargar el PDF, genera Misión, Visión y Política de Calidad con IA.
 */
import React, { useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { DatosEmpresa } from '../../context/AIAnalysisContext'
import './PlantillaOrganizacion.css'
import logoGovernex from "../../assets/logo-governex.png";
import { uploadFile, openSignedFile } from '../../services/api'

/* ── Props ─────────────────────────────────────────────────── */
interface Props {
  currentDatos?: DatosEmpresa | null
  onDatosYOrganigramaListos: (
    datos: DatosEmpresa,
    orgBase64: string,
    orgMime: string,
    orgFileName: string,
  ) => void
  onCancel: () => void
}

/* ── Tipos ─────────────────────────────────────────────────── */
interface TextosIdeario {
  mision: string
  vision: string
  politicaCalidad: string
}

/* ── Constantes ────────────────────────────────────────────── */
const TIPOS_ORGANIGRAMA_PERMITIDOS = [
  'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
]
const EXT_ORGANIGRAMA_PERMITIDAS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp']

const TIPO_EMPRESA_OPTS = [
  'S.A.S.', 'S.A.', 'Ltda.', 'E.U.', 'S.C.A.',
  'Cooperativa', 'Fundación / ONG', 'Empresa pública', 'Otra',
]
const SECTOR_OPTS = [
  'Manufactura / industria', 'Construcción', 'Comercio mayorista',
  'Comercio minorista', 'Servicios profesionales', 'Salud y bienestar',
  'Educación', 'Tecnología / software', 'Agropecuario',
  'Transporte y logística', 'Alimentos y bebidas', 'Energía y utilities',
  'Financiero / seguros', 'Turismo y hotelería', 'Telecomunicaciones', 'Otro',
]
const TAMANO_OPTS = ['Micro (1–10)', 'Pequeña (11–50)', 'Mediana (51–200)', 'Grande (>200)']

/* ── Convierte cualquier imagen a PNG ArrayBuffer vía canvas ── */
async function imagenAPngArrayBuffer(src: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.width
      canvas.height = img.height
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Canvas toBlob falló'))
        blob.arrayBuffer().then(resolve).catch(reject)
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('No se pudo cargar el logo'))
    img.src = src
  })
}

/* ══════════════════════════════════════════════════════════════
   GENERACIÓN DEL PDF CON pdf-lib (ACROFORM RELLENABLE)
   ══════════════════════════════════════════════════════════════ */
async function generarPlantillaPDF(): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')

  const doc  = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontReg  = await doc.embedFont(StandardFonts.Helvetica)

  const NAVY  = rgb(0.059, 0.169, 0.294)
  const BLUE  = rgb(0.102, 0.431, 0.741)
  const GRAY5 = rgb(0.97,  0.97,  0.97)
  const GRAY3 = rgb(0.78,  0.78,  0.78)
  const WHITE = rgb(1, 1, 1)

  const ML = 40, MR = 40
  const CW = width - ML - MR

  let y = height - 10

  page.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: NAVY })

  try {
    const logoPngBuffer = await imagenAPngArrayBuffer(logoGovernex)
    const logoImage     = await doc.embedPng(logoPngBuffer)
    const logoDims      = logoImage.scaleToFit(100, 38)
    page.drawImage(logoImage, {
      x: ML + (110 - logoDims.width)  / 2,
      y: height - 58 + (44 - logoDims.height) / 2,
      width:  logoDims.width,
      height: logoDims.height,
    })
  } catch {
    page.drawRectangle({ x: ML, y: height - 58, width: 110, height: 44,
      color: WHITE, borderColor: BLUE, borderWidth: 1.5 })
    page.drawText('GOVERNEX', { x: ML + 10, y: height - 34,
      font: fontBold, size: 15, color: BLUE })
  }

  page.drawText('PLANTILLA DE CONTEXTO ORGANIZACIONAL', {
    x: ML + 120, y: height - 30, font: fontBold, size: 11.5, color: WHITE,
  })
  page.drawText('Sistema de Gestión de Calidad', {
    x: ML + 120, y: height - 46, font: fontReg, size: 8.5, color: rgb(0.72, 0.85, 0.97),
  })
  page.drawText('Contexto de la Organización', {
    x: ML + 120, y: height - 59, font: fontReg, size: 7.5, color: rgb(0.6, 0.75, 0.9),
  })

  y = height - 82

  const form = doc.getForm()

  function drawField(label: string, fieldName: string, yPos: number, req = false, hint = ''): number {
    const fieldH = 18; const labelH = 11
    page.drawText(`${label}${req ? ' *' : ''}`, {
      x: ML, y: yPos - labelH + 3, font: req ? fontBold : fontReg, size: 7.8, color: NAVY,
    })
    if (hint) {
      page.drawText(hint, { x: ML + CW / 2, y: yPos - labelH + 3,
        font: fontReg, size: 6.8, color: rgb(0.55, 0.55, 0.55) })
    }
    page.drawRectangle({ x: ML, y: yPos - labelH - fieldH,
      width: CW, height: fieldH, color: GRAY5, borderColor: GRAY3, borderWidth: 0.75 })
    const tf = form.createTextField(`form.${fieldName}`)
    tf.addToPage(page, { x: ML + 2, y: yPos - labelH - fieldH + 1, width: CW - 4, height: fieldH - 2 })
    tf.setFontSize(8)
    return yPos - labelH - fieldH - 5
  }

  function drawTextArea(label: string, fieldName: string, yPos: number, areaH: number, hint = ''): number {
    const labelH = 11
    page.drawText(`${label} *`, { x: ML, y: yPos - labelH + 3, font: fontBold, size: 7.8, color: NAVY })
    if (hint) {
      page.drawText(hint, { x: ML, y: yPos - labelH - 8, font: fontReg, size: 6.5, color: rgb(0.5, 0.5, 0.5) })
      yPos -= 10
    }
    page.drawRectangle({ x: ML, y: yPos - labelH - areaH,
      width: CW, height: areaH, color: GRAY5, borderColor: GRAY3, borderWidth: 0.75 })
    const tf = form.createTextField(`form.${fieldName}`)
    tf.enableMultiline()
    tf.addToPage(page, { x: ML + 2, y: yPos - labelH - areaH + 2, width: CW - 4, height: areaH - 4 })
    tf.setFontSize(8)
    return yPos - labelH - areaH - 6
  }

  function drawDropdown(label: string, fieldName: string, options: string[], yPos: number, req = false): number {
    const fieldH = 18; const labelH = 11
    page.drawText(`${label}${req ? ' *' : ''}`, {
      x: ML, y: yPos - labelH + 3, font: req ? fontBold : fontReg, size: 7.8, color: NAVY,
    })
    page.drawRectangle({ x: ML, y: yPos - labelH - fieldH,
      width: CW, height: fieldH, color: GRAY5, borderColor: GRAY3, borderWidth: 0.75 })
    const cb = form.createDropdown(`form.${fieldName}`)
    cb.addOptions(['— Seleccione —', ...options])
    cb.select('— Seleccione —')
    cb.addToPage(page, { x: ML + 2, y: yPos - labelH - fieldH + 1, width: CW - 4, height: fieldH - 2 })
    return yPos - labelH - fieldH - 5
  }

  function drawSection(title: string, sub: string, yPos: number): number {
    page.drawRectangle({ x: ML, y: yPos - 22, width: CW, height: 22, color: NAVY })
    page.drawText(title, { x: ML + 8, y: yPos - 14, font: fontBold, size: 9, color: WHITE })
    page.drawText(sub, { x: ML + 8, y: yPos - 22 + 3, font: fontReg, size: 6.5, color: rgb(0.7, 0.85, 1) })
    return yPos - 22 - 8
  }

  y = drawSection('SECCIÓN 1 – IDENTIDAD DE LA EMPRESA', 'Complete los datos básicos de su organización.', y)
  y = drawField('Nombre de la empresa', 'NOMBRE_EMPRESA', y, true, 'Ej: Industrias XYZ S.A.S.')

  {
    const halfW = (CW - 6) / 2; const rowY = y; const labelH = 11; const fieldH = 18
    page.drawText('Ciudad / Ubicación', { x: ML, y: rowY - labelH + 3, font: fontReg, size: 7.8, color: NAVY })
    page.drawRectangle({ x: ML, y: rowY - labelH - fieldH, width: halfW, height: fieldH, color: GRAY5, borderColor: GRAY3, borderWidth: 0.75 })
    const ub = form.createTextField('form.UBICACION')
    ub.addToPage(page, { x: ML + 2, y: rowY - labelH - fieldH + 1, width: halfW - 4, height: fieldH - 2 })
    ub.setFontSize(8)
    const x2 = ML + halfW + 6
    page.drawText('Año de fundación', { x: x2, y: rowY - labelH + 3, font: fontReg, size: 7.8, color: NAVY })
    page.drawRectangle({ x: x2, y: rowY - labelH - fieldH, width: halfW, height: fieldH, color: GRAY5, borderColor: GRAY3, borderWidth: 0.75 })
    const af = form.createTextField('form.ANO_FUNDACION')
    af.addToPage(page, { x: x2 + 2, y: rowY - labelH - fieldH + 1, width: halfW - 4, height: fieldH - 2 })
    af.setFontSize(8)
    y = rowY - labelH - fieldH - 5
  }

  {
    const halfW = (CW - 6) / 2; const rowY = y; const labelH = 11; const fieldH = 18
    page.drawText('Número de empleados', { x: ML, y: rowY - labelH + 3, font: fontReg, size: 7.8, color: NAVY })
    page.drawRectangle({ x: ML, y: rowY - labelH - fieldH, width: halfW, height: fieldH, color: GRAY5, borderColor: GRAY3, borderWidth: 0.75 })
    const ne = form.createTextField('form.NUM_EMPLEADOS')
    ne.addToPage(page, { x: ML + 2, y: rowY - labelH - fieldH + 1, width: halfW - 4, height: fieldH - 2 })
    ne.setFontSize(8)
    const x2 = ML + halfW + 6
    page.drawText('Certificaciones actuales', { x: x2, y: rowY - labelH + 3, font: fontReg, size: 7.8, color: NAVY })
    page.drawRectangle({ x: x2, y: rowY - labelH - fieldH, width: halfW, height: fieldH, color: GRAY5, borderColor: GRAY3, borderWidth: 0.75 })
    const cert = form.createTextField('form.CERTIFICACIONES')
    cert.addToPage(page, { x: x2 + 2, y: rowY - labelH - fieldH + 1, width: halfW - 4, height: fieldH - 2 })
    cert.setFontSize(8)
    y = rowY - labelH - fieldH - 5
  }

  y = drawDropdown('Tipo de empresa (forma jurídica)', 'TIPO_EMPRESA', TIPO_EMPRESA_OPTS, y, true)
  y = drawDropdown('Sector / Industria (sector económico principal)', 'SECTOR', SECTOR_OPTS, y, true)
  y = drawDropdown('Tamaño de la empresa (según número de empleados)', 'TAMANO', TAMANO_OPTS, y, true)

  y -= 4
  y = drawSection('SECCIÓN 2 – CONTEXTO OPERACIONAL Y SGC', 'Cláusulas 4.2, 4.3 y 8', y)
  y = drawTextArea('Productos y/o Servicios', 'PRODUCTOS_SERVICIOS', y, 58,
    'Describa los principales productos y/o servicios que ofrece la empresa.')
  y = drawTextArea('Mercado objetivo', 'MERCADO_OBJETIVO', y, 44,
    'Segmentos, geografías y tipos de cliente.')
  y = drawTextArea('Partes interesadas', 'PARTES_INTERESADAS', y, 44,
    'Ej: clientes, empleados, proveedores, accionistas, entes reguladores...')
  y = drawTextArea('Alcance del SGC', 'ALCANCE_SGC', y, 44,
    'Límites y aplicabilidad del Sistema de Gestión de Calidad.')

  const FY = 18
  page.drawRectangle({ x: 0, y: 0, width, height: FY, color: NAVY })
  page.drawText('Governex · Análisis de Contexto Organizacional',
    { x: ML, y: 5, font: fontReg, size: 6.5, color: rgb(0.7, 0.85, 1) })
  page.drawText('Página 1 / 1', { x: width - MR - 38, y: 5,
    font: fontReg, size: 6.5, color: rgb(0.7, 0.85, 1) })

  return doc.save()
}

/* ── Descarga del PDF generado ──────────────────────────────── */
async function descargarPlantilla() {
  const bytes = await generarPlantillaPDF()
  // `pdf-lib` tipa `save()` como Uint8Array<ArrayBufferLike>, que las
  // definiciones DOM más recientes de TypeScript no aceptan como
  // BlobPart de forma estructural. En runtime, Blob sí acepta cualquier
  // Uint8Array sin problema — es solo un desajuste de tipos.
  const blob  = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  a.href      = url
  a.download  = 'plantilla_governex_organizacion.pdf'
  a.click()
  URL.revokeObjectURL(url)
}

/* ── Lectura de los campos de un PDF (AcroForm) con pdf-lib ─── */
async function leerCamposPDF(arrayBuffer: ArrayBuffer): Promise<Record<string, string>> {
  const { PDFDocument } = await import('pdf-lib')
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const form   = pdfDoc.getForm()
  const out: Record<string, string> = {}

  for (const field of form.getFields()) {
    const name  = field.getName()
    const clave = name.startsWith('form.') ? name.slice(5) : name
    if (typeof (field as any).getText === 'function') {
      out[clave] = ((field as any).getText() ?? '').trim()
    } else if (typeof (field as any).getSelected === 'function') {
      const sel = (field as any).getSelected() as string[]
      const val = (sel && sel[0]) || ''
      out[clave] = val === '— Seleccione —' ? '' : val.trim()
    }
  }
  return out
}

/* ── Validación de campos extraídos ─────────────────────────── */
function parsearCampos(campos: Record<string, string>): Partial<DatosEmpresa> & { _ok: boolean; _error?: string } {
  const get = (k: string) => (campos[k] || '').trim()
  const nombreEmpresa      = get('NOMBRE_EMPRESA')
  const sector             = get('SECTOR')
  const tipoEmpresa        = get('TIPO_EMPRESA')
  const tamano             = get('TAMANO')
  const productosServicios = get('PRODUCTOS_SERVICIOS')

  if (!nombreEmpresa)      return { _ok: false, _error: 'El campo "Nombre de la empresa" está vacío.' }
  if (!sector)             return { _ok: false, _error: 'El campo "Sector / Industria" está vacío.' }
  if (!tipoEmpresa)        return { _ok: false, _error: 'El campo "Tipo de empresa" está vacío.' }
  if (!tamano)             return { _ok: false, _error: 'El campo "Tamaño de la empresa" está vacío.' }
  if (!productosServicios) return { _ok: false, _error: 'El campo "Productos y/o Servicios" está vacío.' }

  return {
    _ok: true,
    nombreEmpresa,
    sector,
    tipoEmpresa,
    tamano,
    ubicacion:         get('UBICACION'),
    anoFundacion:      get('ANO_FUNDACION'),
    cantidadEmpleados: get('NUM_EMPLEADOS'),
    certificaciones:   get('CERTIFICACIONES'),
    productosServicios,
    mercadoObjetivo:   get('MERCADO_OBJETIVO'),
    parteInteresadas:  get('PARTES_INTERESADAS'),
    alcanceSGC:        get('ALCANCE_SGC'),
    mision:            '',
    vision:            '',
    politicaCalidad:   '',
  }
}

/* ── Base64 helper ───────────────────────────────────────────── */
function leerArchivoComoBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader  = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(f)
  })
}

/* ── Generación de Misión, Visión y Política de Calidad con IA ─ */
async function generarIdearioConIA(datos: Partial<DatosEmpresa>): Promise<TextosIdeario> {
  const token = localStorage.getItem('governex_token')
  const BASE  = import.meta.env.VITE_API_URL || ''

  const response = await fetch(`${BASE}/api/gemini/generar-ideario`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ datosEmpresa: datos }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `Error ${response.status}` }))
    throw new Error(err.error || `Error ${response.status}`)
  }

  const result = await response.json()

  return {
    mision:          result.mision          || '',
    vision:          result.vision          || '',
    politicaCalidad: result.politicaCalidad || '',
  }
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE
   ══════════════════════════════════════════════════════════════ */
const PlantillaOrganizacion: React.FC<Props> = ({ currentDatos, onDatosYOrganigramaListos, onCancel }) => {
  const fileRef    = useRef<HTMLInputElement>(null)
  const orgFileRef = useRef<HTMLInputElement>(null)

  const [archivo,     setArchivo]     = useState<File | null>(null)
  const [cargando,    setCargando]    = useState(false)
  const [generando,   setGenerando]   = useState(false)
  const [parseado,    setParseado]    = useState<{ datos: DatosEmpresa } | null>(null)
  const [archivoOrg,  setArchivoOrg]  = useState<File | null>(null)
  const [cargandoOrg, setCargandoOrg] = useState(false)
  const [organigrama, setOrganigrama] = useState<{ b64: string; mime: string; nombre: string; url: string } | null>(null)

  /* ── Estado del ideario generado por IA ─────────────────── */
  const [ideario,         setIdeario]         = useState<TextosIdeario | null>(null)
  const [generandoIdeario, setGenerandoIdeario] = useState(false)
  const [idearioEditado,  setIdearioEditado]  = useState<TextosIdeario | null>(null)

  /* ── Descargar ─────────────────────────────────────────── */
  const handleDescargar = async () => {
    setGenerando(true)
    try {
      await descargarPlantilla()
      Swal.fire({
        icon: 'success',
        title: '¡Formulario descargado!',
        html: `<div style="text-align:left;font-size:.875rem;line-height:1.7;color:#374151">
          <p><strong>Pasos:</strong></p>
          <ol style="padding-left:1.25rem;margin:.4rem 0">
            <li>Abre <strong>plantilla_governex_organizacion.pdf</strong></li>
            <li>Completa todos los campos marcados con <span style="color:#DC2626">*</span>.</li>
            <li>Guarda el archivo y cárgalo aquí con <strong>"Cargar Formulario"</strong>.</li>
          </ol>
        </div>`,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#1a6ebd',
        width: 520,
      })
    } catch {
      Swal.fire({ icon: 'error', title: 'Error al generar la plantilla', confirmButtonColor: '#1a6ebd' })
    } finally {
      setGenerando(false)
    }
  }

  /* ── Cargar formulario PDF ─────────────────────────────── */
  const handleArchivoSeleccionado = async (f: File) => {
  setArchivo(f)
  setParseado(null)
  setIdeario(null)
  setIdearioEditado(null)
  setCargando(true)

  let datosEmpresa: DatosEmpresa | null = null

  try {
    const campos = await leerCamposPDF(await f.arrayBuffer())
    const parsed = parsearCampos(campos)

    if (!parsed._ok) {
      Swal.fire({ icon: 'warning', title: 'Campos incompletos', text: parsed._error, confirmButtonColor: '#1a6ebd' })
      setArchivo(null)
      return
    }

    const { _ok, _error, ...datos } = parsed

    // ── NUEVO: subir el PDF a R2 ──
    let pdfUrl = ''
    let pdfNombre = ''
    try {
      const subido = await uploadFile(f)
      pdfUrl = subido.url
      pdfNombre = subido.nombre
    } catch (e) {
      console.warn('No se pudo subir el formulario PDF a R2:', e)
      // No bloqueamos el flujo: el análisis puede continuar sin el archivo guardado
    }

    datosEmpresa = { ...(datos as DatosEmpresa), pdfFormularioUrl: pdfUrl, pdfFormularioNombre: pdfNombre }
    setParseado({ datos: datosEmpresa })
  } catch {
    Swal.fire({ icon: 'error', title: 'Error al procesar el formulario PDF', confirmButtonColor: '#1a6ebd' })
    setArchivo(null)
    return
  } finally {
    setCargando(false)
  }

  if (!datosEmpresa) return

  setGenerandoIdeario(true)
  try {
    const textos = await generarIdearioConIA(datosEmpresa)
    setIdeario(textos)
    setIdearioEditado(textos)
  } catch {
    Swal.fire({ icon: 'error', title: 'Error al generar el ideario', confirmButtonColor: '#1a6ebd' })
  } finally {
    setGenerandoIdeario(false)
  }
}

  /* ── Regenerar ideario manualmente ────────────────────── */
  const handleRegenerarIdeario = async () => {
    if (!parseado) return
    setGenerandoIdeario(true)
    try {
      const textos = await generarIdearioConIA(parseado.datos)
      setIdeario(textos)
      setIdearioEditado(textos)
    } catch {
      Swal.fire({ icon: 'error', title: 'Error al generar el ideario', confirmButtonColor: '#1a6ebd' })
    } finally {
      setGenerandoIdeario(false)
    }
  }

  /* ── Cargar organigrama ────────────────────────────────── */
  const handleOrganigramaSeleccionado = async (f: File) => {
  const ext = `.${f.name.split('.').pop()?.toLowerCase() ?? ''}`
  if (!TIPOS_ORGANIGRAMA_PERMITIDOS.includes(f.type) && !EXT_ORGANIGRAMA_PERMITIDAS.includes(ext)) {
    Swal.fire({ icon: 'warning', title: 'Formato no soportado',
      text: 'El organigrama debe ser PDF, JPG, JPEG, PNG o WEBP.', confirmButtonColor: '#1a6ebd' })
    return
  }
  setArchivoOrg(f); setOrganigrama(null); setCargandoOrg(true)
  try {
    const [b64, subido] = await Promise.all([
      leerArchivoComoBase64(f),
      uploadFile(f).catch(e => {
        console.warn('No se pudo subir el organigrama a R2:', e)
        return null // no bloquea el análisis si falla la subida
      }),
    ])
    setOrganigrama({
      b64,
      mime: f.type || 'application/octet-stream',
      nombre: f.name,
      url: subido?.url ?? '',
    })
  } catch {
    Swal.fire({ icon: 'error', title: 'Error al leer el organigrama', confirmButtonColor: '#1a6ebd' })
    setArchivoOrg(null)
  } finally {
    setCargandoOrg(false)
  }
}

  /* ── Analizar: combina datos + ideario editado ─────────── */
  const handleAnalizar = () => {
    if (!parseado || !organigrama) return

    Swal.fire({
      title: '¿Confirmar nuevo análisis?',
      html: '<p style="font-size:0.875rem;line-height:1.5;color:#374151">Ten en cuenta que un nuevo análisis con la IA de Governex <b>puede generar un resultado diferente</b> a los actuales (como el PESTEL, DOFA o Caracterización existentes).</p>',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, analizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1a6ebd',
      cancelButtonColor: '#6b7280'
    }).then((result) => {
      if (result.isConfirmed) {
        const datosFinales: DatosEmpresa = {
          ...parseado.datos,
          mision:           idearioEditado?.mision           ?? '',
          vision:           idearioEditado?.vision           ?? '',
          politicaCalidad:  idearioEditado?.politicaCalidad  ?? '',
          organigramaUrl:    organigrama.url,
          organigramaNombre: organigrama.nombre,
        }
        onDatosYOrganigramaListos(datosFinales, organigrama.b64, organigrama.mime, organigrama.nombre)
      }
    })
  }

  const listo = !!parseado && !!organigrama && !!ideario

  return (
    <div className="plantilla-org panel">

      {/* Header */}
      <div className="plantilla-org__header">
        <div className="plantilla-org__header-icon">📋</div>
        <div>
          <h3>Plantilla de Contexto Organizacional</h3>
          <p>Descarga el formulario PDF interactivo, complétalo, y cárgalo junto con el organigrama. Governex generará automáticamente la Misión, Visión y Política de Calidad.</p>
        </div>
      </div>

      {/* Pasos */}
      <div className="plantilla-org__steps">
        {[
          { n: 1, t: 'Descarga el formulario', d: 'PDF interactivo con campos rellenables (Secciones 1 y 2).' },
          { n: 2, t: 'Completa y guarda', d: 'Rellena y guarda el PDF.' },
          { n: 3, t: 'Carga y analiza', d: 'Sube el PDF y el organigrama. Governex genera la Misión, Visión y Política de Calidad.' },
        ].map((s, i, arr) => (
          <React.Fragment key={s.n}>
            <div className="plantilla-org__step">
              <div className="plantilla-org__step-num">{s.n}</div>
              <div>
                <div className="plantilla-org__step-title">{s.t}</div>
                <div className="plantilla-org__step-desc">{s.d}</div>
              </div>
            </div>
            {i < arr.length - 1 && <div className="plantilla-org__step-arrow">→</div>}
          </React.Fragment>
        ))}
      </div>

      {/* Current Files if Analysis exists */}
      {currentDatos && (currentDatos.pdfFormularioUrl || currentDatos.organigramaUrl) && (
        <div className="plantilla-org__current-files">
          <h4>📂 Archivos del Análisis Actual</h4>
          <p className="plantilla-org__current-files-desc">Puedes descargar y revisar el formulario y organigrama que se encuentran activos actualmente en el SGC:</p>
          <div className="plantilla-org__current-grid">
            {currentDatos.pdfFormularioUrl && (
              <div className="plantilla-org__current-file-card">
                <span className="current-file-icon">📄</span>
                <div className="current-file-info">
                  <div className="current-file-title">Formulario de Contexto</div>
                  <div className="current-file-name">{currentDatos.pdfFormularioNombre || 'plantilla_contexto.pdf'}</div>
                </div>
                <button
                  type="button"
                  className="btn-download-mini"
                  onClick={() => openSignedFile(currentDatos.pdfFormularioUrl!)}
                >
                  Descargar ⬇️
                </button>
              </div>
            )}
            
            {currentDatos.organigramaUrl && (
              <div className="plantilla-org__current-file-card">
                <span className="current-file-icon">🖼️</span>
                <div className="current-file-info">
                  <div className="current-file-title">Organigrama de la Empresa</div>
                  <div className="current-file-name">{currentDatos.organigramaNombre || 'organigrama.pdf'}</div>
                </div>
                <button
                  type="button"
                  className="btn-download-mini"
                  onClick={() => openSignedFile(currentDatos.organigramaUrl!)}
                >
                  Descargar ⬇️
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botón descargar */}
      <button className="plantilla-org__btn-download" onClick={handleDescargar} disabled={generando}>
        <span className="plantilla-org__btn-icon">{generando ? '⏳' : '⬇️'}</span>
        <div>
          <div className="plantilla-org__btn-title">
            {generando ? 'Generando formulario…' : 'Descargar Formulario PDF'}
          </div>
          <div className="plantilla-org__btn-sub">plantilla_governex_organizacion.pdf</div>
        </div>
      </button>

      {/* Dropzone: formulario */}
      <div className="plantilla-org__upload-label">
        <span className="plantilla-org__upload-label-num">1</span>
        Formulario completado (.pdf)
      </div>
      <div
        className={`plantilla-org__dropzone ${parseado ? 'plantilla-org__dropzone--loaded' : ''}`}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleArchivoSeleccionado(f) }}
        onClick={() => !cargando && !generandoIdeario && fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleArchivoSeleccionado(f) }} />
        {cargando
          ? (<><span className="plantilla-org__drop-icon">⏳</span><span className="plantilla-org__drop-title">Procesando formulario…</span></>)
          : generandoIdeario
            ? (<><span className="plantilla-org__drop-icon">✨</span><span className="plantilla-org__drop-title">Generando Misión, Visión y Política de Calidad…</span><span className="plantilla-org__drop-sub">La IA está analizando los datos de la empresa</span></>)
            : archivo && parseado
              ? (<><span className="plantilla-org__drop-icon">✅</span><span className="plantilla-org__drop-title">{archivo.name}</span><span className="plantilla-org__drop-sub">{parseado.datos.nombreEmpresa} · {parseado.datos.sector}</span></>)
              : (<><span className="plantilla-org__drop-icon">📂</span><span className="plantilla-org__drop-title">Cargar Formulario Completado</span><span className="plantilla-org__drop-sub">Arrastra o haz clic · Solo .pdf de Governex</span></>)}
      </div>

      {/* ── Panel del Ideario generado por IA ──────────────── */}
      {parseado && (
        <div className="plantilla-org__ideario">
          <div className="plantilla-org__ideario-header">
            <div className="plantilla-org__ideario-title">
              <span>✨</span>
              <span>Misión, Visión y Política de Calidad</span>
              <span className="plantilla-org__ideario-badge">Generado por IA</span>
            </div>
            <button
              className="plantilla-org__ideario-regen"
              onClick={handleRegenerarIdeario}
              disabled={generandoIdeario}
              title="Regenerar con IA"
            >
              {generandoIdeario ? '⏳' : '🔄'} {generandoIdeario ? 'Generando…' : 'Regenerar'}
            </button>
          </div>

          {generandoIdeario && !ideario ? (
            <div className="plantilla-org__ideario-loading">
              <div className="plantilla-org__ideario-spinner" />
              <span>Analizando datos de la empresa y redactando textos</span>
            </div>
          ) : idearioEditado ? (
            <div className="plantilla-org__ideario-fields">

              {/* Misión */}
              <div className="plantilla-org__ideario-field">
                <label className="plantilla-org__ideario-label">
                  <span className="plantilla-org__ideario-label-icon">🎯</span>
                  Misión
                  <span className="plantilla-org__ideario-editable-hint">Editable</span>
                </label>
                <textarea
                  className="plantilla-org__ideario-textarea"
                  value={idearioEditado.mision}
                  onChange={e => setIdearioEditado(prev => prev ? { ...prev, mision: e.target.value } : prev)}
                  rows={3}
                  placeholder="Governex IA generará la misión automáticamente al cargar el formulario…"
                />
              </div>

              {/* Visión */}
              <div className="plantilla-org__ideario-field">
                <label className="plantilla-org__ideario-label">
                  <span className="plantilla-org__ideario-label-icon">🚀</span>
                  Visión
                  <span className="plantilla-org__ideario-editable-hint">Editable</span>
                </label>
                <textarea
                  className="plantilla-org__ideario-textarea"
                  value={idearioEditado.vision}
                  onChange={e => setIdearioEditado(prev => prev ? { ...prev, vision: e.target.value } : prev)}
                  rows={2}
                  placeholder="Governex IA generará la visión automáticamente al cargar el formulario…"
                />
              </div>

              {/* Política de Calidad */}
              <div className="plantilla-org__ideario-field">
                <label className="plantilla-org__ideario-label">
                  <span className="plantilla-org__ideario-label-icon">📜</span>
                  Política de Calidad
                  <span className="plantilla-org__ideario-editable-hint">Editable</span>
                </label>
                <textarea
                  className="plantilla-org__ideario-textarea"
                  value={idearioEditado.politicaCalidad}
                  onChange={e => setIdearioEditado(prev => prev ? { ...prev, politicaCalidad: e.target.value } : prev)}
                  rows={4}
                  placeholder="Governex IA generará la política de calidad automáticamente al cargar el formulario…"
                />
              </div>

              <p className="plantilla-org__ideario-hint">
                💡 Estos textos se incluirán en el análisis completo de Governex. Puedes editarlos antes de continuar.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Dropzone: organigrama */}
      <div className="plantilla-org__upload-label">
        <span className="plantilla-org__upload-label-num">2</span>
        Organigrama de la empresa
      </div>
      <div
        className={`plantilla-org__dropzone ${organigrama ? 'plantilla-org__dropzone--loaded' : ''}`}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleOrganigramaSeleccionado(f) }}
        onClick={() => !cargandoOrg && orgFileRef.current?.click()}
      >
        <input ref={orgFileRef} type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleOrganigramaSeleccionado(f) }} />
        {cargandoOrg
          ? (<><span className="plantilla-org__drop-icon">⏳</span><span className="plantilla-org__drop-title">Procesando organigrama…</span></>)
          : archivoOrg && organigrama
            ? (<><span className="plantilla-org__drop-icon">{organigrama.mime === 'application/pdf' ? '📄' : '🖼️'}</span><span className="plantilla-org__drop-title">{archivoOrg.name}</span><span className="plantilla-org__drop-sub">Organigrama cargado correctamente</span></>)
            : (<><span className="plantilla-org__drop-icon">🗂️</span><span className="plantilla-org__drop-title">Cargar Organigrama</span><span className="plantilla-org__drop-sub">Arrastra o haz clic · PDF, JPG, JPEG, PNG o WEBP</span></>)}
      </div>

      {/* Footer */}
      <div className="plantilla-org__footer">
        <button className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
        <button
          className="btn btn--primary"
          onClick={handleAnalizar}
          disabled={!listo}
          style={{ opacity: listo ? 1 : 0.45, cursor: listo ? 'pointer' : 'not-allowed' }}
        >
          Analizar con Governex IA →
        </button>
      </div>
    </div>
  )
}

export default PlantillaOrganizacion