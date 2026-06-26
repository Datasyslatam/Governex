import React, { useState, useEffect } from 'react'
import '../iso-module.css'
import { useAIAnalysis, ProyectoDiseno, ActividadEmpresa } from '../../context/AIAnalysisContext'
import { api } from '../../services/api'

const emptyProyecto: Omit<ProyectoDiseno, 'id'> = {
  actividadId: undefined,
  entradas: '',
  desarrollo: '',
  control: '',
  responsable: '',
  fechaInicio: '',
  fechaEntrega: '',
  etapa: 'Planificación',
  estado: 'En tiempo'
}

const DisenоDesarrolloPage: React.FC = () => {
  const { actividades, proyectosDiseno, addProyectoDiseno, updateProyectoDiseno, removeProyectoDiseno } = useAIAnalysis()
  
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Partial<ProyectoDiseno>>({ ...emptyProyecto })
  const [isGeneratingControl, setIsGeneratingControl] = useState(false)
  const [errorControl, setErrorControl] = useState('')

  // Filtrar actividades que aún no tienen un proyecto de diseño asociado
  const actividadesPendientes = actividades.filter(
    act => !proyectosDiseno.some(p => p.actividadId === act.id)
  )

  const handleConfirmActivity = async (act: ActividadEmpresa) => {
    // Pre-poblar datos
    const entradasText = act.entradas.filter(e => e.valor.trim()).map(e => e.valor).join(', ')
    const salidasText = act.salidas.filter(s => s.valor.trim()).map(s => s.valor).join(', ')
    const desarrolloText = `${act.nombre}${salidasText ? ': ' + salidasText : ''}`

    setForm({
      actividadId: act.id,
      entradas: entradasText,
      desarrollo: desarrolloText,
      responsable: act.responsable || '',
      control: '',
      fechaInicio: new Date().toISOString().split('T')[0],
      fechaEntrega: '',
      etapa: 'Planificación',
      estado: 'En tiempo'
    })
    
    setShowModal(true)
    setIsGeneratingControl(true)
    setErrorControl('')

    try {
      const res = await api.post<{ control: string }>('/api/gemini/generar-control-diseno', {
        nombre: act.nombre,
        proceso: act.proceso,
        entradas: entradasText,
        salidas: salidasText
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

  const guardar = () => {
    if (!form.entradas || !form.desarrollo) return
    
    if (form.id) {
      // Editar
      updateProyectoDiseno(form.id, form as ProyectoDiseno)
    } else {
      // Crear
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

  const etapaColor: Record<string, string> = { 
    'Planificación': 'gris', 
    'Desarrollo': 'azul', 
    'Verificación': 'amarillo', 
    'Validación': 'amarillo', 
    'Completado': 'verde' 
  }

  return (
    <div className="iso-page">
      <div className="iso-page__header">
        <div className="iso-page__title-block">
          <h1>⚙️ Diseño y Desarrollo</h1>
          <p>Control y seguimiento del diseño y desarrollo de productos y servicios</p>
          <span className="iso-page__clause">Cláusula 8.3</span>
        </div>
      </div>

      <div className="iso-info-box">
        <span className="iso-info-box__icon">📌</span>
        <span><strong>Cláusula 8.3</strong> — La organización debe establecer, implementar y mantener un proceso de diseño y desarrollo, con etapas de planificación, entradas, controles, salidas, y cambios documentados.</span>
      </div>

      {actividadesPendientes.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#1b3a6b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>✨</span> Generadas / Pendientes de Confirmación
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {actividadesPendientes.map(act => (
              <div key={act.id} style={{ 
                background: '#f8fbff', border: '1px solid #dbeafe', 
                padding: '1rem', borderRadius: '0.5rem', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
              }}>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e40af', fontSize: '1rem' }}>{act.nombre}</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Proceso: <strong>{act.proceso || 'N/A'}</strong> | Entradas: {act.entradas.length} | Salidas: {act.salidas.length}
                  </p>
                </div>
                <button 
                  className="iso-btn-primary" 
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                  onClick={() => handleConfirmActivity(act)}
                >
                  Confirmar Diseño →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="iso-topbar">
        <div className="iso-topbar__info">
          Proyectos activos: <strong>{proyectosDiseno.filter(p => p.etapa !== 'Completado').length}</strong> &nbsp;·&nbsp; 
          Completados: <strong>{proyectosDiseno.filter(p => p.etapa === 'Completado').length}</strong>
        </div>
        <button className="iso-btn-primary" onClick={handleCreateManual}>＋ Diseño y Desarrollo</button>
      </div>

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
                <td>{p.fechaInicio}</td>
                <td>{p.fechaEntrega}</td>
                <td><span className={`iso-badge ${etapaColor[p.etapa]}`}>{p.etapa}</span></td>
                <td>
                  <span className={`iso-badge ${p.estado === 'En tiempo' ? 'verde' : p.estado === 'En riesgo' ? 'amarillo' : 'rojo'}`}>
                    {p.estado}
                  </span>
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
              <label>Control (Verificación y Validación) {isGeneratingControl && <span style={{ color: '#1a6ebd', fontSize: '0.8rem', marginLeft: '0.5rem' }}>✨ Generando con IA...</span>}</label>
              <textarea 
                rows={3} 
                value={form.control} 
                onChange={e => setForm(p => ({ ...p, control: e.target.value }))}
                placeholder={isGeneratingControl ? "La IA está analizando la actividad y generando el control..." : "Describe las revisiones, prototipos, o pruebas..."}
                disabled={isGeneratingControl}
                style={{ background: isGeneratingControl ? '#f3f4f6' : '#fff' }}
              />
              {errorControl && <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errorControl}</div>}
            </div>
            
            <div className="iso-form-row">
              <div className="iso-field">
                <label>Responsable</label>
                <input type="text" value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} />
              </div>
              <div className="iso-field">
                <label>Etapa actual</label>
                <select value={form.etapa} onChange={e => setForm(p => ({ ...p, etapa: e.target.value as any }))}>
                  <option>Planificación</option>
                  <option>Desarrollo</option>
                  <option>Verificación</option>
                  <option>Validación</option>
                  <option>Completado</option>
                </select>
              </div>
              <div className="iso-field">
                <label>Estado</label>
                <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as any }))}>
                  <option>En tiempo</option>
                  <option>En riesgo</option>
                  <option>Retrasado</option>
                </select>
              </div>
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

export default DisenоDesarrolloPage
