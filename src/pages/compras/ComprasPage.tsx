import React, { useState } from 'react'
import '../iso-module.css'

interface OrdenCompra {
  id: number
  proveedor: string
  producto: string
  cantidad: string
  unidad: string
  precioUnit: string
  total: string
  fechaEmision: string
  fechaEntrega: string
  requisitos: string
  responsable: string
  estado: 'Pendiente' | 'Recibido conforme' | 'Recibido no conforme' | 'Cancelado'
}

const datosIniciales: OrdenCompra[] = [
  { id: 1, proveedor: 'Suministros Técnicos S.A.', producto: 'Tornillos de acero inoxidable M8', cantidad: '500', unidad: 'unidades', precioUnit: '350', total: '175.000', fechaEmision: '2025-03-01', fechaEntrega: '2025-03-10', requisitos: 'Certificado de material, norma ASTM A193', responsable: 'Jefe de Compras', estado: 'Recibido conforme' },
  { id: 2, proveedor: 'Distribuidora Química Ltda.', producto: 'Solvente industrial grado técnico', cantidad: '20', unidad: 'litros', precioUnit: '45.000', total: '900.000', fechaEmision: '2025-03-15', fechaEntrega: '2025-03-22', requisitos: 'Hoja de seguridad MSDS vigente, pureza ≥99%', responsable: 'Jefe de Compras', estado: 'Pendiente' },
  { id: 3, proveedor: 'Servicios de Calibración XYZ', producto: 'Calibración vernier y micrómetro', cantidad: '3', unidad: 'equipos', precioUnit: '80.000', total: '240.000', fechaEmision: '2025-02-20', fechaEntrega: '2025-02-28', requisitos: 'Certificado de calibración con trazabilidad ONAC', responsable: 'Jefe de Mantenimiento', estado: 'Recibido conforme' },
]

const empty = { proveedor: '', producto: '', cantidad: '', unidad: '', precioUnit: '', total: '', fechaEmision: '', fechaEntrega: '', requisitos: '', responsable: '', estado: 'Pendiente' as const }

const ComprasPage: React.FC = () => {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>(datosIniciales)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [filtro, setFiltro] = useState('todos')

  const filtradas = filtro === 'todos' ? ordenes : ordenes.filter(o => o.estado === filtro)

  const guardar = () => {
    if (!form.proveedor || !form.producto) return
    const id = Math.max(0, ...ordenes.map(o => o.id)) + 1
    setOrdenes(prev => [...prev, { id, ...form }])
    setShowModal(false); setForm({ ...empty })
  }
  const eliminar = (id: number) => { if (window.confirm('¿Eliminar?')) setOrdenes(prev => prev.filter(o => o.id !== id)) }

  return (
    <div className="iso-page">
      <div className="iso-page__header">
        <div className="iso-page__title-block">
          <h1>⚙️ Compras</h1>
          <p>Control de productos y servicios suministrados externamente</p>
          <span className="iso-page__clause">Cláusula 8.4</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {(['Pendiente','Recibido conforme','Recibido no conforme'] as const).map(e => (
            <div key={e} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.5rem 0.85rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1b3a6b' }}>{ordenes.filter(o => o.estado === e).length}</div>
              <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>{e}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="iso-info-box">
        <span className="iso-info-box__icon">📌</span>
        <span><strong>Cláusula 8.4</strong> — La organización debe asegurarse de que los procesos, productos y servicios suministrados externamente son conformes a los requisitos. Debe comunicar claramente los requisitos a los proveedores externos.</span>
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">
          <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
            <option value="todos">Todos los estados</option>
            <option>Pendiente</option><option>Recibido conforme</option><option>Recibido no conforme</option><option>Cancelado</option>
          </select>
        </div>
        <button className="iso-btn-primary" onClick={() => setShowModal(true)}>＋ Nueva orden</button>
      </div>

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr><th>#</th><th>Proveedor</th><th>Producto / Servicio</th><th>Cantidad</th><th>Total</th><th>Requisitos de calidad</th><th>Responsable</th><th>Fecha emisión</th><th>Fecha entrega</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {filtradas.map((o, i) => (
              <tr key={o.id}>
                <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                <td style={{ fontWeight: 600, color: '#1b3a6b' }}>{o.proveedor}</td>
                <td>{o.producto}</td>
                <td>{o.cantidad} {o.unidad}</td>
                <td>${o.total}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{o.requisitos}</td>
                <td>{o.responsable}</td>
                <td>{o.fechaEmision}</td>
                <td>{o.fechaEntrega}</td>
                <td><span className={`iso-badge ${o.estado === 'Recibido conforme' ? 'verde' : o.estado === 'Pendiente' ? 'amarillo' : o.estado === 'Cancelado' ? 'gris' : 'rojo'}`}>{o.estado}</span></td>
                <td><button className="iso-btn-icon danger" onClick={() => eliminar(o.id)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="iso-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2>➕ Nueva orden de compra</h2>
            <div className="iso-form-row">
              <div className="iso-field"><label>Proveedor *</label><input type="text" value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))} /></div>
              <div className="iso-field"><label>Producto / Servicio *</label><input type="text" value={form.producto} onChange={e => setForm(p => ({ ...p, producto: e.target.value }))} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Cantidad</label><input type="text" value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} /></div>
              <div className="iso-field"><label>Unidad</label><input type="text" placeholder="unidades, kg, litros..." value={form.unidad} onChange={e => setForm(p => ({ ...p, unidad: e.target.value }))} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Precio unitario</label><input type="text" value={form.precioUnit} onChange={e => setForm(p => ({ ...p, precioUnit: e.target.value }))} /></div>
              <div className="iso-field"><label>Total</label><input type="text" value={form.total} onChange={e => setForm(p => ({ ...p, total: e.target.value }))} /></div>
            </div>
            <div className="iso-field"><label>Requisitos de calidad</label><textarea rows={2} value={form.requisitos} onChange={e => setForm(p => ({ ...p, requisitos: e.target.value }))} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Responsable</label><input type="text" value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} /></div>
              <div className="iso-field"><label>Estado</label>
                <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as any }))}>
                  <option>Pendiente</option><option>Recibido conforme</option><option>Recibido no conforme</option><option>Cancelado</option>
                </select>
              </div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Fecha emisión</label><input type="date" value={form.fechaEmision} onChange={e => setForm(p => ({ ...p, fechaEmision: e.target.value }))} /></div>
              <div className="iso-field"><label>Fecha entrega</label><input type="date" value={form.fechaEntrega} onChange={e => setForm(p => ({ ...p, fechaEntrega: e.target.value }))} /></div>
            </div>
            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardar} disabled={!form.proveedor}>＋ Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ComprasPage
