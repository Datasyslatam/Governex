import React, { useState } from 'react'
import '../iso-module.css'

interface Requisito {
  id: number
  cliente: string
  productoServicio: string
  requisitosCliente: string
  requisitosLegales: string
  requisitosOrg: string
  fechaRevision: string
  revisadoPor: string
  estado: 'Aprobado' | 'Pendiente' | 'Rechazado'
}

const datosIniciales: Requisito[] = [
  { id: 1, cliente: 'Empresa ABC Ltda.', productoServicio: 'Software de gestión documental', requisitosCliente: 'Módulos de auditoría, reportes PDF, acceso multi-usuario, soporte 24/7', requisitosLegales: 'Ley 1581 de habeas data, normas de ciberseguridad', requisitosOrg: 'Tiempo de desarrollo: 3 meses, garantía 12 meses', fechaRevision: '2025-02-15', revisadoPor: 'Director Comercial', estado: 'Aprobado' },
  { id: 2, cliente: 'Constructora XYZ', productoServicio: 'Consultoría de calidad', requisitosCliente: 'Implementación completa, formación de auditores, acompañamiento a certificación', requisitosLegales: 'Norma de calidad vigente', requisitosOrg: 'Duración: 6 meses, entregables documentados', fechaRevision: '2025-03-20', revisadoPor: 'Gerente General', estado: 'Aprobado' },
  { id: 3, cliente: 'Distribuidora Sur', productoServicio: 'Suministro de insumos industriales', requisitosCliente: 'Entrega en 48h, certificados de calidad por lote, empaque especial', requisitosLegales: 'Fichas técnicas MSDS, normas de transporte', requisitosOrg: 'Inventario mínimo garantizado', fechaRevision: '2025-04-01', revisadoPor: 'Jefe de Compras', estado: 'Pendiente' },
]

const empty = { cliente: '', productoServicio: '', requisitosCliente: '', requisitosLegales: '', requisitosOrg: '', fechaRevision: '', revisadoPor: '', estado: 'Pendiente' as const }

const RequerimientosPSPage: React.FC = () => {
  const [items, setItems] = useState<Requisito[]>(datosIniciales)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...empty })

  const guardar = () => {
    if (!form.cliente || !form.productoServicio) return
    const id = Math.max(0, ...items.map(r => r.id)) + 1
    setItems(prev => [...prev, { id, ...form }])
    setShowModal(false); setForm({ ...empty })
  }
  const eliminar = (id: number) => { if (window.confirm('¿Eliminar?')) setItems(prev => prev.filter(r => r.id !== id)) }

  return (
    <div className="iso-page">
      <div className="iso-page__header">
        <div className="iso-page__title-block">
          <h1>⚙️ Requerimientos para Productos y Servicios</h1>
          <p>Determinación, revisión y comunicación de requisitos relacionados con productos y servicios</p>
          <span className="iso-page__clause">Cláusula 8.2</span>
        </div>
      </div>

      <div className="iso-info-box">
        <span className="iso-info-box__icon">📌</span>
        <span><strong>Cláusula 8.2</strong> — La organización debe determinar los requisitos del cliente, los legales y reglamentarios aplicables, y cualquier requisito adicional que la organización considera necesario. Debe revisar estos requisitos antes de comprometerse a suministrar.</span>
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">Revisiones registradas: <strong>{items.length}</strong></div>
        <button className="iso-btn-primary" onClick={() => setShowModal(true)}>＋ Nueva revisión</button>
      </div>

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr><th>#</th><th>Cliente</th><th>Producto / Servicio</th><th>Requisitos del cliente</th><th>Req. legales</th><th>Req. organización</th><th>Revisado por</th><th>Fecha</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={r.id}>
                <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                <td style={{ fontWeight: 600, color: '#1b3a6b' }}>{r.cliente}</td>
                <td>{r.productoServicio}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.requisitosCliente}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.requisitosLegales}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.requisitosOrg}</td>
                <td>{r.revisadoPor}</td>
                <td>{r.fechaRevision}</td>
                <td><span className={`iso-badge ${r.estado === 'Aprobado' ? 'verde' : r.estado === 'Pendiente' ? 'amarillo' : 'rojo'}`}>{r.estado}</span></td>
                <td><button className="iso-btn-icon danger" onClick={() => eliminar(r.id)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="iso-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2>➕ Nueva revisión de requisitos</h2>
            <div className="iso-form-row">
              <div className="iso-field"><label>Cliente *</label><input type="text" value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} /></div>
              <div className="iso-field"><label>Producto / Servicio *</label><input type="text" value={form.productoServicio} onChange={e => setForm(p => ({ ...p, productoServicio: e.target.value }))} /></div>
            </div>
            <div className="iso-field"><label>Requisitos del cliente</label><textarea rows={2} value={form.requisitosCliente} onChange={e => setForm(p => ({ ...p, requisitosCliente: e.target.value }))} /></div>
            <div className="iso-field"><label>Requisitos legales y reglamentarios</label><textarea rows={2} value={form.requisitosLegales} onChange={e => setForm(p => ({ ...p, requisitosLegales: e.target.value }))} /></div>
            <div className="iso-field"><label>Requisitos de la organización</label><textarea rows={2} value={form.requisitosOrg} onChange={e => setForm(p => ({ ...p, requisitosOrg: e.target.value }))} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Revisado por</label><input type="text" value={form.revisadoPor} onChange={e => setForm(p => ({ ...p, revisadoPor: e.target.value }))} /></div>
              <div className="iso-field"><label>Fecha</label><input type="date" value={form.fechaRevision} onChange={e => setForm(p => ({ ...p, fechaRevision: e.target.value }))} /></div>
            </div>
            <div className="iso-field"><label>Estado</label>
              <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as any }))}>
                <option>Pendiente</option><option>Aprobado</option><option>Rechazado</option>
              </select>
            </div>
            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardar} disabled={!form.cliente}>＋ Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RequerimientosPSPage
