/**
 * ObjetivosCalidadPage.tsx — §6.2 ISO 9001:2015
 *
 * Los objetivos se generan AUTOMÁTICAMENTE desde los riesgos y oportunidades
 * derivados del análisis IA en §6.1. El usuario puede revisar, ajustar y
 * guardar cada objetivo antes de confirmarlo en la matriz definitiva.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import './ObjetivosCalidadPage.css'
import {
  useAIAnalysis,
  derivarObjetivos,
  ObjetivoDerivado,
  FrecuenciaMedicion,
} from '../../context/AIAnalysisContext'
import { objetivosCalidadService } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

/* ─── Tipos locales ──────────────────────────────────────────── */
type EstadoObjetivo = 'Pendiente' | 'En Progreso' | 'Cumplido' | 'No Cumplido'
type EstadoMedicion = 'Cumplido' | 'En Progreso' | 'No Cumplido'

interface Medicion {
  id?:         number
  periodo:     string
  valor:       number
  estado:      EstadoMedicion
  comentario?: string
  fecha?:      string
}

/* ObjetivoCalidad = ObjetivoDerivado extendido con id y mediciones reales */
interface ObjetivoCalidad extends Omit<ObjetivoDerivado, 'estado' | 'mediciones'> {
  id?:          number
  estado:       EstadoObjetivo
  mediciones:   Medicion[]
  _guardado:    boolean   // true = ya fue confirmado/guardado
}

/* ─── Constantes ─────────────────────────────────────────────── */
const FRECUENCIAS: FrecuenciaMedicion[] = [
  'Mensual', 'Bimestral', 'Trimestral', 'Cuatrimestral', 'Semestral', 'Anual',
]

/* ─── Helpers visuales ───────────────────────────────────────── */
function estadoBadge(estado: string) {
  const map: Record<string, string> = {
    'Pendiente':   'oc-badge--pendiente',
    'En Progreso': 'oc-badge--progreso',
    'Cumplido':    'oc-badge--cumplido',
    'No Cumplido': 'oc-badge--nocumplido',
  }
  return map[estado] ?? 'oc-badge--pendiente'
}

function nivelBadge(nivel: number) {
  if (nivel >= 15) return { cls: 'oc-nivel--critico',    label: '🔴 CRÍTICO' }
  if (nivel >= 9)  return { cls: 'oc-nivel--alto',       label: '🟠 ALTO' }
  if (nivel >= 4)  return { cls: 'oc-nivel--medio',      label: '🟡 MEDIO' }
  return               { cls: 'oc-nivel--bajo',        label: '🟢 BAJO' }
}

/* ─── KPI Card ───────────────────────────────────────────────── */
const KPICard: React.FC<{ value: string | number; label: string; color: string }> = ({ value, label, color }) => (
  <div className="oc-kpi" style={{ borderTop: `3px solid ${color}` }}>
    <span className="oc-kpi__value" style={{ color }}>{value}</span>
    <span className="oc-kpi__label">{label}</span>
  </div>
)

/* ─── Empty State ────────────────────────────────────────────── */
const EmptyState: React.FC = () => (
  <div className="oc-empty-state">
    <div className="oc-empty-state__icon">🎯</div>
    <h3>Sin análisis de IA disponible</h3>
    <p>
      Para generar automáticamente los Objetivos de Calidad, primero debes completar
      el análisis con IA en el módulo <strong>"Contexto de la Organización"</strong>.
      Los objetivos se derivarán de los Riesgos y Oportunidades identificados en §6.1.
    </p>
    <ol className="oc-empty-state__steps">
      <li>Ve al módulo <strong>Contexto de la Organización</strong> (§4)</li>
      <li>Construye o carga el mapa de procesos</li>
      <li>Haz clic en <strong>"Guardar y Analizar con IA"</strong></li>
      <li>Regresa aquí — los objetivos se generarán automáticamente</li>
    </ol>
    <a href="/procesos" className="oc-empty-cta">Ir a Contexto de la Organización →</a>
  </div>
)

/* ─── Modal de edición de un objetivo ───────────────────────── */
interface EditModalProps {
  obj:     ObjetivoCalidad
  onSave:  (o: ObjetivoCalidad) => void
  onClose: () => void
}

const EditModal: React.FC<EditModalProps> = ({ obj, onSave, onClose }) => {
  const [form, setForm] = useState<ObjetivoCalidad>({ ...obj })
  const set = (k: keyof ObjetivoCalidad, v: string) =>
    setForm(p => ({ ...p, [k]: v }))

  const { isReadOnly } = usePermissions('objetivos_calidad')

  return (
    <div className="iso-modal-overlay" onClick={onClose}>
      <div className="iso-modal oc-modal" onClick={e => e.stopPropagation()}>
        <h2>✏️ Ajustar Objetivo — {form.codigo}</h2>
        <p className="oc-modal__hint">
          Revisa y ajusta los campos generados automáticamente antes de confirmar.
        </p>

        <div className="iso-form-row oc-form-row--full">
          <div className="iso-field">
            <label>Objetivo de Calidad *</label>
            <textarea rows={3} value={form.objetivo} readOnly={isReadOnly()}
              onChange={e => set('objetivo', e.target.value)} />
          </div>
        </div>

        <div className="iso-form-row oc-form-row--full">
          <div className="iso-field">
            <label>Fuente — Riesgo / Oportunidad origen</label>
            <textarea rows={2} value={form.fuente_riesgo_oportunidad} readOnly={isReadOnly()}
              onChange={e => set('fuente_riesgo_oportunidad', e.target.value)} />
          </div>
        </div>

        <div className="iso-form-row oc-form-row--full">
          <div className="iso-field">
            <label>Acción a desarrollar (Cómo) *</label>
            <textarea rows={3} value={form.accion} readOnly={isReadOnly()}
              onChange={e => set('accion', e.target.value)} />
          </div>
        </div>

        <div className="iso-form-row">
          <div className="iso-field">
            <label>Indicador *</label>
            <input value={form.indicador} onChange={e => set('indicador', e.target.value)} readOnly={isReadOnly()} />
          </div>
          <div className="iso-field">
            <label>Meta *</label>
            <input value={form.meta} onChange={e => set('meta', e.target.value)} readOnly={isReadOnly()} />
          </div>
        </div>

        <div className="iso-form-row">
          <div className="iso-field">
            <label>Frecuencia de medición *</label>
            <select value={form.frecuencia_medicion} disabled={isReadOnly()}
              onChange={e => set('frecuencia_medicion', e.target.value as FrecuenciaMedicion)}>
              {FRECUENCIAS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="iso-field">
            <label>Responsable *</label>
            <input value={form.responsable} onChange={e => set('responsable', e.target.value)} readOnly={isReadOnly()} />
          </div>
        </div>

        <div className="iso-form-row">
          <div className="iso-field">
            <label>Proceso relacionado</label>
            <input value={form.proceso_relacionado} readOnly={isReadOnly()}
              onChange={e => set('proceso_relacionado', e.target.value)}
              placeholder="Ej: Gestión de Calidad" />
          </div>
          <div className="iso-field">
            <label>Recursos necesarios</label>
            <input value={form.recursos} onChange={e => set('recursos', e.target.value)} readOnly={isReadOnly()} />
          </div>
        </div>

        <div className="iso-form-row">
          <div className="iso-field">
            <label>Fecha inicio</label>
            <input type="date" value={form.fecha_inicio} readOnly={isReadOnly()}
              onChange={e => set('fecha_inicio', e.target.value)} />
          </div>
          <div className="iso-field">
            <label>Fecha límite</label>
            <input type="date" value={form.fecha_fin} readOnly={isReadOnly()}
              onChange={e => set('fecha_fin', e.target.value)} />
          </div>
        </div>

        <div className="iso-form-row">
          <div className="iso-field">
            <label>Estado</label>
            <select value={form.estado} disabled={isReadOnly()}
              onChange={e => set('estado', e.target.value as EstadoObjetivo)}>
              <option>Pendiente</option>
              <option>En Progreso</option>
              <option>Cumplido</option>
              <option>No Cumplido</option>
            </select>
          </div>
        </div>

        <div className="iso-modal__footer">
          <button className="iso-btn-secondary" onClick={onClose}>Cancelar</button>
          {!isReadOnly() && (
            <button className="iso-btn-primary" onClick={() => onSave({ ...form, _guardado: true })}>
              ✅ Confirmar objetivo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Modal de medición ──────────────────────────────────────── */
interface MedicionModalProps {
  objetivo: ObjetivoCalidad
  onSave:   (m: Medicion) => void
  onClose:  () => void
}

const MedicionModal: React.FC<MedicionModalProps> = ({ objetivo, onSave, onClose }) => {
  const [form, setForm] = useState<Medicion>({
    periodo: '', valor: 0, estado: 'En Progreso', comentario: '',
    fecha: new Date().toISOString().slice(0, 10),
  })

  const { isReadOnly } = usePermissions('objetivos_calidad')

  return (
    <div className="iso-modal-overlay" onClick={onClose}>
      <div className="iso-modal" onClick={e => e.stopPropagation()}>
        <h2>📊 Registrar Medición — {objetivo.codigo}</h2>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#6b7280' }}>{objetivo.objetivo}</p>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#4a5e78' }}>
          Meta: <strong>{objetivo.meta}</strong> · Frecuencia: <strong>{objetivo.frecuencia_medicion}</strong>
        </p>

        <div className="iso-form-row">
          <div className="iso-field">
            <label>Período *</label>
            <input value={form.periodo} readOnly={isReadOnly()}
              onChange={e => setForm(p => ({ ...p, periodo: e.target.value }))}
              placeholder="Q1 2025, Sem-1 2025, Ene 2025..." />
          </div>
          <div className="iso-field">
            <label>Valor obtenido *</label>
            <input type="number" step="0.01" value={form.valor} readOnly={isReadOnly()}
              onChange={e => setForm(p => ({ ...p, valor: Number(e.target.value) }))} />
          </div>
        </div>

        <div className="iso-form-row">
          <div className="iso-field">
            <label>Estado *</label>
            <select value={form.estado} disabled={isReadOnly()}
              onChange={e => setForm(p => ({ ...p, estado: e.target.value as EstadoMedicion }))}>
              <option>En Progreso</option>
              <option>Cumplido</option>
              <option>No Cumplido</option>
            </select>
          </div>
          <div className="iso-field">
            <label>Fecha</label>
            <input type="date" value={form.fecha} readOnly={isReadOnly()}
              onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
          </div>
        </div>

        <div className="iso-form-row oc-form-row--full">
          <div className="iso-field">
            <label>Comentario / Evidencia</label>
            <textarea rows={2} value={form.comentario} readOnly={isReadOnly()}
              onChange={e => setForm(p => ({ ...p, comentario: e.target.value }))}
              placeholder="Observaciones, documentos de soporte..." />
          </div>
        </div>

        <div className="iso-modal__footer">
          <button className="iso-btn-secondary" onClick={onClose}>Cancelar</button>
          {!isReadOnly() && (
            <button className="iso-btn-primary" onClick={() => {
              if (!form.periodo) { alert('El período es obligatorio.'); return }
              onSave(form)
            }}>
              💾 Guardar medición
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Fila de la matriz ──────────────────────────────────────── */
interface MatrizRowProps {
  obj:      ObjetivoCalidad
  onEdit:   (o: ObjetivoCalidad) => void
  onDelete: (codigo: string) => void
  onMedir:  (o: ObjetivoCalidad) => void
}

const MatrizRow: React.FC<MatrizRowProps> = ({ obj, onEdit, onDelete, onMedir }) => {
  const [expanded, setExpanded] = useState(false)
  const nivel = nivelBadge(obj._riesgoNivel)
  const { canEdit, canDelete } = usePermissions('objetivos_calidad')

  return (
    <>
      <tr
        className={`oc-matrix-row ${!obj._guardado ? 'oc-matrix-row--borrador' : ''}`}
        onClick={() => setExpanded(v => !v)}
        title={!obj._guardado ? 'Generado automáticamente — haz clic en ✏️ para confirmar' : ''}
      >
        <td>
          <div className="oc-code-cell">
            <span className="oc-matrix__code">{obj.codigo}</span>
            {!obj._guardado && <span className="oc-draft-tag">Borrador</span>}
          </div>
        </td>
        <td>
          <span className={`oc-tipo ${obj.tipo_fuente === 'Oportunidad' ? 'oc-tipo--oportunidad' : 'oc-tipo--riesgo'}`}>
            {obj.tipo_fuente === 'Oportunidad' ? '🚀' : '⚠️'} {obj.tipo_fuente}
          </span>
        </td>
        <td>
          <span className={`oc-nivel ${nivel.cls}`}>{nivel.label}</span>
        </td>
        <td className="oc-matrix__objetivo">{obj.objetivo}</td>
        <td className="oc-matrix__accion">{obj.accion}</td>
        <td style={{ fontSize: '0.8rem' }}>{obj.indicador}</td>
        <td><strong style={{ fontSize: '0.82rem' }}>{obj.meta}</strong></td>
        <td>
          <span className="oc-freq">{obj.frecuencia_medicion}</span>
        </td>
        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{obj.responsable}</td>
        <td>
          <span className={`oc-badge ${estadoBadge(obj.estado)}`}>{obj.estado}</span>
        </td>
        <td onClick={e => e.stopPropagation()}>
          <div className="oc-matrix__actions">
            {obj._guardado && (
              <button className="iso-btn-icon" title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : "Registrar medición"}
                onClick={() => onMedir(obj)} disabled={!canEdit}>📊</button>
            )}
            <button className="iso-btn-icon" title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : (obj._guardado ? 'Editar' : 'Revisar y confirmar')}
              onClick={() => onEdit(obj)} disabled={!canEdit}>
              {obj._guardado ? '✏️' : '✅'}
            </button>
            <PermissionGuard recurso="objetivos_calidad" accion="eliminar" mode="hide">
              <button className="iso-btn-icon danger" title="Eliminar"
                onClick={() => onDelete(obj.codigo)}>🗑️</button>
            </PermissionGuard>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="oc-expand-row">
          <td colSpan={11}>
            <div className="oc-expand-content">
              <div className="oc-expand-info">
                <div className="oc-expand-field">
                  <span className="oc-expand-label">R/O origen (§6.1):</span>
                  <span>{obj.fuente_riesgo_oportunidad || '—'}</span>
                </div>
                <div className="oc-expand-field">
                  <span className="oc-expand-label">Cód. R/O:</span>
                  <span className="oc-matrix__code">{obj._riesgoCodigo}</span>
                </div>
                {obj.proceso_relacionado && (
                  <div className="oc-expand-field">
                    <span className="oc-expand-label">Proceso:</span>
                    <span>{obj.proceso_relacionado}</span>
                  </div>
                )}
                {obj.recursos && (
                  <div className="oc-expand-field">
                    <span className="oc-expand-label">Recursos:</span>
                    <span>{obj.recursos}</span>
                  </div>
                )}
                {(obj.fecha_inicio || obj.fecha_fin) && (
                  <div className="oc-expand-field">
                    <span className="oc-expand-label">Vigencia:</span>
                    <span>{obj.fecha_inicio || '—'} → {obj.fecha_fin || '—'}</span>
                  </div>
                )}
              </div>

              {obj.mediciones.length > 0 ? (
                <div className="oc-mediciones">
                  <h4>Historial de mediciones</h4>
                  <table className="oc-med-table">
                    <thead>
                      <tr>
                        <th>Período</th><th>Valor</th><th>Estado</th>
                        <th>Fecha</th><th>Comentario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {obj.mediciones.map((m, i) => (
                        <tr key={m.id ?? i}>
                          <td>{m.periodo}</td>
                          <td><strong>{m.valor}</strong></td>
                          <td><span className={`oc-badge ${estadoBadge(m.estado)}`}>{m.estado}</span></td>
                          <td>{m.fecha ?? '—'}</td>
                          <td>{m.comentario ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : obj._guardado ? (
                <p className="oc-no-med">Sin mediciones aún. Usa 📊 para registrar la primera.</p>
              ) : (
                <p className="oc-no-med">
                  ⚠️ Este objetivo fue generado automáticamente. Haz clic en <strong>✅</strong> para revisarlo y confirmarlo.
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
const ObjetivosCalidadPage: React.FC = () => {
  const { analysis } = useAIAnalysis()

  /* Objetivos en estado local (borrador + confirmados) */
  const [objetivos,     setObjetivos]     = useState<ObjetivoCalidad[]>([])
  const [loadingBD,     setLoadingBD]     = useState(true)
  const [generando,     setGenerando]     = useState(false)
  const [editItem,      setEditItem]      = useState<ObjetivoCalidad | null>(null)
  const [medirItem,     setMedirItem]     = useState<ObjetivoCalidad | null>(null)
  const [filterEstado,  setFilterEstado]  = useState('todos')
  const [filterTipo,    setFilterTipo]    = useState('todos')
  const [filterGuard,   setFilterGuard]   = useState('todos')  // todos | borrador | confirmado
  const [search,        setSearch]        = useState('')

  const { canEdit, canCreate } = usePermissions('objetivos_calidad')

  /* ── Cargar objetivos guardados en BD ──────────────────────── */
  const cargarDesdeBD = useCallback(async () => {
    setLoadingBD(true)
    try {
      const data = await objetivosCalidadService.getAll()
      if (Array.isArray(data) && data.length > 0) {
        const fromBD: ObjetivoCalidad[] = data.map((r: any) => ({
          id:                        r.id,
          codigo:                    r.codigo,
          objetivo:                  r.objetivo,
          proceso_relacionado:       r.proceso_relacionado ?? '',
          fuente_riesgo_oportunidad: r.fuente_riesgo_oportunidad ?? '',
          tipo_fuente:               r.tipo_fuente,
          accion:                    r.accion,
          responsable:               r.responsable,
          recursos:                  r.recursos ?? '',
          frecuencia_medicion:       r.frecuencia_medicion,
          meta:                      r.meta,
          indicador:                 r.indicador,
          fecha_inicio:              r.fecha_inicio ?? '',
          fecha_fin:                 r.fecha_fin ?? '',
          estado:                    r.estado,
          mediciones:                Array.isArray(r.mediciones) ? r.mediciones : [],
          _guardado:                 true,
          _riesgoCodigo:             r._riesgo_codigo ?? '—',
          _riesgoNivel:              r._riesgo_nivel  ?? 0,
        }))
        setObjetivos(fromBD)
      }
    } catch (e) {
      console.warn('No se pudieron cargar los objetivos de calidad guardados en BD:', e)
    } finally {
      setLoadingBD(false)
    }
  }, [])

  useEffect(() => { cargarDesdeBD() }, [cargarDesdeBD])

  /* ── Generar objetivos desde análisis IA ───────────────────── */
  const generarDesdeIA = useCallback(() => {
    if (!analysis) return
    setGenerando(true)

    const derivados = derivarObjetivos(analysis)

    // Combinar: mantener los ya guardados, agregar los nuevos como borrador
    setObjetivos(prev => {
      const codigosGuardados = new Set(prev.map(o => o._riesgoCodigo))
      const nuevos: ObjetivoCalidad[] = derivados
        .filter(d => !codigosGuardados.has(d._riesgoCodigo))
        .map(d => ({
          ...d,
          estado:    'Pendiente' as EstadoObjetivo,
          mediciones: [],
          _guardado:  false,
        }))

      // Renumerar borradores para evitar colisión de códigos
      const confirmados = prev.filter(o => o._guardado)
      const borradores  = nuevos.map((o, i) => ({
        ...o,
        codigo: `OC-${String(confirmados.length + i + 1).padStart(3, '0')}`,
      }))

      return [...confirmados, ...borradores]
    })

    setTimeout(() => setGenerando(false), 400)
  }, [analysis])

  /* Generar automáticamente cuando el análisis esté disponible
     y no haya objetivos cargados todavía */
  useEffect(() => {
    if (!loadingBD && analysis && objetivos.length === 0) {
      generarDesdeIA()
    }
  }, [loadingBD, analysis])  // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Guardar un objetivo confirmado en BD ──────────────────── */
  const guardarEnBD = useCallback(async (obj: ObjetivoCalidad): Promise<ObjetivoCalidad> => {
    try {
      const payload = {
        codigo:                    obj.codigo,
        objetivo:                  obj.objetivo,
        proceso_relacionado:       obj.proceso_relacionado,
        fuente_riesgo_oportunidad: obj.fuente_riesgo_oportunidad,
        tipo_fuente:               obj.tipo_fuente,
        accion:                    obj.accion,
        responsable:               obj.responsable,
        recursos:                  obj.recursos,
        frecuencia_medicion:       obj.frecuencia_medicion,
        meta:                      obj.meta,
        indicador:                 obj.indicador,
        fecha_inicio:              obj.fecha_inicio || null,
        fecha_fin:                 obj.fecha_fin    || null,
        estado:                    obj.estado,
        /* campos extra para trazabilidad */
        _riesgo_codigo:            obj._riesgoCodigo,
        _riesgo_nivel:             obj._riesgoNivel,
      }

      if (obj.id) {
        const updated = await objetivosCalidadService.update(obj.id, payload)
        return { ...obj, ...updated, mediciones: obj.mediciones, _guardado: true }
      } else {
        const created = await objetivosCalidadService.create(payload)
        return { ...obj, id: created.id, _guardado: true }
      }
    } catch (e: any) {
      /* Re-lanzamos el error: NUNCA marcamos _guardado:true si el
         guardado en BD falló (antes esto quedaba oculto al usuario). */
      throw new Error(`No se pudo guardar "${obj.codigo}" en la base de datos: ${e.message || e}`)
    }
  }, [])

  /* ── Confirmar / editar objetivo ───────────────────────────── */
  const handleSave = useCallback(async (form: ObjetivoCalidad) => {
    try {
      const saved = await guardarEnBD(form)
      setObjetivos(prev => prev.map(o => o.codigo === saved.codigo ? saved : o))
      setEditItem(null)
    } catch (e: any) {
      alert(e.message || 'No se pudo guardar el objetivo.')
    }
  }, [guardarEnBD])

  /* ── Confirmar TODOS los borradores de una vez ─────────────── */
  const confirmarTodos = useCallback(async () => {
    const borradores = objetivos.filter(o => !o._guardado)
    if (borradores.length === 0) return
    if (!confirm(`¿Confirmar y guardar los ${borradores.length} objetivos generados automáticamente?`)) return

    const resultados = await Promise.allSettled(
      borradores.map(b => guardarEnBD({ ...b, _guardado: true }))
    )
    const actualizados = resultados
      .filter((r): r is PromiseFulfilledResult<ObjetivoCalidad> => r.status === 'fulfilled')
      .map(r => r.value)
    const fallidos = resultados.filter(r => r.status === 'rejected') as PromiseRejectedResult[]

    setObjetivos(prev =>
      prev.map(o => {
        const upd = actualizados.find(u => u.codigo === o.codigo)
        return upd ?? o
      })
    )
    if (fallidos.length > 0) {
      alert(`${fallidos.length} de ${borradores.length} objetivos no se pudieron guardar:\n` +
        fallidos.map(f => f.reason?.message || f.reason).join('\n'))
    }
  }, [objetivos, guardarEnBD])

  /* ── Eliminar objetivo ─────────────────────────────────────── */
  const handleDelete = useCallback(async (codigo: string) => {
    const obj = objetivos.find(o => o.codigo === codigo)
    if (!confirm(`¿Eliminar el objetivo ${codigo}?`)) return
    if (obj?.id) {
      try {
        await objetivosCalidadService.delete(obj.id)
      } catch (e: any) {
        alert(`No se pudo eliminar "${codigo}" de la base de datos: ${e.message || e}`)
        return  // no lo quitamos localmente si el backend no lo eliminó
      }
    }
    setObjetivos(prev => prev.filter(o => o.codigo !== codigo))
  }, [objetivos])

  /* ── Registrar medición ────────────────────────────────────── */
  const handleMedicion = useCallback(async (objetivo: ObjetivoCalidad, medicion: Medicion) => {
    let saved: Medicion = medicion
    if (objetivo.id) {
      try {
        saved = await objetivosCalidadService.addMedicion(objetivo.id, medicion)
      } catch (e: any) {
        alert(`No se pudo guardar la medición en la base de datos: ${e.message || e}`)
        return
      }
    } else {
      alert('Este objetivo aún es un borrador (no está confirmado en BD). ' +
            'La medición se guardará solo en esta sesión hasta que confirmes el objetivo.')
    }
    setObjetivos(prev => prev.map(o =>
      o.codigo === objetivo.codigo
        ? { ...o, mediciones: [{ ...saved, id: saved.id ?? Date.now() }, ...o.mediciones] }
        : o
    ))
    setMedirItem(null)
  }, [])

  /* ── Filtros ────────────────────────────────────────────────── */
  const filtered = useMemo(() => objetivos.filter(o => {
    if (filterEstado !== 'todos' && o.estado       !== filterEstado)  return false
    if (filterTipo   !== 'todos' && o.tipo_fuente  !== filterTipo)    return false
    if (filterGuard  === 'borrador'   && o._guardado)                 return false
    if (filterGuard  === 'confirmado' && !o._guardado)                return false
    if (search) {
      const q = search.toLowerCase()
      if (!o.objetivo.toLowerCase().includes(q) &&
          !o.codigo.toLowerCase().includes(q)   &&
          !o.responsable.toLowerCase().includes(q)) return false
    }
    return true
  }), [objetivos, filterEstado, filterTipo, filterGuard, search])

  /* ── KPIs ───────────────────────────────────────────────────── */
  const confirmados   = objetivos.filter(o => o._guardado).length
  const borradores    = objetivos.filter(o => !o._guardado).length
  const cumplidos     = objetivos.filter(o => o.estado === 'Cumplido').length
  const enProgreso    = objetivos.filter(o => o.estado === 'En Progreso').length
  const pct           = objetivos.length > 0
    ? Math.round((cumplidos / objetivos.length) * 100) : 0

  /* ── Sin análisis IA ────────────────────────────────────────── */
  if (!analysis) {
    return (
      <div className="iso-page oc-page">
        <header className="iso-page__header">
          <div className="iso-page__title-block">
            <nav className="oc-breadcrumb">
              <span>Governex</span><span className="oc-breadcrumb__sep">›</span>
              <span>Cap. 6.2</span><span className="oc-breadcrumb__sep">›</span>
              <span className="oc-breadcrumb__active">Objetivos de Calidad</span>
            </nav>
            <h1>Objetivos de Calidad</h1>
            <span className="iso-page__clause">Cláusula 6.2</span>
          </div>
        </header>
        <EmptyState />
      </div>
    )
  }

  /* ── Vista principal ────────────────────────────────────────── */
  return (
    <div className="iso-page oc-page">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="iso-page__header">
        <div className="iso-page__title-block">
          <nav className="oc-breadcrumb">
            <span>Governex</span><span className="oc-breadcrumb__sep">›</span>
            <span>Cap. 6.2</span><span className="oc-breadcrumb__sep">›</span>
            <span className="oc-breadcrumb__active">Objetivos de Calidad</span>
          </nav>
          <h1>Objetivos de Calidad</h1>
          <p>Generados automáticamente desde los Riesgos y Oportunidades §6.1 · Cláusula 6.2</p>
          <span className="iso-page__clause">Cláusula 6.2</span>
        </div>
        <div className="oc-header-actions">
          {borradores > 0 && (
            <button className="iso-btn-primary oc-btn-confirm-all" onClick={confirmarTodos} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>
              ✅ Confirmar todos los borradores ({borradores})
            </button>
          )}
          <button
            className="iso-btn-secondary oc-btn-regen"
            onClick={generarDesdeIA}
            disabled={generando || !canCreate}
            title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : "Regenerar borradores desde el análisis IA actual"}
          >
            {generando ? '⏳ Generando...' : '🔄 Regenerar desde §6.1'}
          </button>
        </div>
      </header>

      {/* ── Banner borradores ───────────────────────────────────── */}
      {borradores > 0 && (
        <div className="oc-banner-borrador">
          <span className="oc-banner-borrador__icon">🤖</span>
          <div>
            <strong>{borradores} objetivo{borradores > 1 ? 's' : ''} generado{borradores > 1 ? 's' : ''} automáticamente</strong>
            {' '}a partir de los Riesgos y Oportunidades identificados en §6.1.
            Revisa cada uno con <strong>✅</strong> y ajusta los campos antes de confirmar,
            o usa <strong>"Confirmar todos"</strong> para guardarlos directamente.
          </div>
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────────────────── */}
      <div className="oc-kpis">
        <KPICard value={objetivos.length} label="Total objetivos"   color="#1a6ebd" />
        <KPICard value={confirmados}      label="Confirmados"        color="#059669" />
        <KPICard value={borradores}       label="Borradores IA"      color="#d97706" />
        <KPICard value={enProgreso}       label="En progreso"        color="#7c3aed" />
        <KPICard value={cumplidos}        label="Cumplidos"          color="#065f46" />
        <KPICard value={`${pct}%`}        label="% Cumplimiento"     color="#1e40af" />
      </div>

      {/* ── Info ISO ────────────────────────────────────────────── */}
      <div className="iso-info-box">
        <span className="iso-info-box__icon">ℹ️</span>
        <span>
          Los <strong>Objetivos de Calidad</strong> (§6.2) se generaron automáticamente
          a partir de los Riesgos y Oportunidades identificados en §6.1. Cada objetivo
          incluye <em>qué se hará</em>, <em>cómo se medirá</em>, <em>quién es responsable</em>
          y <em>con qué frecuencia</em> se evaluará. Los marcados como <strong>Borrador</strong> deben
          ser revisados y confirmados antes de su seguimiento formal.
        </span>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────── */}
      <div className="iso-topbar">
        <span className="iso-topbar__info">
          Mostrando <strong>{filtered.length}</strong> de <strong>{objetivos.length}</strong> objetivos
        </span>
        <div className="iso-topbar__actions">
          <input className="oc-search" type="text" placeholder="🔍 Buscar..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="oc-filter-select" value={filterTipo}
            onChange={e => setFilterTipo(e.target.value)}>
            <option value="todos">Todos los tipos</option>
            <option value="Riesgo">⚠️ Riesgo</option>
            <option value="Oportunidad">🚀 Oportunidad</option>
          </select>
          <select className="oc-filter-select" value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}>
            <option value="todos">Todos los estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="En Progreso">En Progreso</option>
            <option value="Cumplido">Cumplido</option>
            <option value="No Cumplido">No Cumplido</option>
          </select>
          <select className="oc-filter-select" value={filterGuard}
            onChange={e => setFilterGuard(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="confirmado">✅ Confirmados</option>
            <option value="borrador">📝 Borradores IA</option>
          </select>
        </div>
      </div>

      {/* ── Matriz ──────────────────────────────────────────────── */}
      <div className="iso-table-wrapper oc-matrix-wrapper">
        {loadingBD ? (
          <div className="iso-empty"><div className="iso-empty__icon">⏳</div>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="iso-empty">
            <div className="iso-empty__icon">🎯</div>
            {objetivos.length === 0
              ? 'No se generaron objetivos. Verifica que el análisis IA tenga riesgos y oportunidades.'
              : 'Ningún objetivo coincide con los filtros.'}
          </div>
        ) : (
          <table className="iso-table oc-matrix">
            <thead>
              <tr>
                <th>Código</th>
                <th>Tipo</th>
                <th>Nivel R/O</th>
                <th>Objetivo de Calidad</th>
                <th>Cómo (Acción)</th>
                <th>Indicador</th>
                <th>Meta</th>
                <th>Frecuencia</th>
                <th>Responsable</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(obj => (
                <MatrizRow
                  key={obj.codigo}
                  obj={obj}
                  onEdit={o => setEditItem(o)}
                  onDelete={handleDelete}
                  onMedir={o => setMedirItem(o)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modales ─────────────────────────────────────────────── */}
      {editItem && (
        <EditModal
          obj={editItem}
          onSave={handleSave}
          onClose={() => setEditItem(null)}
        />
      )}
      {medirItem && (
        <MedicionModal
          objetivo={medirItem}
          onSave={m => handleMedicion(medirItem, m)}
          onClose={() => setMedirItem(null)}
        />
      )}
    </div>
  )
}

export default ObjetivosCalidadPage