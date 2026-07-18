import React, { useState, useCallback } from 'react'
import './PoliticaPage.css'
import { useFetch } from '../../hooks/useFetch'
import { politicaService } from '../../services'
import { useAIAnalysis } from '../../context/AIAnalysisContext'
import { usePermissions } from '../../hooks/usePermissions'

const PoliticaPage: React.FC = () => {
  const { data: politicas, loading: lPol, refetch: refetchPol }
    = useFetch(politicaService.getAll, [])

  const { data: lecturas, loading: lLec, refetch: refetchLec }
    = useFetch(politicaService.getLecturas, [])

  const { datosEmpresa } = useAIAnalysis()
  const politicaIA = datosEmpresa?.politicaCalidad?.trim() || null
  const { canEdit, canCreate, isReadOnly } = usePermissions('politica_calidad')

  const [showModalEditar, setShowModalEditar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generandoIA, setGenerandoIA] = useState(false)
  const [formPol, setFormPol] = useState({ version: '', contenido: '' })

  const politicaVigente = politicas.find(p => p.estado === 'Vigente') || null

  const aceptadas  = lecturas.filter(l => l.estado === 'Leído y Aceptado').length
  const total      = lecturas.length
  const porcentaje = total > 0 ? Math.round((aceptadas / total) * 100) : 0

  const openEditar = () => {
    if (politicaVigente) {
      setFormPol({ version: politicaVigente.version, contenido: politicaVigente.contenido })
    }
    setShowModalEditar(true)
  }

  const guardarPolitica = useCallback(async () => {
    if (!formPol.version || !formPol.contenido) return
    setSaving(true)
    try {
      if (politicaVigente) {
        await politicaService.update(politicaVigente.id, { ...formPol, estado: 'Vigente' })
      } else {
        await politicaService.create({ ...formPol, estado: 'Vigente' })
      }
      await refetchPol()
      setShowModalEditar(false)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [formPol, politicaVigente, refetchPol])

  const marcarLectura = useCallback(async (lectura: any) => {
    if (lectura.estado === 'Leído y Aceptado') return
    setSaving(true)
    try {
      await politicaService.addLectura({
        politica_id:    politicaVigente?.id,
        nombre_persona: lectura.nombre_persona,
        area:           lectura.area,
        fecha_lectura:  new Date().toISOString().slice(0, 10),
        estado:         'Leído y Aceptado',
      })
      await refetchLec()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [politicaVigente, refetchLec])

  return (
    <div className="page pol-page">
      <header className="page__header pol-page__header">
        <div className="pol-page__header-left">
          <nav className="pol-page__breadcrumb">
            <span>Governex</span>
            <span className="pol-page__bc-sep">›</span>
            <span>Cap. 5.2</span>
            <span className="pol-page__bc-sep">›</span>
            <span className="pol-page__bc-active">Política de Calidad</span>
          </nav>
          <h2>Política y Objetivos de Calidad</h2>
          <p className="pol-page__subtitle">Establecimiento, comunicación y despliegue de la directriz principal del SGC</p>
        </div>
        <div className="pol-page__actions">
          <button className="btn btn--primary" onClick={openEditar} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>Editar Política</button>
        </div>
      </header>

      <div className="pol-layout">
        <div className="pol-main-col panel">

          {/* ── Política vigente ── */}
          {lPol ? (
            <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando política...</div>
          ) : !politicaVigente ? (
            <div style={{ padding: '2rem' }}>
              <p style={{ opacity: 0.5 }}>No hay política vigente. Crea una usando el botón "Editar Política".</p>
            </div>
          ) : (
            <>
              <div className="pol-doc-header">
                <div>
                  <h3 className="pol-doc-title">Política de Calidad Institucional</h3>
                  <span className="pill pill--success">Versión {politicaVigente.version} · Vigente</span>
                </div>
                <button className="pol-btn-download">PDF 📥</button>
              </div>

              <div className="pol-doc-content">
                {politicaVigente.contenido.split('\n').map((parrafo: string, i: number) =>
                  parrafo.trim() ? <p key={i}>{parrafo}</p> : null
                )}
              </div>

              <div className="pol-doc-footer">
                <div className="pol-sign">
                  <span className="pol-sign-name">{politicaVigente.aprobado_por_nombre || 'Alta Dirección'}</span>
                  <span className="pol-sign-role">Director General</span>
                  <span className="pol-sign-date">
                    Fecha de Aprobación: {politicaVigente.fecha_vigencia || politicaVigente.creado_en?.slice(0, 10)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="pol-side-col">
          <div className="panel pol-side-panel">
            <h3>Comunicación y Toma de Conciencia (7.3)</h3>

            <div className="pol-progress-wrap mt-3 mb-4">
              <div className="pol-progress-labels">
                <span>Personal que ha aceptado</span>
                <strong>{porcentaje}%</strong>
              </div>
              <div className="pol-progress-bar">
                <div className="pol-progress-fill bg-primary" style={{ width: `${porcentaje}%` }} />
              </div>
            </div>

            <h4 className="pol-sub-hdr">Registros de Aceptación</h4>

            {lLec ? (
              <div style={{ opacity: 0.5 }}>Cargando registros...</div>
            ) : (
              <div className="pol-lecturas">
                {lecturas.map((reg: any, i: number) => (
                  <div key={reg.id || i} className="pol-lec-item">
                    <div className="pol-lec-top">
                      <strong>{reg.nombre_persona}</strong>
                      <span className="pol-lec-area">{reg.area || '—'}</span>
                    </div>
                    <div className="pol-lec-bot">
                      <span className={`pill ${reg.estado === 'Pendiente' ? 'pill--warning' : 'pill--success'}`}>
                        {reg.estado}
                      </span>
                      <span className="pol-lec-date">{reg.fecha_lectura || '—'}</span>
                      {reg.estado === 'Pendiente' && (
                        <button
                          style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', fontSize: '0.75rem' }}
                          title={!canEdit ? 'Tu rol no tiene permiso para editar' : 'Marcar como leído'}
                          onClick={() => marcarLectura(reg)}
                          disabled={!canEdit}
                        >
                          ✅
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {lecturas.length === 0 && (
                  <div style={{ opacity: 0.4, padding: '1rem 0' }}>No hay registros de lectura</div>
                )}
              </div>
            )}

            <button className="btn btn--muted w-100 mt-3" disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>Enviar Recordatorio</button>
          </div>
        </div>
      </div>

      {/* ── Modal editar política ── */}
      {showModalEditar && (
        <div className="modal-overlay" onClick={() => setShowModalEditar(false)}>
          <div className="modal-card" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📝 {politicaVigente ? 'Editar Política de Calidad' : 'Crear Política de Calidad'}</h3>
              <button className="modal-close" onClick={() => setShowModalEditar(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Versión</label>
                <input
                  type="text"
                  className="filter-input form-control"
                  value={formPol.version}
                  placeholder="Ej: v2.1"
                  onChange={e => setFormPol(f => ({ ...f, version: e.target.value }))}
                  readOnly={isReadOnly()}
                />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ margin: 0 }}>Contenido de la política</label>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    disabled={generandoIA || !canEdit}
                    title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}
                    onClick={async () => {
                      setGenerandoIA(true)
                      try {
                        const token = localStorage.getItem('governex_token')
                        const BASE  = import.meta.env.VITE_API_URL || ''
                        const response = await fetch(`${BASE}/api/gemini/generar-ideario`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                          },
                          body: JSON.stringify({ datosEmpresa }),
                        })
                        if (!response.ok) throw new Error('Error al generar')
                        const result = await response.json()
                        if (result.politicaCalidad) {
                          setFormPol(f => ({ ...f, contenido: result.politicaCalidad }))
                        }
                      } catch (e: any) {
                        alert('No se pudo generar la política: ' + (e.message || e))
                      } finally {
                        setGenerandoIA(false)
                      }
                    }}
                  >
                    {generandoIA ? '⏳ Generando...' : '✨ Generar con IA'}
                  </button>
                </div>
                <textarea
                  className="filter-input form-control"
                  rows={10}
                  value={formPol.contenido}
                  placeholder="Escribe el contenido completo de la política de calidad..."
                  onChange={e => setFormPol(f => ({ ...f, contenido: e.target.value }))}
                  readOnly={isReadOnly()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalEditar(false)}>Cancelar</button>
              <button
                className="btn btn--primary"
                onClick={guardarPolitica}
                disabled={!canEdit || saving || !formPol.version || !formPol.contenido}
                title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}
              >
                {saving ? 'Guardando...' : 'Publicar Política'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PoliticaPage