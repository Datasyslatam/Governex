import React, { useState, useEffect } from 'react'
import './MatrizCargosPage.css'
import { useAIAnalysis, FilaMatrizCargos, TipoProceso } from '../../context/AIAnalysisContext'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

/* ══════════════════════════════════════════════════════════════
   LISTA PREDEFINIDA DE CLÁUSULAS ISO 9001:2015
   ══════════════════════════════════════════════════════════════ */
const CLAUSULAS_ISO: { codigo: string; detalle: string }[] = [
  { codigo: '§4.1', detalle: '§4.1 – Comprensión de la organización y de su contexto' },
  { codigo: '§4.2', detalle: '§4.2 – Comprensión de las necesidades y expectativas de las partes interesadas' },
  { codigo: '§4.3', detalle: '§4.3 – Determinación del alcance del SGC' },
  { codigo: '§4.4', detalle: '§4.4 – Sistema de gestión de la calidad y sus procesos' },
  { codigo: '§5.1', detalle: '§5.1 – Liderazgo y compromiso' },
  { codigo: '§5.2', detalle: '§5.2 – Política de la calidad' },
  { codigo: '§5.3', detalle: '§5.3 – Roles, responsabilidades y autoridades en la organización' },
  { codigo: '§6.1', detalle: '§6.1 – Acciones para abordar riesgos y oportunidades' },
  { codigo: '§6.2', detalle: '§6.2 – Objetivos de la calidad y planificación' },
  { codigo: '§6.3', detalle: '§6.3 – Planificación de los cambios' },
  { codigo: '§7.1', detalle: '§7.1 – Recursos' },
  { codigo: '§7.2', detalle: '§7.2 – Competencia' },
  { codigo: '§7.3', detalle: '§7.3 – Toma de conciencia' },
  { codigo: '§7.4', detalle: '§7.4 – Comunicación' },
  { codigo: '§7.5', detalle: '§7.5 – Información documentada' },
  { codigo: '§8.1', detalle: '§8.1 – Planificación y control operacional' },
  { codigo: '§8.2', detalle: '§8.2 – Requisitos para los productos y servicios' },
  { codigo: '§8.3', detalle: '§8.3 – Diseño y desarrollo de los productos y servicios' },
  { codigo: '§8.4', detalle: '§8.4 – Control de los procesos, productos y servicios suministrados externamente' },
  { codigo: '§8.5', detalle: '§8.5 – Producción y provisión del servicio' },
  { codigo: '§8.6', detalle: '§8.6 – Liberación de los productos y servicios' },
  { codigo: '§8.7', detalle: '§8.7 – Control de las salidas no conformes' },
  { codigo: '§9.1', detalle: '§9.1 – Seguimiento, medición, análisis y evaluación' },
  { codigo: '§9.2', detalle: '§9.2 – Auditoría interna' },
  { codigo: '§9.3', detalle: '§9.3 – Revisión por la dirección' },
  { codigo: '§10.1', detalle: '§10.1 – Generalidades (Mejora)' },
  { codigo: '§10.2', detalle: '§10.2 – No conformidad y acción correctiva' },
  { codigo: '§10.3', detalle: '§10.3 – Mejora continua' },
]

/* ══════════════════════════════════════════════════════════════
   TIPOS LOCALES
   ══════════════════════════════════════════════════════════════ */
type ColKey = 'actividades' | 'responsable' | 'funciones' | 'clausulaDetalle'

const COLS: { key: ColKey; label: string }[] = [
  { key: 'actividades',     label: 'Actividades del Proceso' },
  { key: 'responsable',     label: 'Responsable del Cargo' },
  { key: 'funciones',       label: 'Funciones y Responsabilidades' },
  { key: 'clausulaDetalle', label: 'Cláusula ISO 9001:2015' },
]

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════════════ */
interface MatrizCargosProps {
  isSubTab?: boolean;
}

const MatrizCargosPage: React.FC<MatrizCargosProps> = ({ isSubTab }) => {
  const {
    analysis,
    updateFilaMatrizCargos, addFilaMatrizCargos, removeFilaMatrizCargos,
  } = useAIAnalysis()
  const { canEdit, canCreate, canDelete } = usePermissions('procesos')

  const filas = analysis?.matrizCargos ?? []         // ← sin useState local ni useEffect de sync
  const [editingCell, setEditing]     = useState<{ id: number; col: ColKey } | null>(null)
  const [editValue, setEditValue]     = useState('')
  const [editActividades, setEditActividades] = useState<string[]>([])
  const [filterTipo, setFilterTipo]   = useState<TipoProceso | 'todos'>('todos')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newFila, setNewFila] = useState<Omit<FilaMatrizCargos, 'id'>>({
    proceso: '', tipo: 'misional', actividades: [''], responsable: '',
    funciones: '', clausula: '§5.3', clausulaDetalle: '§5.3 – Roles, responsabilidades y autoridades en la organización',
  })

  const filasFiltradas = filterTipo === 'todos' ? filas : filas.filter(f => f.tipo === filterTipo)

  const startEdit = (id: number, col: ColKey, fila: FilaMatrizCargos) => {
    setEditing({ id, col })
    if (col === 'actividades') setEditActividades([...fila.actividades])
    else setEditValue(fila[col] as string)
  }

  const commitEdit = () => {
    if (!editingCell) return
    if (editingCell.col === 'actividades') {
      updateFilaMatrizCargos(editingCell.id, { actividades: editActividades.filter(a => a.trim()) })
    } else {
      updateFilaMatrizCargos(editingCell.id, { [editingCell.col]: editValue } as Partial<FilaMatrizCargos>)
    }
    setEditing(null)
  }
  const cancelEdit = () => setEditing(null)

  const deleteFila = (id: number) => {
    if (window.confirm('¿Eliminar este cargo de la matriz?')) removeFilaMatrizCargos(id)
  }

  const addFila = () => {
    if (!newFila.proceso.trim()) return
    addFilaMatrizCargos({ ...newFila, actividades: newFila.actividades.filter(a => a.trim()) })
    setShowAddModal(false)
    setNewFila({
      proceso: '', tipo: 'misional', actividades: [''], responsable: '',
      funciones: '', clausula: '§5.3', clausulaDetalle: '§5.3 – Roles, responsabilidades y autoridades en la organización',
    })
  }

  const hasAnalysis = analysis?.matrizCargos && analysis.matrizCargos.length > 0

  /* ── Helpers para actividades en el modal ────────────────── */
  const addActividadNew = () => setNewFila(p => ({ ...p, actividades: [...p.actividades, ''] }))
  const removeActividadNew = (idx: number) => setNewFila(p => ({ ...p, actividades: p.actividades.filter((_, i) => i !== idx) }))
  const updateActividadNew = (idx: number, val: string) => setNewFila(p => ({ ...p, actividades: p.actividades.map((a, i) => i === idx ? val : a) }))

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className={isSubTab ? "" : "cargos-page"}>

      {/* HEADER */}
      {!isSubTab && (
        <div className="cargos-page__header">
          <div className="cargos-page__title-block">
            <h1>📋 Matriz de Cargos</h1>
            <p>Actividades y responsabilidades de cada proceso frente a los requisitos ISO 9001:2015</p>
            <span className="cargos-page__clause">Cláusula 5.3 · RF-004</span>
          </div>
        </div>
      )}

      {/* ── PANEL VACÍO: sin análisis aún ─────────────────── */}
      {!hasAnalysis && filas.length === 0 && (
        <div className="cargos-empty-state">
          <div className="cargos-empty-state__icon">🤖</div>
          <h2>Matriz de Cargos pendiente de generación</h2>
          <p>
            La Matriz de Cargos se genera automáticamente cuando Governex analiza el organigrama
            en el módulo <strong>"Contexto de la Organización"</strong>.
          </p>
          <ol className="cargos-empty-state__steps">
            <li>Ve al módulo <strong>Contexto de la Organización</strong> (§4 — Mapa de Procesos)</li>
            <li>Construye o sube tu organigrama / mapa de procesos</li>
            <li>Haz clic en <strong>"Guardar y analizar con Governex"</strong></li>
            <li>Regresa aquí — la matriz se habrá generado automáticamente</li>
          </ol>
          <a href="/procesos" className="btn-primary" style={{ display: 'inline-block', marginTop: '1.2rem', textDecoration: 'none' }}>
            Ir a Contexto de la Organización →
          </a>
          <div className="cargos-legend" style={{ marginTop: '2rem' }}>
            <div className="cargos-legend__item">
              📌 <strong>RF-004</strong> — Genera una Matriz de Cargos donde cada proceso lista sus actividades concretas mapeadas contra las cláusulas de la norma ISO 9001:2015.
            </div>
          </div>
        </div>
      )}

      {/* ── MATRIZ ────────────────────────────────────────── */}
      {(hasAnalysis || filas.length > 0) && (
        <div className="cargos-matriz-panel">

          {hasAnalysis && (
            <div className="cargos-ai-banner">
              🤖 Matriz de Cargos generada automáticamente por Governex a partir del mapa de procesos analizado en "Contexto de la Organización". Puedes editar cualquier celda haciendo clic.
            </div>
          )}

          <div className="cargos-matriz-topbar">
            <div className="cargos-matriz-topbar__info">
              Mostrando <strong>{filasFiltradas.length}</strong> de <strong>{filas.length}</strong> cargos &nbsp;·&nbsp;
              <select value={filterTipo} onChange={e => setFilterTipo(e.target.value as any)}
                style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                <option value="todos">Todos los tipos</option>
                <option value="estrategico">Estratégicos</option>
                <option value="misional">Misionales</option>
                <option value="apoyo">Apoyo</option>
              </select>
            </div>
            <div className="cargos-matriz-actions">
              <button className="btn-primary" onClick={() => setShowAddModal(true)} disabled={!canCreate} title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Agregar cargo</button>
            </div>
          </div>

          <div className="cargos-legend">
            <div className="cargos-legend__item"><span className="proceso-tipo-badge estrategico">Estratégico</span> Orientan el SGC y marcan la dirección</div>
            <div className="cargos-legend__item"><span className="proceso-tipo-badge misional">Misional</span> Generan valor directo al cliente</div>
            <div className="cargos-legend__item"><span className="proceso-tipo-badge apoyo">Apoyo</span> Soportan la operación del SGC</div>
            <div className="cargos-legend__item">✏️ Haz clic en cualquier celda para editar</div>
          </div>

          <div className="cargos-table-wrapper">
            <table className="cargos-matrix-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 40 }}>#</th>
                  <th style={{ minWidth: 170 }}>Proceso del SGC</th>
                  <th style={{ minWidth: 90 }}>Tipo</th>
                  {COLS.map(c => <th key={c.key} style={{ minWidth: c.key === 'actividades' ? 220 : 150 }}>{c.label}</th>)}
                  <th style={{ minWidth: 50 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map((fila, idx) => (
                  <tr key={fila.id}>
                    <td style={{ color: '#9ca3af', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600, color: '#1b3a6b' }}>{fila.proceso}</td>
                    <td>
                      <span className={`proceso-tipo-badge ${fila.tipo}`}>
                        {fila.tipo === 'estrategico' ? 'Estratégico' : fila.tipo === 'misional' ? 'Misional' : 'Apoyo'}
                      </span>
                    </td>
                    {COLS.map(col => {
                      const isEditing = editingCell?.id === fila.id && editingCell?.col === col.key

                      if (col.key === 'actividades') {
                        return (
                          <td key={col.key} onClick={canEdit ? (() => !isEditing && startEdit(fila.id, col.key, fila)) : undefined} style={{ cursor: canEdit ? 'pointer' : 'default' }} title={!canEdit ? 'Tu rol no tiene permiso para editar' : undefined}>
                            {isEditing ? (
                              <div className="cargos-cell-edit" onClick={e => e.stopPropagation()}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  {editActividades.map((act, ai) => (
                                    <div key={ai} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                      <input type="text" value={act} onChange={e => {
                                        const next = [...editActividades]; next[ai] = e.target.value; setEditActividades(next)
                                      }} style={{ flex: 1, fontSize: '0.8rem', padding: '0.25rem 0.35rem', border: '1px solid #cbd5e1', borderRadius: '3px' }} />
                                      <button className="btn-icon danger" onClick={() => setEditActividades(prev => prev.filter((_, i) => i !== ai))} title="Quitar" style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }} disabled={!canEdit}>✕</button>
                                    </div>
                                  ))}
                                  <button className="btn-icon" onClick={() => setEditActividades(prev => [...prev, ''])} style={{ fontSize: '0.72rem', alignSelf: 'flex-start' }} disabled={!canEdit}>＋ Actividad</button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  <button className="btn-icon" onClick={commitEdit} title="Guardar" disabled={!canEdit}>✔</button>
                                  <button className="btn-icon" onClick={cancelEdit} title="Cancelar">✕</button>
                                </div>
                              </div>
                            ) : Array.isArray(fila.actividades) && fila.actividades.length > 0
                              ? <ul className="cargos-actividades-list">{fila.actividades.map((a, i) => <li key={i}>{a}</li>)}</ul>
                              : (canEdit ? <span className="cargos-cell-empty">— clic para editar</span> : null)
                            }
                          </td>
                        )
                      }

                      const val = fila[col.key] as string
                      return (
                        <td key={col.key} onClick={canEdit ? (() => !isEditing && startEdit(fila.id, col.key, fila)) : undefined} style={{ cursor: canEdit ? 'pointer' : 'default' }} title={!canEdit ? 'Tu rol no tiene permiso para editar' : undefined}>
                          {isEditing ? (
                            <div className="cargos-cell-edit" onClick={e => e.stopPropagation()}>
                              {col.key === 'clausulaDetalle' ? (
                                <select autoFocus value={editValue}
                                  onChange={e => {
                                    setEditValue(e.target.value)
                                  }}
                                  onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
                                  style={{ flex: 1, fontSize: '0.81rem', padding: '0.3rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                                  {CLAUSULAS_ISO.map(c => <option key={c.codigo} value={c.detalle}>{c.detalle}</option>)}
                                </select>
                              ) : (
                                <textarea autoFocus rows={3} value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() } if (e.key === 'Escape') cancelEdit() }} />
                              )}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <button className="btn-icon" onClick={commitEdit} title="Guardar (Enter)" disabled={!canEdit}>✔</button>
                                <button className="btn-icon" onClick={cancelEdit} title="Cancelar (Esc)">✕</button>
                              </div>
                            </div>
                          ) : val
                            ? <span className="cargos-cell-text">{val}</span>
                            : (canEdit ? <span className="cargos-cell-empty">— clic para editar</span> : null)}
                        </td>
                      )
                    })}
                    <td>
                      <PermissionGuard recurso="procesos" accion="eliminar" mode="hide">
                        <button className="btn-icon danger" onClick={() => deleteFila(fila.id)} title="Eliminar cargo">🗑️</button>
                      </PermissionGuard>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Agregar cargo */}
      {showAddModal && (
        <div className="cargos-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="cargos-modal" onClick={e => e.stopPropagation()}>
            <h2>➕ Agregar cargo a la matriz</h2>
            <label>Nombre del proceso *<input type="text" placeholder="ej. Gestión de Proyectos" value={newFila.proceso} onChange={e => setNewFila(p => ({ ...p, proceso: e.target.value }))} /></label>
            <label>Tipo de proceso
              <select value={newFila.tipo} onChange={e => setNewFila(p => ({ ...p, tipo: e.target.value as TipoProceso }))}>
                <option value="estrategico">Estratégico</option>
                <option value="misional">Misional</option>
                <option value="apoyo">Apoyo</option>
              </select>
            </label>

            <div className="cargos-modal__actividades">
              <label style={{ marginBottom: '0.25rem' }}>Actividades del proceso</label>
              {newFila.actividades.map((act, i) => (
                <div key={i} className="cargos-modal__act-row">
                  <input type="text" placeholder={`Actividad ${i + 1}`} value={act}
                    onChange={e => updateActividadNew(i, e.target.value)} />
                  {newFila.actividades.length > 1 && (
                    <button className="btn-icon danger" onClick={() => removeActividadNew(i)} style={{ fontSize: '0.72rem' }}>✕</button>
                  )}
                </div>
              ))}
              <button className="btn-icon" onClick={addActividadNew} style={{ fontSize: '0.78rem', alignSelf: 'flex-start', marginTop: '0.2rem' }}>＋ Agregar actividad</button>
            </div>

            <label>Responsable del cargo<input type="text" placeholder="ej. Jefe de Proyectos" value={newFila.responsable} onChange={e => setNewFila(p => ({ ...p, responsable: e.target.value }))} /></label>
            <label>Funciones y responsabilidades<textarea rows={2} placeholder="ej. Planificar, ejecutar y controlar los proyectos..." value={newFila.funciones} onChange={e => setNewFila(p => ({ ...p, funciones: e.target.value }))} /></label>
            <label>Cláusula ISO 9001:2015
              <select value={newFila.clausulaDetalle} onChange={e => {
                const selected = CLAUSULAS_ISO.find(c => c.detalle === e.target.value)
                setNewFila(p => ({ ...p, clausula: selected?.codigo || '', clausulaDetalle: e.target.value }))
              }}>
                {CLAUSULAS_ISO.map(c => <option key={c.codigo} value={c.detalle}>{c.detalle}</option>)}
              </select>
            </label>

            <div className="cargos-modal__footer">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={addFila} disabled={!canCreate || !newFila.proceso.trim()} title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MatrizCargosPage
