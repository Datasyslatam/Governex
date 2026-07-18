import React, { useState } from 'react'
import '../iso-module.css'
import { useFetch } from '../../hooks/useFetch'
import { comunicacionService } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

const empty = { que: '', cuando: '', quien: '', aQuien: '', como: '', tipo: 'Interna' as const, estado: 'Activo' as const }

const ComunicacionPage: React.FC = () => {
  const { data: itemsDB, loading, refetch } = useFetch(comunicacionService.getAll, [])
  const items = itemsDB.map((r: any) => ({
    id: r.id, que: r.que, cuando: r.cuando ?? '', quien: r.quien, aQuien: r.a_quien ?? '',
    como: r.como ?? '', tipo: r.tipo, estado: r.estado,
  }))

  const { canCreate, isReadOnly } = usePermissions('comunicaciones')

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [filtroTipo, setFiltroTipo] = useState('todos')

  const filtrados = filtroTipo === 'todos' ? items : items.filter(r => r.tipo === filtroTipo)

  const guardar = async () => {
    if (!form.que || !form.quien) return
    try {
      await comunicacionService.create({
        que: form.que, cuando: form.cuando, quien: form.quien, a_quien: form.aQuien,
        como: form.como, tipo: form.tipo, estado: form.estado,
      })
      await refetch()
      setShowModal(false); setForm({ ...empty })
    } catch (e: any) { alert(e.message) }
  }

  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar esta comunicación?')) return
    try { await comunicacionService.delete(id) } catch {}
    await refetch()
  }

  return (
    <div className="iso-page">
      <div className="iso-page__header">
        <div className="iso-page__title-block">
          <h1>🔋 Comunicación</h1>
          <p>Matriz de comunicaciones internas y externas del Sistema de Gestión de Calidad</p>
          <span className="iso-page__clause">Cláusula 7.4</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.6rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1b3a6b' }}>{items.filter(i => i.tipo === 'Interna').length}</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Internas</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.6rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2e86de' }}>{items.filter(i => i.tipo === 'Externa').length}</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Externas</div>
          </div>
        </div>
      </div>

      <div className="iso-info-box">
        <span className="iso-info-box__icon">📌</span>
        <span><strong>Cláusula 7.4</strong> — La organización debe determinar las comunicaciones internas y externas pertinentes al SGC, incluyendo: qué comunicar, cuándo comunicar, a quién comunicar, cómo comunicar y quién comunica.</span>
      </div>

      <div className="iso-topbar">
        <div className="iso-topbar__info">
          Mostrando <strong>{filtrados.length}</strong> de <strong>{items.length}</strong> comunicaciones &nbsp;·&nbsp;
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
            <option value="todos">Todas</option>
            <option value="Interna">Internas</option>
            <option value="Externa">Externas</option>
          </select>
        </div>
        <div className="iso-topbar__actions">
          <button className="iso-btn-primary" onClick={() => setShowModal(true)} disabled={!canCreate} title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Nueva comunicación</button>
        </div>
      </div>

      <div className="iso-table-wrapper">
        <table className="iso-table">
          <thead>
            <tr>
              <th>#</th>
              <th>¿Qué se comunica?</th>
              <th>¿Cuándo?</th>
              <th>¿Quién comunica?</th>
              <th>¿A quién?</th>
              <th>¿Cómo?</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((r, i) => (
              <tr key={r.id}>
                <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                <td style={{ fontWeight: 600, color: '#1b3a6b' }}>{r.que}</td>
                <td style={{ fontSize: '0.8rem' }}>{r.cuando}</td>
                <td>{r.quien}</td>
                <td>{r.aQuien}</td>
                <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.como}</td>
                <td><span className={`iso-badge ${r.tipo === 'Interna' ? 'azul' : 'verde'}`}>{r.tipo}</span></td>
                <td><span className={`iso-badge ${r.estado === 'Activo' ? 'verde' : r.estado === 'Revisión' ? 'amarillo' : 'gris'}`}>{r.estado}</span></td>
                <td>
                  <PermissionGuard recurso="comunicaciones" accion="eliminar" mode="hide">
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
            <h2>➕ Nueva comunicación</h2>
            <div className="iso-field"><label>¿Qué se comunica? *</label><input type="text" placeholder="ej. Resultados de auditoría" readOnly={isReadOnly()} value={form.que} onChange={e => setForm(p => ({ ...p, que: e.target.value }))} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>¿Cuándo?</label><input type="text" placeholder="ej. Trimestralmente" readOnly={isReadOnly()} value={form.cuando} onChange={e => setForm(p => ({ ...p, cuando: e.target.value }))} /></div>
              <div className="iso-field"><label>¿Quién comunica? *</label><input type="text" placeholder="ej. Director de Calidad" readOnly={isReadOnly()} value={form.quien} onChange={e => setForm(p => ({ ...p, quien: e.target.value }))} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>¿A quién?</label><input type="text" placeholder="ej. Todo el personal" readOnly={isReadOnly()} value={form.aQuien} onChange={e => setForm(p => ({ ...p, aQuien: e.target.value }))} /></div>
              <div className="iso-field"><label>¿Cómo?</label><input type="text" placeholder="ej. Correo, reunión, cartelera" readOnly={isReadOnly()} value={form.como} onChange={e => setForm(p => ({ ...p, como: e.target.value }))} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Tipo</label>
                <select value={form.tipo} disabled={isReadOnly()} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as any }))}>
                  <option>Interna</option><option>Externa</option>
                </select>
              </div>
              <div className="iso-field"><label>Estado</label>
                <select value={form.estado} disabled={isReadOnly()} onChange={e => setForm(p => ({ ...p, estado: e.target.value as any }))}>
                  <option>Activo</option><option>Revisión</option><option>Inactivo</option>
                </select>
              </div>
            </div>
            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardar} disabled={!form.que || !form.quien || !canCreate} title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}>＋ Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ComunicacionPage
