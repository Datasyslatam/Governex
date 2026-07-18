import React, { useState, useCallback } from 'react'
import './AuditoriaPage.css'
import AuditCalendar from './components/AuditCalendar'
import { useFetch } from '../../hooks/useFetch'
import { auditoriasService, Auditoria, Hallazgo } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'

type Tab = 'programa' | 'auditorias' | 'hallazgos'

const AUDITORES = ['S. Martínez', 'L. Gómez', 'M. Vargas', 'R. Torres', 'A. Reyes']

const emptyAudit = {
  proceso_id: undefined as number | undefined,
  fecha_inicio: new Date().toISOString().slice(0, 10),
  duracion_dias: 1,
  auditor_lider: AUDITORES[0],
  estado: 'Planificada' as Auditoria['estado'],
}

const emptyPrograma = {
  anio: new Date().getFullYear(),
  objetivo: '',
  duracion: '',
  estado: 'En Curso' as 'En Curso' | 'Cerrado',
}

const formatFecha = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const AuditoriaPage: React.FC = () => {
  const { canEdit, isReadOnly } = usePermissions('auditorias')
  const [activeTab, setActiveTab]     = useState<Tab>('programa')
  const [viewMode, setViewMode]       = useState<'table' | 'calendar'>('table')
  const [showModal, setShowModal]           = useState(false)
  const [editingId, setEditingId]           = useState<number | null>(null)
  const [form, setForm]                     = useState<typeof emptyAudit>(emptyAudit)
  const [saving, setSaving]                 = useState(false)
  const [showProgramaModal, setShowProgramaModal] = useState(false)
  const [programaForm, setProgramaForm]     = useState<typeof emptyPrograma>(emptyPrograma)
  const [savingPrograma, setSavingPrograma] = useState(false)

  // Filtros
  const [filterProgYear, setFilterProgYear]     = useState('')
  const [filterAudProcess, setFilterAudProcess] = useState('')
  const [filterAudAuditor, setFilterAudAuditor] = useState('')
  const [filterAudStatus, setFilterAudStatus]   = useState('')
  const [filterHalAudit, setFilterHalAudit]     = useState('')
  const [filterHalType, setFilterHalType]       = useState('')
  const [filterHalStatus, setFilterHalStatus]   = useState('')

  // Datos desde la API
  const { data: programas, loading: loadingProg, refetch: refetchProg }
    = useFetch(auditoriasService.getProgramas, [])

  const { data: auditorias, loading: loadingAud, refetch: refetchAud }
    = useFetch(auditoriasService.getAll, [])

  const { data: hallazgos, loading: loadingHal }
    = useFetch(auditoriasService.getHallazgos, [])

  // Filtros aplicados
  const filteredProgramas  = programas.filter(p =>
    !filterProgYear || p.anio.toString().includes(filterProgYear))

  const filteredAuditorias = auditorias.filter(a =>
    (!filterAudProcess || (a.proceso_nombre || '').toLowerCase().includes(filterAudProcess.toLowerCase())) &&
    (!filterAudAuditor || (a.auditor_lider  || '').toLowerCase().includes(filterAudAuditor.toLowerCase())) &&
    (!filterAudStatus  || a.estado === filterAudStatus)
  )

  const filteredHallazgos = hallazgos.filter(h =>
    (!filterHalAudit  || (h.auditoria_codigo || '').toLowerCase().includes(filterHalAudit.toLowerCase())) &&
    (!filterHalType   || h.tipo   === filterHalType) &&
    (!filterHalStatus || h.estado === filterHalStatus)
  )

  // Código auto-generado
  const nextCode = useCallback(() => {
    const year = new Date().getFullYear().toString().slice(2)
    const num  = String(auditorias.length + 1).padStart(2, '0')
    return `AI-${year}-${num}`
  }, [auditorias.length])

  // Guardar programa anual
  const handleSavePrograma = useCallback(async () => {
    if (!programaForm.objetivo.trim()) return
    setSavingPrograma(true)
    try {
      await auditoriasService.createPrograma(programaForm)
      await refetchProg()
      setShowProgramaModal(false)
      setProgramaForm(emptyPrograma)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSavingPrograma(false)
    }
  }, [programaForm, refetchProg])

  // Guardar auditoría
  const handleSave = useCallback(async () => {
    if (!form.fecha_inicio) return
    setSaving(true)
    try {
      if (editingId) {
        await auditoriasService.update(editingId, form)
      } else {
        await auditoriasService.create({ ...form, codigo: nextCode() })
      }
      await refetchAud()
      setShowModal(false)
      setEditingId(null)
      setForm(emptyAudit)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [form, editingId, nextCode, refetchAud])

  const openCreate = () => { setEditingId(null); setForm(emptyAudit); setShowModal(true) }
  const openEdit   = (aud: Auditoria) => {
    setEditingId(aud.id)
    setForm({
      proceso_id:   aud.proceso_id,
      fecha_inicio:  aud.fecha_inicio,
      duracion_dias: aud.duracion_dias,
      auditor_lider: aud.auditor_lider || AUDITORES[0],
      estado:        aud.estado,
    })
    setShowModal(true)
  }

  // Adaptar auditorias al tipo que espera AuditCalendar (igual que antes)
  const auditoriasParaCalendario = filteredAuditorias.map(a => ({
    codigo:       a.codigo,
    proceso:      a.proceso_nombre || '—',
    fechaInicio:  a.fecha_inicio,
    duracionDias: a.duracion_dias,
    auditor:      a.auditor_lider || '—',
    estado:       a.estado,
    hallazgos:    Number(a.hallazgos ?? 0),
  }))

  return (
    <div className="page audit-page">
      <header className="page__header audit-page__header">
        <div className="audit-page__header-left">
          <nav className="audit-page__breadcrumb">
            <span>Governex</span>
            <span className="audit-page__bc-sep">›</span>
            <span>Cap. 9.2</span>
            <span className="audit-page__bc-sep">›</span>
            <span className="audit-page__bc-active">Auditoría Interna</span>
          </nav>
          <h2>Gestión de Auditorías Internas</h2>
          <p className="audit-page__subtitle">Programa anual, planes de auditoría y gestión de hallazgos</p>
        </div>
        <div className="audit-page__actions">
          <button className="btn btn--primary" onClick={() => { setProgramaForm(emptyPrograma); setShowProgramaModal(true) }} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>+ Nuevo Programa Anual</button>
        </div>
      </header>

      <nav className="audit-tabs">
        <button className={`audit-tabs__tab ${activeTab === 'programa'   ? 'audit-tabs__tab--active' : ''}`} onClick={() => setActiveTab('programa')}>
          📅 Programas ({filteredProgramas.length})
        </button>
        <button className={`audit-tabs__tab ${activeTab === 'auditorias' ? 'audit-tabs__tab--active' : ''}`} onClick={() => setActiveTab('auditorias')}>
          📋 Auditorías ({filteredAuditorias.length})
        </button>
        <button className={`audit-tabs__tab ${activeTab === 'hallazgos'  ? 'audit-tabs__tab--active' : ''}`} onClick={() => setActiveTab('hallazgos')}>
          🔍 Hallazgos ({filteredHallazgos.length})
        </button>
      </nav>

      <main className="audit-main panel">

        {/* ── Programas ── */}
        {activeTab === 'programa' && (
          <div className="audit-table-wrap">
            <div className="audit-section-header">
              <div className="audit-section-header__title">
                <h3>Programas Anuales de Auditoría</h3>
                <span className="pill pill--muted">Requisito 9.2.2</span>
              </div>
              <div className="audit-filters">
                <input type="text" placeholder="Filtrar por año..." value={filterProgYear}
                  onChange={e => setFilterProgYear(e.target.value)} className="filter-input" />
              </div>
            </div>
            {loadingProg ? <div className="audit-loading">Cargando programas...</div> : (
              <table className="table audit-table">
                <thead>
                  <tr><th>Año</th><th>Objetivo General</th><th>Tiempo / Recursos</th><th>Avance</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {filteredProgramas.map((prog, i) => (
                    <tr key={prog.id} className={i % 2 === 1 ? 'table__row--alt' : ''}>
                      <td className="audit-table__code">{prog.anio}</td>
                      <td className="audit-table__title">{prog.objetivo}</td>
                      <td className="audit-table__duration">{prog.duracion || '—'}</td>
                      <td>
                        <div className="audit-progress">
                          <div className="audit-progress__bar">
                            <div className={`audit-progress__fill ${prog.avance_pct === 100 ? 'bg-success' : 'bg-primary'}`}
                              style={{ width: `${prog.avance_pct}%` }} />
                          </div>
                          <span className="audit-progress__text">{prog.avance_pct}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`pill ${prog.estado === 'Cerrado' ? 'pill--success' : 'pill--warning'}`}>{prog.estado}</span>
                      </td>
                      <td className="audit-table__actions">
                        <button className="audit-action-btn" title="Ver programa">👁️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Auditorías ── */}
        {activeTab === 'auditorias' && (
          <div className="audit-table-wrap">
            <div className="audit-section-header">
              <div className="audit-section-header__title"><h3>Planificación y Ejecución de Auditorías</h3></div>
              <div className="audit-section-controls">
                <div className="audit-view-toggle">
                  <button className={`toggle-btn ${viewMode === 'table'    ? 'active' : ''}`} onClick={() => setViewMode('table')}>Tabla</button>
                  <button className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`} onClick={() => setViewMode('calendar')}>Calendario</button>
                </div>
                <div className="audit-filters">
                  <input type="text" placeholder="Proceso..." value={filterAudProcess}
                    onChange={e => setFilterAudProcess(e.target.value)} className="filter-input" />
                  <input type="text" placeholder="Auditor..." value={filterAudAuditor}
                    onChange={e => setFilterAudAuditor(e.target.value)} className="filter-input" />
                  <select value={filterAudStatus} onChange={e => setFilterAudStatus(e.target.value)} className="filter-select">
                    <option value="">Todos los estados</option>
                    <option value="Planificada">Planificada</option>
                    <option value="En Ejecución">En Ejecución</option>
                    <option value="Cerrada">Cerrada</option>
                  </select>
                </div>
                <button className="btn btn--primary audit-btn-small" onClick={openCreate} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>+ Nueva Auditoría</button>
              </div>
            </div>

            {loadingAud ? <div className="audit-loading">Cargando auditorías...</div> : (
              viewMode === 'calendar'
                ? <AuditCalendar auditorias={auditoriasParaCalendario} />
                : (
                  <table className="table audit-table">
                    <thead>
                      <tr><th>Código</th><th>Proceso Auditado</th><th>Fecha Inicio</th><th>Duración</th><th>Auditor Líder</th><th>Hallazgos</th><th>Estado</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                      {filteredAuditorias.map((aud, i) => (
                        <tr key={aud.id} className={i % 2 === 1 ? 'table__row--alt' : ''}>
                          <td className="audit-table__code">{aud.codigo}</td>
                          <td className="audit-table__process">{aud.proceso_nombre || '—'}</td>
                          <td className="audit-table__date">{formatFecha(aud.fecha_inicio)}</td>
                          <td className="audit-table__date">{aud.duracion_dias} día{aud.duracion_dias !== 1 ? 's' : ''}</td>
                          <td>{aud.auditor_lider || '—'}</td>
                          <td>
                            <span className={`pill ${Number(aud.hallazgos) > 0 ? 'pill--danger' : 'pill--muted'}`}>
                              {aud.hallazgos} hallazgos
                            </span>
                          </td>
                          <td>
                            <span className={`pill ${
                              aud.estado === 'Cerrada' ? 'pill--success' :
                              aud.estado === 'En Ejecución' ? 'pill--warning' : 'pill--muted'
                            }`}>{aud.estado}</span>
                          </td>
                          <td className="audit-table__actions">
                            <button className="audit-action-btn" title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : "Editar"} onClick={() => openEdit(aud)} disabled={!canEdit}>✏️</button>
                            <button className="audit-action-btn" title="Plan de auditoría">📋</button>
                            {aud.estado === 'Cerrada' && (
                              <button className="audit-action-btn" title="Informe final">📄</button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredAuditorias.length === 0 && (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                          No hay auditorías registradas
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                )
            )}
          </div>
        )}

        {/* ── Hallazgos ── */}
        {activeTab === 'hallazgos' && (
          <div className="audit-table-wrap">
            <div className="audit-section-header">
              <div className="audit-section-header__title">
                <h3>Registro de Hallazgos</h3>
                <span className="pill pill--muted">Evidencia objetiva extraída de informes</span>
              </div>
              <div className="audit-filters">
                <input type="text" placeholder="Cód. Auditoría..." value={filterHalAudit}
                  onChange={e => setFilterHalAudit(e.target.value)} className="filter-input" />
                <select value={filterHalType} onChange={e => setFilterHalType(e.target.value)} className="filter-select">
                  <option value="">Todas las naturalezas</option>
                  <option value="No Conformidad Menor">No Conformidad Menor</option>
                  <option value="No Conformidad Mayor">No Conformidad Mayor</option>
                  <option value="Observación">Observación</option>
                  <option value="Oportunidad de Mejora">Oportunidad de Mejora</option>
                </select>
                <select value={filterHalStatus} onChange={e => setFilterHalStatus(e.target.value)} className="filter-select">
                  <option value="">Todos los estados</option>
                  <option value="Abierto">Abierto</option>
                  <option value="Cerrado">Cerrado</option>
                </select>
              </div>
            </div>
            {loadingHal ? <div className="audit-loading">Cargando hallazgos...</div> : (
              <table className="table audit-table">
                <thead>
                  <tr><th>Código</th><th>Auditoría</th><th>Naturaleza</th><th>Descripción</th><th>Cláusula</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {filteredHallazgos.map((hal, i) => (
                    <tr key={hal.id} className={i % 2 === 1 ? 'table__row--alt' : ''}>
                      <td className="audit-table__code">{hal.codigo}</td>
                      <td className="audit-table__ref">{hal.auditoria_codigo}</td>
                      <td>
                        <span className={`pill ${
                          hal.tipo.includes('No Conformidad') ? 'pill--danger' :
                          hal.tipo.includes('Observación') ? 'pill--warning' : 'pill--success'
                        }`}>{hal.tipo}</span>
                      </td>
                      <td className="audit-table__desc">{hal.descripcion}</td>
                      <td className="audit-table__clausula">{hal.clausula || '—'}</td>
                      <td>
                        <span className={`pill ${hal.estado === 'Cerrado' ? 'pill--success' : 'pill--danger'}`}>{hal.estado}</span>
                      </td>
                      <td className="audit-table__actions">
                        <button className="audit-action-btn" title="Ver detalle">👁️</button>
                      </td>
                    </tr>
                  ))}
                  {filteredHallazgos.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                      No hay hallazgos registrados
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* ── Modal Nueva / Editar Auditoría ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? `✏️ Editar Auditoría` : '📋 Nueva Auditoría'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Auditor Líder</label>
                <select value={form.auditor_lider}
                  onChange={e => setForm(f => ({ ...f, auditor_lider: e.target.value }))}
                  className="filter-select form-control" disabled={!canEdit}>
                  {AUDITORES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha de inicio</label>
                  <input type="date" className="filter-input form-control" value={form.fecha_inicio}
                    onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} readOnly={isReadOnly()} />
                </div>
                <div className="form-group">
                  <label>Duración (días)</label>
                  <input type="number" min={1} max={30} className="filter-input form-control"
                    value={form.duracion_dias}
                    onChange={e => setForm(f => ({ ...f, duracion_dias: Math.max(1, parseInt(e.target.value) || 1) }))} readOnly={isReadOnly()} />
                </div>
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={form.estado}
                  onChange={e => setForm(f => ({ ...f, estado: e.target.value as Auditoria['estado'] }))}
                  className="filter-select form-control" disabled={!canEdit}>
                  <option value="Planificada">Planificada</option>
                  <option value="En Ejecución">En Ejecución</option>
                  <option value="Cerrada">Cerrada</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={handleSave} disabled={saving || !form.fecha_inicio || !canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Guardar Auditoría'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal Nuevo Programa Anual ── */}
      {showProgramaModal && (
        <div className="modal-overlay" onClick={() => setShowProgramaModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📅 Nuevo Programa Anual</h3>
              <button className="modal-close" onClick={() => setShowProgramaModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Año</label>
                  <input type="number" className="filter-input form-control"
                    value={programaForm.anio}
                    min={2000} max={2100}
                    onChange={e => setProgramaForm(f => ({ ...f, anio: parseInt(e.target.value) || f.anio }))} readOnly={isReadOnly()} />
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select className="filter-select form-control"
                    value={programaForm.estado}
                    onChange={e => setProgramaForm(f => ({ ...f, estado: e.target.value as typeof f.estado }))} disabled={!canEdit}>
                    <option value="En Curso">En Curso</option>
                    <option value="Cerrado">Cerrado</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Objetivo General</label>
                <input type="text" className="filter-input form-control"
                  placeholder="Ej: Verificar conformidad con los requisitos establecidos..."
                  value={programaForm.objetivo}
                  onChange={e => setProgramaForm(f => ({ ...f, objetivo: e.target.value }))} readOnly={isReadOnly()} />
              </div>
              <div className="form-group">
                <label>Tiempo / Recursos</label>
                <input type="text" className="filter-input form-control"
                  placeholder="Ej: 3 auditores, 12 meses"
                  value={programaForm.duracion}
                  onChange={e => setProgramaForm(f => ({ ...f, duracion: e.target.value }))} readOnly={isReadOnly()} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowProgramaModal(false)}>Cancelar</button>
              <button className="btn btn--primary"
                onClick={handleSavePrograma}
                disabled={savingPrograma || !programaForm.objetivo.trim() || !canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {savingPrograma ? 'Guardando...' : 'Guardar Programa'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default AuditoriaPage
