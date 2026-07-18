import { useState, useRef } from 'react'
import '../iso-module.css'
import './ComprasPage.css' // Nuevos estilos específicos
import Swal from 'sweetalert2'
import { useFetch } from '../../hooks/useFetch'
import { fichasTecnicasService, evaluacionesOrdenCompraService, uploadsService, ordenesCompraService } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

/* ══════════════════════════════════════════════════════════════
   TIPOS
   ══════════════════════════════════════════════════════════════ */
type EstadoOrden = 'Pendiente' | 'Recibido conforme' | 'Recibido no conforme' | 'Cancelado'

interface OrdenCompra {
  id: number
  proveedor: string
  producto: string
  cantidad: string
  unidad: string
  precioUnit: string
  total: string
  fechaEmision: string
  fechaEntrega: string
  requisitos: string
  responsable: string
  estado: EstadoOrden
}

interface FichaTecnica {
  id: number
  nombre: string
  descripcion: string
  especificaciones: string
  unidadMedida: string
  cantidadMinima: string
  documentosRequeridos: string[] // Cambiado a array para soportar múltiples archivos adjuntos
  responsable: string
  fechaCreacion: string
}

interface EvaluacionProveedor {
  id: number
  ordenId: number
  proveedor: string
  producto: string
  calidad: number // 1-5
  tiempoEntrega: 'Cumplió' | 'No cumplió'
  diasRetraso: number
  precio: 'Igual' | 'Mayor' | 'Menor'
  capacidadRespuesta: number // 1-5
  puntajeGlobal: number // 0-100
  observaciones: string
  fechaEvaluacion: string
}

/* ══════════════════════════════════════════════════════════════
   DATOS INICIALES MOCK
   ══════════════════════════════════════════════════════════════ */
const initOrdenes: OrdenCompra[] = [
  { id: 1, proveedor: 'Suministros Técnicos S.A.', producto: 'Tornillos de acero inoxidable M8', cantidad: '500', unidad: 'unidades', precioUnit: '350', total: '175.000', fechaEmision: '2025-03-01', fechaEntrega: '2025-03-10', requisitos: 'Certificado de material, norma ASTM A193', responsable: 'Jefe de Compras', estado: 'Recibido conforme' },
  { id: 2, proveedor: 'Distribuidora Química Ltda.', producto: 'Solvente industrial grado técnico', cantidad: '20', unidad: 'litros', precioUnit: '45.000', total: '900.000', fechaEmision: '2025-03-15', fechaEntrega: '2025-03-22', requisitos: 'Hoja de seguridad MSDS vigente, pureza ≥99%', responsable: 'Jefe de Compras', estado: 'Pendiente' },
  { id: 3, proveedor: 'Servicios de Calibración XYZ', producto: 'Calibración vernier y micrómetro', cantidad: '3', unidad: 'equipos', precioUnit: '80.000', total: '240.000', fechaEmision: '2025-02-20', fechaEntrega: '2025-02-28', requisitos: 'Certificado de calibración con trazabilidad ONAC', responsable: 'Jefe de Mantenimiento', estado: 'Recibido conforme' },
]

const initFichas: FichaTecnica[] = [
  { id: 1, nombre: 'Tornillos de acero inoxidable M8', descripcion: 'Sujeción estructural para ensambles', especificaciones: 'Acero Inox AISI 304, rosca métrica M8 x 1.25, longitud 50mm.', unidadMedida: 'unidades', cantidadMinima: '100', documentosRequeridos: ['Certificado de Material.pdf', 'Norma ASTM A193.pdf'], responsable: 'Ing. Producción', fechaCreacion: '2025-01-15' },
]

const initEvaluaciones: EvaluacionProveedor[] = [
  { id: 1, ordenId: 1, proveedor: 'Suministros Técnicos S.A.', producto: 'Tornillos de acero inoxidable M8', calidad: 5, tiempoEntrega: 'Cumplió', diasRetraso: 0, precio: 'Igual', capacidadRespuesta: 4, puntajeGlobal: 95, observaciones: 'Excelente calidad de material, respuesta rápida en cotización.', fechaEvaluacion: '2025-03-11' },
]

/* ══════════════════════════════════════════════════════════════
   COMPONENTE
   ══════════════════════════════════════════════════════════════ */
const ComprasPage: React.FC = () => {
  const { canEdit, canCreate, canDelete, isReadOnly } = usePermissions('compras')
  const [activeTab, setActiveTab] = useState<'ordenes' | 'fichas' | 'evaluaciones'>('ordenes')

  // Estados de datos
  const { data: ordenesDB, refetch: refetchOrdenes } = useFetch(ordenesCompraService.getAll, [])
  const ordenes: OrdenCompra[] = ordenesDB.map((r: any) => ({
    id: r.id, proveedor: r.proveedor, producto: r.producto, cantidad: r.cantidad ?? '',
    unidad: r.unidad ?? '', precioUnit: r.precio_unit ?? '', total: r.total ?? '',
    fechaEmision: r.fecha_emision ?? '', fechaEntrega: r.fecha_entrega ?? '',
    requisitos: r.requisitos ?? '', responsable: r.responsable ?? '', estado: r.estado,
  }))
  const { data: fichasDB, refetch: refetchFichas } = useFetch(fichasTecnicasService.getAll, [])
  const { data: evaluacionesDB, refetch: refetchEvaluaciones } = useFetch(evaluacionesOrdenCompraService.getAll, [])

  const fichas: FichaTecnica[] = fichasDB.map(f => ({
    id: f.id, nombre: f.nombre, descripcion: f.descripcion ?? '',
    especificaciones: f.especificaciones ?? '', unidadMedida: f.unidad_medida ?? '',
    cantidadMinima: f.cantidad_minima ?? '',
    documentosRequeridos: (f.documentos_requeridos ?? []).map(d => d.nombre),
    responsable: f.responsable ?? '', fechaCreacion: f.fecha_creacion,
  }))

  const evaluaciones: EvaluacionProveedor[] = evaluacionesDB.map((e: any) => ({
    id: e.id, ordenId: e.orden_id, proveedor: e.proveedor, producto: e.producto,
    calidad: e.calidad, tiempoEntrega: e.tiempo_entrega, diasRetraso: e.dias_retraso,
    precio: e.precio, capacidadRespuesta: e.capacidad_respuesta,
    puntajeGlobal: e.puntaje_global, observaciones: e.observaciones ?? '',
    fechaEvaluacion: e.fecha_evaluacion,
  }))

  // Estados de modales
  const [showOrdenModal, setShowOrdenModal] = useState(false)
  const [showFichaModal, setShowFichaModal] = useState(false)
  const [showEvalModal, setShowEvalModal]   = useState<{ visible: boolean, orden?: OrdenCompra }>({ visible: false })

  // Estados de formularios
  const emptyOrden = { proveedor: '', producto: '', cantidad: '', unidad: '', precioUnit: '', total: '', fechaEmision: '', fechaEntrega: '', requisitos: '', responsable: '', estado: 'Pendiente' as const }
  const [formOrden, setFormOrden] = useState({ ...emptyOrden })

  const emptyFicha = { nombre: '', descripcion: '', especificaciones: '', unidadMedida: '', cantidadMinima: '', documentosRequeridos: [] as { nombre: string; url: string }[], responsable: '', fechaCreacion: new Date().toISOString().split('T')[0] }
  const [formFicha, setFormFicha] = useState({ ...emptyFicha })

  const emptyEval = { calidad: 5, tiempoEntrega: 'Cumplió' as 'Cumplió' | 'No cumplió', diasRetraso: 0, precio: 'Igual' as 'Igual' | 'Mayor' | 'Menor', capacidadRespuesta: 5, observaciones: '' }
  const [formEval, setFormEval] = useState({ ...emptyEval })

  const [filtroEstado, setFiltroEstado] = useState('todos')

  /* ── Órdenes de Compra ─────────────────────────────────── */
  const ordenesFiltradas = filtroEstado === 'todos' ? ordenes : ordenes.filter(o => o.estado === filtroEstado)

  const guardarOrden = async () => {
    if (!formOrden.proveedor || !formOrden.producto) return
    try {
      await ordenesCompraService.create({
        proveedor: formOrden.proveedor, producto: formOrden.producto, cantidad: formOrden.cantidad,
        unidad: formOrden.unidad, precio_unit: formOrden.precioUnit, total: formOrden.total,
        fecha_emision: formOrden.fechaEmision, fecha_entrega: formOrden.fechaEntrega,
        requisitos: formOrden.requisitos, responsable: formOrden.responsable, estado: formOrden.estado,
      })
      await refetchOrdenes()
      setShowOrdenModal(false); setFormOrden({ ...emptyOrden })
    } catch (e: any) { alert(e.message) }
  }
  const eliminarOrden = (id: number) => {
    Swal.fire({
      title: '¿Eliminar orden?', text: 'Esta acción no se puede deshacer.', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#6e7d88',
      confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try { await ordenesCompraService.delete(id) } catch {}
        await refetchOrdenes()
      }
    })
  }

  const setEstadoOrden = async (orden: OrdenCompra, estado: EstadoOrden) => {
    try {
      await ordenesCompraService.update(orden.id, {
        proveedor: orden.proveedor, producto: orden.producto, cantidad: orden.cantidad,
        unidad: orden.unidad, precio_unit: orden.precioUnit, total: orden.total,
        fecha_emision: orden.fechaEmision, fecha_entrega: orden.fechaEntrega,
        requisitos: orden.requisitos, responsable: orden.responsable, estado,
      })
      await refetchOrdenes()
    } catch (e: any) {
      alert(e.message); return
    }

    if (estado === 'Recibido conforme') {
      Swal.fire({
        title: '¡Orden recibida conforme!', text: '¿Desea realizar la evaluación del proveedor ahora?',
        icon: 'success', showCancelButton: true, confirmButtonColor: '#1b3a6b', cancelButtonColor: '#6e7d88',
        confirmButtonText: 'Sí, evaluar ahora', cancelButtonText: 'Más tarde',
      }).then((result) => {
        if (result.isConfirmed) setShowEvalModal({ visible: true, orden })
      })
    } else if (estado === 'Recibido no conforme') {
      Swal.fire({
        title: 'Orden No Conforme', text: 'La orden ha sido marcada como no conforme. Recuerde generar una salida no conforme.',
        icon: 'error', confirmButtonColor: '#1b3a6b',
      })
    }
  }

  /* ── Fichas Técnicas ───────────────────────────────────── */
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    setSubiendoArchivo(true)
    try {
      const files = Array.from(e.target.files)
      const subidos: { nombre: string; url: string }[] = []
      for (const f of files) {
        const uploaded = await uploadsService.upload(f)
        subidos.push({ nombre: uploaded.nombre, url: uploaded.url })
      }
      setFormFicha(p => ({ ...p, documentosRequeridos: [...p.documentosRequeridos, ...subidos] }))
    } catch (err: any) {
      alert('No se pudo subir el archivo: ' + (err.message || err))
    } finally {
      setSubiendoArchivo(false)
      e.target.value = ''
    }
  }

  const removeFile = (index: number) => {
    setFormFicha(p => ({ ...p, documentosRequeridos: p.documentosRequeridos.filter((_, i) => i !== index) }))
  }

  const guardarFicha = async () => {
    if (!formFicha.nombre) return
    try {
      await fichasTecnicasService.create(formFicha)
      await refetchFichas()
      setShowFichaModal(false)
      setFormFicha({ ...emptyFicha })
    } catch (e: any) {
      alert('No se pudo guardar la ficha: ' + (e.message || e))
    }
  }
  const eliminarFicha = (id: number) => {
    Swal.fire({
      title: '¿Eliminar ficha técnica?', text: 'Esta acción no se puede deshacer.', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#6e7d88',
      confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try { await fichasTecnicasService.delete(id) } catch {}
        await refetchFichas()
      }
    })
  }

  /* ── Evaluaciones de Proveedores ───────────────────────── */
  const calcularPuntaje = (evaluacion: typeof formEval) => {
    const calidadScore = (evaluacion.calidad / 5) * 40
    let tiempoScore = 0
    if (evaluacion.tiempoEntrega === 'Cumplió') tiempoScore = 30
    else tiempoScore = Math.max(0, 30 - (evaluacion.diasRetraso * 5))
    
    let precioScore = 15
    if (evaluacion.precio === 'Mayor') precioScore = 5
    
    const resScore = (evaluacion.capacidadRespuesta / 5) * 15
    return Math.round(calidadScore + tiempoScore + precioScore + resScore)
  }

  const guardarEvaluacion = async () => {
    const orden = showEvalModal.orden
    if (!orden) return
    const puntaje = calcularPuntaje(formEval)
    try {
      await evaluacionesOrdenCompraService.create({
        ordenId: orden.id, proveedor: orden.proveedor, producto: orden.producto,
        calidad: formEval.calidad, tiempoEntrega: formEval.tiempoEntrega, diasRetraso: formEval.diasRetraso,
        precio: formEval.precio, capacidadRespuesta: formEval.capacidadRespuesta,
        puntajeGlobal: puntaje, observaciones: formEval.observaciones,
      })
      await refetchEvaluaciones()
      setShowEvalModal({ visible: false })
      setFormEval({ ...emptyEval })
    } catch (e: any) {
      alert('No se pudo guardar la evaluación: ' + (e.message || e))
    }
  }

  const getScoreClass = (score: number) => {
    if (score >= 90) return 'excelente'
    if (score >= 70) return 'bueno'
    return 'malo'
  }

  /* ── RENDER ────────────────────────────────────────────── */
  return (
    <div className="iso-page">
      {/* HEADER */}
      <div className="iso-page__header">
        <div className="iso-page__title-block">
          <h1>⚙️ Compras, Fichas Técnicas y Proveedores</h1>
          <p>Control de productos y servicios suministrados externamente (RF-006)</p>
          <span className="iso-page__clause">Cláusula 8.4</span>
        </div>
      </div>

      <div className="iso-info-box">
        <span className="iso-info-box__icon">📌</span>
        <span><strong>Cláusula 8.4</strong> — La organización debe asegurarse de que los procesos, productos y servicios suministrados externamente son conformes. Debe evaluar, seleccionar y reevaluar a los proveedores basándose en su capacidad para proporcionar productos de acuerdo a los requisitos (fichas técnicas).</span>
      </div>

      {/* TABS */}
      <div className="iso-tabs">
        <button className={`iso-tab-btn ${activeTab === 'ordenes' ? 'active' : ''}`} onClick={() => setActiveTab('ordenes')}>🛒 Órdenes de Compra</button>
        <button className={`iso-tab-btn ${activeTab === 'fichas' ? 'active' : ''}`} onClick={() => setActiveTab('fichas')}>📄 Fichas Técnicas</button>
        <button className={`iso-tab-btn ${activeTab === 'evaluaciones' ? 'active' : ''}`} onClick={() => setActiveTab('evaluaciones')}>⭐ Evaluación de Proveedores</button>
      </div>

      {/* ────────────────────────────────────────────────────────
          TAB: ÓRDENES DE COMPRA
          ──────────────────────────────────────────────────────── */}
      {activeTab === 'ordenes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="iso-topbar">
            <div className="iso-topbar__info">
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                <option value="todos">Todos los estados</option>
                <option>Pendiente</option><option>Recibido conforme</option><option>Recibido no conforme</option><option>Cancelado</option>
              </select>
            </div>
            <button className="iso-btn-primary" onClick={() => setShowOrdenModal(true)}>＋ Nueva orden</button>
          </div>

          <div className="iso-table-wrapper">
            <table className="iso-table">
              <thead>
                <tr>
                  <th>#</th><th>Proveedor</th><th>Producto / Servicio</th><th>Cantidad</th><th>Total</th><th>Requisitos</th><th>Fecha entrega</th><th>Estado</th><th style={{ minWidth: 200 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesFiltradas.map((o) => {
                  const isEvaluada = evaluaciones.some(e => e.ordenId === o.id)
                  return (
                  <tr key={o.id}>
                    <td style={{ color: '#9ca3af' }}>{o.id}</td>
                    <td style={{ fontWeight: 600, color: '#1b3a6b' }}>{o.proveedor}</td>
                    <td>{o.producto}</td>
                    <td>{o.cantidad} {o.unidad}</td>
                    <td>${o.total}</td>
                    <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{o.requisitos}</td>
                    <td>{o.fechaEntrega}</td>
                    <td><span className={`iso-badge ${o.estado === 'Recibido conforme' ? 'verde' : o.estado === 'Pendiente' ? 'amarillo' : o.estado === 'Cancelado' ? 'gris' : 'rojo'}`}>{o.estado}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        {o.estado === 'Pendiente' && (
                          <>
                            <button className="orden-action-btn conforme" onClick={() => setEstadoOrden(o, 'Recibido conforme')} title="Marcar como recibido conforme">
                              ✔ Conforme
                            </button>
                            <button className="orden-action-btn no-conforme" onClick={() => setEstadoOrden(o, 'Recibido no conforme')} title="Marcar como recibido NO conforme">
                              ✖ No conf.
                            </button>
                          </>
                        )}
                        {o.estado === 'Recibido conforme' && !isEvaluada && (
                          <button className="orden-action-btn evaluar" onClick={() => setShowEvalModal({ visible: true, orden: o })} title="Evaluar proveedor">
                            ⭐ Evaluar
                          </button>
                        )}
                        {o.estado === 'Recibido conforme' && isEvaluada && (
                          <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, background: '#d1fae5', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>✓ Evaluado</span>
                        )}
                        <button className="iso-btn-icon danger" style={{ marginLeft: 'auto' }} onClick={() => eliminarOrden(o.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          TAB: FICHAS TÉCNICAS (GRID DE TARJETAS)
          ──────────────────────────────────────────────────────── */}
      {activeTab === 'fichas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="iso-topbar">
            <div className="iso-topbar__info">Especificaciones técnicas de insumos y servicios comprados</div>
            <button className="iso-btn-primary" onClick={() => setShowFichaModal(true)}>＋ Nueva ficha técnica</button>
          </div>

          <div className="fichas-grid">
            {fichas.map(f => (
              <div key={f.id} className="ficha-card">
                <div className="ficha-card__header">
                  <div>
                    <h3 className="ficha-card__title">{f.nombre}</h3>
                    <div className="ficha-card__date">Creada: {f.fechaCreacion} • {f.responsable}</div>
                  </div>
                  <button className="iso-btn-icon danger" onClick={() => eliminarFicha(f.id)}>🗑️</button>
                </div>
                
                <div className="ficha-card__body">
                  <div className="ficha-info-row">
                    <span className="label">Descripción</span>
                    <span className="value">{f.descripcion}</span>
                  </div>
                  
                  <div className="ficha-info-row" style={{ marginTop: '0.4rem' }}>
                    <span className="label">Especificaciones</span>
                    <span className="value">{f.especificaciones}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
                    <div className="ficha-info-row" style={{ flex: 1 }}>
                      <span className="label">U. Medida</span>
                      <span className="value">{f.unidadMedida}</span>
                    </div>
                    <div className="ficha-info-row" style={{ flex: 1 }}>
                      <span className="label">Cant. Mínima</span>
                      <span className="value">{f.cantidadMinima}</span>
                    </div>
                  </div>

                  <div className="ficha-info-row" style={{ marginTop: '0.4rem' }}>
                    <span className="label">Documentos / Certificados</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {f.documentosRequeridos && f.documentosRequeridos.length > 0 ? (
                        f.documentosRequeridos.map((doc, idx) => (
                          <span key={idx} className="ficha-file-badge">📎 {doc}</span>
                        ))
                      ) : (
                        <span className="value" style={{ fontStyle: 'italic', color: '#9ca3af' }}>Sin adjuntos</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {fichas.length === 0 && <div className="iso-empty" style={{ gridColumn: '1 / -1' }}>No hay fichas técnicas registradas</div>}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          TAB: EVALUACIÓN PROVEEDORES (GRID PROFESIONAL)
          ──────────────────────────────────────────────────────── */}
      {activeTab === 'evaluaciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="iso-topbar">
            <div className="iso-topbar__info">Dashboard de evaluaciones post-recepción</div>
          </div>

          <div className="evaluaciones-grid">
            {evaluaciones.map(e => (
              <div key={e.id} className="eval-card">
                <div className="eval-card__header">
                  <div>
                    <h3 className="eval-card__provider">{e.proveedor}</h3>
                    <div className="eval-card__product">{e.producto}</div>
                  </div>
                  <div className={`eval-score-circle ${getScoreClass(e.puntajeGlobal)}`}>
                    {e.puntajeGlobal}
                    <span>pts</span>
                  </div>
                </div>

                <div className="eval-metrics">
                  <div className="eval-metric">
                    <span className="eval-metric__label">Calidad (40%)</span>
                    <span className="eval-metric__value">⭐ {e.calidad} / 5</span>
                  </div>
                  <div className="eval-metric">
                    <span className="eval-metric__label">Tiempo (30%)</span>
                    <span className="eval-metric__value" style={{ color: e.tiempoEntrega === 'Cumplió' ? '#059669' : '#dc2626' }}>
                      {e.tiempoEntrega === 'Cumplió' ? '⏱️ Cumplió' : `⏱️ +${e.diasRetraso}d`}
                    </span>
                  </div>
                  <div className="eval-metric">
                    <span className="eval-metric__label">Precio (15%)</span>
                    <span className="eval-metric__value">💲 {e.precio}</span>
                  </div>
                  <div className="eval-metric">
                    <span className="eval-metric__label">Respuesta (15%)</span>
                    <span className="eval-metric__value">⚡ {e.capacidadRespuesta} / 5</span>
                  </div>
                </div>

                {e.observaciones && (
                  <div style={{ fontSize: '0.82rem', background: '#f1f5f9', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '-0.5rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>Observaciones</div>
                    <div style={{ color: '#334155', whiteSpace: 'pre-wrap' }}>{e.observaciones}</div>
                  </div>
                )}

                <div className="eval-card__footer">
                  <span>📅 Eval: {e.fechaEvaluacion}</span>
                  <button className="iso-btn-icon danger" onClick={async () => { try { await evaluacionesOrdenCompraService.delete(e.id) } catch {}; await refetchEvaluaciones() }} title="Eliminar">🗑️</button>
                </div>
              </div>
            ))}
            {evaluaciones.length === 0 && <div className="iso-empty" style={{ gridColumn: '1 / -1' }}>No hay evaluaciones registradas</div>}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          MODALES
          ──────────────────────────────────────────────────────── */}

      {/* MODAL: Nueva Orden */}
      {showOrdenModal && (
        <div className="iso-modal-overlay" onClick={() => setShowOrdenModal(false)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2>➕ Nueva orden de compra</h2>
            <div className="iso-form-row">
              <div className="iso-field"><label>Proveedor *</label><input type="text" value={formOrden.proveedor} onChange={e => setFormOrden(p => ({ ...p, proveedor: e.target.value }))} /></div>
              <div className="iso-field"><label>Producto / Servicio *</label>
                <input type="text" value={formOrden.producto} onChange={e => setFormOrden(p => ({ ...p, producto: e.target.value }))} />
              </div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Cantidad</label><input type="text" value={formOrden.cantidad} onChange={e => setFormOrden(p => ({ ...p, cantidad: e.target.value }))} /></div>
              <div className="iso-field"><label>Unidad</label><input type="text" value={formOrden.unidad} onChange={e => setFormOrden(p => ({ ...p, unidad: e.target.value }))} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Precio unitario</label><input type="text" value={formOrden.precioUnit} onChange={e => setFormOrden(p => ({ ...p, precioUnit: e.target.value }))} /></div>
              <div className="iso-field"><label>Total</label><input type="text" value={formOrden.total} onChange={e => setFormOrden(p => ({ ...p, total: e.target.value }))} /></div>
            </div>
            <div className="iso-field"><label>Requisitos de calidad</label><textarea rows={2} value={formOrden.requisitos} onChange={e => setFormOrden(p => ({ ...p, requisitos: e.target.value }))} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Fecha emisión</label><input type="date" value={formOrden.fechaEmision} onChange={e => setFormOrden(p => ({ ...p, fechaEmision: e.target.value }))} /></div>
              <div className="iso-field"><label>Fecha entrega esperada</label><input type="date" value={formOrden.fechaEntrega} onChange={e => setFormOrden(p => ({ ...p, fechaEntrega: e.target.value }))} /></div>
            </div>
            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowOrdenModal(false)}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardarOrden} disabled={!formOrden.proveedor || !formOrden.producto}>＋ Guardar Orden</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Nueva Ficha Técnica */}
      {showFichaModal && (
        <div className="iso-modal-overlay" onClick={() => setShowFichaModal(false)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2>📄 Nueva Ficha Técnica</h2>
            <div className="iso-field"><label>Nombre del producto/insumo *</label><input type="text" value={formFicha.nombre} onChange={e => setFormFicha(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div className="iso-field"><label>Descripción y uso</label><textarea rows={2} value={formFicha.descripcion} onChange={e => setFormFicha(p => ({ ...p, descripcion: e.target.value }))} /></div>
            <div className="iso-field"><label>Especificaciones técnicas (Normas, dimensiones, composición)</label><textarea rows={3} value={formFicha.especificaciones} onChange={e => setFormFicha(p => ({ ...p, especificaciones: e.target.value }))} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Unidad de medida</label><input type="text" value={formFicha.unidadMedida} onChange={e => setFormFicha(p => ({ ...p, unidadMedida: e.target.value }))} /></div>
              <div className="iso-field"><label>Cantidad mínima requerida</label><input type="text" value={formFicha.cantidadMinima} onChange={e => setFormFicha(p => ({ ...p, cantidadMinima: e.target.value }))} /></div>
            </div>
            
            {/* FILE UPLOAD INPUT */}
            <div className="iso-field">
              <label>Documentos requeridos al proveedor (Certificados, MSDS)</label>
              <div className="file-upload-wrapper">
                <div className="file-upload-box">
                  <input type="file" multiple onChange={handleFileUpload} accept=".pdf,.doc,.docx,.jpg,.png" disabled={subiendoArchivo} />
                  <div className="file-upload-box__content">
                    <span className="file-upload-box__icon">📁</span>
                    <span className="file-upload-box__text">Haz clic o arrastra los certificados aquí</span>
                    <span className="file-upload-box__subtext">Formatos permitidos: PDF, DOC, JPG...</span>
                  </div>
                </div>
                {formFicha.documentosRequeridos.length > 0 && (
                  <div className="uploaded-files-list">
                    {formFicha.documentosRequeridos.map((doc, idx) => (
                      <div key={idx} className="uploaded-file-item">
                        <span>📎 {doc.nombre}</span>
                        <button className="iso-btn-icon danger" onClick={() => removeFile(idx)} style={{ padding: '0.1rem 0.3rem', fontSize: '0.7rem' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="iso-modal__footer" style={{ marginTop: '1rem' }}>
              <button className="iso-btn-secondary" onClick={() => setShowFichaModal(false)}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardarFicha} disabled={!formFicha.nombre}>＋ Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Evaluación Proveedor */}
      {showEvalModal.visible && showEvalModal.orden && (
        <div className="iso-modal-overlay" onClick={() => setShowEvalModal({ visible: false })}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2>⭐ Evaluación de Proveedor</h2>
            <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Evaluando a: <strong>{showEvalModal.orden.proveedor}</strong></p>
            
            <div className="iso-form-row">
              <div className="iso-field">
                <label>Calidad del Producto (40%)</label>
                <select value={formEval.calidad} onChange={e => setFormEval(p => ({ ...p, calidad: Number(e.target.value) }))}>
                  <option value={5}>5 - Excelente (Cumple todo)</option>
                  <option value={4}>4 - Bueno</option>
                  <option value={3}>3 - Aceptable</option>
                  <option value={2}>2 - Deficiente</option>
                  <option value={1}>1 - Inaceptable</option>
                </select>
              </div>
              <div className="iso-field">
                <label>Capacidad de Respuesta (15%)</label>
                <select value={formEval.capacidadRespuesta} onChange={e => setFormEval(p => ({ ...p, capacidadRespuesta: Number(e.target.value) }))}>
                  <option value={5}>5 - Muy rápida</option>
                  <option value={4}>4 - Rápida</option>
                  <option value={3}>3 - Normal</option>
                  <option value={2}>2 - Lenta</option>
                  <option value={1}>1 - Muy lenta / Sin respuesta</option>
                </select>
              </div>
            </div>

            <div className="iso-form-row">
              <div className="iso-field">
                <label>Tiempo de Entrega (30%)</label>
                <select value={formEval.tiempoEntrega} onChange={e => setFormEval(p => ({ ...p, tiempoEntrega: e.target.value as any }))}>
                  <option value="Cumplió">Cumplió la fecha</option>
                  <option value="No cumplió">No cumplió (retraso)</option>
                </select>
              </div>
              {formEval.tiempoEntrega === 'No cumplió' && (
                <div className="iso-field">
                  <label>Días de retraso</label>
                  <input type="number" min="1" value={formEval.diasRetraso} onChange={e => setFormEval(p => ({ ...p, diasRetraso: Number(e.target.value) }))} />
                </div>
              )}
            </div>

            <div className="iso-form-row">
              <div className="iso-field">
                <label>Precio vs. Cotización (15%)</label>
                <select value={formEval.precio} onChange={e => setFormEval(p => ({ ...p, precio: e.target.value as any }))}>
                  <option value="Menor">Menor al cotizado</option>
                  <option value="Igual">Igual al cotizado</option>
                  <option value="Mayor">Mayor al cotizado</option>
                </select>
              </div>
            </div>
            
            <div className="iso-field">
              <label>Observaciones generales</label>
              <textarea rows={2} value={formEval.observaciones} onChange={e => setFormEval(p => ({ ...p, observaciones: e.target.value }))} />
            </div>

            <div className="iso-info-box" style={{ marginTop: '1rem', padding: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Puntaje global calculado:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>{calcularPuntaje(formEval)} / 100</span>
            </div>

            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowEvalModal({ visible: false })}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardarEvaluacion}>Guardar Evaluación</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default ComprasPage
