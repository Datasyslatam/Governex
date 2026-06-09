import React, { useState } from 'react'
import '../iso-module.css'

interface Registro {
  id: number
  colaborador: string
  cargo: string
  proceso: string
  tema: string
  fecha: string
  modalidad: 'Capacitación' | 'Comunicado' | 'Taller' | 'Inducción' | 'E-learning'
  evidencia: string
  estado: 'Pendiente' | 'Completado' | 'Vencido'
}

const datosIniciales: Registro[] = [
  { id: 1, colaborador: 'Ana Martínez', cargo: 'Coordinadora de Calidad', proceso: 'Gestión de la Dirección', tema: 'Política y objetivos de calidad', fecha: '2025-02-10', modalidad: 'Capacitación', evidencia: 'Acta de reunión firmada', estado: 'Completado' },
  { id: 2, colaborador: 'Luis Herrera', cargo: 'Jefe de Producción', proceso: 'Producción / Prestación del Servicio', tema: 'Importancia de la conformidad del producto', fecha: '2025-03-05', modalidad: 'Taller', evidencia: 'Lista de asistencia', estado: 'Completado' },
  { id: 3, colaborador: 'Carla Gómez', cargo: 'Vendedora Senior', proceso: 'Ventas y Gestión Comercial', tema: 'Consecuencias del incumplimiento al SGC', fecha: '2025-04-15', modalidad: 'E-learning', evidencia: 'Certificado plataforma', estado: 'Pendiente' },
  { id: 4, colaborador: 'Pedro Ruiz', cargo: 'Técnico de Mantenimiento', proceso: 'Gestión de Infraestructura', tema: 'Contribución a la eficacia del SGC', fecha: '2025-01-20', modalidad: 'Inducción', evidencia: 'Formato de inducción firmado', estado: 'Vencido' },
]

const empty = { colaborador: '', cargo: '', proceso: '', tema: '', fecha: '', modalidad: 'Capacitación' as const, evidencia: '', estado: 'Pendiente' as const }

const TomaConscienciaPage: React.FC = () => {
  const [registros, setRegistros] = useState<Registro[]>(datosIniciales)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [filtroEstado, setFiltroEstado] = useState('todos')

  const filtrados = filtroEstado === 'todos' ? registros : registros.filter(r => r.estado === filtroEstado)

  const guardar = () => {
    if (!form.colaborador || !form.tema) return
    const id = Math.max(0, ...registros.map(r => r.id)) + 1
    setRegistros(prev => [...prev, { id, ...form }])
    setShowModal(false)
    setForm({ ...empty })
  }

  const eliminar = (id: number) => {
    if (window.confirm('¿Eliminar este registro?')) setRegistros(prev => prev.filter(r => r.id !== id))
  }

  const completados = registros.filter(r => r.estado === 'Completado').length
  const pct = registros.length > 0 ? Math.round((completados / registros.length) * 100) : 0

  return (
    <div className="iso-page">
      <div className="iso-page__header">
        <div className="iso-page__title-block">
          <h1>🔋 Toma de Consciencia</h1>
          <p>Registro de actividades para asegurar que el personal conoce la política, objetivos e importancia del SGC</p>
          <span className="iso-page__clause">Cláusula 7.3</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.6rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2e86de' }}>{pct}%</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Completados</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.6rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1b3a6b' }}>{registros.length}</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Total registros</div>
          </div>
        </div>
      </div>

      <div className="iso-info-box">
        <span className="iso-info-box__icon">📌</span>
        <span><strong>Cláusula 7.3</strong> — La organización debe asegurarse de que las personas que realizan el trabajo bajo el control de la organización toman conciencia de: la política de calidad, los objetivos de calidad pertinentes, su contribución a la eficacia del SGC, y las implicaciones del incumplimiento de los requisitos.</span>
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">
          Mostrando <strong>{filtrados.length}</strong> de <strong>{registros.length}</strong> registros &nbsp;·&nbsp;
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
            <option value="todos">Todos</option>
            <option value="Completado">Completado</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Vencido">Vencido</option>
          </select>
        </div>
        <div className="iso-topbar__actions">
          <button className="iso-btn-primary" onClick={() => setShowModal(true)}>＋ Nuevo registro</button>
        </div>
      </div>

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Colaborador</th>
              <th>Cargo</th>
              <th>Proceso</th>
              <th>Tema de consciencia</th>
              <th>Fecha</th>
              <th>Modalidad</th>
              <th>Evidencia</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((r, i) => (
              <tr key={r.id}>
                <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                <td style={{ fontWeight: 600, color: '#1b3a6b' }}>{r.colaborador}</td>
                <td>{r.cargo}</td>
                <td>{r.proceso}</td>
                <td>{r.tema}</td>
                <td>{r.fecha}</td>
                <td><span className="iso-badge azul">{r.modalidad}</span></td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.evidencia}</td>
                <td>
                  <span className={`iso-badge ${r.estado === 'Completado' ? 'verde' : r.estado === 'Pendiente' ? 'amarillo' : 'rojo'}`}>
                    {r.estado}
                  </span>
                </td>
                <td><button className="iso-btn-icon danger" onClick={() => eliminar(r.id)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="iso-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2>➕ Nuevo registro de toma de consciencia</h2>
            <div className="iso-form-row">
              <div className="iso-field"><label>Colaborador *</label><input type="text" placeholder="Nombre completo" value={form.colaborador} onChange={e => setForm(p => ({ ...p, colaborador: e.target.value }))} /></div>
              <div className="iso-field"><label>Cargo</label><input type="text" placeholder="Cargo del colaborador" value={form.cargo} onChange={e => setForm(p => ({ ...p, cargo: e.target.value }))} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Proceso</label><input type="text" placeholder="Proceso al que pertenece" value={form.proceso} onChange={e => setForm(p => ({ ...p, proceso: e.target.value }))} /></div>
              <div className="iso-field"><label>Fecha</label><input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></div>
            </div>
            <div className="iso-field iso-form-row full"><label>Tema de consciencia *</label><input type="text" placeholder="ej. Política de calidad, consecuencias del incumplimiento..." value={form.tema} onChange={e => setForm(p => ({ ...p, tema: e.target.value }))} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Modalidad</label>
                <select value={form.modalidad} onChange={e => setForm(p => ({ ...p, modalidad: e.target.value as any }))}>
                  <option>Capacitación</option><option>Comunicado</option><option>Taller</option><option>Inducción</option><option>E-learning</option>
                </select>
              </div>
              <div className="iso-field"><label>Estado</label>
                <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as any }))}>
                  <option>Pendiente</option><option>Completado</option><option>Vencido</option>
                </select>
              </div>
            </div>
            <div className="iso-field"><label>Evidencia</label><input type="text" placeholder="ej. Lista de asistencia, certificado, acta..." value={form.evidencia} onChange={e => setForm(p => ({ ...p, evidencia: e.target.value }))} /></div>
            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardar} disabled={!form.colaborador || !form.tema}>＋ Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TomaConscienciaPage
