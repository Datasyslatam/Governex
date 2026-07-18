import React, { useState, useCallback } from 'react'
import './NcAcPage.css'
import { useFetch } from '../../hooks/useFetch'
import { ncAcService, NoConformidad, AccionCorrectiva } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'

type Tab = 'no_conformidades' | 'acciones_correctivas'

// ── Helpers de código auto-generado ───────────────────────
function nextNCCode(ncs: NoConformidad[]): string {
  const year = new Date().getFullYear().toString().slice(2)
  const num  = String(ncs.length + 1).padStart(3, '0')
  return `NC-${year}-${num}`
}
function nextACCode(acs: AccionCorrectiva[]): string {
  const year = new Date().getFullYear().toString().slice(2)
  const num  = String(acs.length + 1).padStart(3, '0')
  return `AC-${year}-${num}`
}

// ── Formularios vacíos ─────────────────────────────────────
const emptyNC: Partial<NoConformidad> = {
  origen: 'Proceso Interno',
  descripcion: '',
  gravedad: 'Menor',
  estado: 'Abierta',
}

const emptyAC: Partial<AccionCorrectiva> = {
  metodo_analisis: '5 Por Qué\'s',
  accion: '',
  responsable: '',
  estado: 'En Implementación',
  eficacia: '-',
}

const NcAcPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('no_conformidades')
  const { canEdit: canEditNC, isReadOnly: isReadOnlyNC } = usePermissions('no_conformidades')
  const { canEdit: canEditAC, isReadOnly: isReadOnlyAC } = usePermissions('acciones_correctivas')

  // ── Datos desde la API ────────────────────────────────────
  const {
    data: ncData, loading: loadingNC, error: errorNC, refetch: refetchNCs
  } = useFetch(ncAcService.getNCs, [])

  const {
    data: acData, loading: loadingAC, error: errorAC, refetch: refetchACs
  } = useFetch(ncAcService.getACs, [])

  // ── Estado de modales ─────────────────────────────────────
  const [showModalNC, setShowModalNC] = useState(false)
  const [showModalAC, setShowModalAC] = useState(false)
  const [editingNCId, setEditingNCId] = useState<number | null>(null)
  const [editingACId, setEditingACId] = useState<number | null>(null)
  const [formNC, setFormNC] = useState<Partial<NoConformidad>>(emptyNC)
  const [formAC, setFormAC] = useState<Partial<AccionCorrectiva>>(emptyAC)
  const [saving, setSaving] = useState(false)

  // ── Filtros ───────────────────────────────────────────────
  const [filterNCEstado, setFilterNCEstado] = useState('')
  const [filterNCBusqueda, setFilterNCBusqueda] = useState('')
  const [filterACBusqueda, setFilterACBusqueda] = useState('')

  const filteredNCs = ncData.filter(nc =>
    (!filterNCEstado   || nc.estado === filterNCEstado) &&
    (!filterNCBusqueda || nc.descripcion.toLowerCase().includes(filterNCBusqueda.toLowerCase()) ||
                          nc.codigo.toLowerCase().includes(filterNCBusqueda.toLowerCase()))
  )
  const filteredACs = acData.filter(ac =>
    !filterACBusqueda ||
    ac.accion.toLowerCase().includes(filterACBusqueda.toLowerCase()) ||
    (ac.nc_codigo || '').toLowerCase().includes(filterACBusqueda.toLowerCase())
  )

  // ── KPIs ──────────────────────────────────────────────────
  const ncAbiertas = ncData.filter(nc => nc.estado === 'Abierta').length
  const acVencidas = acData.filter(ac => {
    if (!ac.fecha_fin || ac.estado === 'Cerrada') return false
    return new Date(ac.fecha_fin) < new Date()
  }).length
  const acCerradas = acData.filter(ac => ac.estado === 'Cerrada' && ac.eficacia === 'Eficaz').length
  const eficaciaAC = acData.length > 0
    ? Math.round((acCerradas / acData.filter(ac => ac.estado === 'Cerrada').length) * 100) || 0
    : 0

  // ── Guardar NC ────────────────────────────────────────────
  const handleSaveNC = useCallback(async () => {
    if (!formNC.descripcion || !formNC.origen || !formNC.gravedad) return
    setSaving(true)
    try {
      if (editingNCId) {
        await ncAcService.updateNC(editingNCId, formNC)
      } else {
        await ncAcService.createNC({ ...formNC, codigo: nextNCCode(ncData) })
      }
      await refetchNCs()
      setShowModalNC(false)
      setEditingNCId(null)
      setFormNC(emptyNC)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [formNC, editingNCId, ncData, refetchNCs])

  // ── Guardar AC ────────────────────────────────────────────
  const handleSaveAC = useCallback(async () => {
    if (!formAC.accion || !formAC.nc_id) return
    setSaving(true)
    try {
      if (editingACId) {
        await ncAcService.updateAC(editingACId, formAC)
      } else {
        await ncAcService.createAC({ ...formAC, codigo: nextACCode(acData) })
      }
      await refetchACs()
      setShowModalAC(false)
      setEditingACId(null)
      setFormAC(emptyAC)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [formAC, editingACId, acData, refetchACs])

  const openEditNC = (nc: NoConformidad) => {
    setEditingNCId(nc.id)
    setFormNC({ origen: nc.origen, descripcion: nc.descripcion, gravedad: nc.gravedad, estado: nc.estado })
    setShowModalNC(true)
  }

  const openEditAC = (ac: AccionCorrectiva) => {
    setEditingACId(ac.id)
    setFormAC({
      nc_id: ac.nc_id,
      metodo_analisis: ac.metodo_analisis,
      accion: ac.accion,
      responsable: ac.responsable,
      fecha_fin: ac.fecha_fin,
      estado: ac.estado,
      eficacia: ac.eficacia,
    })
    setShowModalAC(true)
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="page ncac-page">
      <header className="page__header ncac-page__header">
        <div className="ncac-page__header-left">
          <nav className="ncac-page__breadcrumb">
            <span>Governex</span>
            <span className="ncac-page__bc-sep">›</span>
            <span>Cap. 10.2</span>
            <span className="ncac-page__bc-sep">›</span>
            <span className="ncac-page__bc-active">Mejora Continua</span>
          </nav>
          <h2>No Conformidades y Acciones Correctivas (NC/AC)</h2>
          <p className="ncac-page__subtitle">Registro, análisis de causas (Ishikawa/5W) y planes de acción</p>
        </div>
        <div className="ncac-page__actions">
          {activeTab === 'no_conformidades' && (
            <button className="btn btn--primary" onClick={() => { setEditingNCId(null); setFormNC(emptyNC); setShowModalNC(true) }} disabled={!canEditNC} title={!canEditNC ? 'Tu rol no tiene permiso para esta acción' : undefined}>
              + Nueva NC
            </button>
          )}
          {activeTab === 'acciones_correctivas' && (
            <button className="btn btn--primary" onClick={() => { setEditingACId(null); setFormAC(emptyAC); setShowModalAC(true) }} disabled={!canEditAC} title={!canEditAC ? 'Tu rol no tiene permiso para esta acción' : undefined}>
              + Nueva Acción Correctiva
            </button>
          )}
        </div>
      </header>

      {/* KPIs */}
      <div className="ncac-kpis">
        <div className="kpi-card-mini">
          <span className="kpi-mini-title">NC Abiertas</span>
          <span className={`kpi-mini-value ${ncAbiertas > 0 ? 'danger' : 'success'}`}>{ncAbiertas}</span>
        </div>
        <div className="kpi-card-mini">
          <span className="kpi-mini-title">AC Vencidas</span>
          <span className={`kpi-mini-value ${acVencidas > 0 ? 'warning' : 'success'}`}>{acVencidas}</span>
        </div>
        <div className="kpi-card-mini">
          <span className="kpi-mini-title">Eficacia AC (YTD)</span>
          <span className="kpi-mini-value success">{eficaciaAC}%</span>
        </div>
        <div className="kpi-card-mini">
          <span className="kpi-mini-title">Total NC</span>
          <span className="kpi-mini-value primary">{ncData.length}</span>
        </div>
      </div>

      {/* Tabs */}
      <nav className="ncac-tabs">
        <button
          className={`ncac-tabs__tab ${activeTab === 'no_conformidades' ? 'ncac-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('no_conformidades')}
        >
          🚨 No Conformidades ({filteredNCs.length})
        </button>
        <button
          className={`ncac-tabs__tab ${activeTab === 'acciones_correctivas' ? 'ncac-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('acciones_correctivas')}
        >
          🛠️ Acciones Correctivas ({filteredACs.length})
        </button>
      </nav>

      <main className="ncac-main panel">

        {/* ── No Conformidades ── */}
        {activeTab === 'no_conformidades' && (
          <div className="ncac-table-wrap">
            <div className="ncac-toolbar">
              <input
                type="text" className="input ncac-search" placeholder="Buscar NC..."
                value={filterNCBusqueda} onChange={e => setFilterNCBusqueda(e.target.value)}
              />
              <select className="input ncac-filter" value={filterNCEstado} onChange={e => setFilterNCEstado(e.target.value)}>
                <option value="">Todos los Estados</option>
                <option value="Abierta">Abierta</option>
                <option value="En Análisis">En Análisis</option>
                <option value="Verificación">Verificación</option>
                <option value="Cerrada">Cerrada</option>
              </select>
            </div>

            {loadingNC ? (
              <div className="ncac-loading">Cargando no conformidades...</div>
            ) : errorNC ? (
              <div className="ncac-error">Error: {errorNC}</div>
            ) : (
              <table className="table ncac-table">
                <thead>
                  <tr>
                    <th>Código</th><th>Fecha</th><th>Origen</th>
                    <th>Proceso Afectado</th><th>Descripción del Problema</th>
                    <th>Gravedad</th><th>Estado</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNCs.map((nc, i) => (
                    <tr key={nc.id} className={i % 2 === 1 ? 'table__row--alt' : ''}>
                      <td className="ncac-table__code">{nc.codigo}</td>
                      <td className="ncac-table__date">{nc.fecha}</td>
                      <td>{nc.origen}</td>
                      <td className="ncac-table__process">{nc.proceso_nombre || '—'}</td>
                      <td className="ncac-table__desc">{nc.descripcion}</td>
                      <td>
                        <span className={`ncac-severity ncac-severity--${
                          nc.gravedad === 'Crítica' ? 'critical' : nc.gravedad === 'Mayor' ? 'high' : 'low'
                        }`}>{nc.gravedad}</span>
                      </td>
                      <td>
                        <span className={`pill ${
                          nc.estado === 'Cerrada' ? 'pill--success' :
                          nc.estado === 'Abierta' ? 'pill--danger' :
                          nc.estado === 'Verificación' ? 'pill--primary' : 'pill--warning'
                        }`}>{nc.estado}</span>
                      </td>
                      <td className="ncac-table__actions">
                        <button className="ncac-action-btn" title={!canEditNC ? 'Tu rol no tiene permiso para esta acción' : "Editar"} onClick={() => openEditNC(nc)} disabled={!canEditNC}>✏️</button>
                        <button
                          className="ncac-action-btn" title={!canEditAC ? 'Tu rol no tiene permiso para esta acción' : "Crear AC vinculada"}
                          onClick={() => {
                            setEditingACId(null)
                            setFormAC({ ...emptyAC, nc_id: nc.id })
                            setShowModalAC(true)
                            setActiveTab('acciones_correctivas')
                          }}
                          disabled={!canEditAC}
                        >🔗</button>
                      </td>
                    </tr>
                  ))}
                  {filteredNCs.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                      No hay no conformidades registradas
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Acciones Correctivas ── */}
        {activeTab === 'acciones_correctivas' && (
          <div className="ncac-table-wrap">
            <div className="ncac-toolbar">
              <input
                type="text" className="input ncac-search" placeholder="Buscar AC..."
                value={filterACBusqueda} onChange={e => setFilterACBusqueda(e.target.value)}
              />
            </div>

            {loadingAC ? (
              <div className="ncac-loading">Cargando acciones correctivas...</div>
            ) : errorAC ? (
              <div className="ncac-error">Error: {errorAC}</div>
            ) : (
              <table className="table ncac-table">
                <thead>
                  <tr>
                    <th>Código AC</th><th>NC Ref.</th><th>Método Análisis</th>
                    <th>Acción a Implementar</th><th>Responsable</th>
                    <th>Plazo</th><th>Estado AC</th><th>Eficacia</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredACs.map((ac, i) => (
                    <tr key={ac.id} className={i % 2 === 1 ? 'table__row--alt' : ''}>
                      <td className="ncac-table__code">{ac.codigo}</td>
                      <td className="ncac-table__ref">{ac.nc_codigo || ac.nc_id}</td>
                      <td><span className="pill pill--muted">{ac.metodo_analisis || '—'}</span></td>
                      <td className="ncac-table__desc">{ac.accion}</td>
                      <td>{ac.responsable || '—'}</td>
                      <td className="ncac-table__date">{ac.fecha_fin || '—'}</td>
                      <td>
                        <span className={`pill ${
                          ac.estado === 'Cerrada' ? 'pill--success' :
                          ac.estado === 'Verificación' ? 'pill--primary' : 'pill--warning'
                        }`}>{ac.estado}</span>
                      </td>
                      <td>
                        <span className={`ncac-efficacy ${
                          ac.eficacia === 'Eficaz' ? 'ncac-efficacy--good' :
                          ac.eficacia === '-' ? '' : 'ncac-efficacy--pending'
                        }`}>{ac.eficacia}</span>
                      </td>
                      <td className="ncac-table__actions">
                        <button className="ncac-action-btn" title={!canEditAC ? 'Tu rol no tiene permiso para esta acción' : "Editar"} onClick={() => openEditAC(ac)} disabled={!canEditAC}>✏️</button>
                      </td>
                    </tr>
                  ))}
                  {filteredACs.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                      No hay acciones correctivas registradas
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* ── Modal NC ── */}
      {showModalNC && (
        <div className="modal-overlay" onClick={() => setShowModalNC(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingNCId ? '✏️ Editar No Conformidad' : '🚨 Nueva No Conformidad'}</h3>
              <button className="modal-close" onClick={() => setShowModalNC(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Origen</label>
                <select className="filter-select form-control" value={formNC.origen}
                  onChange={e => setFormNC(f => ({ ...f, origen: e.target.value }))} disabled={!canEditNC}>
                  <option value="Auditoría Interna">Auditoría Interna</option>
                  <option value="Cliente (Queja)">Cliente (Queja)</option>
                  <option value="Proceso Interno">Proceso Interno</option>
                  <option value="Proveedor">Proveedor</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Descripción del problema</label>
                <textarea className="filter-input form-control" rows={3}
                  value={formNC.descripcion}
                  onChange={e => setFormNC(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Describa la no conformidad detectada..."
                  readOnly={isReadOnlyNC()}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Gravedad</label>
                  <select className="filter-select form-control" value={formNC.gravedad}
                    onChange={e => setFormNC(f => ({ ...f, gravedad: e.target.value }))} disabled={!canEditNC}>
                    <option value="Menor">Menor</option>
                    <option value="Mayor">Mayor</option>
                    <option value="Crítica">Crítica</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select className="filter-select form-control" value={formNC.estado}
                    onChange={e => setFormNC(f => ({ ...f, estado: e.target.value }))} disabled={!canEditNC}>
                    <option value="Abierta">Abierta</option>
                    <option value="En Análisis">En Análisis</option>
                    <option value="Verificación">Verificación</option>
                    <option value="Cerrada">Cerrada</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalNC(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={handleSaveNC} disabled={saving || !formNC.descripcion || !canEditNC} title={!canEditNC ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {saving ? 'Guardando...' : editingNCId ? 'Guardar Cambios' : 'Registrar NC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal AC ── */}
      {showModalAC && (
        <div className="modal-overlay" onClick={() => setShowModalAC(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingACId ? '✏️ Editar Acción Correctiva' : '🛠️ Nueva Acción Correctiva'}</h3>
              <button className="modal-close" onClick={() => setShowModalAC(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>NC vinculada</label>
                <select className="filter-select form-control" value={formAC.nc_id || ''}
                  onChange={e => setFormAC(f => ({ ...f, nc_id: Number(e.target.value) }))} disabled={!canEditAC}>
                  <option value="">Seleccionar NC...</option>
                  {ncData.filter(nc => nc.estado !== 'Cerrada').map(nc => (
                    <option key={nc.id} value={nc.id}>{nc.codigo} — {nc.descripcion.slice(0, 50)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Método de análisis de causa raíz</label>
                <select className="filter-select form-control" value={formAC.metodo_analisis}
                  onChange={e => setFormAC(f => ({ ...f, metodo_analisis: e.target.value }))} disabled={!canEditAC}>
                  <option value="5 Por Qué's">5 Por Qué's</option>
                  <option value="Ishikawa">Ishikawa</option>
                  <option value="Pareto">Pareto</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Acción a implementar</label>
                <textarea className="filter-input form-control" rows={3}
                  value={formAC.accion}
                  onChange={e => setFormAC(f => ({ ...f, accion: e.target.value }))}
                  placeholder="Describa la acción correctiva..."
                  readOnly={isReadOnlyAC()}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Responsable</label>
                  <input type="text" className="filter-input form-control"
                    value={formAC.responsable || ''} placeholder="Nombre del responsable"
                    onChange={e => setFormAC(f => ({ ...f, responsable: e.target.value }))}
                    readOnly={isReadOnlyAC()}
                  />
                </div>
                <div className="form-group">
                  <label>Fecha límite</label>
                  <input type="date" className="filter-input form-control"
                    value={formAC.fecha_fin || ''}
                    onChange={e => setFormAC(f => ({ ...f, fecha_fin: e.target.value }))}
                    readOnly={isReadOnlyAC()}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Estado</label>
                  <select className="filter-select form-control" value={formAC.estado}
                    onChange={e => setFormAC(f => ({ ...f, estado: e.target.value }))} disabled={!canEditAC}>
                    <option value="En Implementación">En Implementación</option>
                    <option value="Verificación">Verificación</option>
                    <option value="Cerrada">Cerrada</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Eficacia</label>
                  <select className="filter-select form-control" value={formAC.eficacia}
                    onChange={e => setFormAC(f => ({ ...f, eficacia: e.target.value }))} disabled={!canEditAC}>
                    <option value="-">Pendiente</option>
                    <option value="Pendiente 30 días">Pendiente 30 días</option>
                    <option value="Eficaz">Eficaz</option>
                    <option value="No Eficaz">No Eficaz</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalAC(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={handleSaveAC} disabled={saving || !formAC.accion || !formAC.nc_id || !canEditAC} title={!canEditAC ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {saving ? 'Guardando...' : editingACId ? 'Guardar Cambios' : 'Crear AC'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NcAcPage
