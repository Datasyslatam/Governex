import React, { useState, useCallback } from 'react'
import './DocumentosPage.css'
import { useFetch } from '../../hooks/useFetch'
import { documentosService, Documento } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

const TIPOS = ['Manual', 'Política', 'Proceso', 'Instrucción', 'Formato', 'Otro']
const ESTADOS = ['Aprobado', 'En Revision', 'Borrador', 'Obsoleto']

const emptyForm: Partial<Documento> = {
  titulo: '', tipo: 'Proceso', version: 'v1.0', estado: 'Borrador',
}

function nextCodigo(tipo: string, docs: Documento[]): string {
  const prefixMap: Record<string, string> = {
    Manual: 'MAN', Política: 'POL', Proceso: 'PRO', Instrucción: 'INS', Formato: 'FOR', Otro: 'OTR',
  }
  const prefix = prefixMap[tipo] || 'DOC'
  const count = docs.filter(d => d.codigo.startsWith(prefix)).length + 1
  return `${prefix}-${String(count).padStart(3, '0')}`
}

const DocumentosPage: React.FC = () => {
  const { data: documentosData, loading, error, refetch } = useFetch(documentosService.getAll, [])

  const [selectedDoc, setSelectedDoc]   = useState<Documento | null>(null)
  const [versiones, setVersiones]       = useState<any[]>([])
  const [showModal, setShowModal]       = useState(false)
  const [editingId, setEditingId]       = useState<number | null>(null)
  const [form, setForm]                 = useState<Partial<Documento>>(emptyForm)
  const [saving, setSaving]             = useState(false)
  const [filtroTipo, setFiltroTipo]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda]         = useState('')

  const { canEdit, canCreate, canApprove, isReadOnly } = usePermissions('documentos')

  const filtrados = documentosData.filter(d =>
    (!filtroTipo   || d.tipo === filtroTipo) &&
    (!filtroEstado || d.estado === filtroEstado) &&
    (!busqueda     || d.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
                      d.codigo.toLowerCase().includes(busqueda.toLowerCase()))
  )

  const selectDoc = useCallback(async (doc: Documento) => {
    setSelectedDoc(doc)
    try {
      const vers = await documentosService.getVersiones(doc.id)
      setVersiones(vers)
    } catch {
      setVersiones([])
    }
  }, [])

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true) }
  const openEdit   = (doc: Documento) => {
    setEditingId(doc.id)
    setForm({ titulo: doc.titulo, tipo: doc.tipo, version: doc.version, estado: doc.estado })
    setShowModal(true)
  }

  const handleSave = useCallback(async () => {
    if (!form.titulo || !form.tipo || !form.version) return
    setSaving(true)
    try {
      if (editingId) {
        await documentosService.update(editingId, form)
      } else {
        await documentosService.create({
          ...form,
          codigo: nextCodigo(form.tipo || 'Proceso', documentosData),
        })
      }
      await refetch()
      setShowModal(false)
      setEditingId(null)
      setForm(emptyForm)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [form, editingId, documentosData, refetch])

  const cambiarEstado = useCallback(async (doc: Documento, nuevoEstado: string) => {
    try {
      await documentosService.update(doc.id, { ...doc, estado: nuevoEstado })
      await refetch()
      if (selectedDoc?.id === doc.id) setSelectedDoc(prev => prev ? { ...prev, estado: nuevoEstado } : null)
    } catch (e: any) {
      alert(e.message)
    }
  }, [refetch, selectedDoc])

  return (
    <div className="page docs-page">
      <div className="docs-topbar">
        <div className="docs-topbar__left">
          <h2>Gestión Documental — Control de Versiones</h2>
          <span>Governex — Cap. 7.5 — Información Documentada</span>
        </div>
        <div className="docs-topbar__right">
          <button className="btn btn--primary" onClick={openCreate} disabled={!canCreate} title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}>+ Nuevo Documento</button>
        </div>
      </div>

      <div className="docs-filter-bar">
        <div className="docs-search-wrapper">
          <input type="text" className="docs-search-input" placeholder="Buscar en Governex Docs..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <div className="docs-nav-tabs">
          {['', ...TIPOS].map(t => (
            <button key={t} className={`docs-tab ${filtroTipo === t ? 'docs-tab--active' : ''}`}
              onClick={() => setFiltroTipo(t)}>
              {t || 'Todos'}
            </button>
          ))}
        </div>
        <div className="docs-status-filters">
          <select className="docs-filter-select" value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los Estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>

      <div className="docs-main-grid">
        {/* Tabla */}
        <div className="docs-table-container panel">
          {loading ? (
            <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando documentos...</div>
          ) : error ? (
            <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>
          ) : (
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Código</th><th>Título del Documento</th><th>Tipo</th>
                  <th>Proceso</th><th>Versión</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((doc, i) => (
                  <tr key={doc.id}
                    className={selectedDoc?.id === doc.id ? 'row-active' : ''}
                    onClick={() => selectDoc(doc)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="doc-code text-blue">{doc.codigo}</td>
                    <td className="doc-title">{doc.titulo}</td>
                    <td>
                      <span className={`type-badge type-${doc.tipo.toLowerCase().replace('.', '')}`}>{doc.tipo}</span>
                    </td>
                    <td className="doc-process">{doc.proceso_nombre || '—'}</td>
                    <td className={`doc-version ${
                      doc.estado === 'En Revision' ? 'text-orange font-bold' :
                      doc.estado === 'Aprobado'    ? 'text-green font-bold'  : ''
                    }`}>{doc.version}</td>
                    <td>
                      <span className={`status-pill ${
                        doc.estado === 'Aprobado'    ? 'bg-light-green text-green'  :
                        doc.estado === 'En Revision' ? 'bg-light-orange text-orange' :
                        'bg-light-gray text-gray'
                      }`}>{doc.estado}</span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        title={!canEdit ? 'Tu rol no tiene permiso para editar' : "Editar"} onClick={() => openEdit(doc)} disabled={!canEdit}>✏️</button>
                      {doc.estado === 'Borrador' && (
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}
                          title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : "Enviar a revisión"}
                          onClick={() => cambiarEstado(doc, 'En Revision')} disabled={!canEdit}>📤</button>
                      )}
                      {doc.estado === 'En Revision' && (
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}
                          title={!canApprove ? 'Tu rol no tiene permiso para esta acción' : "Aprobar"}
                          onClick={() => cambiarEstado(doc, 'Aprobado')} disabled={!canApprove}>✅</button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                    No hay documentos que coincidan
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Panel derecho de detalles */}
        <div className="docs-detail-panel panel">
          {!selectedDoc ? (
            <div style={{ padding: '2rem', opacity: 0.4, textAlign: 'center' }}>
              Selecciona un documento para ver su detalle
            </div>
          ) : (
            <>
              <div className="detail-header">
                <div className="detail-header-top">
                  <span className={`status-pill status-pill--large ${
                    selectedDoc.estado === 'Aprobado'    ? 'bg-light-green text-green'   :
                    selectedDoc.estado === 'En Revision' ? 'bg-light-orange text-orange' :
                    'bg-light-gray text-gray'
                  }`}>{selectedDoc.estado}</span>
                  <h3 className="detail-title">{selectedDoc.codigo} — {selectedDoc.titulo}</h3>
                </div>
              </div>

              <div className="detail-section">
                <h4 className="detail-section-title">Historial de Versiones</h4>
                <div className="timeline">
                  {/* Versión actual siempre primero */}
                  <div className="timeline-item">
                    <div className={`timeline-node timeline-node--current ${
                      selectedDoc.estado === 'Aprobado' ? 'bg-green' : 'bg-orange'
                    }`} />
                    <div className="timeline-content">
                      <div className="timeline-title">{selectedDoc.version} — Actual</div>
                      <div className={`timeline-status ${
                        selectedDoc.estado === 'Aprobado' ? 'text-green' : 'text-orange'
                      }`}>{selectedDoc.estado}</div>
                    </div>
                  </div>
                  {versiones.map((v, i) => (
                    <React.Fragment key={v.id}>
                      <div className="timeline-connector" />
                      <div className="timeline-item">
                        <div className="timeline-node bg-gray" />
                        <div className="timeline-content">
                          <div className="timeline-title">{v.version} — {v.fecha?.slice(0, 10)}</div>
                          <div className="timeline-status text-gray">{v.descripcion || 'Versión anterior'}</div>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <hr className="detail-divider" />

              <div className="metadata-block">
                <div className="metadata-title">Governex — Integridad Documental — SHA-256</div>
                <div className="metadata-row">
                  <span className="metadata-label">Hash:</span>
                  <span className="metadata-value">{selectedDoc.hash_sha256 || 'No disponible'}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Proceso:</span>
                  <span className="metadata-value">{selectedDoc.proceso_nombre || '—'}</span>
                </div>
                <div className="metadata-footer text-gray">
                  Tipo: {selectedDoc.tipo} · Versión: {selectedDoc.version}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? '✏️ Editar Documento' : '📄 Nuevo Documento'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Título del documento</label>
                <input type="text" className="filter-input form-control" readOnly={isReadOnly()}
                  value={form.titulo} placeholder="Ej: Procedimiento de Compras"
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo</label>
                  <select className="filter-select form-control" value={form.tipo} disabled={isReadOnly()}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Versión</label>
                  <input type="text" className="filter-input form-control" readOnly={isReadOnly()}
                    value={form.version} placeholder="v1.0"
                    onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select className="filter-select form-control" value={form.estado} disabled={isReadOnly()}
                  onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              {!isReadOnly() && (
                <button className="btn btn--primary" onClick={handleSave}
                  disabled={saving || !form.titulo}>
                  {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Documento'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentosPage
