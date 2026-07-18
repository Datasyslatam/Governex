import React, { useState, useCallback, useRef } from 'react'
import './ProveedoresPage.css'
import { useFetch } from '../../hooks/useFetch'
import { proveedoresService, Proveedor } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

const TIPOS_SUMINISTRO = ['Materia Prima', 'Tecnología / Software', 'Transporte', 'Servicios', 'Otro']

const emptyForm: Partial<Proveedor> = { nit: '', razon: '', tipo: '', estado: 'Aprobado', periodicidad_evaluacion: 'Anual', email: '' }
const emptyEval = { evaluador: '', calidad: 80, entrega: 80, precio: 80, servicio: 80, precio_mercado: '', precio_proveedor: '', debilidades: '', generada_con_ia: false }

const ProveedoresPage: React.FC = () => {
  const { data: proveedores, loading, error, refetch } = useFetch(proveedoresService.getAll, [])
  const { canEdit, canCreate, canDelete, isReadOnly } = usePermissions('proveedores')

  const [busqueda, setBusqueda]             = useState('')
  const [filtroEstado, setFiltroEstado]     = useState('')
  const [showModalNuevo, setShowModalNuevo] = useState(false)
  const [showModalEval, setShowModalEval]   = useState(false)
  const [editingId, setEditingId]           = useState<number | null>(null)
  const [evalProvId, setEvalProvId]         = useState<number | null>(null)
  const [formData, setFormData]             = useState<Partial<Proveedor>>(emptyForm)
  const [evalData, setEvalData]             = useState(emptyEval)
  const [saving, setSaving]                 = useState(false)
  const [generatingIA, setGeneratingIA]     = useState(false)
  const [evalHistory, setEvalHistory]       = useState<any[]>([])
  const [showReport, setShowReport]         = useState(false)
  const [reportData, setReportData]         = useState<any>(null)
  const [showModalHistorial, setShowModalHistorial] = useState(false)
  const [historialProv, setHistorialProv]   = useState<Proveedor | null>(null)

  const filtrados = proveedores.filter(p =>
    (!busqueda     || p.razon.toLowerCase().includes(busqueda.toLowerCase()) || p.nit.includes(busqueda)) &&
    (!filtroEstado || p.estado === filtroEstado)
  )

  const puntajeTotal = Math.round((evalData.calidad + evalData.entrega + evalData.precio + evalData.servicio) / 4)
  const estadoSegunPuntaje = puntajeTotal >= 80 ? 'Aprobado' : puntajeTotal >= 60 ? 'Condicional' : 'Suspendido'

  const abrirModalNuevo = () => { setEditingId(null); setFormData(emptyForm); setShowModalNuevo(true) }
  const editarProveedor = (p: Proveedor) => {
    setEditingId(p.id)
    setFormData({ nit: p.nit, razon: p.razon, tipo: p.tipo, estado: p.estado, periodicidad_evaluacion: p.periodicidad_evaluacion || 'Anual', email: p.email || '' })
    setShowModalNuevo(true)
  }
  const abrirModalEval  = async (p: Proveedor) => {
    setEvalProvId(p.id); setEvalData(emptyEval); setShowModalEval(true);
    try {
      const hist = await proveedoresService.getEvaluaciones(p.id)
      setEvalHistory(hist)
    } catch (e) { console.error(e) }
  }

  const abrirHistorial = async (p: Proveedor) => {
    setHistorialProv(p)
    try {
      const hist = await proveedoresService.getEvaluaciones(p.id)
      setEvalHistory(hist)
      setShowModalHistorial(true)
    } catch (e) { console.error(e) }
  }

  const generarEvalIA = async () => {
    if (!evalProvId) return;
    const prov = proveedores.find(p => p.id === evalProvId)
    if (!prov) return;
    setGeneratingIA(true)
    try {
      const res = await proveedoresService.generarEvaluacionIA({
        proveedor: prov.razon,
        tipoSuministro: prov.tipo,
        historial: evalHistory,
        precioMercado: evalData.precio_mercado ? Number(evalData.precio_mercado) : null,
        precioProveedor: evalData.precio_proveedor ? Number(evalData.precio_proveedor) : null,
        puntajesPrevios: {
          calidad: evalData.calidad,
          entrega: evalData.entrega,
          precio: evalData.precio,
          servicio: evalData.servicio
        }
      })
      setEvalData(prev => ({
        ...prev,
        debilidades: res.debilidades ?? '',
        generada_con_ia: true
      }))
    } catch (e: any) {
      alert(e.message || 'Error al generar evaluación con IA')
    } finally {
      setGeneratingIA(false)
    }
  }

  const guardarProveedor = useCallback(async () => {
    if (!formData.nit || !formData.razon || !formData.tipo) {
      alert('Completa los campos requeridos (NIT, Razón Social, Tipo)')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await proveedoresService.update(editingId, formData)
      } else {
        await proveedoresService.create(formData)
      }
      await refetch()
      setShowModalNuevo(false)
      setFormData(emptyForm)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [formData, editingId, refetch])

  const eliminarProveedor = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este proveedor? Toda su historia de evaluaciones se perderá.')) return
    try {
      await proveedoresService.delete(id)
      await refetch()
    } catch (e: any) {
      alert(e.message || 'Error al eliminar proveedor')
    }
  }

  const guardarEvaluacion = useCallback(async () => {
    if (!evalProvId) return
    setSaving(true)
    try {
      await proveedoresService.addEvaluacion(evalProvId, {
        evaluador: evalData.evaluador,
        calidad:   evalData.calidad,
        entrega:   evalData.entrega,
        precio:    evalData.precio,
        servicio:  evalData.servicio,
        fecha:     new Date().toISOString().slice(0, 10),
        precio_mercado: evalData.precio_mercado ? Number(evalData.precio_mercado) : null,
        precio_proveedor: evalData.precio_proveedor ? Number(evalData.precio_proveedor) : null,
        debilidades: evalData.debilidades || null,
        generada_con_ia: evalData.generada_con_ia
      })
      await refetch()
      setShowModalEval(false)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [evalProvId, evalData, refetch])

  const provSuspendidos = proveedores.filter(p => p.estado === 'Suspendido')
  const evalProvNombre  = proveedores.find(p => p.id === evalProvId)?.razon || ''

  return (
    <div className="page prov-page">
      <header className="page__header prov-page__header">
        <div className="prov-page__header-left">
          <nav className="prov-page__breadcrumb">
            <span>Governex</span>
            <span className="prov-page__bc-sep">›</span>
            <span>Cap. 8.4</span>
            <span className="prov-page__bc-sep">›</span>
            <span className="prov-page__bc-active">Control de Proveedores</span>
          </nav>
          <h2>Gestión y Evaluación de Proveedores</h2>
          <p className="prov-page__subtitle">Selección, evaluación y reevaluación de proveedores externos</p>
        </div>
        <div className="prov-page__actions">
          <button className="btn btn--primary" onClick={abrirModalNuevo} disabled={!canCreate} title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}>+ Nuevo Proveedor</button>
        </div>
      </header>

      <div className="prov-layout">
        <div className="prov-main-col panel">
          <div className="prov-toolbar">
            <div className="prov-search">
              <input type="text" className="input prov-search__input"
                placeholder="Buscar por Razón Social o NIT..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
            <div className="prov-filters">
              <select className="input prov-filter" value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value)}>
                <option value="">Todos los Estados</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Condicional">Condicional</option>
                <option value="Suspendido">Suspendido</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando proveedores...</div>
          ) : error ? (
            <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>
          ) : (
            <table className="table prov-table">
              <thead>
                <tr>
                  <th>NIT</th><th>Razón Social</th><th>Tipo Suministro</th>
                  <th>Última Evaluación</th><th>Puntaje</th><th>Estado</th>
                  <th>Próx. Evaluación</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((prov, i) => {
                  const ult  = prov.ultima_evaluacion
                  const puntaje = ult?.total ?? 0
                  return (
                    <tr key={prov.id} className={i % 2 === 1 ? 'table__row--alt' : ''}>
                      <td className="prov-table__code">{prov.nit}</td>
                      <td className="prov-table__title">{prov.razon}</td>
                      <td className="prov-table__type">{prov.tipo || '—'}</td>
                      <td className="prov-table__date">{ult?.fecha || '—'}</td>
                      <td>
                        <div className="prov-score">
                          <div className={`prov-score-circle ${
                            puntaje >= 80 ? 'score-good' : puntaje >= 60 ? 'score-warn' : 'score-bad'
                          }`}>{ult ? puntaje : '—'}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`pill ${
                          prov.estado === 'Aprobado'    ? 'pill--success' :
                          prov.estado === 'Condicional' ? 'pill--warning' : 'pill--danger'
                        }`}>{prov.estado}</span>
                      </td>
                      <td className="prov-table__next">{prov.prox_eval || '—'}</td>
                      <td className="prov-table__actions">
                        <button className="prov-action-btn btn-evaluar" title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : "Realizar Evaluación"}
                          onClick={() => abrirModalEval(prov)} disabled={!canEdit}>⭐ Evaluar</button>
                        <button className="prov-action-btn" title="Historial"
                          onClick={() => abrirHistorial(prov)}>📜</button>
                        <button className="prov-action-btn" title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : "Editar"}
                          onClick={() => editarProveedor(prov)} disabled={!canEdit}>✏️</button>
                        <PermissionGuard recurso="proveedores" accion="eliminar" mode="hide">
                          <button className="prov-action-btn" title="Eliminar"
                            onClick={() => eliminarProveedor(prov.id)}>🗑️</button>
                        </PermissionGuard>
                      </td>
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                    No hay proveedores que coincidan con los filtros
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Panel lateral */}
        <div className="prov-side-col panel">
          <div className="prov-side-header"><h3>Evaluaciones Recientes</h3></div>
          <div className="prov-eval-list">
            {proveedores
              .filter(p => p.ultima_evaluacion)
              .sort((a, b) => (b.ultima_evaluacion?.fecha || '').localeCompare(a.ultima_evaluacion?.fecha || ''))
              .slice(0, 5)
              .map((prov, i) => {
                const ev = prov.ultima_evaluacion!
                return (
                  <div key={i} className="prov-eval-card">
                    <div className="prov-eval-card-header">
                      <strong>{prov.razon}</strong>
                      <span className="prov-eval-total">Total: {ev.total}/100</span>
                    </div>
                    <div className="prov-eval-footer">
                      <span className="prov-eval-date">{ev.fecha}</span>
                      <button className="btn btn--secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => {
                        setReportData({ prov, ev })
                        setShowReport(true)
                      }}>📄 PDF</button>
                    </div>
                  </div>
                )
              })}
          </div>

          {provSuspendidos.length > 0 && (
            <div className="prov-alerts mt-4">
              <h3 className="mb-2" style={{ fontSize: '1rem' }}>Alertas</h3>
              {provSuspendidos.map(p => (
                <div key={p.id} className="prov-alert-item">
                  <span className="prov-alert-icon">⚠️</span>
                  <div>
                    <strong>{p.razon}</strong>
                    <span>Suspendido por baja calificación. Generar NC de proveedor.</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal nuevo/editar proveedor */}
      {showModalNuevo && (
        <div className="modal-overlay" onClick={() => setShowModalNuevo(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
              <button className="modal-close" onClick={() => setShowModalNuevo(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label>NIT *</label>
              <input type="text" className="input" disabled={!!editingId} readOnly={isReadOnly()}
                value={formData.nit || ''}
                onChange={e => setFormData(f => ({ ...f, nit: e.target.value }))} />
              <label>Razón Social *</label>
              <input type="text" className="input" readOnly={isReadOnly()}
                value={formData.razon || ''}
                onChange={e => setFormData(f => ({ ...f, razon: e.target.value }))} />
              <label>Tipo de Suministro *</label>
              <select className="input" value={formData.tipo || ''} disabled={isReadOnly()}
                onChange={e => setFormData(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Seleccionar</option>
                {TIPOS_SUMINISTRO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <label>Periodicidad de Evaluación</label>
              <select className="input" value={formData.periodicidad_evaluacion || 'Anual'} disabled={isReadOnly()}
                onChange={e => setFormData(f => ({ ...f, periodicidad_evaluacion: e.target.value as any }))}>
                <option value="Anual">Anual</option>
                <option value="Semestral">Semestral</option>
              </select>
              <label>Email de Contacto</label>
              <input type="email" className="input" placeholder="proveedor@ejemplo.com" readOnly={isReadOnly()}
                value={formData.email || ''}
                onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalNuevo(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={guardarProveedor} disabled={saving || (editingId ? !canEdit : !canCreate)} title={(editingId ? !canEdit : !canCreate) ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal evaluación */}
      {showModalEval && evalProvId && (
        <div className="modal-overlay" onClick={() => setShowModalEval(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Evaluar Proveedor</h3>
              <button className="modal-close" onClick={() => setShowModalEval(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)' }}>
                <strong>{evalProvNombre}</strong>
              </p>

              <label>Evaluador</label>
              <input type="text" className="input" placeholder="Nombre del evaluador" readOnly={isReadOnly()}
                value={evalData.evaluador}
                onChange={e => setEvalData(f => ({ ...f, evaluador: e.target.value }))} />

              <div style={{ background: 'var(--color-background-secondary)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>Ingresa los datos para que Governex evalúe considerando historial, precios y tus puntajes preliminares.</p>
                <label>Precio del Mercado Referencia ($)</label>
                <input type="number" className="input" placeholder="Ej: 1500" value={evalData.precio_mercado} readOnly={isReadOnly()} onChange={e => setEvalData(f => ({ ...f, precio_mercado: e.target.value }))} />
                <label>Precio del Proveedor ($)</label>
                <input type="number" className="input" placeholder="Ej: 1600" value={evalData.precio_proveedor} readOnly={isReadOnly()} onChange={e => setEvalData(f => ({ ...f, precio_proveedor: e.target.value }))} />
              </div>

              {(['calidad', 'entrega', 'precio', 'servicio'] as const).map(campo => (
                <div key={campo}>
                  <label>{campo.charAt(0).toUpperCase() + campo.slice(1)} (0-100): {evalData[campo]}</label>
                  <input type="range" min={0} max={100} value={evalData[campo]}
                    onChange={e => setEvalData(f => ({ ...f, [campo]: parseInt(e.target.value) }))} />
                </div>
              ))}
              
              <label>Debilidades / Plan de Acción</label>
              <textarea className="input" rows={3} placeholder="Aspectos a mejorar..." readOnly={isReadOnly()}
                value={evalData.debilidades || ''}
                onChange={e => setEvalData(f => ({ ...f, debilidades: e.target.value }))} />

              <button className="btn btn--primary" style={{ width: '100%', marginTop: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }} onClick={generarEvalIA} disabled={generatingIA || !canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {generatingIA ? 'Analizando con Governex...' : '✨ Generar Análisis Governex'}
              </button>

              <div style={{ padding: '1rem', background: 'var(--color-background-secondary)', borderRadius: '8px' }}>
                <strong>Puntaje Total: {puntajeTotal}/100</strong>
                <span style={{ marginLeft: '1rem' }} className={`pill ${
                  estadoSegunPuntaje === 'Aprobado' ? 'pill--success' :
                  estadoSegunPuntaje === 'Condicional' ? 'pill--warning' : 'pill--danger'
                }`}>{estadoSegunPuntaje}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalEval(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={guardarEvaluacion} disabled={saving || !canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {saving ? 'Guardando...' : 'Guardar Evaluación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial */}
      {showModalHistorial && historialProv && (
        <div className="modal-overlay" onClick={() => setShowModalHistorial(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Historial de Evaluaciones: {historialProv.razon}</h3>
              <button className="modal-close" onClick={() => setShowModalHistorial(false)}>✕</button>
            </div>
            <div className="modal-body">
              {evalHistory.length === 0 ? (
                <p>No hay evaluaciones previas para este proveedor.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {evalHistory.map((ev, i) => (
                    <div key={i} style={{ border: '1px solid #d1dce8', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                      <div style={{ fontSize: '0.85rem', color: '#1a2b45' }}>
                        <div style={{ marginBottom: '0.2rem' }}><strong>Fecha:</strong> {ev.fecha}</div>
                        <div style={{ marginBottom: '0.2rem' }}><strong>Puntaje:</strong> <span style={{ color: ev.total >= 80 ? 'green' : ev.total >= 60 ? 'orange' : 'red', fontWeight: 'bold' }}>{ev.total}/100</span></div>
                        <div><strong>Evaluador:</strong> {ev.evaluador || 'N/A'}</div>
                      </div>
                      <button className="btn btn--secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => {
                        setReportData({ prov: historialProv, ev })
                        setShowReport(true)
                      }}>📄 PDF</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalHistorial(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reporte PDF */}
      {showReport && reportData && (
        <div className="report-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'white', zIndex: 9999, overflowY: 'auto' }}>
          <div className="report-header no-print" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
            <h2>Vista Previa del Reporte</h2>
            <div>
              <button className="btn btn--secondary" onClick={() => setShowReport(false)} style={{ marginRight: '1rem' }}>Cerrar</button>
              <button className="btn btn--primary" onClick={() => window.print()}>Imprimir / PDF</button>
            </div>
          </div>
          <div className="report-content" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: 'black' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #ccc', paddingBottom: '1rem' }}>REPORTE DE EVALUACIÓN DE PROVEEDOR</h1>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              <div>
                <p><strong>Proveedor:</strong> {reportData.prov.razon}</p>
                <p><strong>NIT:</strong> {reportData.prov.nit}</p>
                <p><strong>Tipo:</strong> {reportData.prov.tipo || 'N/A'}</p>
              </div>
              <div>
                <p><strong>Fecha de Evaluación:</strong> {reportData.ev.fecha}</p>
                <p><strong>Puntaje Total:</strong> {reportData.ev.total}/100</p>
                <p><strong>Estado Resultante:</strong> {reportData.prov.estado}</p>
              </div>
            </div>
            
            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Resultados por Variable (KPIs)</h3>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              {(['calidad', 'entrega', 'precio', 'servicio'] as const).map(k => (
                <div key={k} style={{ flex: 1, minWidth: '150px', background: '#fafafa', padding: '1rem', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: '#666' }}>{k}</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: reportData.ev[k] >= 80 ? 'green' : reportData.ev[k] >= 60 ? 'orange' : 'red' }}>
                    {reportData.ev[k]}
                  </div>
                </div>
              ))}
            </div>

            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Plan de Acción / Oportunidades de Mejora</h3>
            <div style={{ background: '#fff3cd', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ffe69c', whiteSpace: 'pre-wrap' }}>
              {reportData.ev.debilidades || 'El proveedor cumple satisfactoriamente con los requisitos, se insta a mantener la mejora continua.'}
            </div>

            <div style={{ marginTop: '4rem', display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
              <div style={{ width: '45%', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <input 
                  type="text" 
                  className="signature-input"
                  placeholder="Escribe tu firma aquí..." 
                  defaultValue={reportData.ev.evaluador || ''}
                  style={{
                    fontFamily: '"Segoe Script", "Bradley Hand", "Lucida Handwriting", cursive',
                    fontSize: '1.8rem',
                    border: 'none',
                    borderBottom: '1px dashed #ccc',
                    background: 'transparent',
                    textAlign: 'center',
                    width: '100%',
                    outline: 'none',
                    color: '#000'
                  }} 
                />
                <div style={{ borderTop: '1px solid #000', marginTop: '0.5rem', paddingTop: '0.5rem', width: '100%' }}>Firma del Evaluador</div>
              </div>
              <div style={{ width: '45%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <div style={{ height: '50px' }}></div>
                <div style={{ borderTop: '1px solid #000', marginTop: '0.5rem', paddingTop: '0.5rem' }}>Recibido por Proveedor</div>
              </div>
            </div>
          </div>
          <style>{`
            @media print {
              .no-print { display: none !important; }
              body { background: white !important; }
              .signature-input { border-bottom: none !important; }
              .signature-input::placeholder { color: transparent !important; }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

export default ProveedoresPage
