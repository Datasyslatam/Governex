import React, { useState, useCallback } from 'react'
import './IndicadoresPage.css'
import { useFetch } from '../../hooks/useFetch'
import { indicadoresService, Indicador } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'

const FRECUENCIAS = ['Diaria', 'Semanal', 'Mensual', 'Trimestral', 'Semestral', 'Anual']

const emptyForm: Partial<Indicador> = {
  titulo: '', frecuencia: 'Mensual', meta: '',
}

const emptyMedicion = { valor: '', tendencia: 'stable' as const, estado: 'Cumple' as const }

const IndicadoresPage: React.FC = () => {
  const { data: kpiData, loading, error, refetch } = useFetch(indicadoresService.getAll, [])
  const { canEdit, canDelete, isReadOnly } = usePermissions('indicadores')

  const [showModalInd, setShowModalInd]     = useState(false)
  const [showModalMed, setShowModalMed]     = useState(false)
  const [editingId, setEditingId]           = useState<number | null>(null)
  const [medicionIndId, setMedicionIndId]   = useState<number | null>(null)
  const [form, setForm]                     = useState<Partial<Indicador>>(emptyForm)
  const [formMed, setFormMed]               = useState(emptyMedicion)
  const [saving, setSaving]                 = useState(false)
  const [filtroProceso, setFiltroProceso]   = useState('')
  const [busqueda, setBusqueda]             = useState('')

  // KPIs calculados dinámicamente
  const activos   = kpiData.length
  const cumple    = kpiData.filter(k => k.ultima_medicion?.estado === 'Cumple').length
  const riesgo    = kpiData.filter(k => k.ultima_medicion?.estado === 'Riesgo').length
  const noCumple  = kpiData.filter(k => k.ultima_medicion?.estado === 'No Cumple').length

  const filtrados = kpiData.filter(k =>
    (!filtroProceso || (k.proceso_nombre || '').toLowerCase().includes(filtroProceso.toLowerCase())) &&
    (!busqueda      || k.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
                       k.codigo.toLowerCase().includes(busqueda.toLowerCase()))
  )

  // Procesos únicos para el filtro
  const procesos = [...new Set(kpiData.map(k => k.proceso_nombre).filter(Boolean))]

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModalInd(true) }
  const openEdit   = (k: Indicador) => {
    setEditingId(k.id)
    setForm({ titulo: k.titulo, frecuencia: k.frecuencia, meta: k.meta })
    setShowModalInd(true)
  }
  const openMedir  = (k: Indicador) => { setMedicionIndId(k.id); setFormMed(emptyMedicion); setShowModalMed(true) }

  const handleSaveInd = useCallback(async () => {
    if (!form.titulo || !form.frecuencia || !form.meta) return
    setSaving(true)
    try {
      if (editingId) {
        await indicadoresService.update(editingId, form)
      } else {
        const year = new Date().getFullYear().toString().slice(2)
        const num  = String(kpiData.length + 1).padStart(2, '0')
        await indicadoresService.create({ ...form, codigo: `IND-${year}-${num}` })
      }
      await refetch()
      setShowModalInd(false)
      setForm(emptyForm)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [form, editingId, kpiData.length, refetch])

  const handleSaveMed = useCallback(async () => {
    if (!medicionIndId || !formMed.valor) return
    setSaving(true)
    try {
      await indicadoresService.addMedicion(medicionIndId, {
        ...formMed,
        fecha: new Date().toISOString().slice(0, 10),
      })
      await refetch()
      setShowModalMed(false)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [medicionIndId, formMed, refetch])

  const handleDeleteInd = useCallback(async () => {
    if (!editingId) return
    if (!window.confirm('¿Estás seguro de eliminar este indicador? Esta acción no se puede deshacer.')) return
    setSaving(true)
    try {
      await indicadoresService.delete(editingId)
      await refetch()
      setShowModalInd(false)
      setForm(emptyForm)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [editingId, refetch])

  const handleDeleteAll = useCallback(async () => {
    if (!window.confirm('¿Estás seguro de eliminar TODOS los indicadores? Esta acción borrará todas las métricas y no se puede deshacer.')) return
    setSaving(true)
    try {
      await indicadoresService.deleteAll()
      await refetch()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [refetch])

  return (
    <div className="page ind-page">
      <header className="page__header ind-page__header">
        <div className="ind-page__header-left">
          <nav className="ind-page__breadcrumb">
            <span>Governex</span>
            <span className="ind-page__bc-sep">›</span>
            <span>Cap. 9.1</span>
            <span className="ind-page__bc-sep">›</span>
            <span className="ind-page__bc-active">Seguimiento y Medición</span>
          </nav>
          <h2>Indicadores de Proceso y Desempeño</h2>
          <p className="ind-page__subtitle">Medición, análisis y evaluación de resultados del SGC</p>
        </div>
        <div className="ind-page__actions" style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn--danger" onClick={handleDeleteAll} disabled={saving || kpiData.length === 0 || !canDelete} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none' }} title={!canDelete ? 'Tu rol no tiene permiso para esta acción' : undefined}>
            🗑️ Eliminar Todos
          </button>
          <button className="btn btn--primary" onClick={openCreate} disabled={!canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>+ Crear Indicador (Ficha Técnica)</button>
        </div>
      </header>

      {/* Cards resumen */}
      <div className="ind-top-cards">
        <div className="ind-summary-card">
          <div className="ind-sum-title">Indicadores Activos</div>
          <div className="ind-sum-val">{activos}</div>
        </div>
        <div className="ind-summary-card success-card">
          <div className="ind-sum-title">Cumpliendo Meta</div>
          <div className="ind-sum-val">{cumple}</div>
        </div>
        <div className="ind-summary-card warning-card">
          <div className="ind-sum-title">En Riesgo / Zona Amarilla</div>
          <div className="ind-sum-val">{riesgo}</div>
        </div>
        <div className="ind-summary-card danger-card">
          <div className="ind-sum-title">No Cumple</div>
          <div className="ind-sum-val">{noCumple}</div>
        </div>
      </div>

      <main className="ind-main panel">
        <div className="ind-toolbar">
          <div className="ind-search">
            <input type="text" className="input ind-search__input" placeholder="Buscar indicador..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <div className="ind-filters">
            <select className="input ind-filter" value={filtroProceso}
              onChange={e => setFiltroProceso(e.target.value)}>
              <option value="">Todos los Procesos</option>
              {procesos.map(p => <option key={p} value={p!}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="ind-table-wrap">
          {loading ? (
            <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando indicadores...</div>
          ) : error ? (
            <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>
          ) : (
            <table className="table ind-table">
              <thead>
                <tr>
                  <th>Código</th><th>Nombre del Indicador</th><th>Proceso Responsable</th>
                  <th>Frecuencia</th><th>Meta Aprobada</th><th>Última Medición</th>
                  <th>Cumplimiento</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((kpi, i) => {
                  const med = kpi.ultima_medicion
                  return (
                    <tr key={kpi.id} className={i % 2 === 1 ? 'table__row--alt' : ''}>
                      <td className="ind-table__code">{kpi.codigo}</td>
                      <td className="ind-table__title">{kpi.titulo}</td>
                      <td className="ind-table__process">{kpi.proceso_nombre || '—'}</td>
                      <td className="ind-table__freq">{kpi.frecuencia}</td>
                      <td className="ind-table__meta">{kpi.meta}</td>
                      <td>
                        {med ? (
                          <div className="ind-table__ultr">
                            <span>{med.valor}</span>
                            <span className={`ind-trend ${med.tendencia === 'up' ? 'ind-trend--up' : med.tendencia === 'down' ? 'ind-trend--down' : ''}`}>
                              {med.tendencia === 'up' ? '↗' : med.tendencia === 'down' ? '↘' : '→'}
                            </span>
                          </div>
                        ) : <span style={{ opacity: 0.4 }}>Sin medición</span>}
                      </td>
                      <td>
                        <span className={`pill ${
                          med?.estado === 'Cumple'    ? 'pill--success' :
                          med?.estado === 'Riesgo'    ? 'pill--warning' :
                          med?.estado === 'No Cumple' ? 'pill--danger'  : 'pill--muted'
                        }`}>{med?.estado || 'Sin datos'}</span>
                      </td>
                      <td className="ind-table__actions">
                        <button className="ind-action-btn btn-record" title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : "Registrar Medición"}
                          onClick={() => openMedir(kpi)} disabled={!canEdit}>📝 Medir</button>
                        <button className="ind-action-btn" title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : "Editar ficha"}
                          onClick={() => openEdit(kpi)} disabled={!canEdit}>✏️</button>
                      </td>
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                    No hay indicadores registrados
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Modal Indicador */}
      {showModalInd && (
        <div className="modal-overlay" onClick={() => setShowModalInd(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? '✏️ Editar Indicador' : '📊 Nueva Ficha de Indicador'}</h3>
              <button className="modal-close" onClick={() => setShowModalInd(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nombre del Indicador</label>
                <input type="text" className="filter-input form-control"
                  value={form.titulo} placeholder="Ej: Cumplimiento Presupuesto Ventas"
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} readOnly={isReadOnly()} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Frecuencia de medición</label>
                  <select className="filter-select form-control" value={form.frecuencia}
                    onChange={e => setForm(f => ({ ...f, frecuencia: e.target.value }))} disabled={!canEdit}>
                    {FRECUENCIAS.map(fr => <option key={fr} value={fr}>{fr}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Meta aprobada</label>
                  <input type="text" className="filter-input form-control"
                    value={form.meta} placeholder="Ej: > 95%"
                    onChange={e => setForm(f => ({ ...f, meta: e.target.value }))} readOnly={isReadOnly()} />
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <div>
                {editingId && (
                  <button className="btn btn--danger" onClick={handleDeleteInd} disabled={saving || !canDelete} title={!canDelete ? 'Tu rol no tiene permiso para esta acción' : undefined} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                    🗑️ Eliminar
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn--secondary" onClick={() => setShowModalInd(false)}>Cancelar</button>
                <button className="btn btn--primary" onClick={handleSaveInd}
                  disabled={saving || !form.titulo || !form.meta || !canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                  {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Indicador'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Medición */}
      {showModalMed && (
        <div className="modal-overlay" onClick={() => setShowModalMed(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📝 Registrar Medición</h3>
              <button className="modal-close" onClick={() => setShowModalMed(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Valor medido</label>
                <input type="text" className="filter-input form-control"
                  value={formMed.valor} placeholder="Ej: 94%"
                  onChange={e => setFormMed(f => ({ ...f, valor: e.target.value }))} readOnly={isReadOnly()} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Tendencia</label>
                  <select className="filter-select form-control" value={formMed.tendencia}
                    onChange={e => setFormMed(f => ({ ...f, tendencia: e.target.value as any }))} disabled={!canEdit}>
                    <option value="up">↗ Mejorando</option>
                    <option value="stable">→ Estable</option>
                    <option value="down">↘ Deteriorando</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Resultado vs meta</label>
                  <select className="filter-select form-control" value={formMed.estado}
                    onChange={e => setFormMed(f => ({ ...f, estado: e.target.value as any }))} disabled={!canEdit}>
                    <option value="Cumple">Cumple</option>
                    <option value="Riesgo">En Riesgo</option>
                    <option value="No Cumple">No Cumple</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalMed(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={handleSaveMed}
                disabled={saving || !formMed.valor || !canEdit} title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}>
                {saving ? 'Guardando...' : 'Registrar Medición'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IndicadoresPage
