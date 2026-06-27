import React, { useState, useMemo } from 'react'
import '../iso-module.css'
import { useAIAnalysis, ProyectoDiseno, CaracterizacionRow } from '../../context/AIAnalysisContext'
import { api } from '../../services/api'

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
  const {
    analysis,
    proyectosDiseno,
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

  /** Procesos de la caracterización que todavía NO se han confirmado como proyecto de diseño y son Desarrollo de Producto */
  const procesosPendientes = useMemo(
    () => caracterizacion.filter(
      row => 
        row.proceso.toLowerCase().includes('desarrollo de producto') &&
        !proyectosDiseno.some(p => p.actividadId === row.codigo),
    ),
    [caracterizacion, proyectosDiseno],
  )

  /* ── Confirmar un proceso de la caracterización ─────────────── */
  const handleConfirmProceso = async (row: CaracterizacionRow) => {
    setForm({
      actividadId: row.codigo,
      entradas: row.entradas,
      desarrollo: row.proceso,
      responsable: row.responsable || '',
      control: '',
      fechaInicio: '',
      fechaEntrega: '',
      etapa: 'Planificación',
      estado: 'En tiempo',
    })

    setShowModal(true)
    setIsGeneratingControl(true)
    setErrorControl('')

    try {
      const res = await api.post<{ control: string }>('/api/gemini/generar-control-diseno', {
        nombre: row.proceso,
        proceso: row.proceso,
        entradas: row.entradas,
        salidas: row.salidas,
      })
      if (res.control) {
        setForm(prev => ({ ...prev, control: res.control }))
      }
    } catch (e: any) {
      console.error(e)
      setErrorControl('No se pudo generar el control automáticamente. Puedes redactarlo manualmente.')
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

      {/* ── Procesos pendientes desde Caracterización ── */}
      {procesosPendientes.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{
            color: '#1b3a6b', marginBottom: '1rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <span style={{ fontSize: '1.2rem' }}>✨</span>
            Procesos de Caracterización — Pendientes de Diseño
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {procesosPendientes.map(row => (
              <div key={row.codigo} style={{
                background: '#f8fbff', border: '1px solid #dbeafe',
                padding: '1rem 1.25rem', borderRadius: '0.6rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <code style={{
                      background: '#eff6ff', color: '#1e40af',
                      padding: '0.12rem 0.5rem', borderRadius: 4,
                      fontSize: '0.78rem', fontWeight: 700,
                    }}>{row.codigo}</code>
                    <h4 style={{ margin: 0, color: '#1e40af', fontSize: '0.95rem' }}>{row.proceso}</h4>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                    Responsable: <strong>{row.responsable}</strong> &nbsp;·&nbsp;
                    Entradas: <em>{row.entradas.slice(0, 60)}{row.entradas.length > 60 ? '…' : ''}</em>
                  </p>
                </div>
                <button
                  className="iso-btn-primary"
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                  onClick={() => handleConfirmProceso(row)}
                >
                  Confirmar Diseño →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Barra superior ── */}
      <div className="iso-topbar">
        <div className="iso-topbar__info">
          Proyectos activos: <strong>{proyectosDiseno.filter(p => p.etapa !== 'Completado').length}</strong> &nbsp;·&nbsp;
          Completados: <strong>{proyectosDiseno.filter(p => p.etapa === 'Completado').length}</strong>
        </div>
        <button className="iso-btn-primary" onClick={handleCreateManual}>＋ Diseño y Desarrollo</button>
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
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{p.control}</td>
                <td>{p.responsable}</td>
                <td>{p.fechaInicio || <em style={{ color: '#d1d5db' }}>—</em>}</td>
                <td>{p.fechaEntrega || <em style={{ color: '#d1d5db' }}>—</em>}</td>
                <td>
                  <select
                    className={`iso-badge ${etapaColor[p.etapa]}`}
                    style={{ border: 'none', cursor: 'pointer', outline: 'none', fontWeight: 'bold' }}
                    value={p.etapa}
                    onChange={(e) => updateProyectoDiseno(p.id, { ...p, etapa: e.target.value as any })}
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
                  >
                    {ESTADOS.map(es => <option key={es} value={es} style={{ color: '#000', background: '#fff' }}>{es}</option>)}
                  </select>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="iso-btn-icon" onClick={() => handleEdit(p)} style={{ marginRight: '0.25rem' }}>✏️</button>
                  <button className="iso-btn-icon danger" onClick={() => eliminar(p.id)}>🗑️</button>
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
              <textarea rows={2} value={form.entradas} onChange={e => setForm(p => ({ ...p, entradas: e.target.value }))} />
            </div>

            <div className="iso-field">
              <label>Desarrollo *</label>
              <textarea rows={2} value={form.desarrollo} onChange={e => setForm(p => ({ ...p, desarrollo: e.target.value }))} />
            </div>

            <div className="iso-field">
              <label>
                Control (Verificación y Validación)
                {isGeneratingControl && (
                  <span style={{ color: '#1a6ebd', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                    ✨ Generando con IA...
                  </span>
                )}
              </label>
              <textarea
                rows={3}
                value={form.control}
                onChange={e => setForm(p => ({ ...p, control: e.target.value }))}
                placeholder={isGeneratingControl
                  ? 'La IA está analizando el proceso y generando el control...'
                  : 'Describe las revisiones, prototipos, o pruebas...'}
                disabled={isGeneratingControl}
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
              />
            </div>

            <div className="iso-form-row">
              <div className="iso-field">
                <label>Fecha inicio</label>
                <input type="date" value={form.fechaInicio} onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))} />
              </div>
              <div className="iso-field">
                <label>Fecha entrega</label>
                <input type="date" value={form.fechaEntrega} onChange={e => setForm(p => ({ ...p, fechaEntrega: e.target.value }))} />
              </div>
            </div>

            <div className="iso-form-row">
              <div className="iso-field">
                <label>Etapa actual</label>
                <select value={form.etapa} onChange={e => setForm(p => ({ ...p, etapa: e.target.value as any }))}>
                  {ETAPAS.map(et => <option key={et} value={et}>{et}</option>)}
                </select>
              </div>
              <div className="iso-field">
                <label>Estado</label>
                <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as any }))}>
                  {ESTADOS.map(es => <option key={es} value={es}>{es}</option>)}
                </select>
              </div>
            </div>

            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button
                className="iso-btn-primary"
                onClick={guardar}
                disabled={!form.entradas || !form.desarrollo || isGeneratingControl}
              >
                {form.id ? '💾 Guardar Cambios' : '＋ Guardar Proyecto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DisenoDesarrolloPage
