import React, { useState } from 'react'
import '../iso-module.css'

interface SalidaNC {
  id: number
  codigo: string
  descripcion: string
  proceso: string
  detectadoEn: 'Producción' | 'Inspección final' | 'Entrega' | 'Postventa' | 'Proveedor'
  disposicion: 'Reparar' | 'Reprocesar' | 'Concesión al cliente' | 'Devolver al proveedor' | 'Desechar'
  responsable: string
  fecha: string
  accionTomada: string
  verificadoPor: string
  estado: 'Abierta' | 'En tratamiento' | 'Cerrada'
}

const datosIniciales: SalidaNC[] = [
  { id: 1, codigo: 'SNC-2025-001', descripcion: 'Pieza metálica con fisura en soldadura zona lateral', proceso: 'Producción', detectadoEn: 'Inspección final', disposicion: 'Desechar', responsable: 'Inspector de Calidad', fecha: '2025-03-05', accionTomada: 'Se descartó la pieza. Se revisó el proceso de soldadura y se recalibró la temperatura del equipo.', verificadoPor: 'Jefe de Producción', estado: 'Cerrada' },
  { id: 2, codigo: 'SNC-2025-002', descripcion: 'Software entregado con error en módulo de reportes PDF', proceso: 'Prestación del servicio', detectadoEn: 'Postventa', disposicion: 'Reprocesar', responsable: 'Líder de Desarrollo', fecha: '2025-03-12', accionTomada: 'Se identificó error en función de exportación. Corrección en progreso versión 1.1.2.', verificadoPor: '', estado: 'En tratamiento' },
]

const empty = { codigo: '', descripcion: '', proceso: '', detectadoEn: 'Inspección final' as const, disposicion: 'Reparar' as const, responsable: '', fecha: '', accionTomada: '', verificadoPor: '', estado: 'Abierta' as const }

const SalidasNCPage: React.FC = () => {
  const [items, setItems] = useState<SalidaNC[]>(datosIniciales)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [filtro, setFiltro] = useState('todos')

  const filtrados = filtro === 'todos' ? items : items.filter(i => i.estado === filtro)

  const guardar = () => {
    if (!form.descripcion) return
    const id = Math.max(0, ...items.map(i => i.id)) + 1
    setItems(prev => [...prev, { id, ...form }])
    setShowModal(false); setForm({ ...empty })
  }
  const eliminar = (id: number) => { if (window.confirm('¿Eliminar?')) setItems(prev => prev.filter(i => i.id !== id)) }

  return (
    <div className="iso-page">
      <div className="iso-page__header">
        <div className="iso-page__title-block">
          <h1>⚙️ Control de las Salidas No Conformes</h1>
          <p>Identificación, control y disposición de productos y servicios que no cumplen los requisitos</p>
          <span className="iso-page__clause">Cláusula 8.7</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {(['Abierta','En tratamiento','Cerrada'] as const).map(e => (
            <div key={e} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.5rem 0.85rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1b3a6b' }}>{items.filter(i => i.estado === e).length}</div>
              <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>{e}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="iso-info-box">
        <span className="iso-info-box__icon">📌</span>
        <span><strong>Cláusula 8.7</strong> — La organización debe asegurarse de que las salidas que no sean conformes con sus requisitos se identifican y se controlan para prevenir su uso o entrega no intencionados. La disposición debe documentarse.</span>
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">
          <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
            <option value="todos">Todos</option><option>Abierta</option><option>En tratamiento</option><option>Cerrada</option>
          </select>
        </div>
        <button className="iso-btn-primary" onClick={() => setShowModal(true)}>＋ Registrar salida NC</button>
      </div>

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr><th>#</th><th>Código</th><th>Descripción</th><th>Proceso</th><th>Detectado en</th><th>Disposición</th><th>Responsable</th><th>Fecha</th><th>Acción tomada</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {filtrados.map((r, i) => (
              <tr key={r.id}>
                <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                <td style={{ fontWeight: 600, color: '#1b3a6b', fontSize: '0.78rem' }}>{r.codigo}</td>
                <td style={{ fontWeight: 500 }}>{r.descripcion}</td>
                <td>{r.proceso}</td>
                <td><span className="iso-badge azul">{r.detectadoEn}</span></td>
                <td><span className="iso-badge amarillo">{r.disposicion}</span></td>
                <td>{r.responsable}</td>
                <td>{r.fecha}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.accionTomada}</td>
                <td><span className={`iso-badge ${r.estado === 'Cerrada' ? 'verde' : r.estado === 'En tratamiento' ? 'amarillo' : 'rojo'}`}>{r.estado}</span></td>
                <td><button className="iso-btn-icon danger" onClick={() => eliminar(r.id)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="iso-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2>➕ Registrar salida no conforme</h2>
            <div className="iso-form-row">
              <div className="iso-field"><label>Código</label><input type="text" placeholder="ej. SNC-2025-003" value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} /></div>
              <div className="iso-field"><label>Proceso</label><input type="text" value={form.proceso} onChange={e => setForm(p => ({ ...p, proceso: e.target.value }))} /></div>
            </div>
            <div className="iso-field"><label>Descripción de la no conformidad *</label><textarea rows={2} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Detectado en</label>
                <select value={form.detectadoEn} onChange={e => setForm(p => ({ ...p, detectadoEn: e.target.value as any }))}>
                  <option>Producción</option><option>Inspección final</option><option>Entrega</option><option>Postventa</option><option>Proveedor</option>
                </select>
              </div>
              <div className="iso-field"><label>Disposición</label>
                <select value={form.disposicion} onChange={e => setForm(p => ({ ...p, disposicion: e.target.value as any }))}>
                  <option>Reparar</option><option>Reprocesar</option><option>Concesión al cliente</option><option>Devolver al proveedor</option><option>Desechar</option>
                </select>
              </div>
            </div>
            <div className="iso-field"><label>Acción tomada</label><textarea rows={2} value={form.accionTomada} onChange={e => setForm(p => ({ ...p, accionTomada: e.target.value }))} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Responsable</label><input type="text" value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} /></div>
              <div className="iso-field"><label>Fecha</label><input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Verificado por</label><input type="text" value={form.verificadoPor} onChange={e => setForm(p => ({ ...p, verificadoPor: e.target.value }))} /></div>
              <div className="iso-field"><label>Estado</label>
                <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as any }))}>
                  <option>Abierta</option><option>En tratamiento</option><option>Cerrada</option>
                </select>
              </div>
            </div>
            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardar} disabled={!form.descripcion}>＋ Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalidasNCPage
