import React, { useState, useEffect } from 'react'
import './EnfoqueClientePage.css'
import { useAIAnalysis } from '../../context/AIAnalysisContext'
import {
  enfoqueClienteService, EncuestasSatisfaccion, EncuestaGenerada,
  AnalisisEncuestasResult, DofaEncuestaItem,
} from '../../services'
import {
  generarEncuestaPDF, leerRespuestasPDF, generarPqrsPDF, descargarBytes,
} from '../../utils/surveyPdf'
import { useFetch } from '../../hooks/useFetch'
import { pqrsBackendService, archivosEnfoqueService, respuestasEncuestaService, uploadsService } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'
/* ══════════════════════════════════════════════════════════════
   TIPOS LOCALES (sin persistencia en BD — solo estado en memoria)
   ══════════════════════════════════════════════════════════════ */
type TipoArchivo = 'Encuesta Cliente' | 'Encuesta Proveedor' | 'PQRS' | 'Otro'

interface ArchivoSubido {
  id:     number
  nombre: string
  tipo:   TipoArchivo
  sizeKB: number
  fecha:  string
  url?:   string
}

interface RespuestaEncuesta {
  id:               number
  archivoNombre:    string
  tipo:             'cliente' | 'proveedor'
  campos:           Record<string, string>
  nombreEncuestado: string
  fecha:            string
}

type TipoPqrs   = 'Petición' | 'Queja' | 'Reclamo' | 'Sugerencia'
type EstadoPqrs = 'Abierta' | 'En Proceso' | 'Cerrada'

interface PqrsItem {
  id:          number
  tipo:        TipoPqrs
  origen:      string
  fecha:       string
  descripcion: string
  estado:      EstadoPqrs
}

/* ── Helpers de agregación ──────────────────────────────────────── */
function idsDeEncuesta(e?: EncuestaGenerada): Set<string> {
  const s = new Set<string>()
  e?.categorias.forEach(c => c.preguntas.forEach(p => s.add(p.id)))
  return s
}

function detectarTipoRespuesta(campos: Record<string, string>, encuestas: EncuestasSatisfaccion | null): 'cliente' | 'proveedor' | 'desconocido' {
  const keys = Object.keys(campos).filter(k => k !== 'encuestado_nombre' && k !== 'encuestado_fecha')
  if (keys.length === 0) return 'desconocido'

  if (encuestas) {
    const clientIds = idsDeEncuesta(encuestas.clientes)
    const providerIds = idsDeEncuesta(encuestas.proveedores)
    let clientMatches = 0
    let providerMatches = 0

    keys.forEach(k => {
      if (clientIds.has(k)) clientMatches++
      if (providerIds.has(k)) providerMatches++
    })

    if (clientMatches > 0 || providerMatches > 0) {
      return clientMatches > providerMatches ? 'cliente' : 'proveedor'
    }
  }

  let clientPrefixMatches = 0
  let providerPrefixMatches = 0
  keys.forEach(k => {
    if (k.startsWith('c')) clientPrefixMatches++
    if (k.startsWith('p')) providerPrefixMatches++
  })

  if (clientPrefixMatches > 0 || providerPrefixMatches > 0) {
    return clientPrefixMatches > providerPrefixMatches ? 'cliente' : 'proveedor'
  }

  return 'desconocido'
}

async function detectarTipoArchivoAutomatico(
  file: File,
  encuestas: EncuestasSatisfaccion | null
): Promise<TipoArchivo> {
  if (file.type === 'application/pdf') {
    try {
      const { campos } = await leerRespuestasPDF(file)
      const tipoRespuesta = detectarTipoRespuesta(campos, encuestas)
      if (tipoRespuesta === 'cliente') return 'Encuesta Cliente'
      if (tipoRespuesta === 'proveedor') return 'Encuesta Proveedor'
    } catch (err) {
      console.error('Error al intentar leer campos del PDF:', err)
    }
  }

  const nombreLower = file.name.toLowerCase()
  if (nombreLower.includes('proveedor') || nombreLower.includes('supplier') || nombreLower.includes('vendor')) {
    return 'Encuesta Proveedor'
  }
  if (
    nombreLower.includes('cliente') ||
    nombreLower.includes('satisfaccion') ||
    nombreLower.includes('satisfacción') ||
    nombreLower.includes('encuesta') ||
    nombreLower.includes('client') ||
    nombreLower.includes('survey') ||
    nombreLower.includes('customer')
  ) {
    return 'Encuesta Cliente'
  }
  if (
    nombreLower.includes('pqrs') ||
    nombreLower.includes('peticion') ||
    nombreLower.includes('petición') ||
    nombreLower.includes('queja') ||
    nombreLower.includes('reclamo') ||
    nombreLower.includes('sugerencia') ||
    nombreLower.includes('reclamacion') ||
    nombreLower.includes('reclamación')
  ) {
    return 'PQRS'
  }

  return 'Otro'
}

function agregarRespuestas(encuesta: EncuestaGenerada | undefined, respuestas: RespuestaEncuesta[]) {
  if (!encuesta || respuestas.length === 0) return { totalEncuestas: 0, promediosPorCategoria: [], respuestasAbiertas: [] }

  const porCategoria: Record<string, { suma: number; conteo: number }> = {}
  encuesta.categorias.forEach(c => { porCategoria[c.categoria] = { suma: 0, conteo: 0 } })
  const abiertas: string[] = []

  for (const resp of respuestas) {
    for (const cat of encuesta.categorias) {
      for (const p of cat.preguntas) {
        const val = resp.campos[p.id]
        if (!val) continue
        if (p.tipo === 'escala') {
          const num = parseInt(val, 10)
          if (!isNaN(num)) { porCategoria[cat.categoria].suma += num; porCategoria[cat.categoria].conteo += 1 }
        } else if (val.trim()) {
          abiertas.push(val.trim())
        }
      }
    }
  }

  const promediosPorCategoria = Object.entries(porCategoria)
    .filter(([, v]) => v.conteo > 0)
    .map(([categoria, v]) => ({ categoria, promedio: +(v.suma / v.conteo).toFixed(2) }))

  return { totalEncuestas: respuestas.length, promediosPorCategoria, respuestasAbiertas: abiertas.slice(0, 40) }
}

const DOFA_ORDEN: DofaEncuestaItem['tipo'][] = ['Fortaleza', 'Oportunidad', 'Debilidad', 'Amenaza']
const DOFA_STYLE: Record<DofaEncuestaItem['tipo'], { icon: string; clase: string }> = {
  Fortaleza:   { icon: '💪', clase: 'fortaleza' },
  Oportunidad: { icon: '🚀', clase: 'oportunidad' },
  Debilidad:   { icon: '⚠️', clase: 'debilidad' },
  Amenaza:     { icon: '🔻', clase: 'amenaza' },
}

const EnfoqueClientePage: React.FC = () => {
  const { canEdit } = usePermissions('enfoque_cliente')
  const { datosEmpresa } = useAIAnalysis()
  const [activeTab, setActiveTab] = useState<'encuestas' | 'archivos'>('encuestas')

  /* ── Generación de encuestas con IA ──────────────────────── */
  const [encuestas, setEncuestas] = useState<EncuestasSatisfaccion | null>(() => {
    try {
      const saved = localStorage.getItem('governex_encuestas_templates')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [loadingIA, setLoadingIA] = useState(false)
  const [errorIA, setErrorIA]     = useState<string | null>(null)
  const [descargando, setDescargando] = useState<string | null>(null)

  const generarEncuestas = async () => {
    if (!datosEmpresa?.nombreEmpresa) {
      setErrorIA('Primero completa el módulo "Contexto de la Organización" (§4.1) con los datos de la empresa.')
      return
    }
    setLoadingIA(true); setErrorIA(null)
    try {
      const data = await enfoqueClienteService.generarEncuestas(datosEmpresa)
      setEncuestas(data)
      localStorage.setItem('governex_encuestas_templates', JSON.stringify(data))
    } catch (e: any) {
      setErrorIA(e.message || 'Error al generar las encuestas')
    } finally {
      setLoadingIA(false)
    }
  }

  const copiarEncuesta = (encuesta: EncuestaGenerada) => {
    let texto = `${encuesta.titulo}\n${encuesta.introduccion}\n\n`
    encuesta.categorias.forEach(cat => {
      texto += `── ${cat.categoria} ──\n`
      cat.preguntas.forEach((p, i) => {
        texto += `${i + 1}. ${p.texto}${p.tipo === 'escala' ? '  (1 - 2 - 3 - 4 - 5)' : ''}\n`
      })
      texto += '\n'
    })
    navigator.clipboard.writeText(texto).then(() => alert('Encuesta copiada al portapapeles ✅'))
  }

  const descargarEncuestaPDF = async (encuesta: EncuestaGenerada, variant: 'cliente' | 'proveedor') => {
    setDescargando(variant)
    try {
      const bytes = await generarEncuestaPDF(encuesta, variant, datosEmpresa?.nombreEmpresa)
      descargarBytes(bytes, variant === 'cliente' ? 'encuesta_clientes.pdf' : 'encuesta_proveedores.pdf')
    } catch (e: any) {
      alert('No se pudo generar el PDF: ' + (e.message || e))
    } finally {
      setDescargando(null)
    }
  }

  /* ── Carga manual de archivos (encuestas respondidas / PQRS) ─
     NOTA: solo se guarda en memoria del navegador, sin persistencia. */
  const { data: archivosDB, refetch: refetchArchivos } = useFetch(archivosEnfoqueService.getAll, [])
  const { data: respuestasDB, refetch: refetchRespuestas } = useFetch(respuestasEncuestaService.getAll, [])

  const archivos: ArchivoSubido[] = archivosDB.map((a: any) => ({
    id: a.id, nombre: a.nombre, tipo: a.tipo,
    url: a.url,
    sizeKB: Math.round((a.tamano_bytes ?? 0) / 1024),
    fecha: new Date(a.subido_en).toISOString().slice(0, 10),
  }))

  const respuestasEncuestas: RespuestaEncuesta[] = respuestasDB.map((r: any) => ({
    id: r.id, archivoNombre: r.archivo_nombre, tipo: r.tipo,
    campos: r.campos, nombreEncuestado: r.nombre_encuestado ?? '', fecha: r.fecha ?? '',
  }))

  const [procesandoArchivos, setProcesandoArchivos] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setProcesandoArchivos(true)

    const fileArray = Array.from(files)

    for (const f of fileArray) {
      try {
        const tipoDetectado = await detectarTipoArchivoAutomatico(f, encuestas)
        const uploaded = await uploadsService.upload(f)
        const archivoDB = await archivosEnfoqueService.create({
          nombre: uploaded.nombre,
          tipo: tipoDetectado,
          url: uploaded.url,
          tipoMime: uploaded.tipoMime,
          tamanoBytes: uploaded.tamanoBytes,
        })

        const esEncuesta = tipoDetectado === 'Encuesta Cliente' || tipoDetectado === 'Encuesta Proveedor'
        if (esEncuesta && f.type === 'application/pdf') {
          try {
            const { campos, nombre, fecha } = await leerRespuestasPDF(f)
            const detectado = detectarTipoRespuesta(campos, encuestas)
            const tipoFinal = detectado !== 'desconocido'
              ? detectado
              : (tipoDetectado === 'Encuesta Cliente' ? 'cliente' : 'proveedor')

            await respuestasEncuestaService.create({
              archivoId: archivoDB.id,
              archivoNombre: f.name,
              tipo: tipoFinal,
              campos,
              nombreEncuestado: nombre,
              fecha,
            })
          } catch (err) {
            console.error('No se pudieron leer las respuestas del PDF:', err)
          }
        }
      } catch (err: any) {
        alert(`No se pudo subir "${f.name}": ${err.message || err}`)
      }
    }

    await Promise.all([refetchArchivos(), refetchRespuestas()])
    setProcesandoArchivos(false)
    e.target.value = ''
  }

  const eliminarArchivo = async (id: number) => {
    try { await archivosEnfoqueService.delete(id) } catch {}
    await Promise.all([refetchArchivos(), refetchRespuestas()])
  }

  /* ── PQRS manual ──────────────────────────────────────────── */
  const { data: pqrsDB, refetch: refetchPqrs } = useFetch(pqrsBackendService.getAll, [])
  const pqrsList: PqrsItem[] = pqrsDB.map((p: any) => ({
    id: p.id, tipo: p.tipo, origen: p.origen, fecha: p.fecha,
    descripcion: p.descripcion, estado: p.estado,
  }))
  const [showPqrsModal, setShowPqrsModal] = useState(false)
  const [pqrsGuardada, setPqrsGuardada]   = useState<PqrsItem | null>(null)
  const [newPqrs, setNewPqrs] = useState<Omit<PqrsItem, 'id'>>({
    tipo: 'Petición', origen: '', fecha: new Date().toISOString().slice(0, 10),
    descripcion: '', estado: 'Abierta',
  })

  const abrirModalPqrs = () => { setPqrsGuardada(null); setShowPqrsModal(true) }
  const cerrarModalPqrs = () => { setShowPqrsModal(false); setPqrsGuardada(null) }

  const agregarPqrs = async () => {
    if (!newPqrs.origen.trim() || !newPqrs.descripcion.trim()) return
    try {
      const creada = await pqrsBackendService.create(newPqrs)
      await refetchPqrs()
      setPqrsGuardada({ id: creada.id, ...newPqrs })
      setNewPqrs({ tipo: 'Petición', origen: '', fecha: new Date().toISOString().slice(0, 10), descripcion: '', estado: 'Abierta' })
    } catch (e: any) {
      alert('No se pudo guardar la PQRS: ' + (e.message || e))
    }
  }

  const descargarPqrsPDF = async (pqrs: PqrsItem) => {
    try {
      const bytes = await generarPqrsPDF(pqrs, datosEmpresa?.nombreEmpresa)
      descargarBytes(bytes, `PQRS_${pqrs.tipo}_${pqrs.id}.pdf`)
    } catch (e: any) {
      alert('No se pudo generar el PDF: ' + (e.message || e))
    }
  }

  const cambiarEstadoPqrs = async (id: number, estado: EstadoPqrs) => {
    const item = pqrsList.find(p => p.id === id)
    if (!item) return
    try {
      await pqrsBackendService.update(id, { ...item, estado })
      await refetchPqrs()
    } catch (e: any) {
      alert('No se pudo actualizar la PQRS: ' + (e.message || e))
    }
  }

  const eliminarPqrs = async (id: number) => {
    try { await pqrsBackendService.delete(id) } catch {}
    await refetchPqrs()
  }

  /* ── Análisis DOFA generado por IA a partir de encuestas + PQRS ─ */
  const [analisis, setAnalisis] = useState<AnalisisEncuestasResult | null>(null)
  const [documentosAnalizados, setDocumentosAnalizados] = useState<string[]>([])
  const [loadingAnalisis, setLoadingAnalisis] = useState(false)
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null)

  useEffect(() => {
    const cargarAnalisisGuardado = async () => {
      try {
        const saved = await enfoqueClienteService.getAnalisis()
        if (saved) {
          setAnalisis({
            resumenEjecutivo: saved.resumenEjecutivo,
            dofa: saved.dofa
          })
          setDocumentosAnalizados(saved.documentos || [])
        }
      } catch (err) {
        console.error('Error al cargar el análisis de enfoque al cliente persistente:', err)
      }
    }
    cargarAnalisisGuardado()
  }, [])

  const respuestasCliente   = respuestasEncuestas.filter(r => r.tipo === 'cliente')
  const respuestasProveedor = respuestasEncuestas.filter(r => r.tipo === 'proveedor')

  const analizarConIA = async () => {
    if (respuestasEncuestas.length === 0 && pqrsList.length === 0) {
      setErrorAnalisis('Sube al menos una encuesta respondida o registra una PQRS antes de analizar.')
      return
    }
    setLoadingAnalisis(true); setErrorAnalisis(null)
    try {
      const resumenClientes    = agregarRespuestas(encuestas?.clientes, respuestasCliente)
      const resumenProveedores = agregarRespuestas(encuestas?.proveedores, respuestasProveedor)
      
      const nombresDocumentos = [
        ...archivos.map(a => `${a.tipo}: ${a.nombre}`),
        ...pqrsList.map(p => `Registro de PQRS (${p.tipo}) de ${p.origen} - ${p.fecha}`)
      ]

      const result = await enfoqueClienteService.analizarEncuestas({
        datosEmpresa,
        resumenClientes,
        resumenProveedores,
        pqrs: pqrsList.map(p => ({ tipo: p.tipo, descripcion: p.descripcion, estado: p.estado })),
        documentos: nombresDocumentos,
      })

      // Guardar el análisis en la base de datos para persistencia multi-dispositivo/sesión
      await enfoqueClienteService.saveAnalisis({
        resumenEjecutivo: result.resumenEjecutivo,
        dofa: result.dofa,
        documentos: nombresDocumentos
      })

      setAnalisis(result)
      setDocumentosAnalizados(nombresDocumentos)
    } catch (e: any) {
      setErrorAnalisis(e.message || 'Error al generar el análisis')
    } finally {
      setLoadingAnalisis(false)
    }
  }

  /* ── Render de una tarjeta de encuesta ───────────────────── */
  const renderEncuestaCard = (encuesta: EncuestaGenerada, variant: 'cliente' | 'proveedor') => (
    <div className={`enf-encuesta-card enf-encuesta-card--${variant}`}>
      <div className="enf-encuesta-card__header">
        <span className="enf-encuesta-card__tag">{variant === 'cliente' ? '👤 Clientes' : '📦 Proveedores'}</span>
        <h3>{encuesta.titulo}</h3>
        <p>{encuesta.introduccion}</p>
      </div>

      <div className="enf-encuesta-card__body">
        {encuesta.categorias.map(cat => (
          <div key={cat.categoria} className="enf-categoria">
            <h4>{cat.categoria}</h4>
            <ol>
              {cat.preguntas.map(p => (
                <li key={p.id}>
                  {p.texto}
                  {p.tipo === 'escala'
                    ? <span className="enf-escala">1 — 2 — 3 — 4 — 5</span>
                    : <span className="enf-abierta">Respuesta abierta</span>}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="enf-encuesta-card__footer">
        <button className="btn-secondary" onClick={() => copiarEncuesta(encuesta)}>📋 Copiar texto</button>
        <button className="btn-primary" disabled={descargando === variant}
          onClick={() => descargarEncuestaPDF(encuesta, variant)}>
          {descargando === variant ? 'Generando PDF...' : '⬇️ Descargar PDF interactivo'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="enf-page">

      {/* HEADER */}
      <div className="enf-page__header">
        <div className="enf-page__title-block">
          <h1>🤝 Enfoque al Cliente</h1>
          <p>Determinación, comprensión y cumplimiento de los requisitos del cliente y partes interesadas</p>
          <span className="enf-page__clause">Cláusula 5.1.2</span>
        </div>
      </div>

      {/* TABS */}
      <div className="enf-tabs">
        <button className={`enf-tab-btn ${activeTab === 'encuestas' ? 'active' : ''}`} onClick={() => setActiveTab('encuestas')}>
          📝 Encuestas de Satisfacción
        </button>
        <button className={`enf-tab-btn ${activeTab === 'archivos' ? 'active' : ''}`} onClick={() => setActiveTab('archivos')}>
          📥 Respuestas, PQRS y Análisis DOFA
        </button>
      </div>

      {/* ── TAB: ENCUESTAS ─────────────────────────────────────── */}
      {activeTab === 'encuestas' && (
        <div className="enf-tab-panel">

          <div className="enf-ai-panel">
            <div className="enf-ai-panel__info">
              <span className="enf-ai-panel__icon">🤖</span>
              <div>
                <strong>Generar encuestas con Governex IA</strong>
                <p>
                  Se generarán dos encuestas distintas según los productos/servicios de tu empresa: una para
                  <strong> clientes</strong> (oportunidad, calidad, capacidad de entrega, cumplimiento, precios
                  y aspectos a mejorar) y otra para <strong>proveedores</strong> (relación comercial y
                  cumplimiento contractual de la empresa hacia ellos). Se descargan como PDF interactivo,
                  listo para diligenciar en computador.
                </p>
              </div>
            </div>

            {!loadingIA ? (
              <button className="btn-ai-generate" onClick={generarEncuestas} disabled={loadingIA || !canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {encuestas ? '🔄 Regenerar Encuestas' : '✨ Generar Encuestas con IA'}
              </button>
            ) : (
              <div className="enf-ai-loading"><div className="enf-ai-spinner" />Generando encuestas con IA...</div>
            )}

            {errorIA && <div className="enf-ai-error">⚠️ {errorIA}</div>}
          </div>

          {!encuestas && !loadingIA && (
            <div className="enf-empty-state">
              <div className="enf-empty-state__icon">📋</div>
              <h2>Aún no se han generado encuestas</h2>
              <p>Haz clic en <strong>"Generar Encuestas con IA"</strong> para crear automáticamente las encuestas de satisfacción de clientes y proveedores, basadas en el contexto de tu organización (§4.1).</p>
            </div>
          )}

          {encuestas && (
            <div className="enf-encuestas-grid">
              {renderEncuestaCard(encuestas.clientes, 'cliente')}
              {renderEncuestaCard(encuestas.proveedores, 'proveedor')}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ARCHIVOS, PQRS Y ANÁLISIS ─────────────────────── */}
      {activeTab === 'archivos' && (
        <div className="enf-tab-panel">

          <div className="enf-notice">
            ℹ️ Los archivos de encuestas y registros de PQRS se almacenan de manera persistente en la base de datos de la organización. La detección del tipo de documento es automática al subirlos.
          </div>

          {/* SUBIDA DE ARCHIVOS */}
          <div className="panel enf-upload-panel">
            <h3>📤 Subir encuestas respondidas y PQRS</h3>
            <div className="enf-upload-row">
              <label className="enf-upload-btn" title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {procesandoArchivos ? '⏳ Leyendo archivo(s)...' : '📎 Seleccionar archivo(s)'}
                <input type="file" multiple accept="application/pdf" onChange={handleFileUpload} disabled={procesandoArchivos || !canEdit} style={{ display: 'none' }} />
              </label>
            </div>
            <p className="enf-upload-hint">
              Al seleccionar un archivo (por ejemplo, encuestas generadas por Governex u otros PDFs), la plataforma detectará su tipo de forma automática y extraerá las respuestas si corresponde.
            </p>

            {archivos.length === 0 ? (
              <div className="enf-empty-mini">No se han subido archivos en esta sesión.</div>
            ) : (
              <table className="enf-table">
                <thead><tr><th>Archivo</th><th>Tipo</th><th>Lectura</th><th>Tamaño</th><th>Fecha</th><th></th></tr></thead>
                <tbody>
                  {archivos.map(a => {
                    const resp = respuestasEncuestas.find(r => r.id === a.id)
                    return (
                      <tr key={a.id}>
                        <td>{a.nombre}</td>
                        <td><span className="enf-badge">{a.tipo}</span></td>
                        <td>
                          {resp
                            ? <span className="enf-badge enf-badge--ok">✓ {resp.tipo === 'cliente' ? 'Cliente' : 'Proveedor'} · {Object.values(resp.campos).filter(v => v).length} resp.</span>
                            : (a.tipo === 'Encuesta Cliente' || a.tipo === 'Encuesta Proveedor')
                              ? <span className="enf-badge enf-badge--warn">Sin datos leídos</span>
                              : <span className="enf-badge enf-badge--muted">—</span>}
                        </td>
                        <td>{a.sizeKB} KB</td>
                        <td>{a.fecha}</td>
                        <td style={{ display: 'flex', gap: '0.3rem' }}>
                          {a.url && (
                            <PermissionGuard recurso="enfoque_cliente" accion="leer">
                              <a href={a.url} download={a.nombre} target="_blank" rel="noopener noreferrer" className="btn-icon" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Descargar archivo">
                                ⬇️
                              </a>
                            </PermissionGuard>
                          )}
                          <PermissionGuard recurso="enfoque_cliente" accion="eliminar" mode="hide">
                            <button className="btn-icon danger" onClick={() => eliminarArchivo(a.id)}>🗑️</button>
                          </PermissionGuard>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* PQRS */}
          <div className="panel enf-pqrs-panel">
            <div className="enf-pqrs-panel__header">
              <h3>📨 Registro de PQRS</h3>
              <button className="btn-primary" onClick={abrirModalPqrs} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Agregar PQRS</button>
            </div>

            {pqrsList.length === 0 ? (
              <div className="enf-empty-mini">No hay registros de PQRS en esta sesión.</div>
            ) : (
              <table className="enf-table">
                <thead><tr><th>Tipo</th><th>Cliente / Proveedor</th><th>Fecha</th><th>Descripción</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {pqrsList.map(p => (
                    <tr key={p.id}>
                      <td><span className="enf-badge">{p.tipo}</span></td>
                      <td>{p.origen}</td>
                      <td>{p.fecha}</td>
                      <td className="enf-table__desc">{p.descripcion}</td>
                      <td>
                        <select value={p.estado} onChange={e => cambiarEstadoPqrs(p.id, e.target.value as EstadoPqrs)} disabled={!canEdit}>
                          <option value="Abierta">Abierta</option>
                          <option value="En Proceso">En Proceso</option>
                          <option value="Cerrada">Cerrada</option>
                        </select>
                      </td>
                      <td style={{ display: 'flex', gap: '0.3rem' }}>
                        <button className="btn-icon" title="Descargar PDF" onClick={() => descargarPqrsPDF(p)}>⬇️</button>
                        <PermissionGuard recurso="enfoque_cliente" accion="eliminar" mode="hide">
                          <button className="btn-icon danger" onClick={() => eliminarPqrs(p.id)}>🗑️</button>
                        </PermissionGuard>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ANÁLISIS DOFA */}
          <div className="panel enf-analisis-panel">
            <div className="enf-analisis-panel__header">
              <div>
                <h3>🧭 Análisis DOFA generado por IA</h3>
                <p className="enf-analisis-panel__subtitle">
                  Basado en {respuestasCliente.length} encuesta(s) de clientes, {respuestasProveedor.length} de proveedores
                  y {pqrsList.length} PQRS registradas.
                </p>
              </div>
              <button className="btn-ai-generate" onClick={analizarConIA} disabled={loadingAnalisis || !canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {loadingAnalisis ? 'Analizando...' : (analisis ? '🔄 Reanalizar' : '🤖 Generar Análisis DOFA')}
              </button>
            </div>

            {errorAnalisis && <div className="enf-ai-error">⚠️ {errorAnalisis}</div>}

            {!analisis && !loadingAnalisis && (
              <div className="enf-empty-mini">Sube encuestas respondidas y/o registra PQRS, luego genera el análisis.</div>
            )}

            {analisis && (
              <>
                <p className="enf-analisis-resumen">{analisis.resumenEjecutivo}</p>
                {documentosAnalizados.length > 0 && (
                  <div className="enf-documentos-analizados">
                    <h4>📂 Documentos y fuentes incluidos en este análisis:</h4>
                    <ul>
                      {documentosAnalizados.map((doc, idx) => (
                        <li key={idx}>📄 {doc}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="enf-dofa-grid">
                  {DOFA_ORDEN.map(tipo => {
                    const { icon, clase } = DOFA_STYLE[tipo]
                    const items = analisis.dofa.filter(d => d.tipo === tipo)
                    return (
                      <div key={tipo} className={`enf-dofa-cell enf-dofa-cell--${clase}`}>
                        <h4>{icon} {tipo}{tipo !== 'Fortaleza' && tipo !== 'Debilidad' ? 's' : 'es'}</h4>
                        {items.length === 0
                          ? <span className="enf-empty-mini">Sin hallazgos</span>
                          : <ul>{items.map((d, i) => <li key={i}>{d.descripcion}</li>)}</ul>}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Agregar PQRS */}
      {showPqrsModal && (
        <div className="modal-overlay" onClick={cerrarModalPqrs}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📨 {pqrsGuardada ? 'PQRS guardada' : 'Agregar PQRS'}</h3>
              <button className="modal-close" onClick={cerrarModalPqrs}>✕</button>
            </div>

            {!pqrsGuardada ? (
              <>
                <div className="modal-body">
                  <div className="form-group">
                    <label>Tipo</label>
                    <select className="filter-input form-control" value={newPqrs.tipo}
                      onChange={e => setNewPqrs(p => ({ ...p, tipo: e.target.value as TipoPqrs }))} disabled={!canEdit}>
                      <option value="Petición">Petición</option>
                      <option value="Queja">Queja</option>
                      <option value="Reclamo">Reclamo</option>
                      <option value="Sugerencia">Sugerencia</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Cliente / Proveedor</label>
                    <input type="text" className="filter-input form-control" placeholder="Nombre"
                      value={newPqrs.origen} onChange={e => setNewPqrs(p => ({ ...p, origen: e.target.value }))} disabled={!canEdit} />
                  </div>
                  <div className="form-group">
                    <label>Fecha</label>
                    <input type="date" className="filter-input form-control"
                      value={newPqrs.fecha} onChange={e => setNewPqrs(p => ({ ...p, fecha: e.target.value }))} disabled={!canEdit} />
                  </div>
                  <div className="form-group">
                    <label>Descripción</label>
                    <textarea className="filter-input form-control" rows={4}
                      value={newPqrs.descripcion} onChange={e => setNewPqrs(p => ({ ...p, descripcion: e.target.value }))} disabled={!canEdit} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn--secondary btn" onClick={cerrarModalPqrs}>Cancelar</button>
                  <button className="btn-primary" onClick={agregarPqrs} disabled={!newPqrs.origen.trim() || !newPqrs.descripcion.trim() || !canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                    Guardar
                  </button>
                </div>
              </>
            ) : (
              <div className="modal-body enf-pqrs-confirm">
                <div className="enf-pqrs-confirm__icon">✅</div>
                <p>La PQRS de <strong>{pqrsGuardada.origen}</strong> quedó registrada en esta sesión.</p>
                <p className="enf-pqrs-confirm__hint">
                  Descárgala en PDF para subirla junto con las encuestas respondidas en la sección
                  "Encuestas Respondidas y PQRS".
                </p>
                <div className="modal-footer" style={{ marginTop: '1rem' }}>
                  <button className="btn--secondary btn" onClick={cerrarModalPqrs}>Cerrar</button>
                  <button className="btn-primary" onClick={() => descargarPqrsPDF(pqrsGuardada)}>⬇️ Descargar PDF</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default EnfoqueClientePage