import React, { useState } from 'react'
import '../iso-module.css'
import { useFetch } from '../../hooks/useFetch'
import { produccionService } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

const empty = { codigo: '', productoServicio: '', cliente: '', cantidad: '', instruccionTrabajo: '', equipos: '', responsable: '', fechaInicio: '', fechaEntrega: '', etapa: 'Programado' as const, conformidad: 'Pendiente inspección' as const }

const ProduccionServicioPage: React.FC = () => {
  const { canEdit, canCreate, canDelete, isReadOnly } = usePermissions('produccion')
  const { data: ordenesDB, loading, refetch } = useFetch(produccionService.getAll, [])
  const ordenes = ordenesDB.map((r: any) => ({
    id: r.id, codigo: r.codigo, productoServicio: r.producto_servicio, cliente: r.cliente ?? '',
    cantidad: r.cantidad ?? '', instruccionTrabajo: r.instruccion_trabajo ?? '', equipos: r.equipos ?? '',
    responsable: r.responsable ?? '', fechaInicio: r.fecha_inicio ?? '', fechaEntrega: r.fecha_entrega ?? '',
    etapa: r.etapa, conformidad: r.conformidad,
  }))

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...empty })

  const guardar = async () => {
    if (!form.productoServicio) return
    try {
      await produccionService.create({
        codigo: form.codigo, producto_servicio: form.productoServicio, cliente: form.cliente,
        cantidad: form.cantidad, instruccion_trabajo: form.instruccionTrabajo, equipos: form.equipos,
        responsable: form.responsable, fecha_inicio: form.fechaInicio, fecha_entrega: form.fechaEntrega,
        etapa: form.etapa, conformidad: form.conformidad,
      })
      await refetch()
      setShowModal(false); setForm({ ...empty })
    } catch (e: any) { alert(e.message) }
  }

  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar?')) return
    try { await produccionService.delete(id) } catch {}
    await refetch()
  }

  const etapaColor: Record<string, string> = { 'Programado': 'gris', 'En proceso': 'azul', 'Control de calidad': 'amarillo', 'Entregado': 'verde' }

  return (
    <div className="iso-page">
      <div className="iso-page__header">
        <div className="iso-page__title-block">
          <h1>⚙️ Producción y Provisión del Servicio</h1>
          <p>Control de las condiciones bajo las cuales se realizan la producción y la prestación del servicio</p>
          <span className="iso-page__clause">Cláusula 8.5</span>
        </div>
      </div>

      <div className="iso-info-box">
        <span className="iso-info-box__icon">📌</span>
        <span><strong>Cláusula 8.5</strong> — La organización debe implementar la producción y provisión del servicio bajo condiciones controladas: información documentada, recursos de seguimiento, infraestructura adecuada, personas competentes, validación de procesos especiales, trazabilidad y preservación de salidas.</span>
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">
          Órdenes activas: <strong>{ordenes.filter(o => o.etapa !== 'Entregado').length}</strong> &nbsp;·&nbsp;
          Entregadas: <strong>{ordenes.filter(o => o.etapa === 'Entregado').length}</strong>
        </div>
        <button className="iso-btn-primary" onClick={() => setShowModal(true)} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Nueva orden</button>
      </div>

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr><th>#</th><th>Código</th><th>Producto / Servicio</th><th>Cliente</th><th>Cantidad</th><th>Instrucción de trabajo</th><th>Responsable</th><th>Entrega</th><th>Etapa</th><th>Conformidad</th><th></th></tr>
          </thead>
          <tbody>
            {ordenes.map((o, i) => (
              <tr key={o.id}>
                <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                <td style={{ fontWeight: 600, color: '#1b3a6b', fontSize: '0.78rem' }}>{o.codigo}</td>
                <td>{o.productoServicio}</td>
                <td>{o.cliente}</td>
                <td>{o.cantidad}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{o.instruccionTrabajo}</td>
                <td>{o.responsable}</td>
                <td>{o.fechaEntrega}</td>
                <td><span className={`iso-badge ${etapaColor[o.etapa]}`}>{o.etapa}</span></td>
                <td><span className={`iso-badge ${o.conformidad === 'Conforme' ? 'verde' : o.conformidad === 'No conforme' ? 'rojo' : 'amarillo'}`}>{o.conformidad}</span></td>
                <td>
                  <PermissionGuard recurso="produccion" accion="eliminar" mode="hide">
                    <button className="iso-btn-icon danger" onClick={() => eliminar(o.id)}>🗑️</button>
                  </PermissionGuard>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="iso-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2>➕ Nueva orden de producción / servicio</h2>
            <div className="iso-form-row">
              <div className="iso-field"><label>Código</label><input type="text" placeholder="ej. OP-2025-003" value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Producto / Servicio *</label><input type="text" value={form.productoServicio} onChange={e => setForm(p => ({ ...p, productoServicio: e.target.value }))} disabled={!canEdit} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Cliente</label><input type="text" value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Cantidad</label><input type="text" value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} disabled={!canEdit} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Instrucción de trabajo</label><input type="text" placeholder="ej. IT-PRO-001 v1.0" value={form.instruccionTrabajo} onChange={e => setForm(p => ({ ...p, instruccionTrabajo: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Responsable</label><input type="text" value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} disabled={!canEdit} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Fecha inicio</label><input type="date" value={form.fechaInicio} onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Fecha entrega</label><input type="date" value={form.fechaEntrega} onChange={e => setForm(p => ({ ...p, fechaEntrega: e.target.value }))} disabled={!canEdit} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Etapa</label>
                <select value={form.etapa} onChange={e => setForm(p => ({ ...p, etapa: e.target.value as any }))} disabled={!canEdit}>
                  <option>Programado</option><option>En proceso</option><option>Control de calidad</option><option>Entregado</option>
                </select>
              </div>
              <div className="iso-field"><label>Conformidad</label>
                <select value={form.conformidad} onChange={e => setForm(p => ({ ...p, conformidad: e.target.value as any }))} disabled={!canEdit}>
                  <option>Pendiente inspección</option><option>Conforme</option><option>No conforme</option>
                </select>
              </div>
            </div>
            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardar} disabled={!form.productoServicio || !canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProduccionServicioPage
