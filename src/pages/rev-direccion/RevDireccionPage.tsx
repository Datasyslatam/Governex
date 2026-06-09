import React, { useState, useCallback } from 'react'
import './RevDireccionPage.css'
import { useFetch } from '../../hooks/useFetch'
import { revDireccionService } from '../../services'

const entradasRequeridas = [
  { req: '9.3.2 a)',    desc: 'Estado de las acciones de revisiones previas' },
  { req: '9.3.2 b)',    desc: 'Cambios en el contexto externo e interno (PESTEL/DOFA)' },
  { req: '9.3.2 c.1)', desc: 'Satisfacción del cliente y retroalimentación de partes interesadas' },
  { req: '9.3.2 c.2)', desc: 'Grado de cumplimiento de los objetivos de la calidad' },
  { req: '9.3.2 c.3)', desc: 'Desempeño de los procesos y conformidad del producto' },
  { req: '9.3.2 c.4)', desc: 'No conformidades y acciones correctivas' },
  { req: '9.3.2 c.5)', desc: 'Resultados de seguimiento y medición' },
  { req: '9.3.2 c.6)', desc: 'Resultados de las auditorías' },
  { req: '9.3.2 c.7)', desc: 'Desempeño de los proveedores externos' },
  { req: '9.3.2 d)',    desc: 'Adecuación de los recursos' },
  { req: '9.3.2 e)',    desc: 'Eficacia de las acciones tomadas para abordar riesgos y oportunidades' },
  { req: '9.3.2 f)',    desc: 'Oportunidades de mejora' },
]

const emptyForm = {
  fecha: new Date().toISOString().slice(0, 10),
  asistentes: '', temas: '', conclusiones: '', decisiones: '', proxima_rev: '',
}

const RevDireccionPage: React.FC = () => {
  const { data: revisiones, loading, error, refetch } = useFetch(revDireccionService.getAll, [])

  const [showModal, setShowModal]           = useState(false)
  const [editingId, setEditingId]           = useState<number | null>(null)
  const [form, setForm]                     = useState(emptyForm)
  const [entradasCheck, setEntradasCheck]   = useState<boolean[]>(new Array(12).fill(false))
  const [saving, setSaving]                 = useState(false)

  const completadas = entradasCheck.filter(Boolean).length
  const bloqueado   = completadas < entradasRequeridas.length

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setEntradasCheck(new Array(12).fill(false))
    setShowModal(true)
  }

  const openEdit = (rev: any) => {
    setEditingId(rev.id)
    setForm({
      fecha: rev.fecha || emptyForm.fecha,
      asistentes: rev.asistentes || '',
      temas: rev.temas || '',
      conclusiones: rev.conclusiones || '',
      decisiones: rev.decisiones || '',
      proxima_rev: rev.proxima_rev || '',
    })
    setShowModal(true)
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      if (editingId) {
        await revDireccionService.update(editingId, form)
      } else {
        await revDireccionService.create(form)
      }
      await refetch()
      setShowModal(false)
      setEditingId(null)
      setForm(emptyForm)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [form, editingId, refetch])

  const toggleEntrada = (i: number) => {
    setEntradasCheck(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  // Revisión en borrador (la más reciente que no tenga un estado cerrado)
  const revActual = revisiones[0] || null

  return (
    <div className="page rev-page">
      <header className="page__header rev-page__header">
        <div className="rev-page__header-left">
          <nav className="rev-page__breadcrumb">
            <span>Governex</span>
            <span className="rev-page__bc-sep">›</span>
            <span>Cap. 9.3</span>
            <span className="rev-page__bc-sep">›</span>
            <span className="rev-page__bc-active">Revisión por la Dirección</span>
          </nav>
          <h2>Revisión por la Dirección</h2>
          <p className="rev-page__subtitle">Evaluación estratégica del desempeño y eficacia del SGC por la Alta Dirección</p>
        </div>
        <div className="rev-page__actions">
          <button className="btn btn--primary" onClick={openCreate}>+ Planificar Nueva Revisión</button>
        </div>
      </header>

      <div className="rev-layout">
        {/* Panel principal: checklist de entradas */}
        <div className="rev-main-col panel">
          <div className="rev-section-header">
            <h3>Preparación de Acta — Entradas Obligatorias § 9.3.2</h3>
            <span className={`pill ${bloqueado ? 'pill--warning' : 'pill--success'}`}>
              {completadas}/{entradasRequeridas.length} completadas
            </span>
          </div>

          <p className="rev-desc">
            Para el desempeño eficaz del SGC, la revisión por la dirección requiere que se analicen
            obligatoriamente las siguientes entradas documentadas.
          </p>

          <div className="rev-inputs-grid">
            {entradasRequeridas.map((entrada, idx) => (
              <div key={idx} className={`rev-input-card ${entradasCheck[idx] ? 'rev-input-card--done' : ''}`}>
                <div className="rev-input-top">
                  <span className="rev-input-req">{entrada.req}</span>
                  {entradasCheck[idx] ? (
                    <span className="rev-check icon-success">✅ Completado</span>
                  ) : (
                    <span className="rev-check icon-pending">⚠️ Pendiente</span>
                  )}
                </div>
                <p className="rev-input-desc">{entrada.desc}</p>
                <button
                  className={`rev-btn-small ${entradasCheck[idx] ? 'btn-view' : 'btn-action'}`}
                  onClick={() => toggleEntrada(idx)}
                >
                  {entradasCheck[idx] ? 'Ver Informe Adjunto' : '+ Adjuntar Evidencia'}
                </button>
              </div>
            ))}
          </div>

          <div className="rev-footer-action">
            <p className="rev-lock-msg">
              <span className="lock-icon">🔒</span>
              {bloqueado
                ? ` No se puede cerrar el acta hasta que el 100% de las entradas estén documentadas. Faltan ${entradasRequeridas.length - completadas}.`
                : ' Todas las entradas documentadas. El acta puede cerrarse y firmarse.'}
            </p>
            <button
              className={`btn ${bloqueado ? 'btn--muted' : 'btn--primary'}`}
              disabled={bloqueado}
              onClick={() => !bloqueado && handleSave()}
            >
              {bloqueado ? `Bloqueado: Faltan ${entradasRequeridas.length - completadas} Entradas` : '✅ Cerrar y Firmar Acta'}
            </button>
          </div>
        </div>

        {/* Panel lateral: historial */}
        <div className="rev-side-col">
          <div className="panel rev-hist-panel">
            <h3>Historial de Revisiones</h3>
            {loading ? (
              <div style={{ padding: '1rem', opacity: 0.5 }}>Cargando...</div>
            ) : error ? (
              <div style={{ padding: '1rem', color: 'red' }}>Error: {error}</div>
            ) : (
              <div className="rev-hist-list">
                {revisiones.map((rev: any, i: number) => (
                  <div key={rev.id} className="rev-hist-item">
                    <div className="rev-hist-item-header">
                      <strong>RD-{new Date(rev.fecha).getFullYear()}-{String(i + 1).padStart(2, '0')}</strong>
                      <span className="rev-hist-date">{rev.fecha}</span>
                    </div>
                    <div className="rev-hist-item-body">
                      <span className="rev-hist-type">{rev.temas ? 'Con temas' : 'Borrador'}</span>
                      <span className="pill pill--success">Registrada</span>
                    </div>
                    <button className="rev-hist-btn" onClick={() => openEdit(rev)}>✏️ Editar</button>
                  </div>
                ))}
                {revisiones.length === 0 && (
                  <div style={{ opacity: 0.4, padding: '1rem 0' }}>No hay revisiones registradas</div>
                )}
              </div>
            )}
          </div>

          {revActual && revActual.decisiones && (
            <div className="panel rev-hist-panel">
              <h3>Salidas de Revisión (Compromisos)</h3>
              <ul className="rev-commit-list">
                {revActual.decisiones.split('\n').filter((d: string) => d.trim()).map((decision: string, i: number) => (
                  <li key={i}>
                    <div className="rev-commit-header">
                      <span className="pill pill--warning">Compromiso</span>
                      <span className="rev-commit-date">{revActual.fecha}</span>
                    </div>
                    <p>{decision}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Modal nueva/editar revisión */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? '✏️ Editar Revisión' : '📋 Nueva Revisión por la Dirección'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha de revisión</label>
                  <input type="date" className="filter-input form-control"
                    value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Próxima revisión</label>
                  <input type="date" className="filter-input form-control"
                    value={form.proxima_rev}
                    onChange={e => setForm(f => ({ ...f, proxima_rev: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Asistentes</label>
                <input type="text" className="filter-input form-control"
                  value={form.asistentes} placeholder="Ej: Gerente General, Dir. de Calidad..."
                  onChange={e => setForm(f => ({ ...f, asistentes: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Temas tratados</label>
                <textarea className="filter-input form-control" rows={3}
                  value={form.temas} placeholder="Resumen de los temas de la agenda..."
                  onChange={e => setForm(f => ({ ...f, temas: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Conclusiones</label>
                <textarea className="filter-input form-control" rows={3}
                  value={form.conclusiones} placeholder="Conclusiones de la revisión..."
                  onChange={e => setForm(f => ({ ...f, conclusiones: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Decisiones y compromisos (una por línea)</label>
                <textarea className="filter-input form-control" rows={3}
                  value={form.decisiones} placeholder="Ej: Presupuestar nuevo software ERP para el Q3..."
                  onChange={e => setForm(f => ({ ...f, decisiones: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Registrar Revisión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RevDireccionPage
