import React, { useState } from 'react'
import '../iso-module.css'
import { useFetch } from '../../hooks/useFetch'
import { mejoraContinuaService } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

const empty = { codigo: '', titulo: '', origen: 'Sugerencia' as const, proceso: '', descripcion: '', beneficioEsperado: '', responsable: '', fechaInicio: '', fechaCierre: '', avancePct: 0, estado: 'Propuesta' as const }

const MejoraContinuaPage: React.FC = () => {
  const { canEdit, isReadOnly } = usePermissions('mejoras_continuas')
  const { data: itemsDB, loading, refetch } = useFetch(mejoraContinuaService.getAll, [])
  const items = itemsDB.map((r: any) => ({
    id: r.id, codigo: r.codigo, titulo: r.titulo, origen: r.origen, proceso: r.proceso ?? '',
    descripcion: r.descripcion ?? '', beneficioEsperado: r.beneficio_esperado ?? '',
    responsable: r.responsable ?? '', fechaInicio: r.fecha_inicio ?? '', fechaCierre: r.fecha_cierre ?? '',
    avancePct: r.avance_pct, estado: r.estado,
  }))

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [filtro, setFiltro] = useState('todos')

  const filtrados = filtro === 'todos' ? items : items.filter(i => i.estado === filtro)

  const guardar = async () => {
    if (!form.titulo) return
    try {
      await mejoraContinuaService.create({
        codigo: form.codigo, titulo: form.titulo, origen: form.origen, proceso: form.proceso,
        descripcion: form.descripcion, beneficio_esperado: form.beneficioEsperado,
        responsable: form.responsable, fecha_inicio: form.fechaInicio, fecha_cierre: form.fechaCierre,
        avance_pct: form.avancePct, estado: form.estado,
      })
      await refetch()
      setShowModal(false); setForm({ ...empty })
    } catch (e: any) { alert(e.message) }
  }

  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar?')) return
    try { await mejoraContinuaService.delete(id) } catch {}
    await refetch()
  }

  const completadas = items.filter(i => i.estado === 'Completada').length
  const enEjecucion = items.filter(i => i.estado === 'En ejecución').length

  return (
    <div className="iso-page">
      <div className="iso-page__header">
        <div className="iso-page__title-block">
          <h1>♾️ Mejora Continua</h1>
          <p>Gestión de iniciativas de mejora para incrementar el desempeño del Sistema de Gestión de Calidad</p>
          <span className="iso-page__clause">Cláusula 10.3</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.6rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#065f46' }}>{completadas}</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Completadas</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.6rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2e86de' }}>{enEjecucion}</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>En ejecución</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.6rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1b3a6b' }}>{items.length}</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Total iniciativas</div>
          </div>
        </div>
      </div>

      <div className="iso-info-box">
        <span className="iso-info-box__icon">📌</span>
        <span><strong>Cláusula 10.3</strong> — La organización debe mejorar continuamente la conveniencia, adecuación y eficacia del SGC. Debe considerar los resultados del análisis y la evaluación, las salidas de la revisión por la dirección, para determinar necesidades u oportunidades de mejora.</span>
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">
          Mostrando <strong>{filtrados.length}</strong> de <strong>{items.length}</strong> &nbsp;·&nbsp;
          <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
            <option value="todos">Todos</option>
            <option>Propuesta</option><option>Aprobada</option><option>En ejecución</option><option>Completada</option><option>Cancelada</option>
          </select>
        </div>
        <button className="iso-btn-primary" onClick={() => setShowModal(true)} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Nueva iniciativa</button>
      </div>

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr><th>#</th><th>Código</th><th>Iniciativa</th><th>Origen</th><th>Proceso</th><th>Beneficio esperado</th><th>Responsable</th><th>Cierre</th><th>Avance</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {filtrados.map((r, i) => (
              <tr key={r.id}>
                <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                <td style={{ fontWeight: 600, color: '#1b3a6b', fontSize: '0.78rem' }}>{r.codigo}</td>
                <td style={{ fontWeight: 500 }}>{r.titulo}</td>
                <td><span className="iso-badge azul">{r.origen}</span></td>
                <td>{r.proceso}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.beneficioEsperado}</td>
                <td>{r.responsable}</td>
                <td>{r.fechaCierre}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 999, minWidth: 60 }}>
                      <div style={{ height: '100%', borderRadius: 999, background: r.avancePct === 100 ? '#10b981' : r.avancePct > 50 ? '#2e86de' : '#f59e0b', width: `${r.avancePct}%`, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#374151', fontWeight: 600 }}>{r.avancePct}%</span>
                  </div>
                </td>
                <td><span className={`iso-badge ${r.estado === 'Completada' ? 'verde' : r.estado === 'En ejecución' ? 'azul' : r.estado === 'Aprobada' ? 'amarillo' : r.estado === 'Cancelada' ? 'rojo' : 'gris'}`}>{r.estado}</span></td>
                <td>
                  <PermissionGuard recurso="mejoras_continuas" accion="eliminar" mode="hide">
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
            <h2>➕ Nueva iniciativa de mejora</h2>
            <div className="iso-form-row">
              <div className="iso-field"><label>Código</label><input type="text" placeholder="ej. MC-2025-004" value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Origen</label>
                <select value={form.origen} onChange={e => setForm(p => ({ ...p, origen: e.target.value as any }))} disabled={!canEdit}>
                  <option>Auditoría</option><option>Indicador</option><option>Revisión dirección</option><option>Sugerencia</option><option>Análisis de datos</option><option>Quejas cliente</option>
                </select>
              </div>
            </div>
            <div className="iso-field"><label>Título de la iniciativa *</label><input type="text" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} disabled={!canEdit} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Proceso</label><input type="text" value={form.proceso} onChange={e => setForm(p => ({ ...p, proceso: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Responsable</label><input type="text" value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} disabled={!canEdit} /></div>
            </div>
            <div className="iso-field"><label>Descripción</label><textarea rows={2} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} disabled={!canEdit} /></div>
            <div className="iso-field"><label>Beneficio esperado</label><textarea rows={2} value={form.beneficioEsperado} onChange={e => setForm(p => ({ ...p, beneficioEsperado: e.target.value }))} disabled={!canEdit} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Fecha inicio</label><input type="date" value={form.fechaInicio} onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Fecha cierre</label><input type="date" value={form.fechaCierre} onChange={e => setForm(p => ({ ...p, fechaCierre: e.target.value }))} disabled={!canEdit} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Avance % (0-100)</label><input type="number" min={0} max={100} value={form.avancePct} onChange={e => setForm(p => ({ ...p, avancePct: Number(e.target.value) }))} disabled={!canEdit} /></div>
              <div className="iso-field"><label>Estado</label>
                <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as any }))} disabled={!canEdit}>
                  <option>Propuesta</option><option>Aprobada</option><option>En ejecución</option><option>Completada</option><option>Cancelada</option>
                </select>
              </div>
            </div>
            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardar} disabled={!form.titulo || !canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MejoraContinuaPage
