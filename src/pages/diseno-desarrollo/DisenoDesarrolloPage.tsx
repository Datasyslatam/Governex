import React, { useState } from 'react'
import '../iso-module.css'

interface Proyecto {
  id: number
  nombre: string
  cliente: string
  entradas: string
  salidas: string
  responsable: string
  fechaInicio: string
  fechaEntrega: string
  etapa: 'Planificación' | 'Desarrollo' | 'Verificación' | 'Validación' | 'Completado'
  estado: 'En tiempo' | 'En riesgo' | 'Retrasado'
}

const datosIniciales: Proyecto[] = [
  { id: 1, nombre: 'App móvil de gestión de inventarios', cliente: 'Logística del Norte S.A.', entradas: 'Especificaciones funcionales, wireframes aprobados, API de ERP del cliente', salidas: 'APK/IPA firmadas, documentación técnica, manual de usuario', responsable: 'Jefe de Ingeniería', fechaInicio: '2025-01-15', fechaEntrega: '2025-05-30', etapa: 'Desarrollo', estado: 'En tiempo' },
  { id: 2, nombre: 'Rediseño de empaque industrial', cliente: 'Químicos del Valle', entradas: 'Normativa de etiquetado, especificaciones de material, restricciones de transporte', salidas: 'Diseño aprobado, especificaciones de producción, prototipo validado', responsable: 'Director Técnico', fechaInicio: '2025-02-01', fechaEntrega: '2025-04-15', etapa: 'Verificación', estado: 'En riesgo' },
]

const empty = { nombre: '', cliente: '', entradas: '', salidas: '', responsable: '', fechaInicio: '', fechaEntrega: '', etapa: 'Planificación' as const, estado: 'En tiempo' as const }

const DisenоDesarrolloPage: React.FC = () => {
  const [proyectos, setProyectos] = useState<Proyecto[]>(datosIniciales)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...empty })

  const guardar = () => {
    if (!form.nombre) return
    const id = Math.max(0, ...proyectos.map(p => p.id)) + 1
    setProyectos(prev => [...prev, { id, ...form }])
    setShowModal(false); setForm({ ...empty })
  }
  const eliminar = (id: number) => { if (window.confirm('¿Eliminar?')) setProyectos(prev => prev.filter(p => p.id !== id)) }

  const etapaColor: Record<string, string> = { 'Planificación': 'gris', 'Desarrollo': 'azul', 'Verificación': 'amarillo', 'Validación': 'amarillo', 'Completado': 'verde' }

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

      <div className="iso-topbar">
        <div className="iso-topbar__info">Proyectos activos: <strong>{proyectos.filter(p => p.etapa !== 'Completado').length}</strong> &nbsp;·&nbsp; Completados: <strong>{proyectos.filter(p => p.etapa === 'Completado').length}</strong></div>
        <button className="iso-btn-primary" onClick={() => setShowModal(true)}>＋ Nuevo proyecto</button>
      </div>

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr><th>#</th><th>Proyecto</th><th>Cliente</th><th>Entradas</th><th>Salidas esperadas</th><th>Responsable</th><th>Inicio</th><th>Entrega</th><th>Etapa</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {proyectos.map((p, i) => (
              <tr key={p.id}>
                <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                <td style={{ fontWeight: 600, color: '#1b3a6b' }}>{p.nombre}</td>
                <td>{p.cliente}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{p.entradas}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{p.salidas}</td>
                <td>{p.responsable}</td>
                <td>{p.fechaInicio}</td>
                <td>{p.fechaEntrega}</td>
                <td><span className={`iso-badge ${etapaColor[p.etapa]}`}>{p.etapa}</span></td>
                <td><span className={`iso-badge ${p.estado === 'En tiempo' ? 'verde' : p.estado === 'En riesgo' ? 'amarillo' : 'rojo'}`}>{p.estado}</span></td>
                <td><button className="iso-btn-icon danger" onClick={() => eliminar(p.id)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="iso-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2>➕ Nuevo proyecto de diseño</h2>
            <div className="iso-form-row">
              <div className="iso-field"><label>Nombre del proyecto *</label><input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
              <div className="iso-field"><label>Cliente</label><input type="text" value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} /></div>
            </div>
            <div className="iso-field"><label>Entradas del diseño</label><textarea rows={2} value={form.entradas} onChange={e => setForm(p => ({ ...p, entradas: e.target.value }))} /></div>
            <div className="iso-field"><label>Salidas esperadas</label><textarea rows={2} value={form.salidas} onChange={e => setForm(p => ({ ...p, salidas: e.target.value }))} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Responsable</label><input type="text" value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} /></div>
              <div className="iso-field"><label>Etapa actual</label>
                <select value={form.etapa} onChange={e => setForm(p => ({ ...p, etapa: e.target.value as any }))}>
                  <option>Planificación</option><option>Desarrollo</option><option>Verificación</option><option>Validación</option><option>Completado</option>
                </select>
              </div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Fecha inicio</label><input type="date" value={form.fechaInicio} onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))} /></div>
              <div className="iso-field"><label>Fecha entrega</label><input type="date" value={form.fechaEntrega} onChange={e => setForm(p => ({ ...p, fechaEntrega: e.target.value }))} /></div>
            </div>
            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardar} disabled={!form.nombre}>＋ Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DisenоDesarrolloPage
