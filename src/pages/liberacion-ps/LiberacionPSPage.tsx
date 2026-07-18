import React, { useState } from 'react'
import '../iso-module.css'
import { useFetch } from '../../hooks/useFetch'
import { liberacionPSService } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

const empty = { codigoOp: '', productoServicio: '', cliente: '', criteriosAceptacion: '', inspeccionRealizada: '', resultados: '', autorizadoPor: '', fecha: '', decision: 'Liberado' as const, observaciones: '' }

const LiberacionPSPage: React.FC = () => {
  const { canEdit } = usePermissions('liberacion_ps')
  const { data: itemsDB, loading, refetch } = useFetch(liberacionPSService.getAll, [])
  const items = itemsDB.map((r: any) => ({
    id: r.id, codigoOp: r.codigo_op ?? '', productoServicio: r.producto_servicio,
    cliente: r.cliente ?? '', criteriosAceptacion: r.criterios_aceptacion ?? '',
    inspeccionRealizada: r.inspeccion_realizada ?? '', resultados: r.resultados ?? '',
    autorizadoPor: r.autorizado_por ?? '', fecha: r.fecha, decision: r.decision,
    observaciones: r.observaciones ?? '',
  }))

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    if (!form.productoServicio) return
    setSaving(true)
    try {
      await liberacionPSService.create({
        codigo_op: form.codigoOp, producto_servicio: form.productoServicio, cliente: form.cliente,
        criterios_aceptacion: form.criteriosAceptacion, inspeccion_realizada: form.inspeccionRealizada,
        resultados: form.resultados, autorizado_por: form.autorizadoPor, fecha: form.fecha,
        decision: form.decision, observaciones: form.observaciones,
      })
      await refetch()
      setShowModal(false); setForm({ ...empty })
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }
  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar?')) return
    try { await liberacionPSService.delete(id) } catch {}
    await refetch()
  }

  return (
    <div className="iso-page">
      <div className="iso-page__header">
        <div className="iso-page__title-block">
          <h1>⚙️ Liberación de Productos y Servicios</h1>
          <p>Registros de inspección y decisiones de liberación para asegurar la conformidad antes de la entrega</p>
          <span className="iso-page__clause">Cláusula 8.6</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {(['Liberado','Retenido','Rechazado'] as const).map(d => (
            <div key={d} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.5rem 0.85rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1b3a6b' }}>{items.filter(i => i.decision === d).length}</div>
              <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="iso-info-box">
        <span className="iso-info-box__icon">📌</span>
        <span><strong>Cláusula 8.6</strong> — La organización debe implementar disposiciones planificadas para verificar que se cumplen los requisitos de los productos y servicios antes de su liberación. La información documentada debe incluir: evidencia de conformidad, trazabilidad a la persona que autoriza la liberación.</span>
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">Total registros: <strong>{items.length}</strong></div>
        <button className="iso-btn-primary" onClick={() => setShowModal(true)} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Nuevo registro</button>
      </div>

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr><th>#</th><th>Código OP</th><th>Producto / Servicio</th><th>Cliente</th><th>Criterios de aceptación</th><th>Inspección realizada</th><th>Resultados</th><th>Autorizado por</th><th>Fecha</th><th>Decisión</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={r.id}>
                <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                <td style={{ fontWeight: 600, color: '#1b3a6b', fontSize: '0.78rem' }}>{r.codigoOp}</td>
                <td>{r.productoServicio}</td>
                <td>{r.cliente}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.criteriosAceptacion}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.inspeccionRealizada}</td>
                <td style={{ fontSize: '0.78rem' }}>{r.resultados}</td>
                <td>{r.autorizadoPor}</td>
                <td>{r.fecha}</td>
                <td><span className={`iso-badge ${r.decision === 'Liberado' ? 'verde' : r.decision === 'Retenido' ? 'amarillo' : 'rojo'}`}>{r.decision}</span></td>
                <td>
                  <PermissionGuard recurso="liberacion_ps" accion="eliminar" mode="hide">
                    <button className="iso-btn-icon danger" onClick={() => eliminar(r.id)}>🗑️</button>
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
            <h2>➕ Nuevo registro de liberación</h2>
            <div className="iso-form-row">
              <div className="iso-field"><label>Código OP</label><input type="text" value={form.codigoOp} onChange={e => setForm(p => ({ ...p, codigoOp: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Producto / Servicio *</label><input type="text" value={form.productoServicio} onChange={e => setForm(p => ({ ...p, productoServicio: e.target.value }))} disabled={!canEdit} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Cliente</label><input type="text" value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Fecha</label><input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} disabled={!canEdit} /></div>
            </div>
            <div className="iso-field"><label>Criterios de aceptación</label><textarea rows={2} value={form.criteriosAceptacion} onChange={e => setForm(p => ({ ...p, criteriosAceptacion: e.target.value }))} disabled={!canEdit} /></div>
            <div className="iso-field"><label>Inspección realizada</label><textarea rows={2} value={form.inspeccionRealizada} onChange={e => setForm(p => ({ ...p, inspeccionRealizada: e.target.value }))} disabled={!canEdit} /></div>
            <div className="iso-field"><label>Resultados de inspección</label><textarea rows={2} value={form.resultados} onChange={e => setForm(p => ({ ...p, resultados: e.target.value }))} disabled={!canEdit} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Autorizado por</label><input type="text" value={form.autorizadoPor} onChange={e => setForm(p => ({ ...p, autorizadoPor: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Decisión</label>
                <select value={form.decision} onChange={e => setForm(p => ({ ...p, decision: e.target.value as any }))} disabled={!canEdit}>
                  <option>Liberado</option><option>Retenido</option><option>Rechazado</option>
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

export default LiberacionPSPage
