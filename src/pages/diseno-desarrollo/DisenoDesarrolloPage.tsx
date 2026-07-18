import React, { useState, useMemo, useEffect, useRef } from 'react'
import '../iso-module.css'
import { useAIAnalysis, ProyectoDiseno, CaracterizacionRow } from '../../context/AIAnalysisContext'
import { api } from '../../services/api'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

/* ── Helpers ──────────────────────────────────────────────────── */
const ETAPAS = ['Planificación', 'Desarrollo', 'Verificación', 'Validación', 'Completado'] as const
const ESTADOS = ['En tiempo', 'En riesgo', 'Retrasado'] as const

const etapaColor: Record<string, string> = {
  'Planificación': 'gris',
  'Desarrollo': 'azul',
  'Verificación': 'amarillo',
  'Validación': 'amarillo',
  'Completado': 'verde',
}

const emptyProyecto: Omit<ProyectoDiseno, 'id'> = {
  actividadId: undefined,
  entradas: '',
  desarrollo: '',
  control: '',
  responsable: '',
  fechaInicio: '',
  fechaEntrega: '',
  etapa: 'Planificación',
  estado: 'En tiempo',
}

/* ══════════════════════════════════════════════════════════════ */
const DisenoDesarrolloPage: React.FC = () => {
  const { canEdit } = usePermissions('diseno_desarrollo')
  const {
    analysis,
    proyectosDiseno,
    actividades,
    addProyectoDiseno,
    updateProyectoDiseno,
    removeProyectoDiseno,
  } = useAIAnalysis()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Partial<ProyectoDiseno>>({ ...emptyProyecto })
  const [isGeneratingControl, setIsGeneratingControl] = useState(false)
  const [errorControl, setErrorControl] = useState('')

  /* ── Procesos de la caracterización ─────────────────────────── */
  const caracterizacion: CaracterizacionRow[] = useMemo(
    () => analysis?.caracterizacion ?? [],
    [analysis],
  )

  /** Procesos y actividades que todavía NO se han confirmado como proyecto de diseño y son Desarrollo de Producto */
  const procesosPendientes = useMemo(() => {
    const fromCaracterizacion = caracterizacion
      .filter(row => 
        (row.proceso.toLowerCase().includes('desarrollo de producto') || row.proceso.toLowerCase().includes('diseño y desarrollo')) &&
        !proyectosDiseno.some(p => p.actividadId === row.codigo)
      )
      .map(row => ({
        codigo: row.codigo,
        proceso: row.proceso,
        entradas: row.entradas,
        responsable: row.responsable,
        salidas: row.salidas
      }));

    const fromActividades = actividades
      .filter(act => 
        (act.proceso.toLowerCase().includes('desarrollo de producto') || act.proceso.toLowerCase().includes('diseño y desarrollo')) &&
        !proyectosDiseno.some(p => p.actividadId === act.id)
      )
      .map(act => ({
        codigo: act.id,
        proceso: act.nombre,
        entradas: act.entradas.map(e => e.valor).join(', '),
        responsable: act.responsable,
        salidas: act.salidas.map(s => s.valor).join(', ')
      }));

    return [...fromCaracterizacion, ...fromActividades];
  }, [caracterizacion, actividades, proyectosDiseno]);

  const [generatingRows, setGeneratingRows] = useState<Set<string>>(new Set())

  /* ── Sincronizar eliminación ──────────────────────────────────── */
  useEffect(() => {
    proyectosDiseno.forEach(p => {
      if (p.actividadId) {
        const enCaracterizacion = caracterizacion.some(c => c.codigo === p.actividadId);
        const enActividades = actividades.some(a => a.id === p.actividadId);
        if (!enCaracterizacion && !enActividades) {
          removeProyectoDiseno(p.id);
        }
      }
    });
  }, [caracterizacion, actividades, proyectosDiseno, removeProyectoDiseno]);

  /* ── Auto-Confirmar procesos de la caracterización ──────────── */
  const procesadosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (procesosPendientes.length === 0) return;

    procesosPendientes.forEach(row => {
      if (procesadosRef.current.has(row.codigo)) return;
      procesadosRef.current.add(row.codigo);

      const newId = `PD-${row.codigo}-${Date.now()}`;
      const newProyecto: ProyectoDiseno = {
        id: newId,
        actividadId: row.codigo,
        entradas: row.entradas,
        desarrollo: row.proceso,
        responsable: row.responsable || '',
        control: '',
        fechaInicio: '',
        fechaEntrega: '',
        etapa: 'Planificación',
        estado: 'En tiempo',
      };
      
      // Se añade a la tabla inmediatamente pero con control vacío
      addProyectoDiseno(newProyecto);
    });
  }, [procesosPendientes, addProyectoDiseno]);

  /* ── Generar Control Manualmente (Tabla y Modal) ────────────── */
  const handleGenerateTableRow = async (p: ProyectoDiseno) => {
    setGeneratingRows(prev => new Set(prev).add(p.id))
    try {
      const actRow = caracterizacion.find(r => r.codigo === p.actividadId)
      const actEmp = actividades.find(a => a.id === p.actividadId)
      const salidas = actRow ? actRow.salidas : (actEmp ? actEmp.salidas.map(s => s.valor).join(', ') : 'Salidas del diseño')
      
      const res = await api.post<{ control: string }>('/api/gemini/generar-control-diseno', {
        nombre: p.desarrollo,
        proceso: p.desarrollo,
        entradas: p.entradas,
        salidas: salidas,
      })
      if (res.control) {
        updateProyectoDiseno(p.id, { ...p, control: res.control })
      } else {
        alert('No se pudo generar el control')
      }
    } catch (e) {
      console.error(e)
      alert('Error al generar el control')
    } finally {
      setGeneratingRows(prev => {
        const next = new Set(prev)
        next.delete(p.id)
        return next
      })
    }
  }

  const handleGenerateModal = async () => {
    setIsGeneratingControl(true)
    setErrorControl('')
    try {
      const actRow = caracterizacion.find(r => r.codigo === form.actividadId)
      const actEmp = actividades.find(a => a.id === form.actividadId)
      const salidas = actRow ? actRow.salidas : (actEmp ? actEmp.salidas.map(s => s.valor).join(', ') : 'Salidas del diseño')
      
      const res = await api.post<{ control: string }>('/api/gemini/generar-control-diseno', {
        nombre: form.desarrollo,
        proceso: form.desarrollo,
        entradas: form.entradas,
        salidas: salidas,
      })
      if (res.control) {
        setForm(prev => ({ ...prev, control: res.control }))
      } else {
        setErrorControl('No se pudo generar el control')
      }
    } catch (e: any) {
      console.error(e)
      setErrorControl('Error al generar el control')
    } finally {
      setIsGeneratingControl(false)
    }
  }

  /* ── Editar / Crear manual ──────────────────────────────────── */
  const handleEdit = (proyecto: ProyectoDiseno) => {
    setForm({ ...proyecto })
    setShowModal(true)
    setErrorControl('')
  }

  const handleCreateManual = () => {
    setForm({ ...emptyProyecto })
    setShowModal(true)
    setErrorControl('')
  }

  /* ── Guardar ────────────────────────────────────────────────── */
  const guardar = () => {
    if (!form.entradas || !form.desarrollo) return

    if (form.id) {
      updateProyectoDiseno(form.id, form as ProyectoDiseno)
    } else {
      const newId = `PD-${Date.now()}`
      addProyectoDiseno({ ...(form as ProyectoDiseno), id: newId })
    }

    setShowModal(false)
    setForm({ ...emptyProyecto })
  }

  const eliminar = (id: string) => {
    if (window.confirm('¿Eliminar este proyecto de diseño?')) {
      removeProyectoDiseno(id)
    }
  }

  /* ══════════════ RENDER ══════════════ */
  return (
    <div className="iso-page">
      {/* ── Header ── */}
      <div className="iso-page__header">
        <div className="iso-page__title-block">
          <h1>⚙️ Diseño y Desarrollo</h1>
          <p>Control y seguimiento del diseño y desarrollo de productos y servicios</p>
          <span className="iso-page__clause">Cláusula 8.3</span>
        </div>
      </div>

      <div className="iso-info-box">
        <span className="iso-info-box__icon">📌</span>
        <span>
          <strong>Cláusula 8.3</strong> — La organización debe establecer, implementar y mantener
          un proceso de diseño y desarrollo, con etapas de planificación, entradas, controles,
          salidas, y cambios documentados.
        </span>
      </div>



      {/* ── Barra superior ── */}
      <div className="iso-topbar">
        <div className="iso-topbar__info">
          Proyectos activos: <strong>{proyectosDiseno.filter(p => p.etapa !== 'Completado').length}</strong> &nbsp;·&nbsp;
          Completados: <strong>{proyectosDiseno.filter(p => p.etapa === 'Completado').length}</strong>
        </div>
        <button className="iso-btn-primary" onClick={handleCreateManual} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Diseño y Desarrollo</button>
      </div>

      {/* ── Tabla ── */}
      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr>
              <th>#</th><th>Entradas</th><th>Desarrollo</th><th>Control</th>
              <th>Responsable</th><th>Inicio</th><th>Entrega</th><th>Etapa</th>
              <th>Estado</th><th style={{ minWidth: '70px' }}></th>
            </tr>
          </thead>
          <tbody>
            {proyectosDiseno.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  No hay proyectos de diseño registrados
                </td>
              </tr>
            ) : proyectosDiseno.map((p, i) => (
              <tr key={p.id}>
                <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{p.entradas}</td>
                <td style={{ fontWeight: 600, color: '#1b3a6b' }}>{p.desarrollo}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                  {p.control ? p.control : (
                    <button
                      className="iso-btn-primary"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: generatingRows.has(p.id) ? '#9ca3af' : '#1b3a6b' }}
                      onClick={() => handleGenerateTableRow(p)}
                      disabled={generatingRows.has(p.id) || !canEdit}
                    >
                      {generatingRows.has(p.id) ? '⏳ Generando...' : '✨ Generar'}
                    </button>
                  )}
                </td>
                <td>{p.responsable}</td>
                <td>{p.fechaInicio || <em style={{ color: '#d1d5db' }}>—</em>}</td>
                <td>{p.fechaEntrega || <em style={{ color: '#d1d5db' }}>—</em>}</td>
                <td>
                  <select
                    className={`iso-badge ${etapaColor[p.etapa]}`}
                    style={{ border: 'none', cursor: 'pointer', outline: 'none', fontWeight: 'bold' }}
                    value={p.etapa}
                    onChange={(e) => updateProyectoDiseno(p.id, { ...p, etapa: e.target.value as any })}
                    disabled={!canEdit}
                  >
                    {ETAPAS.map(et => <option key={et} value={et} style={{ color: '#000', background: '#fff' }}>{et}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    className={`iso-badge ${p.estado === 'En tiempo' ? 'verde' : p.estado === 'En riesgo' ? 'amarillo' : 'rojo'}`}
                    style={{ border: 'none', cursor: 'pointer', outline: 'none', fontWeight: 'bold' }}
                    value={p.estado}
                    onChange={(e) => updateProyectoDiseno(p.id, { ...p, estado: e.target.value as any })}
                    disabled={!canEdit}
                  >
                    {ESTADOS.map(es => <option key={es} value={es} style={{ color: '#000', background: '#fff' }}>{es}</option>)}
                  </select>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="iso-btn-icon" onClick={() => handleEdit(p)} style={{ marginRight: '0.25rem' }} disabled={!canEdit}>✏️</button>
                  <PermissionGuard recurso="diseno_desarrollo" accion="eliminar" mode="hide">
                    <button className="iso-btn-icon danger" onClick={() => eliminar(p.id)}>🗑️</button>
                  </PermissionGuard>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════ MODAL ═══════ */}
      {showModal && (
        <div className="iso-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2>{form.id ? '✏️ Editar Proyecto de Diseño' : '➕ Nuevo Proyecto de Diseño'}</h2>

            <div className="iso-field">
              <label>Entradas del diseño *</label>
              <textarea rows={2} value={form.entradas} onChange={e => setForm(p => ({ ...p, entradas: e.target.value }))} disabled={!canEdit} />
            </div>

            <div className="iso-field">
              <label>Desarrollo *</label>
              <textarea rows={2} value={form.desarrollo} onChange={e => setForm(p => ({ ...p, desarrollo: e.target.value }))} disabled={!canEdit} />
            </div>

            <div className="iso-field">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Control (Verificación y Validación)</span>
                {canEdit && (
                  <button
                    type="button"
                    className="iso-btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: '#dbeafe', color: '#1e40af', background: '#eff6ff' }}
                    onClick={handleGenerateModal}
                    disabled={isGeneratingControl || !form.desarrollo || !form.entradas}
                  >
                    {isGeneratingControl ? '⏳ Generando...' : '✨ Generar con IA'}
                  </button>
                )}
              </label>
              <textarea
                rows={3}
                value={form.control}
                onChange={e => setForm(p => ({ ...p, control: e.target.value }))}
                placeholder={isGeneratingControl
                  ? 'La IA está analizando el proceso y generando el control...'
                  : 'Describe las revisiones, prototipos, o pruebas...'}
                disabled={isGeneratingControl || !canEdit}
                style={{ background: isGeneratingControl ? '#f3f4f6' : '#fff' }}
              />
              {errorControl && (
                <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {errorControl}
                </div>
              )}
            </div>

            <div className="iso-field">
              <label>Responsable</label>
              <input
                type="text"
                value={form.responsable}
                onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))}
                disabled={!canEdit}
              />
            </div>

            <div className="iso-form-row">
              <div className="iso-field">
                <label>Fecha inicio</label>
                <input type="date" value={form.fechaInicio} onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="iso-field">
                <label>Fecha entrega</label>
                <input type="date" value={form.fechaEntrega} onChange={e => setForm(p => ({ ...p, fechaEntrega: e.target.value }))} disabled={!canEdit} />
              </div>
            </div>

            <div className="iso-form-row">
              <div className="iso-field">
                <label>Etapa actual</label>
                <select value={form.etapa} onChange={e => setForm(p => ({ ...p, etapa: e.target.value as any }))} disabled={!canEdit}>
                  {ETAPAS.map(et => <option key={et} value={et}>{et}</option>)}
                </select>
              </div>
              <div className="iso-field">
                <label>Estado</label>
                <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as any }))} disabled={!canEdit}>
                  {ESTADOS.map(es => <option key={es} value={es}>{es}</option>)}
                </select>
              </div>
            </div>

            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              {canEdit && (
                <button
                  className="iso-btn-primary"
                  onClick={guardar}
                  disabled={!form.entradas || !form.desarrollo || isGeneratingControl}
                >
                  {form.id ? '💾 Guardar Cambios' : '＋ Guardar Proyecto'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DisenoDesarrolloPage
