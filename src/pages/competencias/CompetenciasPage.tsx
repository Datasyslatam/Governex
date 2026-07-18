import React, { useState, useCallback } from 'react'
import './CompetenciasPage.css'
import { useFetch } from '../../hooks/useFetch'
import { competenciasService, PersonalItem, PlanFormacion } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'

const emptyPersonal = { nombre: '', cargo: '' }
const emptyPlan     = { tema: '', fecha: '', estado: 'Planificado' as const }

const CompetenciasPage: React.FC = () => {
  const { data: personalData,  loading: lP, error: eP, refetch: refetchP }
    = useFetch(competenciasService.getPersonal, [])

  const { data: planFormacion, loading: lF, error: eF, refetch: refetchF }
    = useFetch(competenciasService.getPlanFormacion, [])

  const { canEdit, canCreate, isReadOnly } = usePermissions('competencias')

  const [filtroProceso, setFiltroProceso]   = useState('')
  const [showModalPers, setShowModalPers]   = useState(false)
  const [showModalPlan, setShowModalPlan]   = useState(false)
  const [showModalEval, setShowModalEval]   = useState(false)
  const [selectedPersona, setSelectedPersona] = useState<PersonalItem | null>(null)
  const [editingPlanId, setEditingPlanId]   = useState<number | null>(null)
  const [formPers, setFormPers]             = useState(emptyPersonal)
  const [formPlan, setFormPlan]             = useState(emptyPlan)
  const [formEval, setFormEval]             = useState({ brecha_pct: 0, estado: 'Competente' as const })
  const [saving, setSaving]                 = useState(false)

  const filtrados = personalData.filter(p =>
    !filtroProceso || (p.proceso_nombre || '').toLowerCase().includes(filtroProceso.toLowerCase())
  )

  const procesos = [...new Set(personalData.map(p => p.proceso_nombre).filter(Boolean))]

  const guardarPersonal = useCallback(async () => {
    if (!formPers.nombre) return
    setSaving(true)
    try {
      await competenciasService.createPersonal(formPers)
      await refetchP()
      setShowModalPers(false)
      setFormPers(emptyPersonal)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }, [formPers, refetchP])

  const guardarEval = useCallback(async () => {
    if (!selectedPersona) return
    setSaving(true)
    try {
      await competenciasService.addEvaluacion({
        personal_id: selectedPersona.id,
        brecha_pct:  formEval.brecha_pct,
        estado:      formEval.estado,
        fecha:       new Date().toISOString().slice(0, 10),
      })
      await refetchP()
      setShowModalEval(false)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }, [selectedPersona, formEval, refetchP])

  const guardarPlan = useCallback(async () => {
    if (!formPlan.tema) return
    setSaving(true)
    try {
      if (editingPlanId) {
        await competenciasService.updatePlan(editingPlanId, formPlan)
      } else {
        await competenciasService.createPlan(formPlan)
      }
      await refetchF()
      setShowModalPlan(false)
      setEditingPlanId(null)
      setFormPlan(emptyPlan)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }, [formPlan, editingPlanId, refetchF])

  const openEval = (p: PersonalItem) => {
    setSelectedPersona(p)
    const ue = p.ultima_evaluacion
    setFormEval({ brecha_pct: ue?.brecha_pct ?? 0, estado: (ue?.estado as any) ?? 'Competente' })
    setShowModalEval(true)
  }

  const openEditPlan = (pl: PlanFormacion) => {
    setEditingPlanId(pl.id)
    setFormPlan({ tema: pl.tema, fecha: pl.fecha || '', estado: pl.estado as any })
    setShowModalPlan(true)
  }

  return (
    <div className="page comp-page">
      <header className="page__header comp-page__header">
        <div className="comp-page__header-left">
          <nav className="comp-page__breadcrumb">
            <span>Governex</span>
            <span className="comp-page__bc-sep">›</span>
            <span>Cap. 7.2</span>
            <span className="comp-page__bc-sep">›</span>
            <span className="comp-page__bc-active">Competencia</span>
          </nav>
          <h2>Gestión de Competencias y Formación</h2>
          <p className="comp-page__subtitle">Perfiles de cargo, evaluación de brechas y planes de capacitación</p>
        </div>
        <div className="comp-page__actions">
          <button className="btn btn--primary" onClick={() => { setShowModalPers(true); setFormPers(emptyPersonal) }} disabled={!canCreate} title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}>
            + Nueva Evaluación
          </button>
        </div>
      </header>

      <div className="comp-layout">
        {/* Tabla de personal */}
        <div className="comp-main-col panel">
          <div className="comp-toolbar">
            <h3 className="comp-section-title">Matriz de Competencias del Personal</h3>
            <div className="comp-filters">
              <select className="input comp-filter" value={filtroProceso}
                onChange={e => setFiltroProceso(e.target.value)}>
                <option value="">Todos los Procesos</option>
                {procesos.map(p => <option key={p} value={p!}>{p}</option>)}
              </select>
            </div>
          </div>

          {lP ? (
            <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando personal...</div>
          ) : eP ? (
            <div style={{ padding: '2rem', color: 'red' }}>Error: {eP}</div>
          ) : (
            <table className="table comp-table">
              <thead>
                <tr>
                  <th>Nombre</th><th>Cargo</th><th>Proceso</th>
                  <th>Última Evaluación</th><th>Brecha Identificada</th>
                  <th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((prs, i) => {
                  const ue     = prs.ultima_evaluacion
                  const brecha = ue?.brecha_pct ?? null
                  const estado = ue?.estado ?? 'Sin evaluar'
                  return (
                    <tr key={prs.id} className={i % 2 === 1 ? 'table__row--alt' : ''}>
                      <td className="comp-table__name">{prs.nombre}</td>
                      <td className="comp-table__cargo">{prs.cargo || '—'}</td>
                      <td className="comp-table__process">{prs.proceso_nombre || '—'}</td>
                      <td className="comp-table__date">{ue?.fecha || '—'}</td>
                      <td>
                        {brecha !== null ? (
                          <span className={`comp-brecha ${
                            brecha === 0 ? 'brecha-0' : brecha <= 15 ? 'brecha-low' : 'brecha-high'
                          }`}>{brecha}%</span>
                        ) : <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                      <td>
                        <span className={`pill ${
                          estado === 'Competente'    ? 'pill--success' :
                          estado === 'En Formación'  ? 'pill--warning' :
                          estado === 'Brecha Crítica'? 'pill--danger'  : 'pill--muted'
                        }`}>{estado}</span>
                      </td>
                      <td className="comp-table__actions">
                        <button className="comp-action-btn" title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : "Registrar Evaluación"}
                          onClick={() => openEval(prs)} disabled={!canEdit}>📊</button>
                      </td>
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                    No hay personal registrado
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Plan de formación */}
        <div className="comp-side-col panel">
          <div className="comp-side-header">
            <h3>Plan Anual de Formación {new Date().getFullYear()}</h3>
            <button className="btn btn--muted"
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
              onClick={() => { setEditingPlanId(null); setFormPlan(emptyPlan); setShowModalPlan(true) }} disabled={!canCreate} title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}>
              + Tarea
            </button>
          </div>

          {lF ? (
            <div style={{ padding: '1rem', opacity: 0.5 }}>Cargando plan...</div>
          ) : (
            <div className="comp-plan-list">
              {planFormacion.map((plan, i) => (
                <div key={plan.id} className={`comp-plan-card ${plan.estado === 'Completado' ? 'comp-plan-done' : ''}`}>
                  <div className="comp-plan-card-header">
                    <strong>{plan.tema}</strong>
                  </div>
                  {plan.asistentes_nombres && plan.asistentes_nombres[0] && (
                    <div className="comp-plan-target">
                      DIRIGIDO A:<br />
                      {plan.asistentes_nombres.filter(Boolean).join(', ')}
                    </div>
                  )}
                  <div className="comp-plan-footer">
                    <span className="comp-plan-date">📅 {plan.fecha || 'Sin fecha'}</span>
                    <span className={`pill ${plan.estado === 'Completado' ? 'pill--success' : 'pill--muted'}`}>
                      {plan.estado}
                    </span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      onClick={() => openEditPlan(plan)} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>✏️</button>
                  </div>
                </div>
              ))}
              {planFormacion.length === 0 && (
                <div style={{ padding: '1rem', opacity: 0.4 }}>No hay actividades de formación</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal agregar personal */}
      {showModalPers && (
        <div className="modal-overlay" onClick={() => setShowModalPers(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>👤 Registrar Persona</h3>
              <button className="modal-close" onClick={() => setShowModalPers(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nombre completo *</label>
                <input type="text" className="filter-input form-control" readOnly={isReadOnly()}
                  value={formPers.nombre} placeholder="Ej: Laura Gómez"
                  onChange={e => setFormPers(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Cargo</label>
                <input type="text" className="filter-input form-control" readOnly={isReadOnly()}
                  value={formPers.cargo} placeholder="Ej: Jefe de Calidad"
                  onChange={e => setFormPers(f => ({ ...f, cargo: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalPers(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={guardarPersonal}
                disabled={saving || !formPers.nombre || !canCreate} title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal evaluación de competencia */}
      {showModalEval && selectedPersona && (
        <div className="modal-overlay" onClick={() => setShowModalEval(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📊 Evaluación de Competencia — {selectedPersona.nombre}</h3>
              <button className="modal-close" onClick={() => setShowModalEval(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Brecha identificada (%): {formEval.brecha_pct}%</label>
                <input type="range" min={0} max={100} value={formEval.brecha_pct}
                  onChange={e => setFormEval(f => ({ ...f, brecha_pct: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label>Estado de competencia</label>
                <select className="filter-select form-control" value={formEval.estado}
                  onChange={e => setFormEval(f => ({ ...f, estado: e.target.value as any }))}>
                  <option value="Competente">Competente</option>
                  <option value="En Formación">En Formación</option>
                  <option value="Brecha Crítica">Brecha Crítica</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalEval(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={guardarEval} disabled={saving || !canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {saving ? 'Guardando...' : 'Registrar Evaluación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal plan de formación */}
      {showModalPlan && (
        <div className="modal-overlay" onClick={() => setShowModalPlan(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPlanId ? '✏️ Editar Plan' : '📅 Nueva Actividad de Formación'}</h3>
              <button className="modal-close" onClick={() => setShowModalPlan(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tema / Capacitación *</label>
                <input type="text" className="filter-input form-control" readOnly={isReadOnly()}
                  value={formPlan.tema} placeholder="Ej: Auditor Interno del SGC"
                  onChange={e => setFormPlan(f => ({ ...f, tema: e.target.value }))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha</label>
                  <input type="date" className="filter-input form-control" readOnly={isReadOnly()}
                    value={formPlan.fecha}
                    onChange={e => setFormPlan(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select className="filter-select form-control" value={formPlan.estado}
                    onChange={e => setFormPlan(f => ({ ...f, estado: e.target.value as any }))}>
                    <option value="Planificado">Planificado</option>
                    <option value="En Ejecución">En Ejecución</option>
                    <option value="Completado">Completado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalPlan(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={guardarPlan}
                disabled={saving || !formPlan.tema || (editingPlanId ? !canEdit : !canCreate)} title={(editingPlanId ? !canEdit : !canCreate) ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {saving ? 'Guardando...' : editingPlanId ? 'Guardar Cambios' : 'Crear Actividad'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompetenciasPage
