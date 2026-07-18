import React, { useState, useEffect } from 'react'
import './RolesPage.css'
import { useAIAnalysis, FilaMatriz, TipoProceso } from '../../context/AIAnalysisContext'
import MatrizCargosPage from './MatrizCargosPage'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

/* ══════════════════════════════════════════════════════════════
   TIPOS
   ══════════════════════════════════════════════════════════════ */
type ColKey = 'responsable' | 'autoridad' | 'funciones' | 'recursos' | 'rendicion' | 'clausula'

const COLS: { key: ColKey; label: string }[] = [
  { key: 'responsable', label: 'Responsable del Proceso' },
  { key: 'autoridad',   label: 'Autoridad de Decisión' },
  { key: 'funciones',   label: 'Funciones y Responsabilidades' },
  { key: 'recursos',    label: 'Recursos Asignados' },
  { key: 'rendicion',   label: 'Rendición de Cuentas (Reporta a)' },
  { key: 'clausula',    label: 'Cláusula' },
]

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════════════ */
const RolesPage: React.FC = () => {
  const {
    analysis,
    updateFilaMatrizRoles, addFilaMatrizRoles, removeFilaMatrizRoles,
  } = useAIAnalysis()
  const { canEdit, canCreate, canDelete } = usePermissions('procesos')
  const [activeTab, setActiveTab] = useState<'roles' | 'cargos'>('roles')

  const filas = analysis?.matrizRoles ?? []          // ← sin useState local ni useEffect de sync
  const [editingCell, setEditing]   = useState<{ id: number; col: ColKey } | null>(null)
  const [editValue, setEditValue]   = useState('')
  const [filterTipo, setFilterTipo] = useState<TipoProceso | 'todos'>('todos')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newFila, setNewFila] = useState<Omit<FilaMatriz, 'id'>>({
    proceso: '', tipo: 'misional', responsable: '', autoridad: '',
    funciones: '', recursos: '', rendicion: '', clausula: '',
  })

  const filasFiltradas = filterTipo === 'todos' ? filas : filas.filter(f => f.tipo === filterTipo)

  const startEdit  = (id: number, col: ColKey, value: string) => { setEditing({ id, col }); setEditValue(value) }
  const commitEdit = () => {
    if (!editingCell) return
    updateFilaMatrizRoles(editingCell.id, { [editingCell.col]: editValue } as Partial<FilaMatriz>)
    setEditing(null)
  }
  const cancelEdit = () => setEditing(null)

  const deleteFila = (id: number) => {
    if (window.confirm('¿Eliminar este proceso de la matriz?')) removeFilaMatrizRoles(id)
  }

  const addFila = () => {
    if (!newFila.proceso.trim()) return
    addFilaMatrizRoles(newFila)
    setShowAddModal(false)
    setNewFila({ proceso: '', tipo: 'misional', responsable: '', autoridad: '', funciones: '', recursos: '', rendicion: '', clausula: '' })
  }

  const hasAnalysis = analysis?.matrizRoles && analysis.matrizRoles.length > 0

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="roles-page">

      {/* HEADER */}
      <div className="roles-page__header">
        <div className="roles-page__title-block">
          <h1>⚓ Roles, Responsabilidades y Autoridad</h1>
          <p>Definición y comunicación de roles dentro del Sistema de Gestión de Calidad</p>
          <span className="roles-page__clause">Cláusula 5.3</span>
        </div>
      </div>

      {/* TABS */}
      <div className="roles-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
        <button 
          className={`btn-secondary ${activeTab === 'roles' ? 'active-tab' : ''}`} 
          style={{ background: activeTab === 'roles' ? '#1b3a6b' : 'transparent', color: activeTab === 'roles' ? '#fff' : '#6b7280', border: 'none', borderBottom: activeTab === 'roles' ? '2px solid #1b3a6b' : 'none', borderRadius: '0', padding: '0.5rem 1rem' }}
          onClick={() => setActiveTab('roles')}
        >
          ⚓ Matriz de Roles
        </button>
        <button 
          className={`btn-secondary ${activeTab === 'cargos' ? 'active-tab' : ''}`} 
          style={{ background: activeTab === 'cargos' ? '#1b3a6b' : 'transparent', color: activeTab === 'cargos' ? '#fff' : '#6b7280', border: 'none', borderBottom: activeTab === 'cargos' ? '2px solid #1b3a6b' : 'none', borderRadius: '0', padding: '0.5rem 1rem' }}
          onClick={() => setActiveTab('cargos')}
        >
          📋 Matriz de Cargos
        </button>
      </div>

      {activeTab === 'cargos' && (
        <div style={{ marginTop: '0.5rem' }}>
          <MatrizCargosPage isSubTab={true} />
        </div>
      )}

      {/* ── PANEL MATRIZ DE ROLES ─────────────────────────── */}
      {activeTab === 'roles' && (
        <>
          {/* ── PANEL VACÍO: sin análisis aún ─────────────────── */}
          {!hasAnalysis && filas.length === 0 && (
            <div className="roles-empty-state">
              <div className="roles-empty-state__icon">🤖</div>
              <h2>Matriz pendiente de generación</h2>
              <p>
                La Matriz de Roles se genera automáticamente cuando Governex analiza el organigrama
                en el módulo <strong>"Contexto de la Organización"</strong>.
              </p>
              <ol className="roles-empty-state__steps">
                <li>Ve al módulo <strong>Contexto de la Organización</strong> (§4 — Mapa de Procesos)</li>
                <li>Construye o sube tu organigrama / mapa de procesos</li>
                <li>Haz clic en <strong>"Guardar y analizar con Governex"</strong></li>
                <li>Regresa aquí — la matriz se habrá generado automáticamente</li>
              </ol>
              <a href="/procesos" className="btn-primary" style={{ display: 'inline-block', marginTop: '1.2rem', textDecoration: 'none' }}>
                Ir a Contexto de la Organización →
              </a>
              <div className="roles-legend" style={{ marginTop: '2rem' }}>
                <div className="roles-legend__item">
                  📌 <strong>Cláusula 5.3</strong> — La alta dirección debe asegurarse de que las responsabilidades y autoridades para los roles pertinentes se asignen, se comuniquen y se entiendan en toda la organización.
                </div>
              </div>
            </div>
          )}

          {/* ── MATRIZ ────────────────────────────────────────── */}
          {(hasAnalysis || filas.length > 0) && (
            <div className="roles-matriz-panel">

              {hasAnalysis && (
                <div className="roles-ai-banner">
                  🤖 Matriz generada automáticamente por Governex a partir del organigrama analizado en "Contexto de la Organización". Puedes editar cualquier celda haciendo clic en ella.
                </div>
              )}

              <div className="roles-matriz-topbar">
                <div className="roles-matriz-topbar__info">
                  Mostrando <strong>{filasFiltradas.length}</strong> de <strong>{filas.length}</strong> procesos &nbsp;·&nbsp;
                  <select value={filterTipo} onChange={e => setFilterTipo(e.target.value as any)}
                    style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                    <option value="todos">Todos los tipos</option>
                    <option value="estrategico">Estratégicos</option>
                    <option value="misional">Misionales</option>
                    <option value="apoyo">Apoyo</option>
                  </select>
                </div>
                <div className="roles-matriz-actions">
                  <button className="btn-primary" onClick={() => setShowAddModal(true)} disabled={!canCreate} title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Agregar proceso</button>
                </div>
              </div>

              <div className="roles-legend">
                <div className="roles-legend__item"><span className="proceso-tipo-badge estrategico">Estratégico</span> Orientan el SGC y marcan la dirección</div>
                <div className="roles-legend__item"><span className="proceso-tipo-badge misional">Misional</span> Generan valor directo al cliente</div>
                <div className="roles-legend__item"><span className="proceso-tipo-badge apoyo">Apoyo</span> Soportan la operación del SGC</div>
                <div className="roles-legend__item">✏️ Haz clic en cualquier celda para editar</div>
              </div>

              <div className="roles-table-wrapper">
                <table className="roles-matrix-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 40 }}>#</th>
                      <th style={{ minWidth: 190 }}>Proceso del SGC</th>
                      <th style={{ minWidth: 90 }}>Tipo</th>
                      {COLS.map(c => <th key={c.key} style={{ minWidth: 150 }}>{c.label}</th>)}
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
                          const val = fila[col.key]
                          return (
                            <td key={col.key} onClick={canEdit ? (() => !isEditing && startEdit(fila.id, col.key, val)) : undefined} style={{ cursor: canEdit ? 'pointer' : 'default' }} title={!canEdit ? 'Tu rol no tiene permiso para editar' : undefined}>
                              {isEditing ? (
                                <div className="roles-cell-edit" onClick={e => e.stopPropagation()}>
                                  <textarea autoFocus rows={3} value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() } if (e.key === 'Escape') cancelEdit() }} />
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <button className="btn-icon" onClick={commitEdit} title="Guardar (Enter)" disabled={!canEdit}>✔</button>
                                    <button className="btn-icon" onClick={cancelEdit} title="Cancelar (Esc)">✕</button>
                                  </div>
                                </div>
                              ) : val
                                ? <span className="roles-cell-text">{val}</span>
                                : (canEdit ? <span className="roles-cell-empty">— clic para editar</span> : null)}
                            </td>
                          )
                        })}
                        <td>
                          <PermissionGuard recurso="procesos" accion="eliminar" mode="hide">
                            <button className="btn-icon danger" onClick={() => deleteFila(fila.id)} title="Eliminar proceso">🗑️</button>
                          </PermissionGuard>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODAL: Agregar proceso */}
          {showAddModal && (
            <div className="roles-modal-overlay" onClick={() => setShowAddModal(false)}>
              <div className="roles-modal" onClick={e => e.stopPropagation()}>
                <h2>➕ Agregar proceso a la matriz</h2>
                <label>Nombre del proceso *<input type="text" placeholder="ej. Gestión de Proyectos" value={newFila.proceso} onChange={e => setNewFila(p => ({ ...p, proceso: e.target.value }))} /></label>
                <label>Tipo de proceso<select value={newFila.tipo} onChange={e => setNewFila(p => ({ ...p, tipo: e.target.value as TipoProceso }))}><option value="estrategico">Estratégico</option><option value="misional">Misional</option><option value="apoyo">Apoyo</option></select></label>
                <label>Responsable del proceso<input type="text" placeholder="ej. Jefe de Proyectos" value={newFila.responsable} onChange={e => setNewFila(p => ({ ...p, responsable: e.target.value }))} /></label>
                <label>Autoridad de decisión<input type="text" placeholder="ej. Gerente de Operaciones" value={newFila.autoridad} onChange={e => setNewFila(p => ({ ...p, autoridad: e.target.value }))} /></label>
                <label>Cláusula<input type="text" placeholder="ej. §8.1, §8.3" value={newFila.clausula} onChange={e => setNewFila(p => ({ ...p, clausula: e.target.value }))} /></label>
                <div className="roles-modal__footer">
                  <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                  <button className="btn-primary" onClick={addFila} disabled={!canCreate || !newFila.proceso.trim()} title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Agregar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default RolesPage
