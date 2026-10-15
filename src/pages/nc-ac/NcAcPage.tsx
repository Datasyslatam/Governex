import React, { useState, useCallback } from 'react'
import './NcAcPage.css'
import { useFetch } from '../../hooks/useFetch'
import { ncAcService, NoConformidad, AccionCorrectiva, AnalisisDetalleIA, AnalisisDetalleIshikawa } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import FiveWhysPanel from './components/FiveWhysPanel'
import IshikawaPanel from './components/IshikawaPanel'

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
  origen: 'Auditoría Interna',
  descripcion: '',
  gravedad: 'Menor',
  estado: 'Abierta',
}

const emptyAC: Partial<AccionCorrectiva> = {
  metodo_analisis: "5 Por Qué's",
  causa_raiz: '',
  correccion_inmediata: '',
  analisis_detalle: undefined,
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

  // ── Modal de Visualización de Análisis Causa Raíz ─────────
  const [selectedACForView, setSelectedACForView] = useState<AccionCorrectiva | null>(null)

  // ── Estado Asistente IA ───────────────────────────────────
  const [analyzingIA, setAnalyzingIA] = useState(false)

  // ── Filtros ───────────────────────────────────────────────
  const [filterNCEstado, setFilterNCEstado] = useState('')
  const [filterNCBusqueda, setFilterNCBusqueda] = useState('')
  const [filterACBusqueda, setFilterACBusqueda] = useState('')

  const filteredNCs = ncData.filter(nc =>
    (!filterNCEstado   || nc.estado === filterNCEstado) &&
    (!filterNCBusqueda || nc.descripcion.toLowerCase().includes(filterNCBusqueda.toLowerCase()) ||
                          nc.codigo.toLowerCase().includes(filterNCBusqueda.toLowerCase()) ||
                          (nc.origen || '').toLowerCase().includes(filterNCBusqueda.toLowerCase()))
  )
  const filteredACs = acData.filter(ac =>
    !filterACBusqueda ||
    ac.accion.toLowerCase().includes(filterACBusqueda.toLowerCase()) ||
    (ac.nc_codigo || '').toLowerCase().includes(filterACBusqueda.toLowerCase()) ||
    (ac.causa_raiz || '').toLowerCase().includes(filterACBusqueda.toLowerCase())
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

  // ── Analizar Causa Raíz con IA ────────────────────────────
  const handleAnalizarConIA = async () => {
    if (!formAC.nc_id) {
      alert('Por favor selecciona primero la No Conformidad que deseas analizar.')
      return
    }
    const selectedNC = ncData.find(n => n.id === formAC.nc_id)
    if (!selectedNC) return

    setAnalyzingIA(true)
    try {
      const res = await ncAcService.analizarConIA({
        descripcion: selectedNC.descripcion,
        origen: selectedNC.origen,
        proceso: selectedNC.proceso_nombre,
        gravedad: selectedNC.gravedad,
        metodo: formAC.metodo_analisis === 'Ishikawa' ? 'Ishikawa' : "5 Por Qué's",
      })

      setFormAC(prev => ({
        ...prev,
        causa_raiz: res.causa_raiz,
        correccion_inmediata: res.correccion_inmediata || prev.correccion_inmediata,
        analisis_detalle: res,
        accion: prev.accion || res.acciones_sugeridas?.[0]?.accion || '',
        responsable: prev.responsable || res.acciones_sugeridas?.[0]?.responsable || '',
      }))
    } catch (err: any) {
      alert(err.message || 'Error al analizar con IA')
    } finally {
      setAnalyzingIA(false)
    }
  }

  const openEditNC = (nc: NoConformidad) => {
    setEditingNCId(nc.id)
    setFormNC({
      origen: nc.origen,
      descripcion: nc.descripcion,
      gravedad: nc.gravedad,
      estado: nc.estado,
      proceso_id: nc.proceso_id,
      hallazgo_id: nc.hallazgo_id,
    })
    setShowModalNC(true)
  }

  const openCreateACForNC = (nc: NoConformidad) => {
    setEditingACId(null)
    setFormAC({
      ...emptyAC,
      nc_id: nc.id,
      metodo_analisis: "5 Por Qué's",
    })
    setShowModalAC(true)
  }

  const openEditAC = (ac: AccionCorrectiva) => {
    setEditingACId(ac.id)
    setFormAC({
      nc_id: ac.nc_id,
      metodo_analisis: ac.metodo_analisis || "5 Por Qué's",
      causa_raiz: ac.causa_raiz || '',
      correccion_inmediata: ac.correccion_inmediata || '',
      analisis_detalle: ac.analisis_detalle,
      accion: ac.accion,
      responsable: ac.responsable,
      fecha_fin: ac.fecha_fin,
      estado: ac.estado,
      eficacia: ac.eficacia,
    })
    setShowModalAC(true)
  }

  return (
    <div className="page ncac-page">
      <header className="page__header ncac-page__header">
        <div className="ncac-page__header-left">
          <nav className="ncac-page__breadcrumb">
            <span>Governex</span>
            <span className="ncac-page__bc-sep">›</span>
            <span>Cap. 10</span>
            <span className="ncac-page__bc-sep">›</span>
            <span className="ncac-page__bc-active">Mejora y Acciones Correctivas</span>
          </nav>
          <h2>No Conformidades y Acciones Correctivas (NC/AC)</h2>
          <p className="ncac-page__subtitle">
            Gestión de hallazgos de auditoría (9.2), análisis de causas raíz con IA (5 Por Qués / Ishikawa) y planes de acción (10.2)
          </p>
        </div>
        <div className="ncac-page__actions">
          {activeTab === 'no_conformidades' && (
            <button
              className="btn btn--primary"
              onClick={() => { setEditingNCId(null); setFormNC(emptyNC); setShowModalNC(true) }}
              disabled={!canEditNC}
              title={!canEditNC ? 'Tu rol no tiene permiso para esta acción' : undefined}
            >
              + Nueva NC
            </button>
          )}
          {activeTab === 'acciones_correctivas' && (
            <button
              className="btn btn--primary"
              onClick={() => { setEditingACId(null); setFormAC(emptyAC); setShowModalAC(true) }}
              disabled={!canEditAC}
              title={!canEditAC ? 'Tu rol no tiene permiso para esta acción' : undefined}
            >
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
          <span className="kpi-mini-title">Total NC Registradas</span>
          <span className="kpi-mini-value primary">{ncData.length}</span>
        </div>
      </div>

      {/* Tabs */}
      <nav className="ncac-tabs">
        <button
          className={`ncac-tabs__tab ${activeTab === 'no_conformidades' ? 'ncac-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('no_conformidades')}
        >
          No Conformidades ({filteredNCs.length})
        </button>
        <button
          className={`ncac-tabs__tab ${activeTab === 'acciones_correctivas' ? 'ncac-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('acciones_correctivas')}
        >
          Acciones Correctivas y Análisis ({filteredACs.length})
        </button>
      </nav>

      <main className="ncac-main panel">
        {/* ── No Conformidades ── */}
        {activeTab === 'no_conformidades' && (
          <div className="ncac-table-wrap">
            <div className="ncac-toolbar">
              <input
                type="text"
                className="input ncac-search"
                placeholder="Buscar por código, descripción u origen..."
                value={filterNCBusqueda}
                onChange={e => setFilterNCBusqueda(e.target.value)}
              />
              <select
                className="input ncac-filter"
                value={filterNCEstado}
                onChange={e => setFilterNCEstado(e.target.value)}
              >
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
                    <th>Código</th>
                    <th>Fecha</th>
                    <th>Origen</th>
                    <th>Proceso Afectado</th>
                    <th>Descripción del Problema</th>
                    <th>Gravedad</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNCs.map((nc, i) => (
                    <tr key={nc.id} className={i % 2 === 1 ? 'table__row--alt' : ''}>
                      <td className="ncac-table__code">
                        <div>{nc.codigo}</div>
                        {nc.hallazgo_codigo && (
                          <span className="pill pill--muted" style={{ fontSize: '0.68rem' }} title="Derivado de auditoría">
                            Hallazgo: {nc.hallazgo_codigo}
                          </span>
                        )}
                      </td>
                      <td className="ncac-table__date">{nc.fecha}</td>
                      <td>
                        <span className={`pill ${nc.origen.includes('Auditoría') ? 'pill--primary' : 'pill--muted'}`}>
                          {nc.origen}
                        </span>
                      </td>
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
                        <button
                          className="ncac-action-btn"
                          title="Editar No Conformidad"
                          onClick={() => openEditNC(nc)}
                          disabled={!canEditNC}
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn--ia"
                          style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                          title="Analizar Causa Raíz con IA y formular Acción Correctiva"
                          onClick={() => openCreateACForNC(nc)}
                          disabled={!canEditAC}
                        >
                          ✨ Analizar Causa (IA)
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredNCs.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                        No hay no conformidades registradas
                      </td>
                    </tr>
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
                type="text"
                className="input ncac-search"
                placeholder="Buscar por código, NC o acción..."
                value={filterACBusqueda}
                onChange={e => setFilterACBusqueda(e.target.value)}
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
                    <th>Código AC</th>
                    <th>NC Ref.</th>
                    <th>Método Análisis</th>
                    <th>Causa Raíz</th>
                    <th>Acción Correctiva</th>
                    <th>Responsable</th>
                    <th>Plazo</th>
                    <th>Estado</th>
                    <th>Eficacia</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredACs.map((ac, i) => (
                    <tr key={ac.id} className={i % 2 === 1 ? 'table__row--alt' : ''}>
                      <td className="ncac-table__code">{ac.codigo}</td>
                      <td className="ncac-table__ref">
                        <span className="pill pill--muted">{ac.nc_codigo || `NC #${ac.nc_id}`}</span>
                      </td>
                      <td>
                        <span className={`pill ${ac.metodo_analisis === 'Ishikawa' ? 'pill--warning' : 'pill--primary'}`}>
                          {ac.metodo_analisis || '—'}
                        </span>
                      </td>
                      <td className="ncac-table__desc" style={{ maxWidth: 220 }}>
                        {ac.causa_raiz ? (
                          <div title={ac.causa_raiz}>
                            <strong>🎯</strong> {ac.causa_raiz.length > 70 ? ac.causa_raiz.slice(0, 68) + '...' : ac.causa_raiz}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin causa raíz registrada</span>
                        )}
                      </td>
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
                        {ac.analisis_detalle && (
                          <button
                            className="btn btn--outline"
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}
                            title="Ver Diagrama / Pasos del Análisis de Causa Raíz"
                            onClick={() => setSelectedACForView(ac)}
                          >
                            🔍 Ver Análisis
                          </button>
                        )}
                        <button
                          className="ncac-action-btn"
                          title={!canEditAC ? 'Tu rol no tiene permiso para esta acción' : "Editar"}
                          onClick={() => openEditAC(ac)}
                          disabled={!canEditAC}
                        >
                          ✏️
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredACs.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                        No hay acciones correctivas registradas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* ── Modal Nueva / Editar NC ── */}
      {showModalNC && (
        <div className="modal-overlay" onClick={() => setShowModalNC(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingNCId ? 'Editar No Conformidad' : 'Nueva No Conformidad'}</h3>
              <button className="modal-close" onClick={() => setShowModalNC(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Origen de la No Conformidad</label>
                <select
                  className="filter-select form-control"
                  value={formNC.origen}
                  onChange={e => setFormNC(f => ({ ...f, origen: e.target.value }))}
                  disabled={!canEditNC}
                >
                  <option value="Auditoría Interna">Auditoría Interna</option>
                  <option value="Auditoría Externa">Auditoría Externa</option>
                  <option value="Cliente (Queja)">Cliente (Queja)</option>
                  <option value="Proceso Interno">Proceso Interno</option>
                  <option value="Proveedor">Proveedor</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className="form-group">
                <label>Descripción del problema detectado</label>
                <textarea
                  className="filter-input form-control"
                  rows={3}
                  value={formNC.descripcion}
                  onChange={e => setFormNC(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Describa la no conformidad objetiva, cláusula y evidencia encontrada..."
                  readOnly={isReadOnlyNC()}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Gravedad</label>
                  <select
                    className="filter-select form-control"
                    value={formNC.gravedad}
                    onChange={e => setFormNC(f => ({ ...f, gravedad: e.target.value }))}
                    disabled={!canEditNC}
                  >
                    <option value="Menor">Menor</option>
                    <option value="Mayor">Mayor</option>
                    <option value="Crítica">Crítica</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select
                    className="filter-select form-control"
                    value={formNC.estado}
                    onChange={e => setFormNC(f => ({ ...f, estado: e.target.value }))}
                    disabled={!canEditNC}
                  >
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
              <button
                className="btn btn--primary"
                onClick={handleSaveNC}
                disabled={saving || !formNC.descripcion || !canEditNC}
              >
                {saving ? 'Guardando...' : editingNCId ? 'Guardar Cambios' : 'Registrar NC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nueva / Editar AC con Asistente de IA ── */}
      {showModalAC && (
        <div className="modal-overlay" onClick={() => setShowModalAC(false)}>
          <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingACId ? 'Editar Acción Correctiva' : 'Nueva Acción Correctiva & Análisis de Causa'}</h3>
              <button className="modal-close" onClick={() => setShowModalAC(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>No Conformidad Vinculada</label>
                <select
                  className="filter-select form-control"
                  value={formAC.nc_id || ''}
                  onChange={e => setFormAC(f => ({ ...f, nc_id: Number(e.target.value) }))}
                  disabled={!canEditAC}
                >
                  <option value="">Seleccionar NC...</option>
                  {ncData.map(nc => (
                    <option key={nc.id} value={nc.id}>
                      {nc.codigo} — [{nc.origen}] {nc.descripcion.slice(0, 60)}...
                    </option>
                  ))}
                </select>
              </div>

              {/* Barra de Análisis con IA */}
              <div className="form-row" style={{ alignItems: 'flex-end', background: '#f1f5f9', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontWeight: 600, color: '#334155' }}>Metodología de Análisis de Causa Raíz</label>
                  <select
                    className="filter-select form-control"
                    value={formAC.metodo_analisis}
                    onChange={e => setFormAC(f => ({ ...f, metodo_analisis: e.target.value }))}
                    disabled={!canEditAC || analyzingIA}
                  >
                    <option value="5 Por Qué's">5 Por Qué's</option>
                    <option value="Ishikawa">Diagrama Ishikawa (Espina de Pescado / 6M)</option>
                    <option value="Pareto">Pareto</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div style={{ paddingBottom: '0.2rem' }}>
                  <button
                    type="button"
                    className="btn btn--ia"
                    onClick={handleAnalizarConIA}
                    disabled={analyzingIA || !formAC.nc_id || !canEditAC}
                  >
                    {analyzingIA ? '⏳ Analizando con Gemini...' : `✨ Analizar Causa Raíz (${formAC.metodo_analisis || 'IA'})`}
                  </button>
                </div>
              </div>

              {/* Visualización del análisis de la IA */}
              {formAC.analisis_detalle && (
                <div style={{ marginBottom: '1.25rem' }}>
                  {formAC.metodo_analisis === 'Ishikawa' ? (
                    <IshikawaPanel
                      efectoProblema={formAC.analisis_detalle.efecto_problema}
                      categorias6m={formAC.analisis_detalle.categorias_6m}
                      causaRaiz={formAC.causa_raiz}
                      onEditCategoriaItem={(cat, idx, val) => {
                        setFormAC(prev => {
                          if (!prev.analisis_detalle?.categorias_6m) return prev
                          const currentCat = [...(prev.analisis_detalle.categorias_6m[cat] || [])]
                          currentCat[idx] = val
                          return {
                            ...prev,
                            analisis_detalle: {
                              ...prev.analisis_detalle,
                              categorias_6m: {
                                ...prev.analisis_detalle.categorias_6m,
                                [cat]: currentCat
                              }
                            }
                          }
                        })
                      }}
                    />
                  ) : (
                    <FiveWhysPanel
                      pasos={formAC.analisis_detalle.pasos}
                      causaRaiz={formAC.causa_raiz}
                      problemaSintoma={formAC.analisis_detalle.problema_sintoma}
                      onEditPaso={(idx, field, val) => {
                        setFormAC(prev => {
                          if (!prev.analisis_detalle?.pasos) return prev
                          const updated = [...prev.analisis_detalle.pasos]
                          updated[idx] = { ...updated[idx], [field]: val }
                          return {
                            ...prev,
                            analisis_detalle: { ...prev.analisis_detalle, pasos: updated }
                          }
                        })
                      }}
                    />
                  )}

                  {/* Acciones correctivas sugeridas por IA */}
                  {formAC.analisis_detalle.acciones_sugeridas && formAC.analisis_detalle.acciones_sugeridas.length > 0 && (
                    <div className="ia-analysis-box">
                      <strong style={{ fontSize: '0.8rem', color: '#4338ca' }}>💡 Acciones Correctivas sugeridas por la IA:</strong>
                      <div className="ia-suggestions-list">
                        {formAC.analisis_detalle.acciones_sugeridas.map((sug, idx) => (
                          <div key={idx} className="ia-suggestion-card">
                            <div>
                              <strong>{sug.accion}</strong>
                              {sug.responsable && <span style={{ color: '#64748b' }}> — Resp: {sug.responsable}</span>}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setFormAC(prev => ({
                                  ...prev,
                                  accion: sug.accion,
                                  responsable: sug.responsable || prev.responsable,
                                }))
                              }}
                            >
                              + Usar esta acción
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Campos Causa Raíz y Corrección Inmediata */}
              <div className="form-group">
                <label>Causa Raíz Identificada *</label>
                <textarea
                  className="filter-input form-control"
                  rows={2}
                  value={formAC.causa_raiz || ''}
                  onChange={e => setFormAC(f => ({ ...f, causa_raiz: e.target.value }))}
                  placeholder="Causa raíz que originó el problema (identificada mediante 5 Por Qués o Ishikawa)..."
                  readOnly={isReadOnlyAC()}
                />
              </div>

              <div className="form-group">
                <label>Corrección Inmediata (Contención del síntoma)</label>
                <input
                  type="text"
                  className="filter-input form-control"
                  value={formAC.correccion_inmediata || ''}
                  onChange={e => setFormAC(f => ({ ...f, correccion_inmediata: e.target.value }))}
                  placeholder="Acción inmediata tomada para contener la desviación..."
                  readOnly={isReadOnlyAC()}
                />
              </div>

              <div className="form-group">
                <label>Acción Correctiva Definitiva (Para eliminar la causa raíz) *</label>
                <textarea
                  className="filter-input form-control"
                  rows={3}
                  value={formAC.accion}
                  onChange={e => setFormAC(f => ({ ...f, accion: e.target.value }))}
                  placeholder="Describa el plan de acción correctiva que previene la recurrencia..."
                  readOnly={isReadOnlyAC()}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Responsable</label>
                  <input
                    type="text"
                    className="filter-input form-control"
                    value={formAC.responsable || ''}
                    placeholder="Nombre o cargo responsable"
                    onChange={e => setFormAC(f => ({ ...f, responsable: e.target.value }))}
                    readOnly={isReadOnlyAC()}
                  />
                </div>
                <div className="form-group">
                  <label>Fecha Límite</label>
                  <input
                    type="date"
                    className="filter-input form-control"
                    value={formAC.fecha_fin || ''}
                    onChange={e => setFormAC(f => ({ ...f, fecha_fin: e.target.value }))}
                    readOnly={isReadOnlyAC()}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Estado de la AC</label>
                  <select
                    className="filter-select form-control"
                    value={formAC.estado}
                    onChange={e => setFormAC(f => ({ ...f, estado: e.target.value }))}
                    disabled={!canEditAC}
                  >
                    <option value="En Implementación">En Implementación</option>
                    <option value="Verificación">Verificación</option>
                    <option value="Cerrada">Cerrada</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Evaluación de Eficacia</label>
                  <select
                    className="filter-select form-control"
                    value={formAC.eficacia}
                    onChange={e => setFormAC(f => ({ ...f, eficacia: e.target.value }))}
                    disabled={!canEditAC}
                  >
                    <option value="-">Pendiente</option>
                    <option value="Pendiente 30 días">Pendiente 30 días</option>
                    <option value="Eficaz">Eficaz (Causa Eliminada)</option>
                    <option value="No Eficaz">No Eficaz (Requiere nuevo análisis)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalAC(false)}>Cancelar</button>
              <button
                className="btn btn--primary"
                onClick={handleSaveAC}
                disabled={saving || !formAC.accion || !formAC.nc_id || !canEditAC}
              >
                {saving ? 'Guardando...' : editingACId ? 'Guardar Cambios' : 'Guardar Acción Correctiva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Visualizador de Diagrama / Causa Raíz Guardada ── */}
      {selectedACForView && (
        <div className="modal-overlay" onClick={() => setSelectedACForView(null)}>
          <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                Análisis de Causa Raíz — {selectedACForView.codigo} ({selectedACForView.metodo_analisis})
              </h3>
              <button className="modal-close" onClick={() => setSelectedACForView(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#eff6ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
                <strong style={{ color: '#1e40af' }}>No Conformidad Asociada: {selectedACForView.nc_codigo}</strong>
                <p style={{ margin: '0.25rem 0 0', color: '#1e3a8a', fontSize: '0.85rem' }}>
                  {selectedACForView.nc_descripcion}
                </p>
              </div>

              {selectedACForView.metodo_analisis === 'Ishikawa' ? (
                <IshikawaPanel
                  efectoProblema={selectedACForView.analisis_detalle?.efecto_problema}
                  categorias6m={selectedACForView.analisis_detalle?.categorias_6m}
                  causaRaiz={selectedACForView.causa_raiz}
                  readOnly={true}
                />
              ) : (
                <FiveWhysPanel
                  pasos={selectedACForView.analisis_detalle?.pasos}
                  causaRaiz={selectedACForView.causa_raiz}
                  problemaSintoma={selectedACForView.analisis_detalle?.problema_sintoma}
                  readOnly={true}
                />
              )}

              {selectedACForView.correccion_inmediata && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fffbeb', borderRadius: '0.5rem', border: '1px solid #fde68a' }}>
                  <strong style={{ color: '#92400e', fontSize: '0.82rem' }}>⚡ Corrección Inmediata Aplicada:</strong>
                  <p style={{ margin: '0.2rem 0 0', color: '#78350f', fontSize: '0.85rem' }}>
                    {selectedACForView.correccion_inmediata}
                  </p>
                </div>
              )}

              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                <strong style={{ color: '#166534', fontSize: '0.82rem' }}>🛡️ Acción Correctiva Definitiva:</strong>
                <p style={{ margin: '0.2rem 0 0', color: '#14532d', fontSize: '0.85rem' }}>
                  {selectedACForView.accion}
                </p>
                <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#15803d' }}>
                  Responsable: {selectedACForView.responsable || 'No asignado'} | Plazo: {selectedACForView.fecha_fin || 'No definido'} | Estado: {selectedACForView.estado}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setSelectedACForView(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NcAcPage
