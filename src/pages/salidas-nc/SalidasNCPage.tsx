import React, { useMemo, useState } from 'react'
import '../iso-module.css'
import { useFetch } from '../../hooks/useFetch'
import { salidasNCService } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'
import DonutChart from '../../components/charts/DonutChart'

const DISPOSICION_COLOR: Record<string, string> = {
  'Separar / Aislar': '#9ca3af',
  'Reparar': '#3b82f6',
  'Reprocesar': '#0ea5e9',
  'Concesión al cliente': '#f59e0b',
  'Devolver al proveedor': '#8b5cf6',
  'Desechar': '#ef4444',
}

const empty = {
  codigo: '', descripcion: '', proceso: '',
  detectadoEn: 'Producción' as string, disposicion: 'Separar / Aislar' as string,
  responsable: '', fecha: new Date().toISOString().slice(0, 10),
  accionTomada: '', verificadoPor: '', estado: 'Abierta' as string,
  clienteInformado: false, fechaNotificacionCliente: '',
  concesionOtorgada: false, concesionAutorizadaPor: '',
  fechaConcesion: '', observacionesConcesion: '',
}

const SalidasNCPage: React.FC = () => {
  const { canEdit, isReadOnly } = usePermissions('salidas_nc')
  const { data: itemsDB, loading, refetch } = useFetch(salidasNCService.getAll, [])
  const items = itemsDB.map((r: any) => ({
    id: r.id, codigo: r.codigo ?? '', descripcion: r.descripcion, proceso: r.proceso ?? '',
    detectadoEn: r.detectado_en, disposicion: r.disposicion, responsable: r.responsable ?? '',
    fecha: r.fecha, accionTomada: r.accion_tomada ?? '', verificadoPor: r.verificado_por ?? '',
    estado: r.estado,
    clienteInformado: !!r.cliente_informado, fechaNotificacionCliente: r.fecha_notificacion_cliente ?? '',
    concesionOtorgada: !!r.concesion_otorgada, concesionAutorizadaPor: r.concesion_autorizada_por ?? '',
    fechaConcesion: r.fecha_concesion ?? '', observacionesConcesion: r.observaciones_concesion ?? '',
  }))

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [filtro, setFiltro] = useState('todos')

  const filtrados = filtro === 'todos' ? items : items.filter(i => i.estado === filtro)

  // ── Datos para el gráfico: qué disposición reciben las salidas NC ──
  const disposicionData = useMemo(() => {
    const orden = ['Separar / Aislar', 'Reparar', 'Reprocesar', 'Concesión al cliente', 'Devolver al proveedor', 'Desechar']
    return orden.map(d => ({
      label: d,
      value: items.filter(i => i.disposicion === d).length,
      color: DISPOSICION_COLOR[d] || '#9ca3af',
    }))
  }, [items])

  const totalConcesiones = items.filter(i => i.concesionOtorgada).length
  const totalClienteInformado = items.filter(i => i.clienteInformado).length

  const guardar = async () => {
    if (!form.descripcion) return
    if (form.concesionOtorgada && !form.concesionAutorizadaPor) {
      alert('Indica quién autorizó la concesión.')
      return
    }
    try {
      await salidasNCService.create({
        codigo: form.codigo, descripcion: form.descripcion, proceso: form.proceso,
        detectado_en: form.detectadoEn, disposicion: form.disposicion, responsable: form.responsable,
        fecha: form.fecha, accion_tomada: form.accionTomada, verificado_por: form.verificadoPor,
        estado: form.estado,
        cliente_informado: form.clienteInformado, fecha_notificacion_cliente: form.fechaNotificacionCliente || null,
        concesion_otorgada: form.concesionOtorgada, concesion_autorizada_por: form.concesionAutorizadaPor || null,
        fecha_concesion: form.fechaConcesion || null, observaciones_concesion: form.observacionesConcesion || null,
      })
      await refetch()
      setShowModal(false); setForm({ ...empty })
    } catch (e: any) { alert(e.message) }
  }

  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar?')) return
    try { await salidasNCService.delete(id) } catch {}
    await refetch()
  }

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
        <span><strong>Cláusula 8.7</strong> — La organización debe asegurarse de que las salidas que no sean conformes con sus requisitos se identifican y se controlan para prevenir su uso o entrega no intencionados. Cuando corresponda, debe informarse al cliente y documentarse la concesión o autorización con la que se acepta la salida.</span>
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          marginBottom: '1.25rem',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, auto) 1fr',
          columnGap: '2.5rem',
          rowGap: '1rem',
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#1b3a6b' }}>¿Qué sucede con las salidas no conformes? — Disposición</h3>
          <DonutChart data={disposicionData} centerLabel="registros" />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignContent: 'flex-start' }}>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.75rem 1rem', minWidth: '9rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1b3a6b' }}>{totalClienteInformado}/{items.length}</div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Casos con cliente informado</div>
          </div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.75rem 1rem', minWidth: '9rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1b3a6b' }}>{totalConcesiones}</div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Concesiones/autorizaciones otorgadas</div>
          </div>
        </div>
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">
          <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
            <option value="todos">Todos</option><option>Abierta</option><option>En tratamiento</option><option>Cerrada</option>
          </select>
        </div>
        <button className="iso-btn-primary" onClick={() => setShowModal(true)} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Registrar salida NC</button>
      </div>

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr><th>#</th><th>Código</th><th>Descripción</th><th>Proceso</th><th>Detectado en</th><th>Disposición</th><th>Responsable</th><th>Fecha</th><th>Acción tomada</th><th>Cliente informado</th><th>Concesión / autorizada por</th><th>Estado</th><th></th></tr>
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
                <td>
                  {r.clienteInformado
                    ? <span className="iso-badge verde">Sí{r.fechaNotificacionCliente ? ` · ${r.fechaNotificacionCliente}` : ''}</span>
                    : <span className="iso-badge gris">No aplica / No</span>}
                </td>
                <td>
                  {r.concesionOtorgada
                    ? <span className="iso-badge amarillo" title={r.observacionesConcesion}>{r.concesionAutorizadaPor || 'Autorizada'}{r.fechaConcesion ? ` · ${r.fechaConcesion}` : ''}</span>
                    : <span className="iso-badge gris">Sin concesión</span>}
                </td>
                <td><span className={`iso-badge ${r.estado === 'Cerrada' ? 'verde' : r.estado === 'En tratamiento' ? 'amarillo' : 'rojo'}`}>{r.estado}</span></td>
                <td>
                  <PermissionGuard recurso="salidas_nc" accion="eliminar" mode="hide">
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
            <h2>➕ Registrar salida no conforme</h2>
            <div className="iso-form-row">
              <div className="iso-field"><label>Código</label><input type="text" placeholder="ej. SNC-2025-003" value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Proceso</label><input type="text" value={form.proceso} onChange={e => setForm(p => ({ ...p, proceso: e.target.value }))} disabled={!canEdit} /></div>
            </div>
            <div className="iso-field"><label>Descripción de la no conformidad *</label><textarea rows={2} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} disabled={!canEdit} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Detectado en</label>
                <select value={form.detectadoEn} onChange={e => setForm(p => ({ ...p, detectadoEn: e.target.value as any }))} disabled={!canEdit}>
                  <option>Producción</option><option>Inspección final</option><option>Entrega</option><option>Postventa</option><option>Proveedor</option>
                </select>
              </div>
              <div className="iso-field"><label>Disposición</label>
                <select value={form.disposicion} onChange={e => setForm(p => ({ ...p, disposicion: e.target.value as any }))} disabled={!canEdit}>
                  <option>Separar / Aislar</option><option>Reparar</option><option>Reprocesar</option><option>Concesión al cliente</option><option>Devolver al proveedor</option><option>Desechar</option>
                </select>
              </div>
            </div>
            <div className="iso-field"><label>Acción tomada / corrección</label><textarea rows={2} value={form.accionTomada} onChange={e => setForm(p => ({ ...p, accionTomada: e.target.value }))} disabled={!canEdit} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Responsable</label><input type="text" value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Fecha</label><input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} disabled={!canEdit} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Verificado por</label><input type="text" value={form.verificadoPor} onChange={e => setForm(p => ({ ...p, verificadoPor: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Estado</label>
                <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as any }))} disabled={!canEdit}>
                  <option>Abierta</option><option>En tratamiento</option><option>Cerrada</option>
                </select>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0.75rem 0' }} />
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#1b3a6b' }}>§8.7.2 — Comunicación al cliente</p>
            <div className="iso-form-row">
              <div className="iso-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={form.clienteInformado} onChange={e => setForm(p => ({ ...p, clienteInformado: e.target.checked }))} disabled={!canEdit} id="clienteInformado" />
                <label htmlFor="clienteInformado" style={{ margin: 0 }}>Se informó al cliente de la no conformidad</label>
              </div>
              {form.clienteInformado && (
                <div className="iso-field"><label>Fecha de notificación</label><input type="date" value={form.fechaNotificacionCliente} onChange={e => setForm(p => ({ ...p, fechaNotificacionCliente: e.target.value }))} disabled={!canEdit} /></div>
              )}
            </div>

            <p style={{ margin: '0.75rem 0 0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#1b3a6b' }}>§8.7.1 c) — Concesión / autorización de aceptación</p>
            <div className="iso-form-row">
              <div className="iso-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={form.concesionOtorgada} onChange={e => setForm(p => ({ ...p, concesionOtorgada: e.target.checked }))} disabled={!canEdit} id="concesionOtorgada" />
                <label htmlFor="concesionOtorgada" style={{ margin: 0 }}>Se otorgó concesión / autorización para aceptar la salida</label>
              </div>
            </div>
            {form.concesionOtorgada && (
              <>
                <div className="iso-form-row">
                  <div className="iso-field"><label>Autorizada por *</label><input type="text" placeholder="Nombre / cargo de quien autoriza" value={form.concesionAutorizadaPor} onChange={e => setForm(p => ({ ...p, concesionAutorizadaPor: e.target.value }))} disabled={!canEdit} /></div>
                  <div className="iso-field"><label>Fecha de concesión</label><input type="date" value={form.fechaConcesion} onChange={e => setForm(p => ({ ...p, fechaConcesion: e.target.value }))} disabled={!canEdit} /></div>
                </div>
                <div className="iso-field"><label>Observaciones de la concesión</label><textarea rows={2} placeholder="Condiciones acordadas, alcance de la autorización, etc." value={form.observacionesConcesion} onChange={e => setForm(p => ({ ...p, observacionesConcesion: e.target.value }))} disabled={!canEdit} /></div>
              </>
            )}

            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardar} disabled={!form.descripcion || !canEdit || (form.concesionOtorgada && !form.concesionAutorizadaPor)} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalidasNCPage