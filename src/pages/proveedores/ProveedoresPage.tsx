import React, { useState, useCallback } from 'react'
import './ProveedoresPage.css'
import { useFetch } from '../../hooks/useFetch'
import { proveedoresService, Proveedor } from '../../services'

const TIPOS_SUMINISTRO = ['Materia Prima', 'Tecnología / Software', 'Transporte', 'Servicios', 'Otro']

const emptyForm: Partial<Proveedor> = { nit: '', razon: '', tipo: '', estado: 'Aprobado' }
const emptyEval = { evaluador: '', calidad: 80, entrega: 80, precio: 80, servicio: 80 }

const ProveedoresPage: React.FC = () => {
  const { data: proveedores, loading, error, refetch } = useFetch(proveedoresService.getAll, [])

  const [busqueda, setBusqueda]             = useState('')
  const [filtroEstado, setFiltroEstado]     = useState('')
  const [showModalNuevo, setShowModalNuevo] = useState(false)
  const [showModalEval, setShowModalEval]   = useState(false)
  const [editingId, setEditingId]           = useState<number | null>(null)
  const [evalProvId, setEvalProvId]         = useState<number | null>(null)
  const [formData, setFormData]             = useState<Partial<Proveedor>>(emptyForm)
  const [evalData, setEvalData]             = useState(emptyEval)
  const [saving, setSaving]                 = useState(false)

  const filtrados = proveedores.filter(p =>
    (!busqueda     || p.razon.toLowerCase().includes(busqueda.toLowerCase()) || p.nit.includes(busqueda)) &&
    (!filtroEstado || p.estado === filtroEstado)
  )

  const puntajeTotal = Math.round((evalData.calidad + evalData.entrega + evalData.precio + evalData.servicio) / 4)
  const estadoSegunPuntaje = puntajeTotal >= 80 ? 'Aprobado' : puntajeTotal >= 60 ? 'Condicional' : 'Suspendido'

  const abrirModalNuevo = () => { setEditingId(null); setFormData(emptyForm); setShowModalNuevo(true) }
  const editarProveedor = (p: Proveedor) => {
    setEditingId(p.id)
    setFormData({ nit: p.nit, razon: p.razon, tipo: p.tipo, estado: p.estado })
    setShowModalNuevo(true)
  }
  const abrirModalEval  = (p: Proveedor) => { setEvalProvId(p.id); setEvalData(emptyEval); setShowModalEval(true) }

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
          <button className="btn btn--primary" onClick={abrirModalNuevo}>+ Nuevo Proveedor</button>
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
                        <button className="prov-action-btn btn-evaluar" title="Realizar Evaluación"
                          onClick={() => abrirModalEval(prov)}>⭐ Evaluar</button>
                        <button className="prov-action-btn" title="Editar"
                          onClick={() => editarProveedor(prov)}>✏️</button>
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
              <input type="text" className="input" disabled={!!editingId}
                value={formData.nit || ''}
                onChange={e => setFormData(f => ({ ...f, nit: e.target.value }))} />
              <label>Razón Social *</label>
              <input type="text" className="input"
                value={formData.razon || ''}
                onChange={e => setFormData(f => ({ ...f, razon: e.target.value }))} />
              <label>Tipo de Suministro *</label>
              <select className="input" value={formData.tipo || ''}
                onChange={e => setFormData(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Seleccionar</option>
                {TIPOS_SUMINISTRO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalNuevo(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={guardarProveedor} disabled={saving}>
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
              <input type="text" className="input" placeholder="Nombre del evaluador"
                value={evalData.evaluador}
                onChange={e => setEvalData(f => ({ ...f, evaluador: e.target.value }))} />
              {(['calidad', 'entrega', 'precio', 'servicio'] as const).map(campo => (
                <div key={campo}>
                  <label>{campo.charAt(0).toUpperCase() + campo.slice(1)} (0-100): {evalData[campo]}</label>
                  <input type="range" min={0} max={100} value={evalData[campo]}
                    onChange={e => setEvalData(f => ({ ...f, [campo]: parseInt(e.target.value) }))} />
                </div>
              ))}
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-background-secondary)', borderRadius: '8px' }}>
                <strong>Puntaje Total: {puntajeTotal}/100</strong>
                <span style={{ marginLeft: '1rem' }} className={`pill ${
                  estadoSegunPuntaje === 'Aprobado' ? 'pill--success' :
                  estadoSegunPuntaje === 'Condicional' ? 'pill--warning' : 'pill--danger'
                }`}>{estadoSegunPuntaje}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalEval(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={guardarEvaluacion} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Evaluación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProveedoresPage
