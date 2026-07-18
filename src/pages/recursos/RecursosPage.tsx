import React, { useState, useEffect } from 'react'
import './RecursosPage.css'
import { useAIAnalysis, FilaMatrizRecursos } from '../../context/AIAnalysisContext'
import { usePermissions } from '../../hooks/usePermissions'

/* ══════════════════════════════════════════════════════════════
   TIPOS
   ══════════════════════════════════════════════════════════════ */
type ColKey = 'nPersonas' | 'infraestructura' | 'hardwareSoftware' | 'transporte' | 'ambienteSocial' | 'ambientePsicologico' | 'ambienteFisico'

const COLS: { key: ColKey; label: string; group?: string }[] = [
  { key: 'nPersonas', label: 'N° Personas/Roles', group: 'RECURSOS' },
  { key: 'infraestructura', label: 'Infraestructura (Edificios, Servicios)', group: 'RECURSOS' },
  { key: 'hardwareSoftware', label: 'Hardware y Software', group: 'RECURSOS' },
  { key: 'transporte', label: 'Transporte/TIC', group: 'RECURSOS' },
  { key: 'ambienteSocial', label: 'Social (Relaciones, No-Disc.)', group: 'AMBIENTE DE OPERACIÓN' },
  { key: 'ambientePsicologico', label: 'Psicológico (Estrés, Bienestar)', group: 'AMBIENTE DE OPERACIÓN' },
  { key: 'ambienteFisico', label: 'Físico (Iluminación, Temp, Erg.)', group: 'AMBIENTE DE OPERACIÓN' }
]

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════════════ */
const RecursosPage: React.FC = () => {
  const { analysis } = useAIAnalysis()
  const { canEdit, isReadOnly } = usePermissions('contexto_empresa')

  /* ── Estado de la Matriz ────────────────────────────────── */
  const [activeTab, setActiveTab]   = useState<'matriz' | 'criterios'>('matriz')
  const [filas, setFilas]           = useState<(FilaMatrizRecursos & { id: number })[]>([])
  const [editingCell, setEditing]   = useState<{ id: number; col: ColKey } | null>(null)
  const [editValue, setEditValue]   = useState('')

  /* ── Sincronizar con el análisis global de IA ──────────── */
  useEffect(() => {
    if (analysis?.matrizRecursos && analysis.matrizRecursos.length > 0) {
      const normalized = analysis.matrizRecursos.map((f: any, i: number) => ({
        ...f,
        id: i + 1,
      }))
      setFilas(normalized)
    }
  }, [analysis?.matrizRecursos])

  /* ── Helpers de edición ─────────────────────────────────── */
  const startEdit  = (id: number, col: ColKey, value: string) => { setEditing({ id, col }); setEditValue(value) }
  const commitEdit = () => {
    if (!editingCell) return
    setFilas(prev => prev.map(f => f.id === editingCell.id ? { ...f, [editingCell.col]: editValue } : f))
    setEditing(null)
  }
  const cancelEdit = () => setEditing(null)

  const exportCSV = () => {
    const headers = ['Proceso', ...COLS.map(c => c.label)]
    const rows = filas.map(f => [
      f.proceso, f.nPersonas, f.infraestructura, f.hardwareSoftware, f.transporte, f.ambienteSocial, f.ambientePsicologico, f.ambienteFisico
    ].map(v => `"${(v ?? '').replace(/"/g, '""')}"`))
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'Matriz_Recursos_Ambiente_ISO9001.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const hasAnalysis = analysis?.matrizRecursos && analysis.matrizRecursos.length > 0

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="recursos-page">

      {/* HEADER */}
      <div className="recursos-page__header">
        <div className="recursos-page__title-block">
          <h1>🔋 Matriz de Recursos y Ambiente de Trabajo</h1>
          <p>Identificación de recursos e infraestructura para realizar las actividades del alcance (Requisito 7.1)</p>
          <span className="recursos-page__clause">Cláusula 7.1</span>
        </div>
      </div>

      <nav className="procesos-tabs" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e5e7eb' }}>
        <button 
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'matriz' ? '2px solid #1a6ebd' : '2px solid transparent', color: activeTab === 'matriz' ? '#1a6ebd' : '#6b7280', fontWeight: 600, cursor: 'pointer', marginBottom: '-2px' }}
          onClick={() => setActiveTab('matriz')}
        >
          🔋 Matriz de Recursos
        </button>
        <button 
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'criterios' ? '2px solid #1a6ebd' : '2px solid transparent', color: activeTab === 'criterios' ? '#1a6ebd' : '#6b7280', fontWeight: 600, cursor: 'pointer', marginBottom: '-2px' }}
          onClick={() => setActiveTab('criterios')}
        >
          📘 Evaluación y Riesgos
        </button>
      </nav>

      {/* ── TAB 1: MATRIZ ────────────────────────────────────── */}
      {activeTab === 'matriz' && (
        <>
          {/* PANEL VACÍO: sin análisis aún */}
          {!hasAnalysis && filas.length === 0 && (
        <div className="recursos-empty-state">
          <div className="recursos-empty-state__icon">🤖</div>
          <h2>Matriz pendiente de generación</h2>
          <p>
            La Matriz de Recursos se genera automáticamente cuando Governex analiza el organigrama
            en el módulo <strong>"Contexto de la Organización"</strong>.
          </p>
          <ol className="recursos-empty-state__steps">
            <li>Ve al módulo <strong>Contexto de la Organización</strong> (§4 — Mapa de Procesos)</li>
            <li>Construye o sube tu organigrama / mapa de procesos</li>
            <li>Haz clic en <strong>"Guardar y analizar con Governex"</strong> para generar todo el análisis.</li>
            <li>Regresa aquí — la matriz se habrá generado automáticamente evaluando las variables Sociales, Psicológicas y Físicas.</li>
          </ol>
          <a href="/procesos" className="btn-primary" style={{ display: 'inline-block', marginTop: '1.2rem', textDecoration: 'none' }}>
            Ir a Contexto de la Organización →
          </a>
        </div>
      )}

      {/* ── MATRIZ ────────────────────────────────────────── */}
      {(hasAnalysis || filas.length > 0) && (
        <div className="recursos-matriz-panel">

          {hasAnalysis && (
            <div className="recursos-ai-banner">
              🤖 Matriz generada automáticamente por Governex a partir del organigrama. Los riesgos y oportunidades detectados aquí se han enviado al panel central de Riesgos. Puedes editar cualquier celda haciendo clic en ella.
            </div>
          )}

          <div className="recursos-matriz-topbar">
            <div className="recursos-matriz-topbar__info">
              Mostrando <strong>{filas.length}</strong> procesos
            </div>
            <div className="recursos-matriz-actions">
              <button className="btn-secondary" onClick={exportCSV}>⬇️ Exportar CSV</button>
            </div>
          </div>

          <div className="recursos-legend">
            <div className="recursos-legend__item">✏️ Haz clic en cualquier celda para editar (los cambios en Riesgos/Oportunidades aquí no sobreescriben automáticamente el panel de Riesgos si ya fueron generados).</div>
          </div>

          <div className="recursos-table-wrapper">
            <table className="recursos-matrix-table">
              <thead>
                <tr>
                  <th rowSpan={2} style={{ minWidth: 40 }}>#</th>
                  <th rowSpan={2} style={{ minWidth: 190 }}>ALCANCE DEL SGC<br/><span style={{fontWeight:'normal', fontSize:'0.85em'}}>Proceso</span></th>
                  <th colSpan={4} style={{ textAlign: 'center' }}>RECURSOS</th>
                  <th colSpan={3} style={{ textAlign: 'center' }}>AMBIENTE DE OPERACIÓN</th>
                </tr>
                <tr>
                  {COLS.map(c => <th key={c.key} style={{ minWidth: 150, fontSize: '0.85em' }}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {filas.map((fila, idx) => (
                  <tr key={fila.id}>
                    <td style={{ color: '#9ca3af', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600, color: '#1b3a6b' }}>{fila.proceso}</td>
                    {COLS.map(col => {
                      const isEditing = editingCell?.id === fila.id && editingCell?.col === col.key
                      const val = fila[col.key]
                      return (
                        <td key={col.key} onClick={canEdit ? (() => !isEditing && startEdit(fila.id, col.key, val)) : undefined} style={{ cursor: canEdit ? 'pointer' : 'default' }} title={!canEdit ? 'Tu rol no tiene permiso para editar' : undefined}>
                          {isEditing ? (
                            <div className="recursos-cell-edit" onClick={e => e.stopPropagation()}>
                              <textarea readOnly={isReadOnly()} autoFocus rows={3} value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() } if (e.key === 'Escape') cancelEdit() }} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <button className="btn-icon" onClick={commitEdit} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : "Guardar (Enter)"}>✔</button>
                                <button className="btn-icon" onClick={cancelEdit} title="Cancelar (Esc)">✕</button>
                              </div>
                            </div>
                          ) : !val ? (
                            <span className="recursos-cell-empty">— clic para editar</span>
                          ) : val.includes(',') ? (
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', listStyleType: 'disc', textAlign: 'left' }}>
                              {val.split(',').map(s => s.trim()).filter(Boolean).map((item, i) => (
                                <li key={i} className="recursos-cell-text">{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="recursos-cell-text">{val}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}

      {/* ── TAB 2: CRITERIOS ─────────────────────────────────── */}
      {activeTab === 'criterios' && (
        <div className="recursos-criterios">
          <div className="panel" style={{ background: '#fff', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #e5e7eb', marginBottom: '2rem' }}>
            <h3 style={{ color: '#1b3a6b', marginBottom: '0.5rem' }}>Tabla de Riesgos y Oportunidades</h3>
            <p style={{marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.5}}>
              Matriz de identificación y análisis de riesgos derivados de los recursos y ambiente de trabajo.
            </p>
            <div className="recursos-table-wrapper">
              <table className="recursos-matrix-table" style={{width: '100%', minWidth: 900}}>
                <thead>
                  <tr>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Proceso</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Recurso o Ambiente Evaluado</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Hallazgo</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Riesgo</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Impacto</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Probabilidad</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Nivel de Riesgo</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Oportunidad</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.length === 0 && <tr><td colSpan={9} style={{textAlign:'center', padding:'1rem'}}>No hay datos generados</td></tr>}
                  {filas.map((f, i) => (
                    <tr key={i}>
                      <td style={{fontWeight:600}}>{f.proceso}</td>
                      <td>{f.recursoEvaluado}</td>
                      <td>{f.hallazgo}</td>
                      <td>{f.riesgo}</td>
                      <td>{f.impacto}</td>
                      <td>{f.probabilidad}</td>
                      <td><span className={`pill ${f.nivelRiesgoAzul==='Crítico'?'pill--danger':f.nivelRiesgoAzul==='Alto'?'pill--warning':'pill--muted'}`}>{f.nivelRiesgoAzul}</span></td>
                      <td>{f.oportunidad}</td>
                      <td>{f.accion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel" style={{ background: '#fff', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #e5e7eb' }}>
            <h3 style={{ color: '#1b3a6b', marginBottom: '0.5rem' }}>Evaluación del Ambiente de Operación</h3>
            <p style={{marginBottom: '0.5rem', color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.5}}>
              Calificación cuantitativa de las variables del ambiente por proceso.
            </p>
            <p style={{marginBottom: '1.5rem', color: '#4b5563', fontSize: '0.85rem', fontWeight: 500, background: '#f3f4f6', padding: '0.75rem', borderRadius: '0.5rem'}}>
              💡 <strong>Criterios de calificación:</strong> 1 = Deficiente | 2 = Insuficiente | 3 = Aceptable | 4 = Bueno | 5 = Excelente
            </p>
            <div className="recursos-table-wrapper">
              <table className="recursos-matrix-table" style={{width: '100%'}}>
                <thead>
                  <tr>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Proceso</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Variable Social</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Variable Psicológica</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Variable Física</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Calificación Promedio</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Nivel de Riesgo</th>
                    <th style={{background: '#1b3a6b', color: 'white', padding: '0.6rem'}}>Acción Requerida</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.length === 0 && <tr><td colSpan={7} style={{textAlign:'center', padding:'1rem'}}>No hay datos generados</td></tr>}
                  {filas.map((f, i) => (
                    <tr key={i}>
                      <td style={{fontWeight:600}}>{f.proceso}</td>
                      <td style={{textAlign:'center'}}>{f.varSocial}</td>
                      <td style={{textAlign:'center'}}>{f.varPsicologica}</td>
                      <td style={{textAlign:'center'}}>{f.varFisica}</td>
                      <td style={{textAlign:'center', fontWeight:600, color: '#1b3a6b'}}>{f.calificacionPromedio}</td>
                      <td style={{textAlign:'center'}}><span className={`pill ${f.nivelRiesgoVerde==='Crítico'?'pill--danger':f.nivelRiesgoVerde==='Alto'?'pill--warning':f.nivelRiesgoVerde==='Medio'?'pill--warning':'pill--success'}`}>{f.nivelRiesgoVerde}</span></td>
                      <td>{f.accionRequerida}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default RecursosPage
