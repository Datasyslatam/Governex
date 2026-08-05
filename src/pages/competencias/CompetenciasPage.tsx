import React, { useState, useCallback } from 'react'
import './CompetenciasPage.css'
import { useFetch } from '../../hooks/useFetch'
import { competenciasService, PersonalItem, PlanFormacion, perfilesCargoService, procesosService, PerfilCargo, geminiCompetenciasService } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import { ModalPerfilCargo } from './ModalPerfilCargo'
import logoGovernex from '../../assets/LOGO Governex2.0.png'

const emptyPersonal = { nombre: '', cargo: '', proceso_id: '' }
const emptyPlan     = { tema: '', fecha: '', estado: 'Planificado' as const }

const CompetenciasPage: React.FC = () => {
  const { data: personalData,  loading: lP, error: eP, refetch: refetchP }
    = useFetch(competenciasService.getPersonal, [])

  const { data: planFormacion, loading: lF, error: eF, refetch: refetchF }
    = useFetch(competenciasService.getPlanFormacion, [])

  const { data: perfilesData, loading: lPerf, error: ePerf, refetch: refetchPerf }
    = useFetch(perfilesCargoService.getAll, [])

  const { data: procesosData } = useFetch(procesosService.getAll, [])

  const { canEdit, canCreate, isReadOnly, canDelete } = usePermissions('competencias')

  const [filtroProceso, setFiltroProceso]   = useState('')
  const [showModalPers, setShowModalPers]   = useState(false)
  const [showModalPlan, setShowModalPlan]   = useState(false)
  const [showModalEval, setShowModalEval]   = useState(false)
  const [showModalPerfil, setShowModalPerfil] = useState(false)
  const [selectedPersona, setSelectedPersona] = useState<PersonalItem | null>(null)
  
  const [showModalGuia, setShowModalGuia] = useState(false)
  const [temaGuia, setTemaGuia] = useState('')
  const [planIdGuia, setPlanIdGuia] = useState<number | null>(null)
  const [guiaMarkdown, setGuiaMarkdown] = useState('')
  const [loadingGuia, setLoadingGuia] = useState(false)

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

  const handleEliminarPerfil = async (id: number) => {
    if (!window.confirm('¿Eliminar perfil de cargo?')) return
    try {
      await perfilesCargoService.delete(id)
      refetchPerf()
    } catch (e: any) { alert(e.message) }
  }

  const handleDeletePersonal = async (id: number) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro de personal?')) return
    try {
      await competenciasService.deletePersonal(id)
      refetchP()
    } catch (e: any) { alert(e.message) }
  }

  const handleDeletePlan = async (id: number) => {
    if (!window.confirm('¿Estás seguro de eliminar esta capacitación?')) return
    try {
      await competenciasService.deletePlan(id)
      refetchF()
    } catch (e: any) { alert(e.message) }
  }
  const openModalGuia = async (planId: number, tema: string, guiaMarkdownSaved?: string, forceRegenerate = false) => {
    setTemaGuia(tema)
    setPlanIdGuia(planId)
    setShowModalGuia(true)
    
    // Si ya existe la guía guardada y no estamos forzando regeneración, mostrarla directamente
    if (guiaMarkdownSaved && !forceRegenerate) {
      setGuiaMarkdown(guiaMarkdownSaved)
      return
    }

    setGuiaMarkdown('')
    setLoadingGuia(true)
    try {
      const res = await geminiCompetenciasService.generarGuiaCapacitacion({ plan_id: planId, tema })
      setGuiaMarkdown(res.guia)
      // Refrescar la lista de planes para que obtenga la nueva guía guardada
      refetchF()
    } catch (e: any) {
      setGuiaMarkdown('Error al generar la guía: ' + (e.message || 'Error de servidor'))
    } finally {
      setLoadingGuia(false)
    }
  }

  const printGuia = () => {
    // 1. Crear el contenedor para imprimir
    const printSection = document.createElement('div')
    printSection.id = 'print-section'
    printSection.style.fontFamily = 'Arial, sans-serif'
    printSection.style.color = '#000'
    printSection.style.padding = '0'
    
    // Plantilla con logo de Governex
    const logoHtml = `
      <div style="display: flex; align-items: center; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 20px;">
        <img src="${logoGovernex}" alt="Governex Logo" style="max-height: 60px; object-fit: contain; margin-right: 15px;" />
        <div>
          <h2 style="margin: 0; color: #1e1e80; font-size: 22px;">Governex</h2>
          <p style="margin: 0; font-size: 12px; color: #666;">Sistema de Gestión de Calidad</p>
        </div>
      </div>
    `
    
    const contentHtml = `
      <div class="pdf-content" style="line-height: 1.6; font-size: 14px; text-align: justify; padding-bottom: 20px;">
        ${parseMarkdown(guiaMarkdown)}
      </div>
    `
    
    printSection.innerHTML = logoHtml + contentHtml
    
    // 2. Crear estilos específicos para la impresión
    const style = document.createElement('style')
    style.innerHTML = `
      @media print {
        /* Ocultar toda la app de React */
        body > *:not(#print-section) {
          display: none !important;
        }
        /* Definir márgenes de página para evitar que salgan los textos por defecto del navegador (URL, Fecha) */
        @page { margin: 15mm; }
        body { background: white; margin: 0; }
        
        /* Evitar saltos de página a mitad de los textos */
        .pdf-content h1, .pdf-content h2, .pdf-content h3, .pdf-content h4 { page-break-after: avoid; color: #1e1e80; margin-top: 20px; }
        .pdf-content p, .pdf-content li { page-break-inside: avoid; margin-bottom: 10px; }
      }
    `
    
    // 3. Añadir todo al DOM
    document.head.appendChild(style)
    document.body.appendChild(printSection)
    
    // 4. Invocar la impresión nativa (que ahora solo verá la plantilla hermosa)
    window.print()
    
    // 5. Limpiar el DOM al terminar, devolviendo la app a la normalidad sin tener que recargar
    document.body.removeChild(printSection)
    document.head.removeChild(style)
  }

  const directPrintGuia = (tema: string, markdown: string) => {
    const printContent = document.createElement('div')
    printContent.innerHTML = `
      <div style="padding: 2rem; font-family: sans-serif; color: black;">
        <h2>Guía de Capacitación: ${tema}</h2>
        <div style="line-height: 1.6; font-size: 0.95rem;">
          ${parseMarkdown(markdown)}
        </div>
      </div>
    `
    const originalContent = document.body.innerHTML
    document.body.innerHTML = printContent.innerHTML
    window.print()
    document.body.innerHTML = originalContent
    window.location.reload()
  }

  const parseMarkdown = (md: string) => {
    let html = md
      .replace(/^### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^## (.*$)/gim, '<h3>$1</h3>')
      .replace(/^# (.*$)/gim, '<h2>$1</h2>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
    
    html = html.replace(/(<li>.*<\/li>(\n)?)+/g, '<ul>$&</ul>')

    html = html.split(/\n\n+/).map(block => {
      block = block.trim()
      if (!block) return ''
      if (block.startsWith('<h') || block.startsWith('<ul')) return block
      return `<p>${block.replace(/\n/g, '<br />')}</p>`
    }).join('\n')

    return html
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
                        <button className="comp-action-btn" style={{ color: '#ef4444' }} title={!canDelete ? 'Tu rol no tiene permiso para esta acción' : "Eliminar Personal"}
                          onClick={() => handleDeletePersonal(prs.id)} disabled={!canDelete}>🗑️</button>
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

          {/* Sección de Perfiles de Cargo con IA */}
          <div className="comp-toolbar" style={{ marginTop: '3rem' }}>
            <h3 className="comp-section-title">Perfiles de Cargo (Asistidos por IA)</h3>
            <button className="btn btn--primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
              onClick={() => setShowModalPerfil(true)} disabled={!canCreate}>
              + Perfil de Cargo (IA) 🪄
            </button>
          </div>

          {lPerf ? (
            <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando perfiles...</div>
          ) : ePerf ? (
            <div style={{ padding: '2rem', color: 'red' }}>Error: {ePerf}</div>
          ) : (
            <div className="perfiles-grid">
              {perfilesData.map(perfil => (
                <div key={perfil.id} className="perfil-card panel">
                  <div className="perfil-card-header">
                    <h4>{perfil.cargo}</h4>
                    <span className="perfil-badge">{perfil.proceso_nombre || 'Sin Proceso'}</span>
                  </div>
                  <div className="perfil-card-body">
                    <p><strong>Educación:</strong> {perfil.educacion || 'No especificada'}</p>
                    <p><strong>Formación:</strong> {perfil.formacion || 'No especificada'}</p>
                    <p><strong>Experiencia:</strong> {perfil.experiencia || 'No especificada'}</p>
                    
                    <div className="perfil-checklists">
                      <details className="perfil-cl-details">
                        <summary><strong>☑️ Desempeño ({perfil.checklist_desempeno?.length || 0})</strong></summary>
                        <ul className="perfil-cl-list">
                          {perfil.checklist_desempeno?.map((item, i) => <li key={i}>{item}</li>) || <li>No hay ítems</li>}
                        </ul>
                      </details>
                      <details className="perfil-cl-details">
                        <summary><strong>🧠 Conocimiento ({perfil.checklist_conocimiento?.length || 0})</strong></summary>
                        <ul className="perfil-cl-list">
                          {perfil.checklist_conocimiento?.map((item, i) => <li key={i}>{item}</li>) || <li>No hay ítems</li>}
                        </ul>
                      </details>
                    </div>
                  </div>
                  <div className="perfil-card-footer">
                    <span className="perfil-ia-badge">
                      {perfil.generado_con_ia ? '🪄 Generado por IA' : ''}
                    </span>
                    <button className="btn btn--danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => handleEliminarPerfil(perfil.id)} disabled={!canDelete}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              {perfilesData.length === 0 && (
                <div style={{ padding: '2rem', opacity: 0.5, gridColumn: '1 / -1', textAlign: 'center' }}>
                  No hay perfiles de cargo registrados. Utiliza el asistente de IA para crear uno desde un manual de funciones.
                </div>
              )}
            </div>
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
                    
                    {plan.guia_markdown ? (
                      <button className="btn btn--primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', marginLeft: '0.5rem' }}
                        onClick={() => openModalGuia(plan.id, plan.tema, plan.guia_markdown!)}
                        title="Ver Guía Generada">
                        📖 Ver Guía
                      </button>
                    ) : (
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', marginLeft: '0.5rem' }}
                        onClick={() => openModalGuia(plan.id, plan.tema, plan.guia_markdown)}
                        title="Generar Guía IA 🪄">
                        🪄
                      </button>
                    )}

                    <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      onClick={() => openEditPlan(plan)} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>✏️</button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                      onClick={() => handleDeletePlan(plan.id)} disabled={!canDelete} title={!canDelete ? 'Tu rol no tiene permiso para esta acción' : "Eliminar Plan"}>🗑️</button>
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
              <div className="form-group">
                <label>Proceso Asociado</label>
                <select className="filter-input form-control" disabled={isReadOnly()}
                  value={formPers.proceso_id}
                  onChange={e => setFormPers(f => ({ ...f, proceso_id: e.target.value }))}>
                  <option value="">Ninguno / No especificado</option>
                  {procesosData?.map((proc: any) => (
                    <option key={proc.id} value={proc.id}>{proc.nombre}</option>
                  ))}
                </select>
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

      {/* Modal Perfil Cargo IA */}
      {showModalPerfil && (
        <ModalPerfilCargo 
          onClose={() => setShowModalPerfil(false)}
          onSaved={() => {
            refetchPerf()
            refetchF() // Refetch plan de formacion too
          }}
          procesos={procesosData.map(p => ({ id: p.id, nombre: p.nombre }))}
          canEdit={canEdit}
        />
      )}
      {/* Modal Guia PDF */}
      {showModalGuia && (
        <div className="modal-overlay" onClick={() => setShowModalGuia(false)}>
          <div className="modal-card modal-perfil-cargo" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3>📄 Guía de Capacitación: {temaGuia}</h3>
              <button className="modal-close" onClick={() => setShowModalGuia(false)}>✕</button>
            </div>
            <div className="modal-body" id="guia-pdf-content" style={{ background: '#fff', padding: '2rem', flex: 1, overflowY: 'auto' }}>
              {loadingGuia ? (
                <div style={{ textAlign: 'center', opacity: 0.6, padding: '2rem' }}>
                  <p>🪄 La IA está diseñando la guía de capacitación...</p>
                  <p>Por favor, espera unos segundos.</p>
                </div>
              ) : (
                <div className="guia-markdown" dangerouslySetInnerHTML={{ __html: parseMarkdown(guiaMarkdown) }} style={{ lineHeight: '1.6' }} />
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div>
                <button className="btn btn--secondary" onClick={() => setShowModalGuia(false)}>Cerrar</button>
                <button className="btn btn--secondary" onClick={() => planIdGuia && openModalGuia(planIdGuia, temaGuia, undefined, true)} disabled={loadingGuia} style={{ marginLeft: '0.5rem' }}>
                  🔄 Regenerar con IA
                </button>
              </div>
              <button className="btn btn--primary" onClick={printGuia} disabled={loadingGuia}>
                ⬇️ Guardar como PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default CompetenciasPage
