import React, { useState, useMemo } from 'react'
import '../iso-module.css'
import './ProduccionServicioPage.css'
import { useFetch } from '../../hooks/useFetch'
import {
  produccionService, fichasTecnicasPSService, documentosService, competenciasService,
  OrdenProduccionItem, PuntoControlProduccion, PersonalAsignadoItem,
} from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

const empty = {
  codigo: '', productoServicio: '', cliente: '', cantidad: '',
  instruccionTrabajo: '', equipos: '', responsable: '', fechaInicio: '', fechaEntrega: '',
  etapa: 'Programado' as string, conformidad: 'Pendiente inspección' as string,
  fichaTecnicaId: '', documentoInstructivoId: '', infraestructuraAmbiente: '',
  personalAsignado: [] as PersonalAsignadoItem[],
  seguimientoPostventa: '', fechaPostventa: '',
}

const emptyPC = {
  puntoControl: '', parametro: '', criterioAceptacion: '', valorMedido: '', unidad: '',
  instrumentoMedicion: '', resultado: 'Pendiente' as 'Conforme' | 'No conforme' | 'Pendiente',
  responsable: '', observaciones: '',
}

const etapaColor: Record<string, string> = { 'Programado': 'gris', 'En proceso': 'azul', 'Control de calidad': 'amarillo', 'Entregado': 'verde' }
const resultadoColor: Record<string, string> = { 'Conforme': 'verde', 'No conforme': 'rojo', 'Pendiente': 'amarillo' }
const liberacionColor: Record<string, string> = { 'Liberado': 'verde', 'Retenido': 'amarillo', 'Rechazado': 'rojo' }

