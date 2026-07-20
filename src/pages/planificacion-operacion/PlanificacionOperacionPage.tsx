/**
 * PlanificacionOperacionPage.tsx — ISO 9001:2015 §8.1
 */

import React, { useState, useMemo } from 'react'
import '../iso-module.css'
import {
  useAIAnalysis,
  CaracterizacionRow,
  FilaMatriz,
  TipoProceso,
  ActividadEmpresa,
  derivarRiesgos,
  RiesgoDerivado,
  FilaMapaDB,
  FilaManualDB,
} from '../../context/AIAnalysisContext'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

/* ─────────────────────────── TIPOS LOCALES ─────────────────────── */
type Tab = 'caracterizacion' | 'mapa' | 'manual' | 'riesgos'

/* ──────────────────────────── HELPERS ─────────────────────────── */
const TIPO_LABEL: Record<TipoProceso, string> = {
  estrategico: 'Estratégico',
  misional:    'Misional',
  apoyo:       'Apoyo',
}

const TIPO_COLOR: Record<TipoProceso, { bg: string; color: string; border: string }> = {
  estrategico: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  misional:    { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  apoyo:       { bg: '#fefce8', color: '#854d0e', border: '#fde68a' },
}

function estadoBadgeClass(estado: string): string {
  if (estado === 'Activo')   return 'verde'
  if (estado === 'Revisión') return 'amarillo'
  return 'gris'
}

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

/* ── Texto expandible reutilizable ─────────────────────────────── */
interface TextoExpandibleProps {
  texto:    string
  maxChars?: number
}

const TextoExpandible: React.FC<TextoExpandibleProps> = ({ texto, maxChars = 80 }) => {
  const [expanded, setExpanded] = useState(false)
  const necesitaTruncado = texto.length > maxChars

  if (!necesitaTruncado) {
    return <span style={{ fontSize: '0.78rem', color: '#374151', lineHeight: 1.45 }}>{texto}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      <span style={{ fontSize: '0.78rem', color: '#374151', lineHeight: 1.45, wordBreak: 'break-word' }}>
        {expanded ? texto : `${texto.slice(0, maxChars)}…`}
      </span>
      <button
        onClick={() => setExpanded(prev => !prev)}
        style={{
          alignSelf:   'flex-start',
          background:  'none',
          border:      'none',
          padding:     0,
          fontSize:    '0.71rem',
          fontWeight:  700,
          color:       '#2563eb',
          cursor:      'pointer',
          lineHeight:  1,
          fontFamily:  'inherit',
          whiteSpace:  'nowrap',
          transition:  'color 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#1d4ed8'; (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#2563eb'; (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none' }}
        title={expanded ? 'Colapsar' : 'Ver texto completo'}
      >
        {expanded ? '▲ Ver menos' : '▼ Ver más'}
      </button>
    </div>
  )
}

/* ── Badge desplegable para identificativo de actividad ────────── */
const ActividadBadge: React.FC<{ nombre: string; codigo: string }> = ({ nombre, codigo }) => {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={nombre}
        style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          '0.25rem',
          background:   '#fdf4ff',
          color:        '#7e22ce',
          border:       '1px solid #e9d5ff',
          borderRadius: '0.4rem',
          padding:      '0.2rem 0.55rem',
          fontSize:     '0.72rem',
          fontWeight:   700,
          cursor:       'pointer',
          fontFamily:   'inherit',
          transition:   'all 0.15s',
          whiteSpace:   'nowrap',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f3e8ff' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fdf4ff' }}
      >
        ⚙️ {codigo}
        <span style={{
          display:    'inline-block',
          transform:  open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s',
          fontSize:   '0.6rem',
          marginLeft: 2,
        }}>▼</span>
      </button>

      {open && (
        <div style={{
          position:     'absolute',
          top:          '110%',
          left:         0,
          zIndex:       50,
          background:   '#fff',
          border:       '1px solid #e9d5ff',
          borderRadius: '0.5rem',
          boxShadow:    '0 8px 24px rgba(0,0,0,0.12)',
          padding:      '0.65rem 0.85rem',
          minWidth:     220,
          maxWidth:     300,
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7e22ce', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Actividad
          </div>
          <div style={{ fontSize: '0.84rem', color: '#1a2b45', fontWeight: 600, lineHeight: 1.4 }}>
            {nombre}
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              position:   'absolute',
              top:        '0.4rem',
              right:      '0.4rem',
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              color:      '#9ca3af',
              fontSize:   '0.75rem',
              padding:    '0.1rem 0.3rem',
            }}
          >✕</button>
        </div>
      )}
    </div>
  )
}

/* ───────────────── SUBCOMPONENTE: ESTADO VACÍO ────────────────── */
const EmptyState: React.FC = () => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '1.25rem',
    padding: '4rem 2rem', textAlign: 'center',
  }}>
    <div style={{ fontSize: '3.5rem' }}>🏗️</div>
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1b3a6b', margin: '0 0 0.5rem' }}>
        Sin análisis disponible
      </h2>
      <p style={{ fontSize: '0.88rem', color: '#6b7280', maxWidth: 480, margin: '0 auto' }}>
        La Tabla de Caracterización, el Mapa de Procedimiento y el Manual de Procedimiento
        se generan automáticamente a partir del análisis IA producido en el módulo{' '}
        <strong>Contexto de la Organización</strong>.
      </p>
    </div>
    <div style={{
      background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.75rem',
      padding: '1rem 1.5rem', fontSize: '0.82rem', color: '#1e40af', maxWidth: 480,
    }}>
      <strong>¿Cómo generar el análisis?</strong>
      <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', textAlign: 'left', lineHeight: 1.8 }}>
        <li>Ve al módulo <em>Contexto de la Organización</em> (Cap. 4).</li>
        <li>Construye o carga el organigrama en la pestaña <em>Mapa de Procesos</em>.</li>
        <li>Haz clic en <strong>"Analizar con Governex IA"</strong> e ingresa el nombre de la empresa y sector.</li>
        <li>Regresa aquí: los documentos se generarán automáticamente.</li>
      </ol>
    </div>
  </div>
)

