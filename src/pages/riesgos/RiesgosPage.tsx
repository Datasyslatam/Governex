/**
 * RiesgosPage.tsx — Governex · ISO 9001:2015 §6.1
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import RiskHeatmap    from './components/RiskHeatmap'
import RiskSummaryBars from './components/RiskSummaryBars'
import './RiesgosPage.css'
import { useAIAnalysis, derivarRiesgos, RiesgoDerivado } from '../../context/AIAnalysisContext'
import { riesgoEvidenciasService, uploadsService, riesgosService } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import { ACCEPTED } from '../../constants/uploads'


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

/* ── Tipos locales ───────────────────────────────────────────── */
export interface EvidenciaFile {
  id:       string
  name:     string
  size:     number
  type:     string
  dataUrl:  string
  uploadedAt: string
}

interface RiesgoOverride {
  responsable?: string
  estado?:      RiesgoDerivado['estado']
  acciones?:    string
  evidencias?:  EvidenciaFile[]
  eficacia?:    number
}

/* ── Pantalla vacía ─────────────────────────────────────────── */
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

/* ── Columna: Descripción desplegable ────────────────────────── */
const MAX_CHARS = 60  // caracteres visibles antes del "Ver más"

interface DescripcionCellProps {
  texto: string
}

const DescripcionCell: React.FC<DescripcionCellProps> = ({ texto }) => {
  const [expanded, setExpanded] = useState(false)
  const needsTruncation = texto.length > MAX_CHARS

  if (!needsTruncation) {
    return <span className="risk-table__desc-text">{texto}</span>
  }

  return (
    <div className="risk-table__desc-wrap">
      <span className="risk-table__desc-text">
        {expanded ? texto : `${texto.slice(0, MAX_CHARS)}…`}
      </span>
      <button
        className="risk-table__desc-toggle"
        onClick={() => setExpanded(prev => !prev)}
        title={expanded ? 'Colapsar' : 'Ver descripción completa'}
      >
        {expanded ? '▲ Ver menos' : '▼ Ver más'}
      </button>
    </div>
  )
}

/* ── Columna: Acciones (read-only, generada por IA) ─────────── */
interface AccionesCellProps {
  acciones: string
  tipo:     'Riesgo' | 'Oportunidad'
}
const AccionesCell: React.FC<AccionesCellProps> = ({ acciones, tipo }) => {
  const colorClass = tipo === 'Riesgo' ? 'risk-table__pill--mitigar' : 'risk-table__pill--aprovechar'
  const prefix     = tipo === 'Riesgo'
    ? acciones.startsWith('ACCIÓN INMEDIATA') ? '🔴 ' : acciones.startsWith('PRIORITARIO') ? '🟠 ' : '🟡 '
    : '🟢 '
  return (
    <div className="risk-table__acciones-cell">
      <span className={`risk-table__pill ${colorClass}`}>
        <span className="risk-table__pill-prefix">{prefix}</span>
        {acciones.replace(/^(ACCIÓN INMEDIATA|PRIORITARIO): /, '')}
      </span>
    </div>
  )
}

/* ── Columna: Indicador de seguimiento (uploader de evidencias) ─ */
interface EvidenciasCellProps {
  riesgoCodigo: string
  evidencias:   EvidenciaFile[]
  onChange:     (files: EvidenciaFile[]) => void
}

const EvidenciasCell: React.FC<EvidenciasCellProps> = ({ riesgoCodigo, evidencias, onChange }) => {
  const { canEdit } = usePermissions('riesgos')
  const inputRef              = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<EvidenciaFile | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    try {
      const nuevos: EvidenciaFile[] = []
      for (const file of Array.from(fileList)) {
        const uploaded = await uploadsService.upload(file)
        const saved = await riesgoEvidenciasService.create({
          riesgoCodigo,
          nombreArchivo: uploaded.nombre,
          url: uploaded.url,
          tipoMime: uploaded.tipoMime,
          tamanoBytes: uploaded.tamanoBytes,
        })
        nuevos.push({
          id: String(saved.id),
          name: saved.nombre_archivo,
          size: saved.tamano_bytes ?? 0,
          type: saved.tipo_mime ?? '',
          dataUrl: saved.url,
          uploadedAt: new Date(saved.subido_en).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }),
        })
      }
      onChange([...evidencias, ...nuevos])
    } catch (e: any) {
      alert('No se pudo subir el archivo: ' + (e.message || e))
    } finally {
      setUploading(false)
    }
  }

  const removeFile = async (id: string) => {
    try { await riesgoEvidenciasService.delete(Number(id)) } catch {}
    onChange(evidencias.filter(f => f.id !== id))
  }

  const isImage = (f: EvidenciaFile) => f.type.startsWith('image/')

  const fileIcon = (f: EvidenciaFile) => {
    if (f.type.startsWith('image/'))       return '🖼️'
    if (f.type.includes('pdf'))            return '📄'
    if (f.type.includes('word') || f.name.endsWith('.docx') || f.name.endsWith('.doc')) return '📝'
    if (f.type.includes('sheet') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) return '📊'
    if (f.type.includes('presentation') || f.name.endsWith('.pptx')) return '📑'
    if (f.type.includes('zip') || f.name.endsWith('.zip')) return '🗜️'
    return '📎'
  }

  const fmtSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1024*1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024/1024).toFixed(1)} MB`

  return (
    <div className="ev-cell">
      <div
        className="ev-dropzone"
        onClick={canEdit ? (() => !uploading && inputRef.current?.click()) : undefined}
        style={{ cursor: canEdit ? 'pointer' : 'default' }}
        title={!canEdit ? 'Tu rol no tiene permiso para editar' : undefined}
        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ev-dropzone--over') }}
        onDragLeave={e => e.currentTarget.classList.remove('ev-dropzone--over')}
        onDrop={e => {
          e.preventDefault()
          e.currentTarget.classList.remove('ev-dropzone--over')
          handleFiles(e.dataTransfer.files)
        }}
      >
        <span className="ev-dropzone__icon">{uploading ? '⏳' : '📎'}</span>
        <span className="ev-dropzone__label">
          {uploading ? 'Subiendo...' : evidencias.length === 0 ? 'Adjuntar evidencias' : '+  Añadir más'}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />

      {evidencias.length > 0 && (
        <ul className="ev-list">
          {evidencias.map(f => (
            <li key={f.id} className="ev-item">
              {isImage(f) ? (
                <img src={f.dataUrl} alt={f.name} className="ev-item__thumb" onClick={() => setPreview(f)} title="Ver imagen" />
              ) : (
                <a href={f.dataUrl} target="_blank" rel="noreferrer" className="ev-item__icon" title={f.name}>{fileIcon(f)}</a>
              )}
              <div className="ev-item__meta">
                <span className="ev-item__name" title={f.name}>{f.name}</span>
                <span className="ev-item__info">{fmtSize(f.size)} · {f.uploadedAt}</span>
              </div>
              <button className="ev-item__remove" onClick={() => removeFile(f.id)} title={canEdit ? "Quitar" : "Tu rol no tiene permiso para editar"} disabled={!canEdit}>✕</button>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="ev-preview-overlay" onClick={() => setPreview(null)}>
          <div className="ev-preview-modal" onClick={e => e.stopPropagation()}>
            <button className="ev-preview-close" onClick={() => setPreview(null)}>✕</button>
            <img src={preview.dataUrl} alt={preview.name} className="ev-preview-img" />
            <span className="ev-preview-name">{preview.name}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Columna: Eficacia del control ────────────────────────────── */
interface EficaciaCellProps {
  value:    number
  onChange: (v: number) => void
}

function eficaciaVariant(v: number) {
  if (v >= 80) return 'success'
  if (v >= 50) return 'warning'
  if (v >= 25) return 'risk'
  return 'critical'
}

function eficaciaLabel(v: number) {
  if (v >= 80) return 'Eficaz'
  if (v >= 50) return 'En progreso'
  if (v >= 25) return 'Iniciado'
  return 'Sin ejecutar'
}

const EficaciaCell: React.FC<EficaciaCellProps> = ({ value, onChange }) => {
  const { canEdit } = usePermissions('riesgos')
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)
  const variant = eficaciaVariant(value)

  const commit = (v: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(v)))
    onChange(clamped)
    setEditing(false)
  }

  return (
    <div className="ef-cell">
      <div className="ef-bar-wrap" title={`${value}% — ${eficaciaLabel(value)}`}>
        <div className={`ef-bar ef-bar--${variant}`} style={{ width: `${value}%` }} />
      </div>
      <div className="ef-footer">
        {editing ? (
          <div className="ef-editor">
            <input
              type="number"
              min={0} max={100}
              value={draft}
              autoFocus
              className="ef-input"
              onChange={e => setDraft(Number(e.target.value))}
              onBlur={() => commit(draft)}
              onKeyDown={e => {
                if (e.key === 'Enter') commit(draft)
                if (e.key === 'Escape') setEditing(false)
              }}
            />
            <span className="ef-pct-label">%</span>
          </div>
        ) : (
          <button
            className={`ef-badge ef-badge--${variant}`}
            onClick={canEdit ? (() => { setDraft(value); setEditing(true) }) : undefined}
            title={canEdit ? "Clic para editar porcentaje" : "Tu rol no tiene permiso para editar"}
            disabled={!canEdit}
          >
            {value}% · {eficaciaLabel(value)}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Componente principal ────────────────────────────────────── */
const RiesgosPage: React.FC = () => {
  const { analysis, actividades } = useAIAnalysis()
  const { canEdit, canCreate } = usePermissions('riesgos')

  const riesgos: RiesgoDerivado[] = useMemo(
    () => (analysis ? derivarRiesgos(analysis, actividades) : []),
    [analysis, actividades]
  )

  const [filterTipo,   setFilterTipo]   = useState<'todos' | 'Riesgo' | 'Oportunidad'>('todos')
  const [filterNivel,  setFilterNivel]  = useState<'todos' | 'CRITICO' | 'TRATAMIENTO' | 'MONITOREO'>('todos')
  const [filterFuente, setFilterFuente] = useState<'todos' | 'PESTEL' | 'DOFA' | 'ACTIVIDAD'>('todos')
  const [search,       setSearch]       = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [overrides, setOverrides] = useState<Record<string, RiesgoOverride>>({})

  /* ── Persistencia en BD (tabla `riesgos`) — patrón borrador/confirmado ── */
  const [confirmados, setConfirmados] = useState<Record<string, number>>({}) // codigo -> id en BD
  const [guardando,   setGuardando]   = useState<Record<string, boolean>>({})
  const [confirmandoTodos, setConfirmandoTodos] = useState(false)

  const cargarConfirmados = useCallback(() => {
    riesgosService.getAll()
      .then(rows => {
        const map: Record<string, number> = {}
        for (const row of rows) if (row.codigo) map[row.codigo] = row.id
        setConfirmados(map)
      })
      .catch(e => console.warn('No se pudieron cargar los riesgos confirmados en BD:', e))
  }, [])

  useEffect(() => { cargarConfirmados() }, [cargarConfirmados])

  /* ── Cargar eficacia/responsable/estado guardados + evidencias por riesgo visible ── */
  useEffect(() => {
    riesgoEvidenciasService.getEficaciaTodos()
      .then(rows => {
        const initial: Record<string, RiesgoOverride> = {}
        for (const r of rows) {
          initial[r.riesgo_codigo] = {
            eficacia: r.eficacia_pct,
            responsable: r.responsable_override ?? undefined,
            estado: r.estado_override ?? undefined,
          }
        }
        setOverrides(prev => ({ ...initial, ...prev }))
      })
      .catch(e => console.warn('No se pudo cargar eficacia de riesgos:', e))
  }, [])

  useEffect(() => {
    if (riesgos.length === 0) return
    Promise.all(riesgos.map(r =>
      riesgoEvidenciasService.getByCodigo(r.codigo)
        .then(rows => [r.codigo, rows] as const)
        .catch(() => [r.codigo, []] as const)
    )).then(pairs => {
      setOverrides(prev => {
        const next = { ...prev }
        for (const [codigo, rows] of pairs) {
          if (!rows.length) continue
          next[codigo] = {
            ...next[codigo],
            evidencias: rows.map((f: any) => ({
              id: String(f.id), name: f.nombre_archivo, size: f.tamano_bytes ?? 0,
              type: f.tipo_mime ?? '', dataUrl: f.url,
              uploadedAt: new Date(f.subido_en).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }),
            })),
          }
        }
        return next
      })
    })
  }, [riesgos])

  const setOverride = useCallback((codigo: string, patch: Partial<RiesgoOverride>) => {
    setOverrides(prev => ({ ...prev, [codigo]: { ...prev[codigo], ...patch } }))

    if (patch.eficacia !== undefined || patch.responsable !== undefined || patch.estado !== undefined) {
      riesgoEvidenciasService.putEficacia(codigo, {
        eficaciaPct: patch.eficacia,
        responsableOverride: patch.responsable,
        estadoOverride: patch.estado,
      }).catch(e => console.warn('No se pudo guardar override de riesgo:', e))
    }
  }, [])

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
    setOverride(codigo, { responsable: editValue })
    setEditingId(null)
  }, [editValue, setOverride])

  const changeEstado = useCallback((codigo: string, estado: RiesgoDerivado['estado']) => {
    setOverride(codigo, { estado })
  }, [setOverride])

  /* ── Confirmar (guardar/actualizar en BD) un riesgo derivado ───────── */
  const confirmarRiesgo = useCallback(async (r: RiesgoDerivado) => {
    setGuardando(prev => ({ ...prev, [r.codigo]: true }))
    try {
      const saved = await riesgosService.upsert({
        codigo:       r.codigo,
        descripcion:  r.descripcion,
        tipo:         r.tipo,
        fuente:       r.fuente,
        categoria:    r.categoria,
        actividad_id: r.actividadId,
        probabilidad: r.probabilidad,
        impacto:      r.impacto,
        estado:       r.estado,
        responsable:  r.responsable,
        tratamiento:  r.acciones,
      })
      setConfirmados(prev => ({ ...prev, [r.codigo]: saved.id }))
    } catch (e: any) {
      alert(`No se pudo guardar ${r.codigo} en la base de datos: ${e.message || e}`)
    } finally {
      setGuardando(prev => ({ ...prev, [r.codigo]: false }))
    }
  }, [])

  /* ── Confirmar todos los borradores visibles de una vez ─────────────── */
  const confirmarTodos = useCallback(async () => {
    const borradores = riesgosFinal.filter(r => !confirmados[r.codigo])
    if (borradores.length === 0) return
    if (!confirm(`¿Confirmar y guardar en la base de datos los ${borradores.length} elementos generados automáticamente?`)) return
    setConfirmandoTodos(true)
    try {
      await Promise.all(borradores.map(r => confirmarRiesgo(r)))
    } finally {
      setConfirmandoTodos(false)
    }
  }, [riesgosFinal, confirmados, confirmarRiesgo])

  const totalRiesgos       = riesgosFinal.filter(r => r.tipo === 'Riesgo').length
  const totalOportunidades = riesgosFinal.filter(r => r.tipo === 'Oportunidad').length
  const criticos           = riesgosFinal.filter(r => r.tipo === 'Riesgo' && r.nivel >= 15).length
  const enTratamiento      = riesgosFinal.filter(r => r.estado === 'TRATAMIENTO').length

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

      {/* KPIs */}
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
        {actividades.length > 0 && (
          <div className="riesgos-kpi" style={{ borderLeft: '3px solid #7c3aed' }}>
            <span className="riesgos-kpi__value" style={{ color: '#7c3aed' }}>
              {riesgosFinal.filter(r => r.fuente === 'ACTIVIDAD').length}
            </span>
            <span className="riesgos-kpi__label">De Actividades §4.1</span>
          </div>
        )}
      </div>

      <main className="riesgos-page__main">
        {/* Panel izq: Mapa de calor + Barras */}
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

        {/* Panel der: Tabla */}
        <div className="riesgos-page__panel riesgos-page__panel--right">
          <div className="riesgos-page__section-header">
            <div>
              <h3 className="riesgos-page__section-title">Registro de Riesgos y Oportunidades</h3>
              <span className="riesgos-page__section-subtitle">
                {riesgosFinal.filter(r => confirmados[r.codigo]).length} confirmados en BD · {riesgosFinal.filter(r => !confirmados[r.codigo]).length} borradores
              </span>
            </div>
            <button
              className="iso-btn-secondary"
              disabled={!canCreate || confirmandoTodos || riesgosFinal.every(r => confirmados[r.codigo])}
              title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}
              onClick={confirmarTodos}
            >
              {confirmandoTodos ? 'Guardando...' : '✅ Confirmar todos los borradores'}
            </button>
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
              <option value="todos">Todas las fuentes</option>
              <option value="PESTEL">Solo PESTEL</option>
              <option value="DOFA">Solo DOFA</option>
              <option value="ACTIVIDAD">Solo Actividades (§4.1)</option>
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
                  <th className="risk-table__th--acciones">
                    Acciones
                    <span className="risk-table__th-sub">Mitigación · Aprovechamiento</span>
                  </th>
                  <th className="risk-table__th--evidencias">
                    Indicador de seguimiento
                    <span className="risk-table__th-sub">Evidencias de ejecución</span>
                  </th>
                  <th className="risk-table__th--eficacia">
                    Eficacia del control
                    <span className="risk-table__th-sub">% de avance</span>
                  </th>
                  <th className="risk-table__th--bd">BD</th>
                </tr>
              </thead>
              <tbody>
                {riesgosFiltrados.map(r => {
                  const ov = overrides[r.codigo] ?? {}
                  const estaConfirmado = !!confirmados[r.codigo]
                  const estaGuardando  = !!guardando[r.codigo]
                  return (
                    <tr key={r.codigo} className={!estaConfirmado ? 'risk-table__row--borrador' : undefined}
                        title={!estaConfirmado ? 'Generado automáticamente — aún no se ha guardado en la base de datos' : undefined}>
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

                      {/* ── Descripción desplegable ── */}
                      <td className="risk-table__desc">
                        <DescripcionCell texto={r.descripcion} />
                      </td>

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
                          disabled={!canEdit}
                          title={!canEdit ? 'Tu rol no tiene permiso para editar' : undefined}
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
                            <button onClick={() => saveEdit(r.codigo)} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>✔</button>
                            <button onClick={() => setEditingId(null)}>✕</button>
                          </div>
                        ) : (
                          <span
                            className="risk-table__responsable"
                            onClick={canEdit ? (() => { setEditingId(r.codigo); setEditValue(r.responsable) }) : undefined}
                            title={canEdit ? "Clic para editar" : "Tu rol no tiene permiso para editar"}
                            style={{ cursor: canEdit ? 'pointer' : 'default' }}
                          >
                            {r.responsable}
                          </span>
                        )}
                      </td>

                      <td className="risk-table__td--acciones">
                        <AccionesCell acciones={r.acciones} tipo={r.tipo} />
                      </td>
                      <td className="risk-table__td--evidencias">
                        <EvidenciasCell
                          riesgoCodigo={r.codigo}
                          evidencias={ov.evidencias ?? []}
                          onChange={files => setOverride(r.codigo, { evidencias: files })}
                        />
                      </td>
                      <td className="risk-table__td--eficacia">
                        <EficaciaCell
                          value={ov.eficacia ?? 0}
                          onChange={v => setOverride(r.codigo, { eficacia: v })}
                        />
                      </td>
                      <td className="risk-table__td--bd" style={{ textAlign: 'center' }}>
                        {estaConfirmado ? (
                          <span className="risk-table__bd-badge risk-table__bd-badge--ok" title="Guardado en la base de datos">
                            ✅ Confirmado
                          </span>
                        ) : (
                          <button
                            className="risk-table__bd-confirm-btn"
                            disabled={!canCreate || estaGuardando}
                            onClick={() => confirmarRiesgo(r)}
                            title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : "Guardar este riesgo/oportunidad en la base de datos"}
                          >
                            {estaGuardando ? '⏳' : '💾 Confirmar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {riesgosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={14} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
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