/**
 * PlanificacionCambiosPage.tsx — §6.3 ISO 9001:2015 (CORREGIDO)
 *
 * Fix principal: el módulo ahora funciona 100% en memoria sin necesidad
 * de BD. Los cambios se guardan localmente de forma inmediata y se
 * intentan persistir en BD en segundo plano. El código se auto-genera
 * si el usuario no lo llena. Los filtros usan comparación robusta.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import '../iso-module.css'
import './PlanificacionCambiosPage.css'
import { planificacionCambiosService } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

/* ═══════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════ */
type CategoriaCambio =
  | 'Tecnológico' | 'Proceso' | 'Estructura SGC' | 'Infraestructura'
  | 'Recursos Humanos' | 'Normativo / Legal' | 'Estratégico' | 'Otro'

type EstadoCambio =
  | 'Planificado' | 'En Ejecución' | 'Completado' | 'Suspendido' | 'Cancelado'

type ImpactoCambio = 'Alto' | 'Medio' | 'Bajo'

interface Cambio {
  id:                   number
  codigo:               string
  categoria:            CategoriaCambio
  descripcion:          string
  justificacion:        string
  responsable:          string
  recursos:             string
  implicaciones:        string
  acciones:             string
  fecha_inicio:         string
  fecha_fin:            string
  impacto:              ImpactoCambio
  estado:               EstadoCambio
  procesos_afectados:   string
  documentos_afectados: string
  aprobado_por:         string
  observaciones:        string
  /** true una vez confirmado que existe en BD con este id (no viaja al backend) */
  _persisted?:          boolean
  /** true si el último intento de guardar/actualizar en BD falló (no viaja al backend) */
  _sinGuardar?:         boolean
}

type FormData = Omit<Cambio, 'id'> & { id?: number }

/* ═══════════════════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════════════════ */
const CATEGORIAS: CategoriaCambio[] = [
  'Tecnológico', 'Proceso', 'Estructura SGC', 'Infraestructura',
  'Recursos Humanos', 'Normativo / Legal', 'Estratégico', 'Otro',
]

const ESTADOS: EstadoCambio[] = [
  'Planificado', 'En Ejecución', 'Completado', 'Suspendido', 'Cancelado',
]

const PREFIJOS: Record<CategoriaCambio, string> = {
  'Tecnológico':       'CT',
  'Proceso':           'CP',
  'Estructura SGC':    'CS',
  'Infraestructura':   'CI',
  'Recursos Humanos':  'CR',
  'Normativo / Legal': 'CN',
  'Estratégico':       'CE',
  'Otro':              'CO',
}

const EMPTY_FORM: FormData = {
  codigo: '', categoria: 'Tecnológico', descripcion: '', justificacion: '',
  responsable: '', recursos: '', implicaciones: '', acciones: '',
  fecha_inicio: '', fecha_fin: '', impacto: 'Medio', estado: 'Planificado',
  procesos_afectados: '', documentos_afectados: '', aprobado_por: '', observaciones: '',
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function estadoClass(estado: string): string {
  const map: Record<string, string> = {
    'Planificado':  'pc-badge--planificado',
    'En Ejecución': 'pc-badge--ejecucion',
    'Completado':   'pc-badge--completado',
    'Suspendido':   'pc-badge--suspendido',
    'Cancelado':    'pc-badge--cancelado',
  }
  return map[estado] ?? 'pc-badge--planificado'
}

function impactoClass(impacto: string): string {
  const map: Record<string, string> = {
    'Alto':  'pc-impacto--alto',
    'Medio': 'pc-impacto--medio',
    'Bajo':  'pc-impacto--bajo',
  }
  return map[impacto] ?? 'pc-impacto--medio'
}

function categoriaIcon(cat: string): string {
  const map: Record<string, string> = {
    'Tecnológico': '💻', 'Proceso': '🔄', 'Estructura SGC': '📋',
    'Infraestructura': '🏗️', 'Recursos Humanos': '👥',
    'Normativo / Legal': '⚖️', 'Estratégico': '🧭', 'Otro': '📌',
  }
  return map[cat] ?? '📌'
}

function generarCodigo(cambios: Cambio[], categoria: CategoriaCambio): string {
  const prefijo   = PREFIJOS[categoria]
  const existentes = cambios.filter(c => c.codigo.startsWith(prefijo)).length
  return `${prefijo}-${String(existentes + 1).padStart(3, '0')}`
}

/* ═══════════════════════════════════════════════════════════════
   KPI CARD
   ═══════════════════════════════════════════════════════════════ */
const KPICard: React.FC<{
  value: string | number; label: string; color: string; icon: string
}> = ({ value, label, color, icon }) => (
  <div className="pc-kpi" style={{ borderTop: `3px solid ${color}` }}>
    <span className="pc-kpi__icon">{icon}</span>
    <span className="pc-kpi__value" style={{ color }}>{value}</span>
    <span className="pc-kpi__label">{label}</span>
  </div>
)

/* ═══════════════════════════════════════════════════════════════
   MODAL FORMULARIO
   ═══════════════════════════════════════════════════════════════ */
interface FormModalProps {
  initial:  FormData
  cambios:  Cambio[]
  onSave:   (c: FormData) => void
  onClose:  () => void
}

const FormModal: React.FC<FormModalProps> = ({ initial, cambios, onSave, onClose }) => {
  const [form, setForm] = useState<FormData>({ ...initial })
  const [tab,  setTab]  = useState<'general' | 'detalle' | 'control'>('general')

  const set = useCallback((field: keyof FormData, value: string) =>
    setForm(p => ({ ...p, [field]: value })), [])

  const { isReadOnly } = usePermissions('planificacion_cambios')

  const handleCategoria = useCallback((cat: CategoriaCambio) => {
    setForm(p => ({
      ...p,
      categoria: cat,
      codigo: p.codigo || generarCodigo(cambios, cat),
    }))
  }, [cambios])

  const handleGuardar = () => {
    if (!form.descripcion.trim()) { alert('La descripción es obligatoria.'); return }
    if (!form.justificacion.trim()) { alert('La justificación es obligatoria.'); return }
    if (!form.responsable.trim()) { alert('El responsable es obligatorio.'); return }

    const codigo = form.codigo.trim() || generarCodigo(cambios, form.categoria)
    onSave({ ...form, codigo })
  }

  const isEdit = !!form.id

  return (
    <div className="iso-modal-overlay" onClick={onClose}>
      <div className="iso-modal pc-modal" onClick={e => e.stopPropagation()}>

        <div className="pc-modal__header">
          <h2>{isEdit ? '✏️ Editar Cambio' : '➕ Registrar Cambio Planificado'}</h2>
          {form.codigo && <span className="pc-modal__codigo">{form.codigo}</span>}
        </div>

        {/* Tabs */}
        <div className="iso-tabs">
          <button className={`iso-tab-btn${tab === 'general'  ? ' active' : ''}`} onClick={() => setTab('general')}>📋 General</button>
          <button className={`iso-tab-btn${tab === 'detalle'  ? ' active' : ''}`} onClick={() => setTab('detalle')}>🔍 Detalle</button>
          <button className={`iso-tab-btn${tab === 'control'  ? ' active' : ''}`} onClick={() => setTab('control')}>✅ Control</button>
        </div>

        {/* ── Tab General ─── */}
        {tab === 'general' && (
          <>
            <div className="iso-form-row">
              <div className="iso-field">
                <label>Categoría del cambio *</label>
                <select value={form.categoria} onChange={e => handleCategoria(e.target.value as CategoriaCambio)} disabled={isReadOnly()}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{categoriaIcon(c)} {c}</option>)}
                </select>
              </div>
              <div className="iso-field">
                <label>Código</label>
                <input
                  value={form.codigo}
                  onChange={e => set('codigo', e.target.value)}
                  placeholder={generarCodigo(cambios, form.categoria)}
                  disabled={isEdit}
                />
              </div>
            </div>
            <div className="iso-form-row iso-form-row--full">
              <div className="iso-field">
                <label>Descripción del cambio *</label>
                <textarea rows={3} value={form.descripcion} readOnly={isReadOnly()}
                  onChange={e => set('descripcion', e.target.value)}
                  placeholder="Describe el cambio planificado..." />
              </div>
            </div>
            <div className="iso-form-row iso-form-row--full">
              <div className="iso-field">
                <label>Justificación / Propósito *</label>
                <textarea rows={2} value={form.justificacion} readOnly={isReadOnly()}
                  onChange={e => set('justificacion', e.target.value)}
                  placeholder="¿Por qué se realiza este cambio?" />
              </div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field">
                <label>Impacto *</label>
                <select value={form.impacto} onChange={e => set('impacto', e.target.value as ImpactoCambio)} disabled={isReadOnly()}>
                  <option value="Alto">Alto</option>
                  <option value="Medio">Medio</option>
                  <option value="Bajo">Bajo</option>
                </select>
              </div>
              <div className="iso-field">
                <label>Estado *</label>
                <select value={form.estado} onChange={e => set('estado', e.target.value as EstadoCambio)} disabled={isReadOnly()}>
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {/* ── Tab Detalle ─── */}
        {tab === 'detalle' && (
          <>
            <div className="iso-form-row iso-form-row--full">
              <div className="iso-field">
                <label>Acciones / Pasos para implementar el cambio</label>
                <textarea rows={3} value={form.acciones} readOnly={isReadOnly()}
                  onChange={e => set('acciones', e.target.value)}
                  placeholder={'1. Levantar requerimientos\n2. Asignar recursos\n3. Ejecutar\n4. Verificar'} />
              </div>
            </div>
            <div className="iso-form-row iso-form-row--full">
              <div className="iso-field">
                <label>Implicaciones si no se realiza el cambio</label>
                <textarea rows={2} value={form.implicaciones} readOnly={isReadOnly()}
                  onChange={e => set('implicaciones', e.target.value)}
                  placeholder="Consecuencias de no ejecutar el cambio..." />
              </div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field">
                <label>Procesos afectados</label>
                <input value={form.procesos_afectados} onChange={e => set('procesos_afectados', e.target.value)} readOnly={isReadOnly()}
                  placeholder="Ej: Gestión de Calidad, Producción..." />
              </div>
              <div className="iso-field">
                <label>Documentos afectados</label>
                <input value={form.documentos_afectados} onChange={e => set('documentos_afectados', e.target.value)} readOnly={isReadOnly()}
                  placeholder="Ej: Manual de Calidad, Procedimientos..." />
              </div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field">
                <label>Recursos necesarios</label>
                <input value={form.recursos} onChange={e => set('recursos', e.target.value)} readOnly={isReadOnly()}
                  placeholder="Presupuesto, personal, equipos..." />
              </div>
            </div>
          </>
        )}

        {/* ── Tab Control ─── */}
        {tab === 'control' && (
          <>
            <div className="iso-form-row">
              <div className="iso-field">
                <label>Responsable *</label>
                <input value={form.responsable} onChange={e => set('responsable', e.target.value)} readOnly={isReadOnly()}
                  placeholder="Director de Calidad, Gerente de TI..." />
              </div>
              <div className="iso-field">
                <label>Aprobado por</label>
                <input value={form.aprobado_por} onChange={e => set('aprobado_por', e.target.value)} readOnly={isReadOnly()}
                  placeholder="Alta dirección, Comité de Calidad..." />
              </div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field">
                <label>Fecha de inicio</label>
                <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} readOnly={isReadOnly()} />
              </div>
              <div className="iso-field">
                <label>Fecha de finalización</label>
                <input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} readOnly={isReadOnly()} />
              </div>
            </div>
            <div className="iso-form-row iso-form-row--full">
              <div className="iso-field">
                <label>Observaciones / Evidencias</label>
                <textarea rows={3} value={form.observaciones} readOnly={isReadOnly()}
                  onChange={e => set('observaciones', e.target.value)}
                  placeholder="Notas adicionales, resultados, lecciones aprendidas..." />
              </div>
            </div>
          </>
        )}

        <div className="iso-modal__footer">
          <button className="iso-btn-secondary" onClick={onClose}>Cancelar</button>
          {!isReadOnly() && (
            <button className="iso-btn-primary" onClick={handleGuardar}>💾 Guardar cambio</button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FILA EXPANDIBLE
   ═══════════════════════════════════════════════════════════════ */
interface MatrizRowProps {
  cambio:   Cambio
  onEdit:   (c: Cambio) => void
  onDelete: (id: number) => void
  onRetry:  (c: Cambio) => void
}

const MatrizRow: React.FC<MatrizRowProps> = ({ cambio, onEdit, onDelete, onRetry }) => {
  const [expanded, setExpanded] = useState(false)
  const { canEdit, canDelete } = usePermissions('planificacion_cambios')

  const diasRestantes = (() => {
    if (!cambio.fecha_fin) return null
    if (cambio.estado === 'Completado' || cambio.estado === 'Cancelado') return null
    return Math.ceil((new Date(cambio.fecha_fin).getTime() - Date.now()) / 86400000)
  })()

  return (
    <>
      <tr className="pc-matrix-row" onClick={() => setExpanded(v => !v)}>
        <td>
          <span className="pc-matrix__code">{cambio.codigo}</span>
          {cambio._sinGuardar && (
            <span className="pc-badge-singuardar" title="No se pudo guardar en la base de datos — usa 'Reintentar guardado'">
              ⚠️ Sin guardar
            </span>
          )}
        </td>
        <td>
          <span className="pc-categoria">
            {categoriaIcon(cambio.categoria)} {cambio.categoria}
          </span>
        </td>
        <td className="pc-matrix__desc">
          <span className="pc-matrix__desc-text">{cambio.descripcion}</span>
        </td>
        <td className="pc-matrix__justif">{cambio.justificacion}</td>
        <td>
          <span className={`pc-impacto ${impactoClass(cambio.impacto)}`}>{cambio.impacto}</span>
        </td>
        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{cambio.responsable}</td>
        <td>{cambio.fecha_inicio && <span className="pc-fecha">{cambio.fecha_inicio}</span>}</td>
        <td>
          {cambio.fecha_fin && (
            <div className="pc-fecha-fin-cell">
              <span className="pc-fecha">{cambio.fecha_fin}</span>
              {diasRestantes !== null && (
                <span className={`pc-dias ${diasRestantes < 0 ? 'pc-dias--vencido' : diasRestantes <= 7 ? 'pc-dias--urgente' : 'pc-dias--ok'}`}>
                  {diasRestantes < 0 ? `${Math.abs(diasRestantes)}d vencido` : `${diasRestantes}d restantes`}
                </span>
              )}
            </div>
          )}
        </td>
        <td><span className={`pc-badge ${estadoClass(cambio.estado)}`}>{cambio.estado}</span></td>
        <td onClick={e => e.stopPropagation()}>
          <div className="pc-matrix__actions">
            {cambio._sinGuardar && (
              <button className="iso-btn-icon" title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : "Reintentar guardado en la base de datos"}
                onClick={() => onRetry(cambio)} disabled={!canEdit}>🔄</button>
            )}
            <button className="iso-btn-icon" title={!canEdit ? 'Tu rol no tiene permiso para editar' : "Editar"} onClick={() => onEdit(cambio)} disabled={!canEdit}>✏️</button>
            <PermissionGuard recurso="planificacion_cambios" accion="eliminar" mode="hide">
              <button className="iso-btn-icon danger" title="Eliminar" onClick={() => onDelete(cambio.id)}>🗑️</button>
            </PermissionGuard>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="pc-expand-row">
          <td colSpan={10}>
            <div className="pc-expand-content">
              <div className="pc-expand-chips">
                {cambio.procesos_afectados && (
                  <div className="pc-expand-chip">
                    <span className="pc-expand-chip__label">🔄 Procesos afectados</span>
                    <span>{cambio.procesos_afectados}</span>
                  </div>
                )}
                {cambio.documentos_afectados && (
                  <div className="pc-expand-chip">
                    <span className="pc-expand-chip__label">📄 Documentos afectados</span>
                    <span>{cambio.documentos_afectados}</span>
                  </div>
                )}
                {cambio.recursos && (
                  <div className="pc-expand-chip">
                    <span className="pc-expand-chip__label">🔧 Recursos</span>
                    <span>{cambio.recursos}</span>
                  </div>
                )}
                {cambio.aprobado_por && (
                  <div className="pc-expand-chip">
                    <span className="pc-expand-chip__label">✅ Aprobado por</span>
                    <span>{cambio.aprobado_por}</span>
                  </div>
                )}
              </div>
              <div className="pc-expand-cols">
                {cambio.acciones && (
                  <div className="pc-expand-block">
                    <h4>📝 Acciones / Pasos</h4>
                    <p>{cambio.acciones}</p>
                  </div>
                )}
                {cambio.implicaciones && (
                  <div className="pc-expand-block">
                    <h4>⚠️ Implicaciones si no se ejecuta</h4>
                    <p>{cambio.implicaciones}</p>
                  </div>
                )}
                {cambio.observaciones && (
                  <div className="pc-expand-block">
                    <h4>💬 Observaciones</h4>
                    <p>{cambio.observaciones}</p>
                  </div>
                )}
              </div>
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
const PlanificacionCambiosPage: React.FC = () => {
  const [cambios,       setCambios]       = useState<Cambio[]>([])
  const [loading,       setLoading]       = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [editItem,      setEditItem]      = useState<Cambio | null>(null)
  const [filterEstado,  setFilterEstado]  = useState('todos')
  const [filterCat,     setFilterCat]     = useState('todos')
  const [filterImpacto, setFilterImpacto] = useState('todos')
  const [search,        setSearch]        = useState('')

  const { canCreate } = usePermissions('planificacion_cambios')

  /* ── Cargar desde BD ──────────────────────────────────── */
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    planificacionCambiosService.getAll()
      .then(data => {
        if (!cancelled && Array.isArray(data)) {
          setCambios(data.map((c: any) => ({ ...c, _persisted: true, _sinGuardar: false })))
        }
      })
      .catch(e => console.warn('No se pudieron cargar los cambios planificados guardados en BD:', e))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  /** Quita los campos internos (no existen como columnas en BD) antes de enviar. */
  const toPayload = (c: FormData | Cambio) => {
    const { id: _id, _persisted, _sinGuardar, ...payload } = c as Cambio
    return payload
  }

  /* ── Guardar (con persistencia optimista + reintento en caso de fallo) ── */
  const handleSave = useCallback(async (form: FormData) => {
    if (form.id) {
      /* ── EDITAR: actualizar inmediatamente en UI ── */
      const actualizado: Cambio = { ...(form as Cambio), _sinGuardar: false }
      setCambios(prev => prev.map(c => c.id === form.id ? actualizado : c))
      setShowForm(false)
      setEditItem(null)

      try {
        await planificacionCambiosService.update(form.id, toPayload(form))
        setCambios(prev => prev.map(c => c.id === form.id ? { ...c, _persisted: true, _sinGuardar: false } : c))
      } catch (e: any) {
        setCambios(prev => prev.map(c => c.id === form.id ? { ...c, _sinGuardar: true } : c))
        alert(`El cambio se muestra en pantalla, pero no se pudo guardar en la base de datos: ${e.message || e}\n` +
              'Usa el botón "🔄 Reintentar guardado" en la fila, o se perderá al recargar la página.')
      }

    } else {
      /* ── CREAR: mostrar en UI de inmediato con ID temporal ── */
      const tempId   = Date.now()
      const tempItem: Cambio = { ...form, id: tempId, _persisted: false, _sinGuardar: false } as Cambio
      setCambios(prev => [tempItem, ...prev])
      setShowForm(false)
      setEditItem(null)

      try {
        const creado = await planificacionCambiosService.create(toPayload(form))
        setCambios(prev => prev.map(c => c.id === tempId ? { ...creado, _persisted: true, _sinGuardar: false } : c))
      } catch (e: any) {
        setCambios(prev => prev.map(c => c.id === tempId ? { ...c, _sinGuardar: true } : c))
        alert(`El cambio se muestra en pantalla, pero no se pudo guardar en la base de datos: ${e.message || e}\n` +
              'Usa el botón "🔄 Reintentar guardado" en la fila, o se perderá al recargar la página.')
      }
    }
  }, [])

  /* ── Reintentar guardado de una fila marcada como "sin guardar" ── */
  const reintentarGuardado = useCallback(async (c: Cambio) => {
    try {
      if (c._persisted) {
        await planificacionCambiosService.update(c.id, toPayload(c))
        setCambios(prev => prev.map(x => x.id === c.id ? { ...x, _sinGuardar: false } : x))
      } else {
        const creado = await planificacionCambiosService.create(toPayload(c))
        setCambios(prev => prev.map(x => x.id === c.id ? { ...creado, _persisted: true, _sinGuardar: false } : x))
      }
    } catch (e: any) {
      alert(`Sigue sin poderse guardar en la base de datos: ${e.message || e}`)
    }
  }, [])

  /* ── Eliminar (con reversión si falla en BD) ───────────── */
  const handleDelete = useCallback(async (id: number) => {
    const cambio = cambios.find(c => c.id === id)
    if (!cambio) return
    if (!confirm(`¿Eliminar "${cambio.codigo} — ${cambio.descripcion.slice(0, 60)}"?`)) return

    /* Quitar de la UI de inmediato */
    setCambios(prev => prev.filter(c => c.id !== id))

    if (!cambio._persisted) return  // nunca llegó a existir en BD, no hay nada que borrar ahí

    try {
      await planificacionCambiosService.delete(id)
    } catch (e: any) {
      /* Revertir: el borrado en BD falló, no ocultamos el dato */
      setCambios(prev => [cambio, ...prev])
      alert(`No se pudo eliminar "${cambio.codigo}" de la base de datos, se restauró en la lista: ${e.message || e}`)
    }
  }, [cambios])

  /* ── Filtros ──────────────────────────────────────────── */
  const filtered = useMemo(() => {
    return cambios.filter(c => {
      const estadoOk   = filterEstado  === 'todos' || (c.estado    ?? '') === filterEstado
      const catOk      = filterCat     === 'todos' || (c.categoria ?? '') === filterCat
      const impactoOk  = filterImpacto === 'todos' || (c.impacto   ?? '') === filterImpacto
      const searchOk   = !search.trim() || (
        (c.descripcion  ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.codigo       ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.responsable  ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.justificacion ?? '').toLowerCase().includes(search.toLowerCase())
      )
      return estadoOk && catOk && impactoOk && searchOk
    })
  }, [cambios, filterEstado, filterCat, filterImpacto, search])

  /* ── KPIs ─────────────────────────────────────────────── */
  const total       = cambios.length
  const planif      = cambios.filter(c => c.estado === 'Planificado').length
  const ejecucion   = cambios.filter(c => c.estado === 'En Ejecución').length
  const completados = cambios.filter(c => c.estado === 'Completado').length
  const altos       = cambios.filter(c => c.impacto === 'Alto').length
  const vencidos    = cambios.filter(c => {
    if (!c.fecha_fin) return false
    if (c.estado === 'Completado' || c.estado === 'Cancelado') return false
    return new Date(c.fecha_fin) < new Date()
  }).length

  const formInitial: FormData = editItem
    ? { ...editItem }
    : { ...EMPTY_FORM }

  return (
    <div className="iso-page pc-page">

      {/* ── Header ──────────────────────────────────────── */}
      <header className="iso-page__header">
        <div className="iso-page__title-block">
          <nav className="pc-breadcrumb">
            <span>Governex</span>
            <span className="pc-breadcrumb__sep">›</span>
            <span>Cap. 6.3</span>
            <span className="pc-breadcrumb__sep">›</span>
            <span className="pc-breadcrumb__active">Planificación de los Cambios</span>
          </nav>
          <h1>Planificación de los Cambios</h1>
          <p>Registro y seguimiento de todos los cambios planificados que afectan al SGC · Cláusula 6.3</p>
          <span className="iso-page__clause">Cláusula 6.3</span>
        </div>
        <button className="iso-btn-primary pc-btn-add" onClick={() => { setEditItem(null); setShowForm(true) }} disabled={!canCreate} title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}>
          ➕ Registrar cambio
        </button>
      </header>

      {/* ── KPIs ────────────────────────────────────────── */}
      <div className="pc-kpis">
        <KPICard value={total}       label="Total cambios"  color="#1a6ebd" icon="📋" />
        <KPICard value={planif}      label="Planificados"   color="#7c3aed" icon="🗓️" />
        <KPICard value={ejecucion}   label="En ejecución"   color="#d97706" icon="⚙️" />
        <KPICard value={completados} label="Completados"    color="#059669" icon="✅" />
        <KPICard value={altos}       label="Impacto alto"   color="#dc2626" icon="🔴" />
        <KPICard value={vencidos}    label="Vencidos"       color="#b91c1c" icon="⏰" />
      </div>

      {/* ── Info ISO ────────────────────────────────────── */}
      <div className="iso-info-box">
        <span className="iso-info-box__icon">ℹ️</span>
        <span>
          Cláusula 6.3 — Los cambios en el SGC deben llevarse a cabo de manera planificada,
          considerando: el <em>propósito y consecuencias</em>, la <em>integridad del SGC</em>,
          la <em>disponibilidad de recursos</em> y la <em>asignación de responsabilidades</em>.
        </span>
      </div>

      {/* ── Filtros ─────────────────────────────────────── */}
      <div className="iso-topbar">
        <span className="iso-topbar__info">
          Mostrando <strong>{filtered.length}</strong> de <strong>{cambios.length}</strong> cambios
        </span>
        <div className="iso-topbar__actions">
          <input className="pc-search" type="text" placeholder="🔍 Buscar..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="pc-filter" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="todos">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{categoriaIcon(c)} {c}</option>)}
          </select>
          <select className="pc-filter" value={filterImpacto} onChange={e => setFilterImpacto(e.target.value)}>
            <option value="todos">Todos los impactos</option>
            <option value="Alto">🔴 Alto</option>
            <option value="Medio">🟡 Medio</option>
            <option value="Bajo">🟢 Bajo</option>
          </select>
          <select className="pc-filter" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
            <option value="todos">Todos los estados</option>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* ── Matriz ──────────────────────────────────────── */}
      <div className="iso-table-wrapper pc-matrix-wrapper">
        {loading ? (
          <div className="iso-empty"><div className="iso-empty__icon">⏳</div>Cargando...</div>
        ) : cambios.length === 0 ? (
          <div className="iso-empty">
            <div className="iso-empty__icon">🔄</div>
            No hay cambios registrados. Haz clic en "Registrar cambio" para comenzar.
          </div>
        ) : filtered.length === 0 ? (
          <div className="iso-empty">
            <div className="iso-empty__icon">🔍</div>
            Ningún cambio coincide con los filtros. <button
              style={{ marginLeft:'0.5rem', background:'none', border:'none', color:'#1a6ebd', cursor:'pointer', textDecoration:'underline' }}
              onClick={() => { setFilterEstado('todos'); setFilterCat('todos'); setFilterImpacto('todos'); setSearch('') }}>
              Limpiar filtros
            </button>
          </div>
        ) : (
          <table className="iso-table pc-matrix">
            <thead>
              <tr>
                <th>Código</th>
                <th>Categoría</th>
                <th>Descripción del cambio</th>
                <th>Justificación</th>
                <th>Impacto</th>
                <th>Responsable</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(cambio => (
                <MatrizRow
                  key={cambio.id}
                  cambio={cambio}
                  onEdit={c => { setEditItem(c); setShowForm(true) }}
                  onDelete={handleDelete}
                  onRetry={reintentarGuardado}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal ───────────────────────────────────────── */}
      {showForm && (
        <FormModal
          initial={formInitial}
          cambios={cambios}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        />
      )}

    </div>
  )
}

export default PlanificacionCambiosPage