/* ──────────────── SUBCOMPONENTE: TABLA DE CARACTERIZACIÓN ─────── */
const TablaCaracterizacion: React.FC<{
  rows:        CaracterizacionRow[]
  actividades: ActividadEmpresa[]
}> = ({ rows, actividades }) => {
  const [search, setSearch] = useState('')

  const filtered = rows.filter(r =>
    r.proceso.toLowerCase().includes(search.toLowerCase()) ||
    r.responsable.toLowerCase().includes(search.toLowerCase())
  )

  const actIdx = (id: string) => {
    const i = actividades.findIndex(a => a.id === id)
    return i >= 0 ? String(i + 1).padStart(3, '0') : '001'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="iso-info-box">
        <span className="iso-info-box__icon">📌</span>
        <span>
          <strong>§4.4 / §8.1</strong> — La tabla de caracterización documenta
          entradas, salidas, indicadores y responsables de cada proceso del SGC.
        </span>
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">
          Total procesos: <strong>{rows.length}</strong>
          {search && <span style={{ marginLeft: 8, color: '#6b7280' }}>· Mostrando {filtered.length}</span>}
        </div>
        <input
          type="text"
          placeholder="🔍 Buscar proceso o responsable…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '0.4rem 0.75rem', border: '1px solid #e5e7eb',
            borderRadius: '0.5rem', fontSize: '0.82rem', outline: 'none', width: 220,
          }}
        />
      </div>

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr>
              <th>Código</th><th>Proceso</th><th>Objetivo</th>
              <th>Entradas</th><th>Salidas</th><th>Indicador</th>
              <th>Responsable</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem' }}>Sin resultados</td></tr>
            ) : filtered.map(row => (
              <tr key={row.codigo}>
                <td>
                  <code style={{
                    background: '#eff6ff', color: '#1e40af',
                    padding: '0.15rem 0.5rem', borderRadius: 4,
                    fontSize: '0.78rem', fontWeight: 700,
                  }}>{row.codigo}</code>
                </td>
                <td style={{ fontWeight: 600, color: '#1b3a6b' }}>{row.proceso}</td>
                <td style={{ fontSize: '0.8rem' }}>{row.objetivo}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{row.entradas}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{row.salidas}</td>
                <td style={{ fontSize: '0.78rem' }}>{row.indicador}</td>
                <td style={{ fontWeight: 500 }}>{row.responsable}</td>
                <td><span className={`iso-badge ${estadoBadgeClass(row.estado)}`}>{row.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Actividades registradas en §4.1 ── */}
      {actividades.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 0', borderTop: '2px solid #e8edf4', marginBottom: '0.85rem',
          }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1b3a6b' }}>
                ⚙️ Actividades de la Empresa — §4.1 / §8.1
              </h4>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#6b7280' }}>
                Actividades con objetivo e indicador generados por IA.
                Los riesgos y oportunidades asociados se reflejan en §6.1.
              </p>
            </div>
            <span style={{
              background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff',
              borderRadius: 999, padding: '0.2rem 0.75rem', fontSize: '0.75rem', fontWeight: 700,
            }}>
              {actividades.length} actividad{actividades.length !== 1 ? 'es' : ''}
            </span>
          </div>

          <div className="iso-table-wrapper">
            <table className="iso-table">
              <thead>
                <tr>
                  <th>Actividad</th>
                  <th>Proceso</th>
                  <th>Responsable</th>
                  <th style={{ minWidth: 200 }}>Objetivo ✨</th>
                  <th style={{ minWidth: 180 }}>Indicador ✨</th>
                  <th>Entradas</th>
                  <th>Salidas</th>
                  <th>Riesgos</th>
                  <th>Oportunidades</th>
                  <th>Registrada</th>
                </tr>
              </thead>
              <tbody>
                {actividades.map(act => {
                  const entradasValidas = act.entradas.filter(e => e.valor.trim())
                  const salidasValidas  = act.salidas.filter(s => s.valor.trim())
                  const codigo = `ACT-${actIdx(act.id)}`
                  return (
                    <tr key={act.id}>
                      <td>
                        <ActividadBadge nombre={act.nombre} codigo={codigo} />
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        {act.proceso || <em style={{ color: '#9ca3af' }}>—</em>}
                      </td>
                      <td style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                        {act.responsable || <em style={{ color: '#9ca3af' }}>—</em>}
                      </td>

                      {/* Objetivo — expandible */}
                      <td style={{ maxWidth: 220, verticalAlign: 'top' }}>
                        {act.objetivo
                          ? <TextoExpandible texto={act.objetivo} maxChars={80} />
                          : <em style={{ color: '#9ca3af', fontSize: '0.78rem' }}>—</em>
                        }
                      </td>

                      {/* Indicador — expandible */}
                      <td style={{ maxWidth: 200, verticalAlign: 'top' }}>
                        {act.indicador
                          ? <TextoExpandible texto={act.indicador} maxChars={70} />
                          : <em style={{ color: '#9ca3af', fontSize: '0.78rem' }}>—</em>
                        }
                      </td>

                      <td style={{ fontSize: '0.78rem' }}>
                        {entradasValidas.length === 0 ? (
                          <em style={{ color: '#9ca3af' }}>Sin entradas</em>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {entradasValidas.map(e => (
                              <li key={e.id} style={{ color: '#374151' }}>{e.valor}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>
                        {salidasValidas.length === 0 ? (
                          <em style={{ color: '#9ca3af' }}>Sin salidas</em>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {salidasValidas.map(s => (
                              <li key={s.id} style={{ color: '#374151' }}>{s.valor}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td>
                        <span style={{
                          background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
                          borderRadius: 999, padding: '0.15rem 0.6rem',
                          fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap',
                        }}>
                          ⚠️ {entradasValidas.length}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
                          borderRadius: 999, padding: '0.15rem 0.6rem',
                          fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap',
                        }}>
                          🚀 {salidasValidas.length}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {new Date(act.creadaEn).toLocaleDateString('es-CO')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────── SUBCOMPONENTE: MAPA DE PROCEDIMIENTO ────────── */
const MapaProcedimiento: React.FC<{
  filas:    FilaMapaDB[]
  empresa?: string
  sector?:  string
  canCreate: boolean
  canEdit:   boolean
  canDelete: boolean
  onAdd:    (fila: Omit<FilaMapaDB, 'id'>) => void
  onUpdate: (id: number, patch: Partial<FilaMapaDB>) => void
  onDelete: (id: number) => void
}> = ({ filas, empresa, sector, canCreate, canEdit, canDelete, onAdd, onUpdate, onDelete }) => {
  const [search, setSearch]         = useState('')
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [editValues, setEditValues] = useState<Partial<FilaMapaDB>>({})
  const [showAdd, setShowAdd]       = useState(false)
  const [newFila, setNewFila]       = useState<Omit<FilaMapaDB, 'id'>>({ proceso: '', tipo: 'misional', responsable: '', clausula: '', funciones: '' })

  const filtered = filas.filter(f =>
    f.proceso.toLowerCase().includes(search.toLowerCase()) ||
    f.responsable.toLowerCase().includes(search.toLowerCase()) ||
    (f.clausula || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.tipo || '').toLowerCase().includes(search.toLowerCase())
  )

  const grupos = useMemo(() => ({
    estrategico: filas.filter(f => f.tipo === 'estrategico'),
    misional:    filas.filter(f => f.tipo === 'misional'),
    apoyo:       filas.filter(f => f.tipo === 'apoyo'),
  }), [filas])

  const startEdit = (f: FilaMapaDB) => { setEditingId(f.id); setEditValues({ ...f }) }
  const cancelEdit = () => { setEditingId(null); setEditValues({}) }
  const saveEdit = (id: number) => { onUpdate(id, editValues); cancelEdit() }

  const handleAdd = () => {
    if (!newFila.proceso.trim()) return
    onAdd(newFila)
    setNewFila({ proceso: '', tipo: 'misional', responsable: '', clausula: '', funciones: '' })
    setShowAdd(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="iso-info-box">
        <span className="iso-info-box__icon">🗺️</span>
        <span>
          <strong>§4.4 / §8.1 - Mapa de Procedimiento</strong> — Relación de procesos clasificados por tipo, responsables, cláusulas ISO aplicables y descripción de funciones.
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {(['estrategico', 'misional', 'apoyo'] as TipoProceso[]).map(tipo => {
          const c = TIPO_COLOR[tipo]
          return (
            <div key={tipo} style={{
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: '0.6rem', padding: '0.6rem 1.1rem',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: c.color }}>{grupos[tipo].length}</span>
              <span style={{ fontSize: '0.73rem', color: c.color, fontWeight: 600 }}>{TIPO_LABEL[tipo]}s</span>
            </div>
          )
        })}
        {empresa && (
          <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.6rem 1.1rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1b3a6b' }}>{empresa}</div>
            {sector && <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{sector}</div>}
          </div>
        )}
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">
          Procedimientos en el Mapa: <strong>{filas.length}</strong>
          {search && <span style={{ marginLeft: 8, color: '#6b7280' }}>· Mostrando {filtered.length}</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="🔍 Filtrar procedimientos…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.82rem', outline: 'none', width: 220 }}
          />
          {canCreate && (
            <button
              onClick={() => setShowAdd(s => !s)}
              style={{
                background: '#1b3a6b', color: '#fff', border: 'none',
                borderRadius: '0.5rem', padding: '0.4rem 0.9rem',
                fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
              }}
            >＋ Agregar</button>
          )}
        </div>
      </div>

      {/* Formulario de agregar */}
      {showAdd && canCreate && (
        <div style={{
          background: '#f0f9ff', border: '1px solid #bae6fd',
          borderRadius: '0.6rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem',
        }}>
          <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.85rem' }}>➕ Nueva fila — Mapa de Procedimiento</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
            <input placeholder="Nombre del proceso *" value={newFila.proceso}
              onChange={e => setNewFila(p => ({ ...p, proceso: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' }} />
            <select value={newFila.tipo} onChange={e => setNewFila(p => ({ ...p, tipo: e.target.value as TipoProceso }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' }}>
              <option value="estrategico">Estratégico</option>
              <option value="misional">Misional</option>
              <option value="apoyo">Apoyo</option>
            </select>
            <input placeholder="Responsable" value={newFila.responsable}
              onChange={e => setNewFila(p => ({ ...p, responsable: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' }} />
            <input placeholder="Cláusula ISO (ej: §8.1)" value={newFila.clausula}
              onChange={e => setNewFila(p => ({ ...p, clausula: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' }} />
            <input placeholder="Funciones / Requisitos" value={newFila.funciones}
              onChange={e => setNewFila(p => ({ ...p, funciones: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem', gridColumn: '2 / 4' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleAdd}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.4rem', padding: '0.38rem 0.9rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
            >✔ Guardar</button>
            <button onClick={() => setShowAdd(false)}
              style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '0.4rem', padding: '0.38rem 0.9rem', fontSize: '0.82rem', cursor: 'pointer' }}
            >✕ Cancelar</button>
          </div>
        </div>
      )}

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>Tipo</th>
              <th>Proceso</th>
              <th>Responsable</th>
              <th>Cláusula ISO</th>
              <th>Funciones / Requisitos</th>
              {(canEdit || canDelete) && <th style={{ width: '90px' }}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem' }}>Sin resultados</td></tr>
            ) : filtered.map(f => {
              const tipo = f.tipo as TipoProceso
              const c = TIPO_COLOR[tipo] || { bg: '#f3f4f6', color: '#374151', border: '#cbd5e1' }
              const isEditing = editingId === f.id
              return (
                <tr key={f.id}>
                  <td>
                    {isEditing && canEdit ? (
                      <select value={editValues.tipo || f.tipo}
                        onChange={e => setEditValues(p => ({ ...p, tipo: e.target.value as TipoProceso }))}
                        style={{ padding: '0.3rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.8rem' }}>
                        <option value="estrategico">Estratégico</option>
                        <option value="misional">Misional</option>
                        <option value="apoyo">Apoyo</option>
                      </select>
                    ) : (
                      <span style={{
                        background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                        fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.55rem',
                        borderRadius: 6, textTransform: 'uppercase', display: 'inline-block',
                      }}>{TIPO_LABEL[tipo] || tipo}</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600, color: '#1b3a6b' }}>
                    {isEditing && canEdit ? (
                      <input value={editValues.proceso ?? f.proceso}
                        onChange={e => setEditValues(p => ({ ...p, proceso: e.target.value }))}
                        style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.82rem' }} />
                    ) : f.proceso}
                  </td>
                  <td>
                    {isEditing && canEdit ? (
                      <input value={editValues.responsable ?? f.responsable}
                        onChange={e => setEditValues(p => ({ ...p, responsable: e.target.value }))}
                        style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.82rem' }} />
                    ) : f.responsable || <em style={{ color: '#9ca3af' }}>—</em>}
                  </td>
                  <td>
                    {isEditing && canEdit ? (
                      <input value={editValues.clausula ?? f.clausula}
                        onChange={e => setEditValues(p => ({ ...p, clausula: e.target.value }))}
                        style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.82rem' }} />
                    ) : f.clausula ? (
                      <span style={{ background: '#e8f0fb', color: '#1b3a6b', padding: '0.15rem 0.45rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600 }}>{f.clausula}</span>
                    ) : <em style={{ color: '#9ca3af' }}>—</em>}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                    {isEditing && canEdit ? (
                      <input value={editValues.funciones ?? f.funciones}
                        onChange={e => setEditValues(p => ({ ...p, funciones: e.target.value }))}
                        style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.82rem' }} />
                    ) : f.funciones || <em style={{ color: '#9ca3af' }}>—</em>}
                  </td>
                  {(canEdit || canDelete) && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                        {isEditing && canEdit ? (
                          <>
                            <button onClick={() => saveEdit(f.id)}
                              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>✔</button>
                            <button onClick={cancelEdit}
                              style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>✕</button>
                          </>
                        ) : (
                          <>
                            {canEdit && (
                              <button onClick={() => startEdit(f)}
                                title="Editar fila"
                                style={{ background: '#eff6ff', color: '#1e40af', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>✏️</button>
                            )}
                            {canDelete && (
                              <button onClick={() => onDelete(f.id)}
                                title="Eliminar fila"
                                style={{ background: '#fef2f2', color: '#991b1b', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>🗑️</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ────────────── SUBCOMPONENTE: MANUAL DE PROCEDIMIENTO ────────── */
const ManualProcedimiento: React.FC<{
  filas:     FilaManualDB[]
  canCreate: boolean
  canEdit:   boolean
  canDelete: boolean
  onAdd:     (fila: Omit<FilaManualDB, 'id'>) => void
  onUpdate:  (id: number, patch: Partial<FilaManualDB>) => void
  onDelete:  (id: number) => void
}> = ({ filas, canCreate, canEdit, canDelete, onAdd, onUpdate, onDelete }) => {
  const [search, setSearch]         = useState('')
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [editValues, setEditValues] = useState<Partial<FilaManualDB>>({})
  const [showAdd, setShowAdd]       = useState(false)
  const [newFila, setNewFila]       = useState<Omit<FilaManualDB, 'id'>>({
    codigo: '', proceso: '', objetivo: '', entradas: '', salidas: '',
    indicador: '', responsable: '', estado: 'Activo', clausula: '',
  })

  const filtered = filas.filter(r =>
    r.proceso.toLowerCase().includes(search.toLowerCase()) ||
    r.responsable.toLowerCase().includes(search.toLowerCase()) ||
    (r.clausula || '').toLowerCase().includes(search.toLowerCase())
  )

  const generarPasos = (row: FilaManualDB): string[] => [
    `Revisar las entradas del proceso: ${row.entradas || 'no definidas'}.`,
    `Verificar disponibilidad de recursos y personal responsable (${row.responsable || 'por asignar'}).`,
    `Ejecutar las actividades del proceso conforme a los criterios definidos.`,
    `Controlar el proceso usando el indicador: ${row.indicador || 'no definido'}.`,
    `Generar y verificar las salidas esperadas: ${row.salidas || 'no definidas'}.`,
    `Registrar evidencia y conservar la información documentada según §7.5.`,
  ]

  const startEdit = (r: FilaManualDB) => { setEditingId(r.id); setEditValues({ ...r }) }
  const cancelEdit = () => { setEditingId(null); setEditValues({}) }
  const saveEdit = (id: number) => { onUpdate(id, editValues); cancelEdit() }

  const handleAdd = () => {
    if (!newFila.proceso.trim()) return
    onAdd(newFila)
    setNewFila({ codigo: '', proceso: '', objetivo: '', entradas: '', salidas: '', indicador: '', responsable: '', estado: 'Activo', clausula: '' })
    setShowAdd(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="iso-info-box">
        <span className="iso-info-box__icon">📖</span>
        <span>
          <strong>§8.1 / §4.4.2 - Manual de Procedimientos</strong> — Fichas de procesos y guías paso a paso del procedimiento operacional estándar.
        </span>
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">
          Procedimientos documentados: <strong>{filas.length}</strong>
          {search && <span style={{ marginLeft: 8, color: '#6b7280' }}>· Mostrando {filtered.length}</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="🔍 Buscar procedimiento o responsable…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.82rem', outline: 'none', width: 220 }}
          />
          {canCreate && (
            <button onClick={() => setShowAdd(s => !s)}
              style={{ background: '#1b3a6b', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.9rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
            >＋ Agregar</button>
          )}
        </div>
      </div>

      {/* Formulario de agregar */}
      {showAdd && canCreate && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.6rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.85rem' }}>➕ Nueva fila — Manual de Procedimiento</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
            <input placeholder="Código (ej: GP-001)" value={newFila.codigo}
              onChange={e => setNewFila(p => ({ ...p, codigo: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' }} />
            <input placeholder="Nombre del proceso *" value={newFila.proceso}
              onChange={e => setNewFila(p => ({ ...p, proceso: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' }} />
            <input placeholder="Responsable" value={newFila.responsable}
              onChange={e => setNewFila(p => ({ ...p, responsable: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' }} />
            <input placeholder="Objetivo" value={newFila.objetivo}
              onChange={e => setNewFila(p => ({ ...p, objetivo: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' }} />
            <input placeholder="Entradas" value={newFila.entradas}
              onChange={e => setNewFila(p => ({ ...p, entradas: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' }} />
            <input placeholder="Salidas" value={newFila.salidas}
              onChange={e => setNewFila(p => ({ ...p, salidas: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' }} />
            <input placeholder="Indicador" value={newFila.indicador}
              onChange={e => setNewFila(p => ({ ...p, indicador: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' }} />
            <input placeholder="Cláusula ISO (ej: §8.1)" value={newFila.clausula}
              onChange={e => setNewFila(p => ({ ...p, clausula: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' }} />
            <select value={newFila.estado} onChange={e => setNewFila(p => ({ ...p, estado: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' }}>
              <option>Activo</option><option>Revisión</option><option>Inactivo</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleAdd}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.4rem', padding: '0.38rem 0.9rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>✔ Guardar</button>
            <button onClick={() => setShowAdd(false)}
              style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '0.4rem', padding: '0.38rem 0.9rem', fontSize: '0.82rem', cursor: 'pointer' }}>✕ Cancelar</button>
          </div>
        </div>
      )}

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr>
              <th style={{ width: '90px' }}>Código</th>
              <th style={{ width: '180px' }}>Proceso / Responsable</th>
              <th style={{ width: '220px' }}>Ficha Técnica SGC</th>
              <th style={{ minWidth: '300px' }}>Procedimiento Operacional</th>
              <th style={{ width: '110px' }}>Cláusula ISO</th>
              {(canEdit || canDelete) && <th style={{ width: '90px' }}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem' }}>Sin resultados</td></tr>
            ) : filtered.map(row => {
              const isEditing = editingId === row.id
              const pasos = generarPasos(row)
              return (
                <tr key={row.id} style={{ verticalAlign: 'top' }}>
                  <td>
                    {isEditing && canEdit ? (
                      <input value={editValues.codigo ?? row.codigo}
                        onChange={e => setEditValues(p => ({ ...p, codigo: e.target.value }))}
                        style={{ width: '80px', padding: '0.3rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.78rem' }} />
                    ) : (
                      <code style={{ background: '#1b3a6b', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 4, display: 'inline-block' }}>{row.codigo}</code>
                    )}
                  </td>
                  <td>
                    {isEditing && canEdit ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input value={editValues.proceso ?? row.proceso}
                          onChange={e => setEditValues(p => ({ ...p, proceso: e.target.value }))}
                          style={{ padding: '0.3rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.82rem' }} />
                        <input value={editValues.responsable ?? row.responsable}
                          onChange={e => setEditValues(p => ({ ...p, responsable: e.target.value }))}
                          style={{ padding: '0.3rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.78rem' }} />
                        <select value={editValues.estado ?? row.estado}
                          onChange={e => setEditValues(p => ({ ...p, estado: e.target.value }))}
                          style={{ padding: '0.3rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.78rem' }}>
                          <option>Activo</option><option>Revisión</option><option>Inactivo</option>
                        </select>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 700, color: '#1b3a6b', fontSize: '0.85rem', marginBottom: 4 }}>{row.proceso}</div>
                        <div style={{ fontSize: '0.74rem', color: '#6b7280' }}>👤 <strong>Resp:</strong> {row.responsable || '—'}</div>
                        <div style={{ marginTop: 4 }}><span className={`iso-badge ${estadoBadgeClass(row.estado)}`}>{row.estado}</span></div>
                      </>
                    )}
                  </td>
                  <td style={{ fontSize: '0.78rem', color: '#4b5563', lineHeight: 1.5 }}>
                    {isEditing && canEdit ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input placeholder="Objetivo" value={editValues.objetivo ?? row.objetivo}
                          onChange={e => setEditValues(p => ({ ...p, objetivo: e.target.value }))}
                          style={{ padding: '0.3rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.78rem' }} />
                        <input placeholder="Entradas" value={editValues.entradas ?? row.entradas}
                          onChange={e => setEditValues(p => ({ ...p, entradas: e.target.value }))}
                          style={{ padding: '0.3rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.78rem' }} />
                        <input placeholder="Salidas" value={editValues.salidas ?? row.salidas}
                          onChange={e => setEditValues(p => ({ ...p, salidas: e.target.value }))}
                          style={{ padding: '0.3rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.78rem' }} />
                        <input placeholder="Indicador" value={editValues.indicador ?? row.indicador}
                          onChange={e => setEditValues(p => ({ ...p, indicador: e.target.value }))}
                          style={{ padding: '0.3rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.78rem' }} />
                      </div>
                    ) : (
                      <>
                        <div style={{ marginBottom: 4 }}><strong>🎯 Objetivo:</strong> {row.objetivo || <em style={{ color: '#9ca3af' }}>—</em>}</div>
                        <div style={{ marginBottom: 4 }}><strong>📥 Entradas:</strong> {row.entradas || <em style={{ color: '#9ca3af' }}>—</em>}</div>
                        <div style={{ marginBottom: 4 }}><strong>📤 Salidas:</strong> {row.salidas || <em style={{ color: '#9ca3af' }}>—</em>}</div>
                        <div><strong>📊 Indicador:</strong> {row.indicador || <em style={{ color: '#9ca3af' }}>—</em>}</div>
                      </>
                    )}
                  </td>
                  <td>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.4rem', padding: '0.6rem 0.75rem' }}>
                      <ol style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {pasos.map((paso, idx) => (
                          <li key={idx} style={{ fontSize: '0.78rem', color: '#374151', lineHeight: 1.45 }}>{paso}</li>
                        ))}
                      </ol>
                    </div>
                  </td>
                  <td>
                    {isEditing && canEdit ? (
                      <input value={editValues.clausula ?? row.clausula}
                        onChange={e => setEditValues(p => ({ ...p, clausula: e.target.value }))}
                        style={{ width: '100%', padding: '0.3rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.78rem' }} />
                    ) : row.clausula ? (
                      <span style={{ background: '#e8f0fb', color: '#1b3a6b', padding: '0.15rem 0.45rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, display: 'inline-block' }}>{row.clausula}</span>
                    ) : <em style={{ color: '#9ca3af' }}>—</em>}
                  </td>
                  {(canEdit || canDelete) && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                        {isEditing && canEdit ? (
                          <>
                            <button onClick={() => saveEdit(row.id)}
                              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>✔</button>
                            <button onClick={cancelEdit}
                              style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>✕</button>
                          </>
                        ) : (
                          <>
                            {canEdit && (
                              <button onClick={() => startEdit(row)}
                                title="Editar fila"
                                style={{ background: '#eff6ff', color: '#1e40af', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>✏️</button>
                            )}
                            {canDelete && (
                              <button onClick={() => onDelete(row.id)}
                                title="Eliminar fila"
                                style={{ background: '#fef2f2', color: '#991b1b', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>🗑️</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─────────────── SUBCOMPONENTE: MATRIZ RIESGOS (actividades) ─── */

const MatrizRiesgosActividades: React.FC<{
  actividades: ActividadEmpresa[]
  analysis:    any
}> = ({ actividades, analysis }) => {
  const [filterTipo, setFilterTipo] = useState<'todos' | 'Riesgo' | 'Oportunidad'>('todos')

  const riesgos = useMemo(
    () => (analysis ? derivarRiesgos(analysis, actividades) : []).filter(r => r.fuente === 'ACTIVIDAD'),
    [analysis, actividades]
  )

  const filtered = riesgos.filter(r =>
    filterTipo === 'todos' || r.tipo === filterTipo
  )

  const actIdxMap = useMemo(() => {
    const m: Record<string, string> = {}
    actividades.forEach((a, i) => { m[a.id] = String(i + 1).padStart(3, '0') })
    return m
  }, [actividades])

  if (actividades.length === 0) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
      No hay actividades registradas. Ve a la pestaña <strong>Tabla de Caracterización</strong> y usa el botón{' '}
      <em>Registrar Actividad</em>.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="iso-info-box">
        <span className="iso-info-box__icon">⚠️</span>
        <span>
          <strong>§6.1 / §8.1</strong> — Riesgos y oportunidades derivados de las actividades
          propias de la empresa. La descripción se genera a partir de las entradas y salidas registradas.
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        {[
          { val: riesgos.length,                                        lbl: 'Total',          color: '#7e22ce', bg: '#fdf4ff', border: '#e9d5ff' },
          { val: riesgos.filter(r => r.tipo === 'Riesgo').length,       lbl: 'Riesgos',        color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
          { val: riesgos.filter(r => r.tipo === 'Oportunidad').length,  lbl: 'Oportunidades',  color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
          { val: riesgos.filter(r => r.nivel >= 15).length,             lbl: 'Críticos',       color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5' },
        ].map(({ val, lbl, color, bg, border }) => (
          <div key={lbl} style={{
            background: bg, border: `1px solid ${border}`,
            borderRadius: '0.6rem', padding: '0.45rem 0.85rem', textAlign: 'center', minWidth: 70,
          }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color }}>{val}</div>
            <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>{lbl}</div>
          </div>
        ))}
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">
          Mostrando <strong>{filtered.length}</strong> de <strong>{riesgos.length}</strong> elementos
        </div>
        <select
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value as any)}
          style={{
            padding: '0.38rem 0.7rem', border: '1px solid #e5e7eb',
            borderRadius: '0.5rem', fontSize: '0.82rem', outline: 'none',
            background: '#fff',
          }}
        >
          <option value="todos">Todos los tipos</option>
          <option value="Riesgo">Solo Riesgos</option>
          <option value="Oportunidad">Solo Oportunidades</option>
        </select>
      </div>

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Actividad</th>
              <th>Tipo</th>
              <th>Categoría</th>
              <th>Descripción</th>
              <th style={{ textAlign: 'center' }}>P</th>
              <th style={{ textAlign: 'center' }}>I</th>
              <th>Nivel</th>
              <th>Estado</th>
              <th>Responsable</th>
              <th>Acciones sugeridas</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem' }}>
                  Sin resultados con el filtro actual
                </td>
              </tr>
            ) : filtered.map((r: RiesgoDerivado) => {
              const actCodigo = r.actividadId
                ? `ACT-${actIdxMap[r.actividadId] ?? '001'}`
                : r.codigo.split('-').slice(0, 2).join('-')
              const actNombre = r.actividadNombre ?? '—'
              return (
                <tr key={r.codigo}>
                  <td>
                    <code style={{
                      background: r.tipo === 'Riesgo' ? '#fef2f2' : '#f0fdf4',
                      color:      r.tipo === 'Riesgo' ? '#991b1b' : '#166534',
                      padding: '0.15rem 0.45rem', borderRadius: 4,
                      fontSize: '0.72rem', fontWeight: 700,
                    }}>{r.codigo}</code>
                  </td>
                  <td>
                    <ActividadBadge nombre={actNombre} codigo={actCodigo} />
                  </td>
                  <td>
                    <span style={{
                      background: r.tipo === 'Riesgo' ? '#fef2f2' : '#f0fdf4',
                      color:      r.tipo === 'Riesgo' ? '#991b1b' : '#166534',
                      border:     `1px solid ${r.tipo === 'Riesgo' ? '#fecaca' : '#bbf7d0'}`,
                      borderRadius: 999, padding: '0.15rem 0.6rem',
                      fontSize: '0.73rem', fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      {r.tipo === 'Riesgo' ? '⚠️ Riesgo' : '🚀 Oportunidad'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff',
                      borderRadius: 999, padding: '0.15rem 0.6rem',
                      fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      ⚙️ {r.categoria}
                    </span>
                  </td>
                  <td style={{ maxWidth: 260, verticalAlign: 'top' }}>
                    <TextoExpandible texto={r.descripcion} maxChars={100} />
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.probabilidad}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.impacto}</td>
                  <td>
                    <span style={{
                      background:   getLevelVariant(r.nivel) === 'critical' ? '#fee2e2'
                                  : getLevelVariant(r.nivel) === 'high'     ? '#fef3c7'
                                  : getLevelVariant(r.nivel) === 'medium'   ? '#fefce8'
                                  : '#f0fdf4',
                      color:        getLevelVariant(r.nivel) === 'critical' ? '#7f1d1d'
                                  : getLevelVariant(r.nivel) === 'high'     ? '#92400e'
                                  : getLevelVariant(r.nivel) === 'medium'   ? '#854d0e'
                                  : '#166534',
                      borderRadius: 999, padding: '0.15rem 0.6rem',
                      fontSize: '0.73rem', fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      {r.nivel} — {getLevelLabel(r.nivel)}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      background:   r.estado === 'CRITICO'     ? '#fee2e2'
                                  : r.estado === 'TRATAMIENTO' ? '#fef3c7' : '#f0fdf4',
                      color:        r.estado === 'CRITICO'     ? '#991b1b'
                                  : r.estado === 'TRATAMIENTO' ? '#92400e' : '#166534',
                      borderRadius: 999, padding: '0.15rem 0.55rem',
                      fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
                    }}>{r.estado}</span>
                  </td>
                  <td style={{ fontSize: '0.79rem', fontWeight: 500 }}>{r.responsable}</td>
                  <td style={{ maxWidth: 220, verticalAlign: 'top' }}>
                    <TextoExpandible texto={r.acciones} maxChars={90} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─────────────────────────── PÁGINA PRINCIPAL ─────────────────── */
const PlanificacionOperacionPage: React.FC = () => {
  const { canCreate, canEdit, canDelete } = usePermissions('planes_operacion')
  const {
    analysis, actividades,
    addFilaMapaProcedimiento, updateFilaMapaProcedimiento, removeFilaMapaProcedimiento,
    addFilaManualProcedimiento, updateFilaManualProcedimiento, removeFilaManualProcedimiento,
  } = useAIAnalysis()
  const [activeTab, setActiveTab] = useState<Tab>('caracterizacion')

  const caracterizacion: CaracterizacionRow[] = analysis?.caracterizacion ?? []
  const matrizRoles: FilaMapaDB[]            = analysis?.mapaProcedimiento ?? []
  const manualRows: FilaManualDB[]           = analysis?.manualProcedimiento ?? []
  const hasData = caracterizacion.length > 0 || matrizRoles.length > 0 || actividades.length > 0 || manualRows.length > 0

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'caracterizacion', label: '📋 Tabla de Caracterización', count: caracterizacion.length },
    { id: 'mapa',            label: '🗺️ Mapa de Procedimiento',    count: matrizRoles.length    },
    { id: 'manual',          label: '📖 Manual de Procedimiento',  count: manualRows.length     },
    { id: 'riesgos',         label: '⚠️ Riesgos de Actividades',   count: actividades.length    },
  ]

  return (
    <div className="iso-page">
      <div className="iso-page__header">
        <div className="iso-page__title-block">
          <h1>⚙️ Planificación y Control Operacional</h1>
          <p>
            Tabla de caracterización, mapa y manual de procedimiento, y matriz de riesgos de actividades
            {analysis?.nombreEmpresa && (
              <> · <strong style={{ color: '#1b3a6b' }}>{analysis.nombreEmpresa}</strong></>
            )}
            {analysis?.sector && (
              <span style={{
                marginLeft: 8, background: '#e8f0fb', color: '#1b3a6b',
                fontSize: '0.72rem', fontWeight: 700, borderRadius: 999,
                padding: '0.15rem 0.55rem',
              }}>{analysis.sector}</span>
            )}
          </p>
          <span className="iso-page__clause">Cláusula 8.1</span>
        </div>

        {hasData && (
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {[
              { val: caracterizacion.length,                                     lbl: 'Procesos',     color: '#1b3a6b' },
              { val: matrizRoles.filter(f => f.tipo === 'estrategico').length,   lbl: 'Estratégicos', color: '#1e40af' },
              { val: matrizRoles.filter(f => f.tipo === 'misional').length,      lbl: 'Misionales',   color: '#166534' },
              { val: matrizRoles.filter(f => f.tipo === 'apoyo').length,         lbl: 'Apoyo',        color: '#854d0e' },
              { val: actividades.length,                                          lbl: 'Actividades',  color: '#7e22ce' },
            ].map(({ val, lbl, color }) => (
              <div key={lbl} style={{
                background: '#f8fafc', border: '1px solid #e5e7eb',
                borderRadius: '0.6rem', padding: '0.45rem 0.85rem',
                textAlign: 'center', minWidth: 70,
              }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color }}>{val}</div>
                <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>{lbl}</div>
              </div>
            ))}
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: '0.6rem', padding: '0.45rem 0.85rem',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}>
              <span style={{ fontSize: '0.85rem' }}>✅</span>
              <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>Persistido en BD</span>
            </div>
          </div>
        )}
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          <div className="iso-tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`iso-tab-btn ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span style={{
                    background: activeTab === t.id ? '#2e86de' : '#e5e7eb',
                    color:      activeTab === t.id ? '#fff'     : '#6b7280',
                    fontSize: '0.68rem', fontWeight: 700,
                    padding: '0.1rem 0.45rem', borderRadius: 999, marginLeft: 4,
                  }}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'caracterizacion' && (
            <TablaCaracterizacion rows={caracterizacion} actividades={actividades} />
          )}
          {activeTab === 'mapa' && (
            <MapaProcedimiento
              filas={matrizRoles}
              empresa={analysis?.nombreEmpresa}
              sector={analysis?.sector}
              canCreate={canCreate}
              canEdit={canEdit}
              canDelete={canDelete}
              onAdd={addFilaMapaProcedimiento}
              onUpdate={updateFilaMapaProcedimiento}
              onDelete={removeFilaMapaProcedimiento}
            />
          )}
          {activeTab === 'manual' && (
            <ManualProcedimiento
              filas={manualRows}
              canCreate={canCreate}
              canEdit={canEdit}
              canDelete={canDelete}
              onAdd={addFilaManualProcedimiento}
              onUpdate={updateFilaManualProcedimiento}
              onDelete={removeFilaManualProcedimiento}
            />
          )}
          {activeTab === 'riesgos' && (
            <MatrizRiesgosActividades actividades={actividades} analysis={analysis} />
          )}
        </>
      )}
    </div>
  )
}

export default PlanificacionOperacionPage