const ProduccionServicioPage: React.FC = () => {
  const { canEdit, canCreate, canDelete, isReadOnly } = usePermissions('produccion')
  const { data: ordenes, loading, refetch } = useFetch<OrdenProduccionItem[]>(produccionService.getAll, [])
  const { data: fichasTecnicas } = useFetch(fichasTecnicasPSService.getAll, [])
  const { data: documentos } = useFetch(documentosService.getAll, [])
  const { data: personalDisponible } = useFetch(competenciasService.getPersonal, [])

  const instructivos = useMemo(() => documentos.filter((d: any) => d.tipo === 'Instrucción'), [documentos])

  /* ── Modal: crear / editar orden ─────────────────────────── */
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [tab, setTab] = useState<'general' | 'recursos' | 'postventa'>('general')
  const [form, setForm] = useState({ ...empty })
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setEditingId(null); setForm({ ...empty }); setTab('general'); setShowModal(true)
  }

  const openEdit = (o: OrdenProduccionItem) => {
    setEditingId(o.id)
    setForm({
      codigo: o.codigo, productoServicio: o.producto_servicio, cliente: o.cliente ?? '',
      cantidad: o.cantidad ?? '', instruccionTrabajo: o.instruccion_trabajo ?? '', equipos: o.equipos ?? '',
      responsable: o.responsable ?? '', fechaInicio: o.fecha_inicio ?? '', fechaEntrega: o.fecha_entrega ?? '',
      etapa: o.etapa, conformidad: o.conformidad,
      fichaTecnicaId: o.ficha_tecnica_id ?? '', documentoInstructivoId: o.documento_instructivo_id ? String(o.documento_instructivo_id) : '',
      infraestructuraAmbiente: o.infraestructura_ambiente ?? '',
      personalAsignado: o.personal_asignado ?? [],
      seguimientoPostventa: o.seguimiento_postventa ?? '', fechaPostventa: o.fecha_postventa ?? '',
    })
    setTab('general')
    setShowModal(true)
  }

  const togglePersonal = (p: any) => {
    setForm(prev => {
      const yaEsta = prev.personalAsignado.some(x => x.id === p.id)
      return {
        ...prev,
        personalAsignado: yaEsta
          ? prev.personalAsignado.filter(x => x.id !== p.id)
          : [...prev.personalAsignado, { id: p.id, nombre: p.nombre, cargo: p.cargo }],
      }
    })
  }

  const guardar = async () => {
    if (!form.productoServicio) return
    setSaving(true)
    try {
      const body = {
        codigo: form.codigo, producto_servicio: form.productoServicio, cliente: form.cliente,
        cantidad: form.cantidad, instruccion_trabajo: form.instruccionTrabajo, equipos: form.equipos,
        responsable: form.responsable, fecha_inicio: form.fechaInicio, fecha_entrega: form.fechaEntrega,
        etapa: form.etapa, conformidad: form.conformidad,
        ficha_tecnica_id: form.fichaTecnicaId || null,
        documento_instructivo_id: form.documentoInstructivoId ? Number(form.documentoInstructivoId) : null,
        infraestructura_ambiente: form.infraestructuraAmbiente,
        personal_asignado: form.personalAsignado,
        seguimiento_postventa: form.seguimientoPostventa,
        fecha_postventa: form.fechaPostventa || null,
      }
      if (editingId) {
        await produccionService.update(editingId, body)
      } else {
        await produccionService.create(body)
      }
      await refetch()
      setShowModal(false); setForm({ ...empty }); setEditingId(null)
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar esta orden? También se eliminarán sus puntos de control.')) return
    try { await produccionService.delete(id) } catch {}
    await refetch()
  }

  /* ── Modal: puntos de control (seguimiento y medición) ───── */
  const [showPCModal, setShowPCModal] = useState(false)
  const [pcOrden, setPcOrden] = useState<OrdenProduccionItem | null>(null)
  const [pcList, setPcList] = useState<PuntoControlProduccion[]>([])
  const [pcLoading, setPcLoading] = useState(false)
  const [formPC, setFormPC] = useState({ ...emptyPC })
  const [savingPC, setSavingPC] = useState(false)

  const abrirPuntosControl = async (o: OrdenProduccionItem) => {
    setPcOrden(o); setFormPC({ ...emptyPC }); setShowPCModal(true); setPcLoading(true)
    try {
      const rows = await produccionService.getPuntosControl(o.id)
      setPcList(rows)
    } catch (e: any) { alert(e.message) } finally { setPcLoading(false) }
  }

  const guardarPuntoControl = async () => {
    if (!pcOrden || !formPC.puntoControl) return
    setSavingPC(true)
    try {
      await produccionService.addPuntoControl(pcOrden.id, {
        punto_control: formPC.puntoControl, parametro: formPC.parametro,
        criterio_aceptacion: formPC.criterioAceptacion, valor_medido: formPC.valorMedido,
        unidad: formPC.unidad, instrumento_medicion: formPC.instrumentoMedicion,
        resultado: formPC.resultado, responsable: formPC.responsable,
        observaciones: formPC.observaciones,
      })
      const rows = await produccionService.getPuntosControl(pcOrden.id)
      setPcList(rows)
      setFormPC({ ...emptyPC })
      await refetch()
    } catch (e: any) { alert(e.message) } finally { setSavingPC(false) }
  }

  const eliminarPuntoControl = async (pcId: number) => {
    if (!pcOrden) return
    if (!window.confirm('¿Eliminar este punto de control?')) return
    try {
      await produccionService.deletePuntoControl(pcId)
      const rows = await produccionService.getPuntosControl(pcOrden.id)
      setPcList(rows)
      await refetch()
    } catch (e: any) { alert(e.message) }
  }

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
        <span><strong>Cláusula 8.5</strong> — La organización debe implementar la producción y provisión del servicio bajo condiciones controladas: información documentada (ficha técnica e instructivo de trabajo), equipos adecuados, seguimiento y medición mediante puntos de control, infraestructura y ambiente apropiados, personal competente, y actividades de liberación, entrega y postventa.</span>
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">
          Órdenes activas: <strong>{ordenes.filter(o => o.etapa !== 'Entregado').length}</strong> &nbsp;·&nbsp;
          Entregadas: <strong>{ordenes.filter(o => o.etapa === 'Entregado').length}</strong> &nbsp;·&nbsp;
          Puntos de control no conformes: <strong style={{ color: (ordenes.reduce((s, o) => s + (o.puntos_control_no_conformes || 0), 0) > 0) ? '#dc2626' : undefined }}>
            {ordenes.reduce((s, o) => s + (o.puntos_control_no_conformes || 0), 0)}
          </strong>
        </div>
        <button className="iso-btn-primary" onClick={openCreate} disabled={!canCreate} title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Nueva orden</button>
      </div>

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr>
              <th>#</th><th>Código</th><th>Producto / Servicio</th><th>Cliente</th>
              <th>Ficha técnica</th><th>Instructivo</th><th>Equipos</th><th>Personal</th>
              <th>Entrega</th><th>Etapa</th><th>Conformidad</th><th>Liberación</th>
              <th>Puntos de control</th><th></th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map((o, i) => (
              <tr key={o.id}>
                <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                <td style={{ fontWeight: 600, color: '#1b3a6b', fontSize: '0.78rem', cursor: 'pointer' }} onClick={() => openEdit(o)}>{o.codigo}</td>
                <td>{o.producto_servicio}</td>
                <td>{o.cliente}</td>
                <td>
                  {o.ficha_tecnica_id ? (
                    <span className="pv-link-badge">
                      <span className="pv-link-badge__code">{o.ficha_tecnica_producto || o.ficha_tecnica_id}</span>
                      <span className="pv-link-badge__meta">v{o.ficha_tecnica_version} · {o.ficha_tecnica_estado}</span>
                    </span>
                  ) : <span className="pv-link-empty">Sin ficha</span>}
                </td>
                <td>
                  {o.documento_instructivo_id ? (
                    <span className="pv-link-badge">
                      <span className="pv-link-badge__code">{o.documento_instructivo_codigo}</span>
                      <span className="pv-link-badge__meta">v{o.documento_instructivo_version} · {o.documento_instructivo_estado}</span>
                    </span>
                  ) : o.instruccion_trabajo
                    ? <span className="pv-link-badge__meta">{o.instruccion_trabajo}</span>
                    : <span className="pv-link-empty">Sin instructivo</span>}
                </td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{o.equipos}</td>
                <td>
                  {o.personal_asignado && o.personal_asignado.length > 0 ? (
                    <div className="pv-chip-list">
                      {o.personal_asignado.slice(0, 2).map((p, idx) => <span className="pv-chip" key={idx}>{p.nombre}</span>)}
                      {o.personal_asignado.length > 2 && <span className="pv-chip">+{o.personal_asignado.length - 2}</span>}
                    </div>
                  ) : <span className="pv-link-empty">Sin asignar</span>}
                </td>
                <td>{o.fecha_entrega}</td>
                <td><span className={`iso-badge ${etapaColor[o.etapa]}`}>{o.etapa}</span></td>
                <td><span className={`iso-badge ${o.conformidad === 'Conforme' ? 'verde' : o.conformidad === 'No conforme' ? 'rojo' : 'amarillo'}`}>{o.conformidad}</span></td>
                <td>
                  {o.liberacion_decision
                    ? <span className={`iso-badge ${liberacionColor[o.liberacion_decision]}`}>{o.liberacion_decision}</span>
                    : <span className="pv-link-empty">Pendiente</span>}
                </td>
                <td>
                  <button className="iso-btn-secondary" onClick={() => abrirPuntosControl(o)} style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}>
                    🎯 {o.puntos_control_total || 0}
                    {(o.puntos_control_no_conformes || 0) > 0 && <span style={{ color: '#dc2626', marginLeft: '0.25rem' }}>({o.puntos_control_no_conformes} NC)</span>}
                  </button>
                </td>
                <td style={{ display: 'flex', gap: '0.3rem' }}>
                  <button className="iso-btn-icon" onClick={() => openEdit(o)} title="Ver / editar">✏️</button>
                  <PermissionGuard recurso="produccion" accion="eliminar" mode="hide">
                    <button className="iso-btn-icon danger" onClick={() => eliminar(o.id)}>🗑️</button>
                  </PermissionGuard>
                </td>
              </tr>
            ))}
            {!loading && ordenes.length === 0 && (
              <tr><td colSpan={14} className="iso-empty">
                <div className="iso-empty__icon">📦</div>
                No hay órdenes de producción registradas
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal: crear / editar orden ─────────────────────── */}
      {showModal && (
        <div className="iso-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="iso-modal pv-modal--wide" onClick={e => e.stopPropagation()}>
            <h2>{editingId ? `✏️ Orden ${form.codigo}` : '➕ Nueva orden de producción / servicio'}</h2>

            <div className="pv-tabs">
              <button className={`pv-tab-btn ${tab === 'general' ? 'active' : ''}`} onClick={() => setTab('general')}>📋 General</button>
              <button className={`pv-tab-btn ${tab === 'recursos' ? 'active' : ''}`} onClick={() => setTab('recursos')}>🏭 Recursos y personal</button>
              <button className={`pv-tab-btn ${tab === 'postventa' ? 'active' : ''}`} onClick={() => setTab('postventa')}>📦 Liberación y postventa</button>
            </div>

            {tab === 'general' && (
              <>
                <div className="iso-form-row">
                  <div className="iso-field"><label>Código</label><input type="text" placeholder="ej. OP-2025-003" value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} disabled={!canEdit || !!editingId} /></div>
                  <div className="iso-field"><label>Producto / Servicio *</label><input type="text" value={form.productoServicio} onChange={e => setForm(p => ({ ...p, productoServicio: e.target.value }))} disabled={!canEdit} /></div>
                </div>
                <div className="iso-form-row">
                  <div className="iso-field"><label>Cliente</label><input type="text" value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} disabled={!canEdit} /></div>
                  <div className="iso-field"><label>Cantidad</label><input type="text" value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} disabled={!canEdit} /></div>
                </div>
                <div className="iso-form-row">
                  <div className="iso-field"><label>Responsable</label><input type="text" value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} disabled={!canEdit} /></div>
                  <div className="iso-field"><label>Equipos utilizados</label><input type="text" placeholder="ej. Máquina de corte CNC-02" value={form.equipos} onChange={e => setForm(p => ({ ...p, equipos: e.target.value }))} disabled={!canEdit} /></div>
                </div>
                <div className="iso-form-row">
                  <div className="iso-field"><label>Fecha inicio</label><input type="date" value={form.fechaInicio} onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))} disabled={!canEdit} /></div>
                  <div className="iso-field"><label>Fecha entrega</label><input type="date" value={form.fechaEntrega} onChange={e => setForm(p => ({ ...p, fechaEntrega: e.target.value }))} disabled={!canEdit} /></div>
                </div>
                <div className="iso-form-row">
                  <div className="iso-field"><label>Etapa</label>
                    <select value={form.etapa} onChange={e => setForm(p => ({ ...p, etapa: e.target.value }))} disabled={!canEdit}>
                      <option>Programado</option><option>En proceso</option><option>Control de calidad</option><option>Entregado</option>
                    </select>
                  </div>
                  <div className="iso-field"><label>Conformidad</label>
                    <select value={form.conformidad} onChange={e => setForm(p => ({ ...p, conformidad: e.target.value }))} disabled={!canEdit}>
                      <option>Pendiente inspección</option><option>Conforme</option><option>No conforme</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {tab === 'recursos' && (
              <>
                <p className="pv-section-title">📄 Información documentada del producto/servicio (§8.5.1 a)</p>
                <div className="iso-form-row">
                  <div className="iso-field">
                    <label>Ficha técnica del producto/servicio terminado</label>
                    <select value={form.fichaTecnicaId} onChange={e => setForm(p => ({ ...p, fichaTecnicaId: e.target.value }))} disabled={!canEdit}>
                      <option value="">— Sin vincular —</option>
                      {fichasTecnicas.map((f: any) => (
                        <option key={f.id} value={f.id}>{f.producto_servicio || f.id} (v{f.version} · {f.estado})</option>
                      ))}
                    </select>
                  </div>
                  <div className="iso-field">
                    <label>Instructivo de trabajo</label>
                    <select value={form.documentoInstructivoId} onChange={e => setForm(p => ({ ...p, documentoInstructivoId: e.target.value }))} disabled={!canEdit}>
                      <option value="">— Sin vincular —</option>
                      {instructivos.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.codigo} — {d.titulo} (v{d.version} · {d.estado})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="iso-form-row full">
                  <div className="iso-field">
                    <label>Instrucción de trabajo (texto libre, si no hay documento formal aún)</label>
                    <input type="text" placeholder="ej. IT-PRO-001 v1.0" value={form.instruccionTrabajo} onChange={e => setForm(p => ({ ...p, instruccionTrabajo: e.target.value }))} disabled={!canEdit} />
                  </div>
                </div>

                <p className="pv-section-title">🏭 Infraestructura y ambiente de operación (§8.5.1 c/d)</p>
                <div className="iso-form-row full">
                  <div className="iso-field">
                    <textarea rows={3} placeholder="ej. Planta climatizada, área de ensamble con piso antiestático, iluminación 500 lux..." value={form.infraestructuraAmbiente} onChange={e => setForm(p => ({ ...p, infraestructuraAmbiente: e.target.value }))} disabled={!canEdit} />
                  </div>
                </div>

                <p className="pv-section-title">👥 Personal competente asignado (§8.5.1 e / §7.2)</p>
                <div className="pv-personal-grid">
                  {personalDisponible.length === 0 && <div className="pv-personal-empty">No hay personal registrado en Competencias.</div>}
                  {personalDisponible.map((p: any) => (
                    <label className="pv-personal-check" key={p.id}>
                      <input type="checkbox" checked={form.personalAsignado.some(x => x.id === p.id)} onChange={() => togglePersonal(p)} disabled={!canEdit} />
                      {p.nombre}{p.cargo ? ` — ${p.cargo}` : ''}
                    </label>
                  ))}
                </div>
              </>
            )}

            {tab === 'postventa' && (
              <>
                <p className="pv-section-title">✅ Liberación de productos y servicios (§8.6)</p>
                <div className="iso-info-box" style={{ fontSize: '0.78rem' }}>
                  <span className="iso-info-box__icon">ℹ️</span>
                  <span>
                    {editingId
                      ? (
                        <>Estado de liberación más reciente para el código <strong>{form.codigo}</strong>: {' '}
                          {ordenes.find(o => o.id === editingId)?.liberacion_decision
                            ? <span className={`iso-badge ${liberacionColor[ordenes.find(o => o.id === editingId)!.liberacion_decision!]}`}>{ordenes.find(o => o.id === editingId)!.liberacion_decision}</span>
                            : 'aún sin registrar'}. Los registros de inspección y autorización se gestionan en el módulo <strong>Liberación de Productos y Servicios (§8.6)</strong>.</>
                      )
                      : 'Una vez guardada la orden, podrás liberarla desde el módulo Liberación de Productos y Servicios (§8.6).'}
                  </span>
                </div>

                <p className="pv-section-title">📮 Actividades de postventa (§8.5.5 b)</p>
                <div className="iso-form-row">
                  <div className="iso-field">
                    <label>Fecha de seguimiento posventa</label>
                    <input type="date" value={form.fechaPostventa} onChange={e => setForm(p => ({ ...p, fechaPostventa: e.target.value }))} disabled={!canEdit} />
                  </div>
                </div>
                <div className="iso-form-row full">
                  <div className="iso-field">
                    <label>Seguimiento posventa realizado</label>
                    <textarea rows={3} placeholder="ej. Llamada de satisfacción al cliente el 15/03, sin observaciones. Garantía activa hasta..." value={form.seguimientoPostventa} onChange={e => setForm(p => ({ ...p, seguimientoPostventa: e.target.value }))} disabled={!canEdit} />
                  </div>
                </div>
              </>
            )}

            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardar} disabled={!form.productoServicio || !canEdit || saving} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {saving ? 'Guardando…' : '＋ Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: puntos de control (seguimiento y medición) ── */}
      {showPCModal && pcOrden && (
        <div className="iso-modal-overlay" onClick={() => setShowPCModal(false)}>
          <div className="iso-modal pv-modal--wide" onClick={e => e.stopPropagation()}>
            <h2>🎯 Puntos de control — {pcOrden.codigo}</h2>
            <div className="iso-info-box" style={{ fontSize: '0.78rem' }}>
              <span className="iso-info-box__icon">📌</span>
              <span><strong>§8.5.1 b)</strong> — Seguimiento y medición durante el proceso de transformación. Registra cada punto de control con su criterio de aceptación, valor medido y resultado.</span>
            </div>

            <div className="pv-pc-table-wrapper">
              <table className="pv-pc-table">
                <thead>
                  <tr>
                    <th>Fecha</th><th>Punto de control</th><th>Parámetro</th><th>Criterio de aceptación</th>
                    <th>Valor medido</th><th>Instrumento</th><th>Resultado</th><th>Responsable</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {pcLoading && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '1rem', opacity: 0.6 }}>Cargando…</td></tr>}
                  {!pcLoading && pcList.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '1rem', opacity: 0.6 }}>Sin puntos de control registrados aún</td></tr>
                  )}
                  {pcList.map(pc => (
                    <tr key={pc.id}>
                      <td>{new Date(pc.fecha).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600 }}>{pc.punto_control}</td>
                      <td>{pc.parametro}</td>
                      <td>{pc.criterio_aceptacion}</td>
                      <td>{pc.valor_medido} {pc.unidad}</td>
                      <td>{pc.instrumento_medicion}</td>
                      <td><span className={`iso-badge ${resultadoColor[pc.resultado]}`}>{pc.resultado}</span></td>
                      <td>{pc.responsable}</td>
                      <td>
                        <PermissionGuard recurso="produccion" accion="eliminar" mode="hide">
                          <button className="iso-btn-icon danger" onClick={() => eliminarPuntoControl(pc.id)}>🗑️</button>
                        </PermissionGuard>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="pv-section-title">➕ Registrar nuevo punto de control</p>
            <div className="pv-pc-form">
              <div className="iso-field"><label>Punto de control *</label><input type="text" placeholder="ej. Inspección dimensional, Recepción MP" value={formPC.puntoControl} onChange={e => setFormPC(p => ({ ...p, puntoControl: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Parámetro controlado</label><input type="text" placeholder="ej. Diámetro, temperatura" value={formPC.parametro} onChange={e => setFormPC(p => ({ ...p, parametro: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field span2"><label>Criterio de aceptación</label><input type="text" placeholder="ej. 50mm ± 0.5mm" value={formPC.criterioAceptacion} onChange={e => setFormPC(p => ({ ...p, criterioAceptacion: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Valor medido</label><input type="text" value={formPC.valorMedido} onChange={e => setFormPC(p => ({ ...p, valorMedido: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Unidad</label><input type="text" placeholder="ej. mm, °C, %" value={formPC.unidad} onChange={e => setFormPC(p => ({ ...p, unidad: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Instrumento de medición</label><input type="text" placeholder="ej. Calibrador pie de rey" value={formPC.instrumentoMedicion} onChange={e => setFormPC(p => ({ ...p, instrumentoMedicion: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Resultado</label>
                <select value={formPC.resultado} onChange={e => setFormPC(p => ({ ...p, resultado: e.target.value as any }))} disabled={!canEdit}>
                  <option>Pendiente</option><option>Conforme</option><option>No conforme</option>
                </select>
              </div>
              <div className="iso-field"><label>Responsable</label><input type="text" value={formPC.responsable} onChange={e => setFormPC(p => ({ ...p, responsable: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field span2"><label>Observaciones</label><input type="text" value={formPC.observaciones} onChange={e => setFormPC(p => ({ ...p, observaciones: e.target.value }))} disabled={!canEdit} /></div>
            </div>

            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowPCModal(false)}>Cerrar</button>
              <button className="iso-btn-primary" onClick={guardarPuntoControl} disabled={!formPC.puntoControl || !canEdit || savingPC}>
                {savingPC ? 'Guardando…' : '＋ Registrar control'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProduccionServicioPage
