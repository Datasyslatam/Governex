import React, { useState, useCallback, useMemo } from 'react'
import RiskHeatmap from './components/RiskHeatmap'
import RiskSummaryBars from './components/RiskSummaryBars'
import './RiesgosPage.css'
import { useAIAnalysis, derivarRiesgos, RiesgoDerivado } from '../../context/AIAnalysisContext'

/* ── Helpers ─────────────────────────────────────────────────── */
function getLevelVariant(nivel: number): string {
  if (nivel >= 15) return 'critical'
  if (nivel >= 9)  return 'high'
  if (nivel >= 4)  return 'medium'
  return 'low'
}

function getLevelLabel(nivel: number): string {
  if (nivel >= 15) return 'CRÍTICO'
  if (nivel >= 9)  return 'ALTO'
  if (nivel >= 4)  return 'MEDIO'
  return 'BAJO'
}

const estadoLabel: Record<string, string> = {
  CRITICO: 'CRÍTICO', TRATAMIENTO: 'EN TRATAMIENTO', MONITOREO: 'MONITOREO',
}

/* ── Pantalla vacía cuando no hay análisis ──────────────────── */
const EmptyState: React.FC = () => (
  <div className="riesgos-empty-state">
    <div className="riesgos-empty-state__icon">🔍</div>
    <h3>No hay análisis disponible</h3>
    <p>
      Para generar la Matriz de Riesgos y Oportunidades, primero debes completar el
      análisis con IA en el módulo <strong>"Contexto de la Organización"</strong>.
    </p>
    <ol className="riesgos-empty-state__steps">
      <li>Ve al módulo <strong>Contexto de la Organización</strong> (§4 — Mapa de Procesos)</li>
      <li>Construye o carga el mapa de procesos de tu organización</li>
      <li>Haz clic en <strong>"Guardar y Analizar con IA"</strong></li>
      <li>Regresa a este módulo para ver la matriz generada automáticamente</li>
    </ol>
    <a href="/procesos" className="riesgos-empty-cta">
      Ir a Contexto de la Organización →
    </a>
  </div>
)

/* ── Componente principal ────────────────────────────────────── */
const RiesgosPage: React.FC = () => {
  const { analysis } = useAIAnalysis()

  /* Derivar riesgos y oportunidades desde el análisis IA */
  const riesgos: RiesgoDerivado[] = useMemo(
    () => (analysis ? derivarRiesgos(analysis) : []),
    [analysis]
  )

  /* Filtros */
  const [filterTipo,   setFilterTipo]   = useState<'todos' | 'Riesgo' | 'Oportunidad'>('todos')
  const [filterNivel,  setFilterNivel]  = useState<'todos' | 'CRITICO' | 'TRATAMIENTO' | 'MONITOREO'>('todos')
  const [filterFuente, setFilterFuente] = useState<'todos' | 'PESTEL' | 'DOFA'>('todos')
  const [search,       setSearch]       = useState('')

  /* Edición de responsable inline */
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [editValue,    setEditValue]    = useState('')
  const [overrides,    setOverrides]    = useState<Record<string, Partial<RiesgoDerivado>>>({})

  const riesgosFinal: RiesgoDerivado[] = useMemo(
    () => riesgos.map(r => ({ ...r, ...(overrides[r.codigo] ?? {}) })),
    [riesgos, overrides]
  )

  const riesgosFiltrados = useMemo(() => riesgosFinal.filter(r => {
    if (filterTipo   !== 'todos' && r.tipo   !== filterTipo)   return false
    if (filterNivel  !== 'todos' && r.estado !== filterNivel)  return false
    if (filterFuente !== 'todos' && r.fuente !== filterFuente) return false
    if (search && !r.descripcion.toLowerCase().includes(search.toLowerCase()) &&
        !r.codigo.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [riesgosFinal, filterTipo, filterNivel, filterFuente, search])

  const saveEdit = useCallback((codigo: string) => {
    setOverrides(prev => ({ ...prev, [codigo]: { ...prev[codigo], responsable: editValue } }))
    setEditingId(null)
  }, [editValue])

  const changeEstado = useCallback((codigo: string, estado: RiesgoDerivado['estado']) => {
    setOverrides(prev => ({ ...prev, [codigo]: { ...prev[codigo], estado } }))
  }, [])

  /* KPIs */
  const totalRiesgos     = riesgosFinal.filter(r => r.tipo === 'Riesgo').length
  const totalOportunidades = riesgosFinal.filter(r => r.tipo === 'Oportunidad').length
  const criticos         = riesgosFinal.filter(r => r.tipo === 'Riesgo' && r.nivel >= 15).length
  const enTratamiento    = riesgosFinal.filter(r => r.estado === 'TRATAMIENTO').length

  if (!analysis) return (
    <div className="page riesgos-page">
      <header className="page__header riesgos-page__header">
        <div className="riesgos-page__header-left">
          <nav className="riesgos-page__breadcrumb">
            <span>Governex</span><span className="riesgos-page__bc-sep">›</span>
            <span>Cap. 6.1</span><span className="riesgos-page__bc-sep">›</span>
            <span className="riesgos-page__breadcrumb-active">Pensamiento basado en riesgos</span>
          </nav>
          <h2>Matriz de Riesgos y Oportunidades</h2>
        </div>
      </header>
      <EmptyState />
    </div>
  )

  return (
    <div className="page riesgos-page">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="page__header riesgos-page__header">
        <div className="riesgos-page__header-left">
          <nav className="riesgos-page__breadcrumb">
            <span>Governex</span><span className="riesgos-page__bc-sep">›</span>
            <span>Cap. 6.1</span><span className="riesgos-page__bc-sep">›</span>
            <span className="riesgos-page__breadcrumb-active">Pensamiento basado en riesgos</span>
          </nav>
          <h2>Matriz de Riesgos y Oportunidades</h2>
          <span className="riesgos-page__ai-badge">
            ✨ Generado con IA · {riesgosFinal.length} elementos identificados
          </span>
        </div>
      </header>

      {/* ── KPIs ───────────────────────────────────────────── */}
      <div className="riesgos-kpis">
        <div className="riesgos-kpi riesgos-kpi--risk">
          <span className="riesgos-kpi__value">{totalRiesgos}</span>
          <span className="riesgos-kpi__label">Riesgos identificados</span>
        </div>
        <div className="riesgos-kpi riesgos-kpi--critical">
          <span className="riesgos-kpi__value">{criticos}</span>
          <span className="riesgos-kpi__label">Riesgos críticos</span>
        </div>
        <div className="riesgos-kpi riesgos-kpi--treatment">
          <span className="riesgos-kpi__value">{enTratamiento}</span>
          <span className="riesgos-kpi__label">En tratamiento</span>
        </div>
        <div className="riesgos-kpi riesgos-kpi--opportunity">
          <span className="riesgos-kpi__value">{totalOportunidades}</span>
          <span className="riesgos-kpi__label">Oportunidades</span>
        </div>
      </div>

      <main className="riesgos-page__main">
        {/* ── Panel izquierdo: Mapa de calor + Barras ──── */}
        <div className="riesgos-page__panel riesgos-page__panel--left">
          <div className="riesgos-page__section-header">
            <div>
              <h3 className="riesgos-page__section-title">Mapa de Calor de Riesgos</h3>
              <span className="riesgos-page__section-subtitle">
                Posición actual · {riesgosFinal.filter(r => r.tipo === 'Riesgo').length} riesgos mapeados
              </span>
            </div>
          </div>
          <div className="riesgos-page__heatmap-wrap">
            <RiskHeatmap riesgos={riesgosFinal} />
          </div>

          <div className="riesgos-page__divider" />

          <h3 className="riesgos-page__section-title">Riesgos por Nivel de Criticidad</h3>
          <RiskSummaryBars riesgos={riesgosFinal} />
        </div>

        {/* ── Panel derecho: Tabla de riesgos ─────────── */}
        <div className="riesgos-page__panel riesgos-page__panel--right">
          <div className="riesgos-page__section-header">
            <h3 className="riesgos-page__section-title">Registro de Riesgos y Oportunidades</h3>
          </div>

          {/* Filtros */}
          <div className="riesgos-filters">
            <input
              className="riesgos-filter-input"
              type="text"
              placeholder="🔍 Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="riesgos-filter-select" value={filterTipo} onChange={e => setFilterTipo(e.target.value as any)}>
              <option value="todos">Todos los tipos</option>
              <option value="Riesgo">Solo Riesgos</option>
              <option value="Oportunidad">Solo Oportunidades</option>
            </select>
            <select className="riesgos-filter-select" value={filterNivel} onChange={e => setFilterNivel(e.target.value as any)}>
              <option value="todos">Todos los estados</option>
              <option value="CRITICO">Crítico</option>
              <option value="TRATAMIENTO">En tratamiento</option>
              <option value="MONITOREO">Monitoreo</option>
            </select>
            <select className="riesgos-filter-select" value={filterFuente} onChange={e => setFilterFuente(e.target.value as any)}>
              <option value="todos">PESTEL + DOFA</option>
              <option value="PESTEL">Solo PESTEL</option>
              <option value="DOFA">Solo DOFA</option>
            </select>
          </div>

          <div className="riesgos-page__table-wrap">
            <table className="risk-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Fuente</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>P</th>
                  <th>I</th>
                  <th>Nivel</th>
                  <th>Estado</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {riesgosFiltrados.map(r => (
                  <tr key={r.codigo}>
                    <td className="risk-table__code">{r.codigo}</td>
                    <td>
                      <span className={`risk-table__tipo risk-table__tipo--${r.tipo === 'Riesgo' ? 'riesgo' : 'oportunidad'}`}>
                        {r.tipo === 'Riesgo' ? '⚠️ Riesgo' : '🚀 Oport.'}
                      </span>
                    </td>
                    <td>
                      <span className={`risk-table__fuente risk-table__fuente--${r.fuente.toLowerCase()}`}>
                        {r.fuente}
                      </span>
                    </td>
                    <td className="risk-table__desc">{r.descripcion}</td>
                    <td className="risk-table__cat">{r.categoria}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.probabilidad}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.impacto}</td>
                    <td>
                      <span className={`risk-table__level risk-table__level--${getLevelVariant(r.nivel)}`}>
                        {r.nivel} — {getLevelLabel(r.nivel)}
                      </span>
                    </td>
                    <td>
                      <select
                        className={`risk-table__estado-select risk-table__estado-select--${r.estado.toLowerCase()}`}
                        value={r.estado}
                        onChange={e => changeEstado(r.codigo, e.target.value as RiesgoDerivado['estado'])}
                      >
                        <option value="MONITOREO">MONITOREO</option>
                        <option value="TRATAMIENTO">TRATAMIENTO</option>
                        <option value="CRITICO">CRÍTICO</option>
                      </select>
                    </td>
                    <td>
                      {editingId === r.codigo ? (
                        <div className="risk-table__edit-cell">
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit(r.codigo)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                          />
                          <button onClick={() => saveEdit(r.codigo)}>✔</button>
                          <button onClick={() => setEditingId(null)}>✕</button>
                        </div>
                      ) : (
                        <span
                          className="risk-table__responsable"
                          onClick={() => { setEditingId(r.codigo); setEditValue(r.responsable) }}
                          title="Clic para editar"
                        >
                          {r.responsable}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {riesgosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                      No hay elementos que coincidan con los filtros
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="riesgos-table-footer">
            Mostrando <strong>{riesgosFiltrados.length}</strong> de <strong>{riesgosFinal.length}</strong> elementos
          </div>
        </div>
      </main>
    </div>
  )
}

export default RiesgosPage
