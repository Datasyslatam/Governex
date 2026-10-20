import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import './AuditoriaPage.css'
import AuditCalendar from './components/AuditCalendar'
import { useFetch } from '../../hooks/useFetch'
import { auditoriasService, procesosService, Auditoria, Hallazgo, ProgramaAuditoria } from '../../services'
import { usePermissions } from '../../hooks/usePermissions'
import { generarAuditoriasPDF, descargarBytes } from '../../utils/auditPdf'

type Tab = 'programa' | 'auditorias' | 'hallazgos'

const AUDITORES = ['S. Martínez', 'L. Gómez', 'M. Vargas', 'R. Torres', 'A. Reyes']

const TIPOS_HALLAZGO = [
  'Fortaleza',
  'Conformidad',
  'No Conformidad Menor',
  'No Conformidad Mayor',
  'Oportunidad de Mejora',
  'Observación'
]

const emptyAudit = {
  proceso_id: undefined as number | undefined,
  fecha_inicio: new Date().toISOString().slice(0, 10),
  duracion_dias: 1,
  auditor_lider: AUDITORES[0],
  estado: 'Planificada' as Auditoria['estado'],
  requisito_norma: '',
  auditado: '',
  observacion: '',
}

const emptyPrograma = {
  anio: new Date().getFullYear(),
  numero: `PA-${new Date().getFullYear()}`,
  objetivo: '',
  alcance: '',
  tipo: 'Auditoría Interna de Sistema de Gestión',
  duracion: '12 meses',
  ubicacion: 'Sede Principal / Híbrida',
  calendario: 'Planificación anual con auditorías semestrales por proceso',
  criterio: 'Sistema de Gestión de la Calidad, Manual de Calidad, Procedimientos e Instructivos internos, Requisitos legales y reglamentarios aplicables.',
  metodo: 'Entrevistas a responsables, revisión documental y muestreo de registros, observación in situ.',
  equipo_auditores: 'Auditor Líder + Auditores Internos calificados',
  recursos: 'Equipo de cómputo, acceso al ERP Governex, salas de reunión, transporte y disponibilidad del personal clave.',
  riesgos: 'Indisponibilidad de auditados por carga operativa, falta de acceso a registros, cambios imprevistos en turnos.',
  tipo_informe: 'Informe de Auditoría Interna con clasificación de hallazgos y planes de acción (§10.2 / §10.3)',
  estado: 'En Curso' as 'Planificado' | 'En Curso' | 'Cerrado',
}

const emptyHallazgo = {
  auditoria_id: undefined as number | undefined,
  codigo: '',
  tipo: 'No Conformidad Menor',
  descripcion: '',
  clausula: '',
  estado: 'Abierto',
}

const formatFecha = (iso?: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!d) return iso
  return `${d}/${m}/${y}`
}

const AuditoriaPage: React.FC = () => {
  const navigate = useNavigate()
  const { canEdit, isReadOnly } = usePermissions('auditorias')
  const [activeTab, setActiveTab] = useState<Tab>('programa')
  const [viewMode, setViewMode]   = useState<'table' | 'calendar'>('table')

  // Modales
  const [showModal, setShowModal]                     = useState(false)
  const [editingId, setEditingId]                     = useState<number | null>(null)
  const [form, setForm]                               = useState<typeof emptyAudit>(emptyAudit)
  const [saving, setSaving]                           = useState(false)

  const [showProgramaModal, setShowProgramaModal]     = useState(false)
  const [editingProgramaId, setEditingProgramaId]     = useState<number | null>(null)
  const [programaForm, setProgramaForm]               = useState<typeof emptyPrograma>(emptyPrograma)
  const [savingPrograma, setSavingPrograma]           = useState(false)
  const [viewingPrograma, setViewingPrograma]         = useState<ProgramaAuditoria | null>(null)

  const [showHallazgoModal, setShowHallazgoModal]     = useState(false)
  const [hallazgoForm, setHallazgoForm]               = useState<typeof emptyHallazgo>(emptyHallazgo)
  const [savingHallazgo, setSavingHallazgo]           = useState(false)

  const [convertingId, setConvertingId]               = useState<number | null>(null)
  const [downloadingPdf, setDownloadingPdf]           = useState(false)

  // Filtros
  const [filterProgYear, setFilterProgYear]     = useState('')
  const [filterAudProcess, setFilterAudProcess] = useState('')
  const [filterAudAuditor, setFilterAudAuditor] = useState('')
  const [filterAudStatus, setFilterAudStatus]   = useState('')
  const [filterHalAudit, setFilterHalAudit]     = useState('')
  const [filterHalType, setFilterHalType]       = useState('')
  const [filterHalStatus, setFilterHalStatus]   = useState('')

  // Datos desde la API
  const { data: programas, loading: loadingProg, refetch: refetchProg }
    = useFetch(auditoriasService.getProgramas, [])

  const { data: auditorias, loading: loadingAud, refetch: refetchAud }
    = useFetch(auditoriasService.getAll, [])

  const { data: hallazgos, loading: loadingHal, refetch: refetchHal }
    = useFetch(auditoriasService.getHallazgos, [])

  const { data: procesos } = useFetch(procesosService.getAll, [])

  const handleConvertirEnNC = async (hal: Hallazgo) => {
    if (hal.nc_id) {
      navigate('/nc-ac')
      return
    }
    if (!window.confirm(`¿Deseas transferir este hallazgo ("${hal.codigo}") a No Conformidades (Cap. 10.2) para realizar el análisis de causa raíz?`)) return
    setConvertingId(hal.id)
    try {
      const nc = await auditoriasService.convertirEnNC(hal.id)
      alert(`No Conformidad ${nc.codigo} creada correctamente a partir del hallazgo.`)
      await refetchHal()
      navigate('/nc-ac')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setConvertingId(null)
    }
  }

  const handleConvertirEnMejora = async (hal: Hallazgo) => {
    if (hal.mejora_id) {
      navigate('/mejora-continua')
      return
    }
    if (!window.confirm(`¿Deseas transferir este hallazgo ("${hal.codigo}") al registro de Mejora Continua (Cap. 10.3)?`)) return
    setConvertingId(hal.id)
    try {
      const mc = await auditoriasService.convertirEnMejora(hal.id)
      alert(`Iniciativa de Mejora ${mc.codigo} creada correctamente.`)
      await refetchHal()
      navigate('/mejora-continua')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setConvertingId(null)
    }
  }

  // Filtros aplicados
  const filteredProgramas = (programas || []).filter(p =>
    !filterProgYear || p.anio.toString().includes(filterProgYear) || (p.numero || '').toLowerCase().includes(filterProgYear.toLowerCase())
  )

  const filteredAuditorias = (auditorias || []).filter(a =>
    (!filterAudProcess || (a.proceso_nombre || '').toLowerCase().includes(filterAudProcess.toLowerCase())) &&
    (!filterAudAuditor || (a.auditor_lider  || '').toLowerCase().includes(filterAudAuditor.toLowerCase())) &&
    (!filterAudStatus  || a.estado === filterAudStatus)
  )

  const filteredHallazgos = (hallazgos || []).filter(h => {
    const matchAudit = !filterHalAudit || (h.auditoria_codigo || '').toLowerCase().includes(filterHalAudit.toLowerCase()) || (h.codigo || '').toLowerCase().includes(filterHalAudit.toLowerCase())
    const matchStatus = !filterHalStatus || h.estado === filterHalStatus
    let matchType = true
    if (filterHalType) {
      if (filterHalType === 'No Conformidad') {
        matchType = h.tipo.includes('No Conformidad')
      } else if (filterHalType === 'Mejora/Observacion') {
        matchType = h.tipo.includes('Mejora') || h.tipo.includes('Observación')
      } else {
        matchType = h.tipo === filterHalType
      }
    }
    return matchAudit && matchStatus && matchType
  })

  // Código auto-generado para auditoría
  const nextCode = useCallback(() => {
    const year = new Date().getFullYear().toString().slice(2)
    const num  = String((auditorias || []).length + 1).padStart(2, '0')
    return `AI-${year}-${num}`
  }, [auditorias?.length])

  // Guardar programa anual
  const handleSavePrograma = useCallback(async () => {
    if (!programaForm.objetivo.trim()) {
      alert('Por favor especifica el objetivo general del programa')
      return
    }
    setSavingPrograma(true)
    try {
      if (editingProgramaId) {
        await auditoriasService.updatePrograma(editingProgramaId, programaForm)
      } else {
        await auditoriasService.createPrograma(programaForm)
      }
      await refetchProg()
      setShowProgramaModal(false)
      setEditingProgramaId(null)
      setProgramaForm(emptyPrograma)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSavingPrograma(false)
    }
  }, [programaForm, editingProgramaId, refetchProg])

  // Guardar auditoría
  const handleSave = useCallback(async () => {
    if (!form.fecha_inicio) {
      alert('La fecha de inicio es requerida')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await auditoriasService.update(editingId, form)
      } else {
        await auditoriasService.create({ ...form, codigo: nextCode() })
      }
      await refetchAud()
      setShowModal(false)
      setEditingId(null)
      setForm(emptyAudit)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }, [form, editingId, nextCode, refetchAud])

  // Guardar hallazgo
  const handleSaveHallazgo = useCallback(async () => {
    if (!hallazgoForm.auditoria_id) {
      alert('Por favor selecciona la auditoría de origen para el hallazgo')
      return
    }
    if (!hallazgoForm.descripcion.trim()) {
      alert('La descripción del hallazgo es requerida')
      return
    }
    setSavingHallazgo(true)
    try {
      await auditoriasService.createHallazgo(hallazgoForm)
      await refetchHal()
      await refetchAud()
      setShowHallazgoModal(false)
      setHallazgoForm(emptyHallazgo)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSavingHallazgo(false)
    }
  }, [hallazgoForm, refetchHal, refetchAud])

  const openCreate = () => {
    setEditingId(null)
    setForm({
      ...emptyAudit,
      proceso_id: procesos && procesos.length > 0 ? procesos[0].id : undefined
    })
    setShowModal(true)
  }

  const openEdit = (aud: Auditoria) => {
    setEditingId(aud.id)
    setForm({
      proceso_id:   aud.proceso_id,
      fecha_inicio:  aud.fecha_inicio ? aud.fecha_inicio.slice(0, 10) : '',
      duracion_dias: aud.duracion_dias || 1,
      auditor_lider: aud.auditor_lider || AUDITORES[0],
      estado:        aud.estado,
      requisito_norma: aud.requisito_norma || '',
      auditado:        aud.auditado || '',
      observacion:     aud.observacion || '',
    })
    setShowModal(true)
  }

  const openEditPrograma = (prog: ProgramaAuditoria) => {
    setEditingProgramaId(prog.id)
    setProgramaForm({
      anio: prog.anio,
      numero: prog.numero || `PA-${prog.anio}`,
      objetivo: prog.objetivo || '',
      alcance: prog.alcance || '',
      tipo: prog.tipo || 'Auditoría Interna de Sistema de Gestión',
      duracion: prog.duracion || '',
      ubicacion: prog.ubicacion || '',
      calendario: prog.calendario || '',
      criterio: prog.criterio || '',
      metodo: prog.metodo || '',
      equipo_auditores: prog.equipo_auditores || '',
      recursos: prog.recursos || '',
      riesgos: prog.riesgos || '',
      tipo_informe: prog.tipo_informe || '',
      estado: (prog.estado as any) || 'En Curso',
    })
    setShowProgramaModal(true)
  }

  // Descarga de PDF con el cuadro de auditorías
  const handleExportPDF = async () => {
    if (filteredAuditorias.length === 0) {
      alert('No hay auditorías para exportar en este momento')
      return
    }
    setDownloadingPdf(true)
    try {
      const pdfBytes = await generarAuditoriasPDF(filteredAuditorias)
      descargarBytes(pdfBytes, `Plan_Auditorias_${new Date().getFullYear()}.pdf`)
    } catch (err: any) {
      console.error(err)
      alert('Error al generar el documento PDF: ' + err.message)
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Adaptar auditorias para vista calendario
  const auditoriasParaCalendario = filteredAuditorias.map(a => ({
    codigo:       a.codigo,
    proceso:      a.proceso_nombre || '—',
    fechaInicio:  a.fecha_inicio,
    duracionDias: a.duracion_dias,
    auditor:      a.auditor_lider || '—',
    estado:       a.estado,
    hallazgos:    Number(a.hallazgos ?? 0),
  }))

  return (
    <div className="page audit-page">
      <header className="page__header audit-page__header">
        <div className="audit-page__header-left">
          <nav className="audit-page__breadcrumb">
            <span>Governex</span>
            <span className="audit-page__bc-sep">›</span>
            <span>Cap. 9.2</span>
            <span className="audit-page__bc-sep">›</span>
            <span className="audit-page__bc-active">Auditoría Interna</span>
          </nav>
          <h2>Gestión de Auditorías Internas</h2>
          <p className="audit-page__subtitle">
            Programa anual (ISO 19011:2018), plan de auditorías y trazabilidad integral de hallazgos
          </p>
        </div>
        <div className="audit-page__actions">
          <button
            className="btn btn--primary"
            onClick={() => {
              setEditingProgramaId(null)
              setProgramaForm(emptyPrograma)
              setShowProgramaModal(true)
            }}
            disabled={!canEdit}
            title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}
          >
            + Nuevo Programa Anual
          </button>
        </div>
      </header>

      <nav className="audit-tabs">
        <button
          className={`audit-tabs__tab ${activeTab === 'programa' ? 'audit-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('programa')}
        >
          Programas Anuales ({filteredProgramas.length})
        </button>
        <button
          className={`audit-tabs__tab ${activeTab === 'auditorias' ? 'audit-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('auditorias')}
        >
          Plan de Auditorías ({filteredAuditorias.length})
        </button>
        <button
          className={`audit-tabs__tab ${activeTab === 'hallazgos' ? 'audit-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('hallazgos')}
        >
          Hallazgos ({filteredHallazgos.length})
        </button>
      </nav>

      <main className="audit-main panel">

        {/* ── 1. PROGRAMAS ANUALES ── */}
        {activeTab === 'programa' && (
          <div className="audit-table-wrap">
            <div className="audit-section-header">
              <div className="audit-section-header__title">
                <h3>Programas Anuales de Auditoría</h3>
                <span className="pill pill--muted">Requisito §9.2.2 & Directrices de Auditoría</span>
              </div>
              <div className="audit-filters">
                <input
                  type="text"
                  placeholder="Buscar por año o número..."
                  value={filterProgYear}
                  onChange={e => setFilterProgYear(e.target.value)}
                  className="filter-input"
                />
              </div>
            </div>

            {loadingProg ? (
              <div className="audit-loading">Cargando programas anuales...</div>
            ) : (
              <table className="table audit-table">
                <thead>
                  <tr>
                    <th>Número / Año</th>
                    <th>Tipo / Alcance</th>
                    <th>Objetivo General</th>
                    <th>Método / Ubicación</th>
                    <th>Duración</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProgramas.map((prog, i) => (
                    <tr key={prog.id} className={i % 2 === 1 ? 'table__row--alt' : ''}>
                      <td className="audit-table__code">
                        <strong>{prog.numero || `PA-${prog.anio}`}</strong>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Año {prog.anio}</div>
                      </td>
                      <td style={{ maxWidth: '200px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1e293b' }}>
                          {prog.tipo || 'Auditoría Interna'}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={prog.alcance}>
                          {prog.alcance || 'Todos los procesos del SGC'}
                        </div>
                      </td>
                      <td className="audit-table__title" style={{ maxWidth: '240px' }} title={prog.objetivo}>
                        {prog.objetivo}
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>
                        <div>{prog.ubicacion || 'Sede Principal / Híbrida'}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{prog.metodo ? prog.metodo.slice(0, 30) + '...' : 'In situ / Documental'}</div>
                      </td>
                      <td className="audit-table__duration">{prog.duracion || '12 meses'}</td>
                      <td>
                        <span className={`pill ${prog.estado === 'Cerrado' ? 'pill--success' : prog.estado === 'En Curso' ? 'pill--warning' : 'pill--muted'}`}>
                          {prog.estado}
                        </span>
                      </td>
                      <td className="audit-table__actions" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="btn btn--outline"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', marginRight: '0.35rem' }}
                          title="Ver detalle del programa"
                          onClick={() => setViewingPrograma(prog)}
                        >
                          👁️ Detalle
                        </button>
                        <button
                          className="btn btn--secondary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                          title="Editar programa"
                          disabled={!canEdit}
                          onClick={() => openEditPrograma(prog)}
                        >
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredProgramas.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                        No hay programas anuales registrados. Haz clic en <strong>+ Nuevo Programa Anual</strong> para configurar el primero.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── 2. AUDITORÍAS (TABLA MEJORADA + PDF) ── */}
        {activeTab === 'auditorias' && (
          <div className="audit-table-wrap">
            <div className="audit-section-header">
              <div className="audit-section-header__title">
                <h3>Planificación y Cuadro de Auditorías</h3>
                <span className="pill pill--muted">Requisitos, Responsables, Auditores y Observaciones</span>
              </div>
              <div className="audit-section-controls">
                <div className="audit-view-toggle">
                  <button
                    className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                  >
                    Tabla
                  </button>
                  <button
                    className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                    onClick={() => setViewMode('calendar')}
                  >
                    Calendario
                  </button>
                </div>
                <div className="audit-filters">
                  <input
                    type="text"
                    placeholder="Filtrar por proceso..."
                    value={filterAudProcess}
                    onChange={e => setFilterAudProcess(e.target.value)}
                    className="filter-input"
                  />
                  <input
                    type="text"
                    placeholder="Filtrar por auditor..."
                    value={filterAudAuditor}
                    onChange={e => setFilterAudAuditor(e.target.value)}
                    className="filter-input"
                  />
                  <select
                    value={filterAudStatus}
                    onChange={e => setFilterAudStatus(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">Todos los estados</option>
                    <option value="Planificada">Planificada</option>
                    <option value="En Ejecución">En Ejecución</option>
                    <option value="Cerrada">Cerrada</option>
                  </select>
                </div>

                {/* Botón de descarga PDF requerido */}
                <button
                  className="audit-btn-pdf"
                  onClick={handleExportPDF}
                  disabled={downloadingPdf || filteredAuditorias.length === 0}
                  title="Descargar cuadro de auditorías en formato PDF"
                >
                  📄 {downloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}
                </button>

                <button
                  className="btn btn--primary audit-btn-small"
                  onClick={openCreate}
                  disabled={!canEdit}
                  title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}
                >
                  + Nueva Auditoría
                </button>
              </div>
            </div>

            {loadingAud ? (
              <div className="audit-loading">Cargando auditorías...</div>
            ) : viewMode === 'calendar' ? (
              <AuditCalendar auditorias={auditoriasParaCalendario} />
            ) : (
              <table className="table audit-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Proceso</th>
                    <th>Requisito de Norma a Auditar</th>
                    <th>Auditado</th>
                    <th>Auditor</th>
                    <th>Observación</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditorias.map((aud, i) => (
                    <tr key={aud.id} className={i % 2 === 1 ? 'table__row--alt' : ''}>
                      <td className="audit-table__date" style={{ fontWeight: 600 }}>
                        {formatFecha(aud.fecha_inicio)}
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{aud.duracion_dias} día{aud.duracion_dias !== 1 ? 's' : ''}</div>
                      </td>
                      <td className="audit-table__process">
                        <strong>{aud.proceso_nombre || 'General / Sin Asignar'}</strong>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{aud.codigo}</div>
                      </td>
                      <td style={{ fontSize: '0.8rem', maxWidth: '180px' }}>
                        {aud.requisito_norma ? (
                          <span style={{ color: '#1e3a8a', background: '#eff6ff', padding: '0.2rem 0.45rem', borderRadius: '0.25rem', display: 'inline-block' }}>
                            {aud.requisito_norma}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Requisitos del Sistema de Gestión</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {aud.auditado || <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                        {aud.auditor_lider || <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#475569', maxWidth: '200px' }} title={aud.observacion || ''}>
                        {aud.observacion || <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td>
                        <span className={`pill ${
                          aud.estado === 'Cerrada' ? 'pill--success' :
                          aud.estado === 'En Ejecución' ? 'pill--warning' : 'pill--muted'
                        }`}>
                          {aud.estado}
                        </span>
                      </td>
                      <td className="audit-table__actions">
                        <button
                          className="btn btn--outline"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                          title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : 'Editar auditoría'}
                          onClick={() => openEdit(aud)}
                          disabled={!canEdit}
                        >
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAuditorias.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                        No hay auditorías registradas que coincidan con los filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── 3. HALLAZGOS (INGRESO + 4 CATEGORÍAS) ── */}
        {activeTab === 'hallazgos' && (
          <div className="audit-table-wrap">
            <div className="audit-section-header">
              <div className="audit-section-header__title">
                <h3>Registro y Clasificación de Hallazgos</h3>
                <span className="pill pill--muted">Fortalezas, Conformidades, No Conformidades y Oportunidades de Mejora</span>
              </div>
              <div className="audit-section-controls">
                <div className="audit-filters">
                  <input
                    type="text"
                    placeholder="Buscar por código o auditoría..."
                    value={filterHalAudit}
                    onChange={e => setFilterHalAudit(e.target.value)}
                    className="filter-input"
                  />
                  <select
                    value={filterHalType}
                    onChange={e => setFilterHalType(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">Todas las naturalezas</option>
                    <option value="Fortaleza">1. Fortalezas</option>
                    <option value="Conformidad">2. Conformidades</option>
                    <option value="No Conformidad">3. No Conformidades (Todas)</option>
                    <option value="No Conformidad Menor">— No Conformidad Menor</option>
                    <option value="No Conformidad Mayor">— No Conformidad Mayor</option>
                    <option value="Mejora/Observacion">4. Oportunidades de Mejora / Observaciones</option>
                    <option value="Oportunidad de Mejora">— Oportunidad de Mejora</option>
                    <option value="Observación">— Observación</option>
                  </select>
                  <select
                    value={filterHalStatus}
                    onChange={e => setFilterHalStatus(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">Todos los estados</option>
                    <option value="Abierto">Abierto</option>
                    <option value="Cerrado">Cerrado</option>
                  </select>
                </div>

                {/* Botón para ingresar nuevo hallazgo */}
                <button
                  className="btn btn--primary audit-btn-small"
                  onClick={() => {
                    setHallazgoForm({
                      ...emptyHallazgo,
                      auditoria_id: auditorias && auditorias.length > 0 ? auditorias[0].id : undefined
                    })
                    setShowHallazgoModal(true)
                  }}
                  disabled={!canEdit || auditorias.length === 0}
                  title={auditorias.length === 0 ? 'Debes registrar al menos una auditoría primero' : !canEdit ? 'Sin permisos' : undefined}
                >
                  + Nuevo Hallazgo
                </button>
              </div>
            </div>

            {loadingHal ? (
              <div className="audit-loading">Cargando hallazgos...</div>
            ) : (
              <table className="table audit-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Auditoría / Proceso</th>
                    <th>Naturaleza del Hallazgo</th>
                    <th>Descripción / Evidencia</th>
                    <th>Cláusula</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHallazgos.map((hal, i) => {
                    const isFortaleza = hal.tipo === 'Fortaleza'
                    const isConformidad = hal.tipo === 'Conformidad'
                    const isNC = hal.tipo.includes('No Conformidad')
                    const isMejora = hal.tipo.includes('Oportunidad') || hal.tipo.includes('Mejora')
                    const isObservacion = hal.tipo.includes('Observación')

                    return (
                      <tr key={hal.id} className={i % 2 === 1 ? 'table__row--alt' : ''}>
                        <td className="audit-table__code">{hal.codigo}</td>
                        <td className="audit-table__ref">
                          <strong>{hal.auditoria_codigo || 'AI'}</strong>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{hal.proceso_nombre || 'General'}</div>
                        </td>
                        <td>
                          <span className={`pill ${
                            isFortaleza ? 'pill--fortaleza' :
                            isConformidad ? 'pill--conformidad' :
                            isNC ? 'pill--danger' :
                            isMejora ? 'pill--mejora' : 'pill--observacion'
                          }`}>
                            {isFortaleza && '⭐ '}
                            {isConformidad && '✓ '}
                            {isNC && '⚠️ '}
                            {isMejora && '💡 '}
                            {isObservacion && 'ℹ️ '}
                            {hal.tipo}
                          </span>
                        </td>
                        <td className="audit-table__desc">{hal.descripcion}</td>
                        <td className="audit-table__clausula">{hal.clausula || '—'}</td>
                        <td>
                          <span className={`pill ${hal.estado === 'Cerrado' ? 'pill--success' : 'pill--danger'}`}>
                            {hal.estado}
                          </span>
                        </td>
                        <td className="audit-table__actions" style={{ whiteSpace: 'nowrap' }}>
                          {isNC ? (
                            hal.nc_id ? (
                              <button
                                className="btn btn--outline"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}
                                onClick={() => navigate('/nc-ac')}
                                title="Ver No Conformidad vinculada (Cap. 10.2)"
                              >
                                ✓ Ver {hal.nc_codigo || 'NC'}
                              </button>
                            ) : (
                              <button
                                className="btn btn--primary"
                                style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                                onClick={() => handleConvertirEnNC(hal)}
                                disabled={convertingId === hal.id}
                                title="Transferir hallazgo a No Conformidades (Cap. 10.2)"
                              >
                                {convertingId === hal.id ? 'Transferir...' : '→ Enviar a NC (10.2)'}
                              </button>
                            )
                          ) : isMejora ? (
                            hal.mejora_id ? (
                              <button
                                className="btn btn--outline"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }}
                                onClick={() => navigate('/mejora-continua')}
                                title="Ver Iniciativa de Mejora vinculada (Cap. 10.3)"
                              >
                                ✓ Ver {hal.mejora_codigo || 'Mejora'}
                              </button>
                            ) : (
                              <button
                                className="btn btn--secondary"
                                style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                                onClick={() => handleConvertirEnMejora(hal)}
                                disabled={convertingId === hal.id}
                                title="Transferir a Iniciativas de Mejora (Cap. 10.3)"
                              >
                                {convertingId === hal.id ? 'Transferir...' : '→ Enviar a Mejora (10.3)'}
                              </button>
                            )
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {isFortaleza ? 'Aspecto Destacado' : isConformidad ? 'Requisito Conforme' : 'Nota de Auditoría'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredHallazgos.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                        No hay hallazgos registrados. Haz clic en <strong>+ Nuevo Hallazgo</strong> para ingresar evidencias de auditoría.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* ── MODAL NUEVO / EDITAR PROGRAMA ANUAL (7 PUNTOS ISO 19011) ── */}
      {showProgramaModal && (
        <div className="modal-overlay" onClick={() => setShowProgramaModal(false)}>
          <div className="modal-card modal-card--lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProgramaId ? 'Editar Programa Anual de Auditoría' : 'Nuevo Programa Anual de Auditoría (ISO 19011:2018)'}</h3>
              <button className="modal-close" onClick={() => setShowProgramaModal(false)}>✕</button>
            </div>
            <div className="modal-body modal-body--scrollable">

              {/* Punto 1: Alcance, Número, Tipo, Duración, Ubicación, Calendario */}
              <div className="form-section">
                <h4 className="form-section__title">1. Identificación, Alcance, Tipo, Duración, Ubicación y Calendario</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Número / Código del Programa</label>
                    <input
                      type="text"
                      className="filter-input form-control"
                      placeholder="Ej: PA-2026"
                      value={programaForm.numero}
                      onChange={e => setProgramaForm(f => ({ ...f, numero: e.target.value }))}
                      readOnly={isReadOnly()}
                    />
                  </div>
                  <div className="form-group">
                    <label>Año</label>
                    <input
                      type="number"
                      className="filter-input form-control"
                      value={programaForm.anio}
                      min={2000}
                      max={2100}
                      onChange={e => setProgramaForm(f => ({ ...f, anio: parseInt(e.target.value) || f.anio }))}
                      readOnly={isReadOnly()}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo de Auditoría</label>
                    <input
                      type="text"
                      className="filter-input form-control"
                      placeholder="Ej: Auditoría Interna de Sistema de Gestión"
                      value={programaForm.tipo}
                      onChange={e => setProgramaForm(f => ({ ...f, tipo: e.target.value }))}
                      readOnly={isReadOnly()}
                    />
                  </div>
                  <div className="form-group">
                    <label>Duración Estimada</label>
                    <input
                      type="text"
                      className="filter-input form-control"
                      placeholder="Ej: 12 meses / 1 ciclo anual"
                      value={programaForm.duracion}
                      onChange={e => setProgramaForm(f => ({ ...f, duracion: e.target.value }))}
                      readOnly={isReadOnly()}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Ubicación / Modalidad</label>
                    <input
                      type="text"
                      className="filter-input form-control"
                      placeholder="Ej: Sede Principal, Plantas y Oficinas (Híbrida: in situ y remota)"
                      value={programaForm.ubicacion}
                      onChange={e => setProgramaForm(f => ({ ...f, ubicacion: e.target.value }))}
                      readOnly={isReadOnly()}
                    />
                  </div>
                  <div className="form-group">
                    <label>Estado del Programa</label>
                    <select
                      className="filter-select form-control"
                      value={programaForm.estado}
                      onChange={e => setProgramaForm(f => ({ ...f, estado: e.target.value as any }))}
                      disabled={!canEdit}
                    >
                      <option value="Planificado">Planificado</option>
                      <option value="En Curso">En Curso</option>
                      <option value="Cerrado">Cerrado</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Alcance de la Auditoría</label>
                  <textarea
                    className="filter-input form-control form-control-textarea"
                    placeholder="Describa el alcance: procesos, sedes, líneas de servicio o productos incluidos en el programa..."
                    value={programaForm.alcance}
                    onChange={e => setProgramaForm(f => ({ ...f, alcance: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>

                <div className="form-group">
                  <label>Calendario / Cronograma General</label>
                  <textarea
                    className="filter-input form-control form-control-textarea"
                    placeholder="Detalle la distribución temporal estimada (ej: auditorías de procesos misionales en mayo y de apoyo en octubre)..."
                    value={programaForm.calendario}
                    onChange={e => setProgramaForm(f => ({ ...f, calendario: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>

                <div className="form-group">
                  <label>Objetivo General del Programa *</label>
                  <input
                    type="text"
                    className="filter-input form-control"
                    placeholder="Ej: Determinar la conformidad y eficacia del Sistema de Gestión de Calidad..."
                    value={programaForm.objetivo}
                    onChange={e => setProgramaForm(f => ({ ...f, objetivo: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>
              </div>

              {/* Punto 2: Criterio de la auditoría */}
              <div className="form-section">
                <h4 className="form-section__title">2. Criterio de la Auditoría</h4>
                <div className="form-group">
                  <label>Normas, Políticas y Requisitos aplicables</label>
                  <textarea
                    className="filter-input form-control form-control-textarea"
                    placeholder="Normas de referencia (ej: Requisitos normativos, reglamentarios, procedimientos e instructivos internos)..."
                    value={programaForm.criterio}
                    onChange={e => setProgramaForm(f => ({ ...f, criterio: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>
              </div>

              {/* Punto 3: Método de la auditoría */}
              <div className="form-section">
                <h4 className="form-section__title">3. Método de la Auditoría</h4>
                <div className="form-group">
                  <label>Metodología y Técnicas de Evaluación</label>
                  <textarea
                    className="filter-input form-control form-control-textarea"
                    placeholder="Ej: Entrevistas a líderes, muestreo probabilístico de registros, observación directa de operaciones in situ, revisión documental digital..."
                    value={programaForm.metodo}
                    onChange={e => setProgramaForm(f => ({ ...f, metodo: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>
              </div>

              {/* Punto 4: Equipo de auditores */}
              <div className="form-section">
                <h4 className="form-section__title">4. Equipo de Auditores</h4>
                <div className="form-group">
                  <label>Auditor Líder, Auditores Internos y Expertos Técnicos</label>
                  <textarea
                    className="filter-input form-control form-control-textarea"
                    placeholder="Ej: Auditor Líder: S. Martínez. Equipo Auditor: L. Gómez, M. Vargas. Expertos técnicos u observadores asignados..."
                    value={programaForm.equipo_auditores}
                    onChange={e => setProgramaForm(f => ({ ...f, equipo_auditores: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>
              </div>

              {/* Punto 5: Recursos necesarios */}
              <div className="form-section">
                <h4 className="form-section__title">5. Recursos Necesarios</h4>
                <div className="form-group">
                  <label>Recursos Humanos, Técnicos, Logísticos y Tecnológicos</label>
                  <textarea
                    className="filter-input form-control form-control-textarea"
                    placeholder="Ej: Licencias Governex, salas de conferencia, equipos portátiles, viáticos/transporte y dedicación horaria..."
                    value={programaForm.recursos}
                    onChange={e => setProgramaForm(f => ({ ...f, recursos: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>
              </div>

              {/* Punto 6: Riesgos de la auditoría */}
              <div className="form-section">
                <h4 className="form-section__title">6. Riesgos de la Auditoría</h4>
                <div className="form-group">
                  <label>Riesgos del Programa y Medidas de Tratamiento</label>
                  <textarea
                    className="filter-input form-control form-control-textarea"
                    placeholder="Ej: Falta de disponibilidad de personal por contingencias operativas, problemas de conectividad en sedes remotas, sesgos de objetividad..."
                    value={programaForm.riesgos}
                    onChange={e => setProgramaForm(f => ({ ...f, riesgos: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>
              </div>

              {/* Punto 7: Tipo de informe */}
              <div className="form-section">
                <h4 className="form-section__title">7. Tipo de Informe</h4>
                <div className="form-group">
                  <label>Formato y Estructura del Informe de Salida</label>
                  <input
                    type="text"
                    className="filter-input form-control"
                    placeholder="Ej: Informe Ejecutivo para Alta Dirección con Matriz de Hallazgos y Planes de Acción (§10.2 / §10.3)"
                    value={programaForm.tipo_informe}
                    onChange={e => setProgramaForm(f => ({ ...f, tipo_informe: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowProgramaModal(false)}>Cancelar</button>
              <button
                className="btn btn--primary"
                onClick={handleSavePrograma}
                disabled={savingPrograma || !programaForm.objetivo.trim() || !canEdit}
                title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}
              >
                {savingPrograma ? 'Guardando...' : editingProgramaId ? 'Actualizar Programa' : 'Guardar Programa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL VER DETALLE COMPLETO DEL PROGRAMA ── */}
      {viewingPrograma && (
        <div className="modal-overlay" onClick={() => setViewingPrograma(null)}>
          <div className="modal-card modal-card--lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Programa Anual de Auditoría: {viewingPrograma.numero || `PA-${viewingPrograma.anio}`}</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Año {viewingPrograma.anio} — Estado: {viewingPrograma.estado}</span>
              </div>
              <button className="modal-close" onClick={() => setViewingPrograma(null)}>✕</button>
            </div>
            <div className="modal-body modal-body--scrollable">
              <div className="program-detail-grid">
                <div className="program-detail-card">
                  <div className="program-detail-card__label">1. Identificación y Alcance</div>
                  <div className="program-detail-card__val">
                    <strong>Tipo:</strong> {viewingPrograma.tipo || 'Auditoría Interna'}<br />
                    <strong>Duración:</strong> {viewingPrograma.duracion || '12 meses'}<br />
                    <strong>Ubicación:</strong> {viewingPrograma.ubicacion || 'Sede Principal'}<br />
                    <strong>Alcance:</strong> {viewingPrograma.alcance || 'Todos los procesos del SGC'}
                  </div>
                </div>

                <div className="program-detail-card">
                  <div className="program-detail-card__label">Objetivo General</div>
                  <div className="program-detail-card__val">{viewingPrograma.objetivo}</div>
                </div>

                <div className="program-detail-card">
                  <div className="program-detail-card__label">Calendario / Cronograma</div>
                  <div className="program-detail-card__val">{viewingPrograma.calendario || 'No especificado'}</div>
                </div>

                <div className="program-detail-card">
                  <div className="program-detail-card__label">2. Criterio de la Auditoría</div>
                  <div className="program-detail-card__val">{viewingPrograma.criterio || 'Requisitos del Sistema de Gestión'}</div>
                </div>

                <div className="program-detail-card">
                  <div className="program-detail-card__label">3. Método de la Auditoría</div>
                  <div className="program-detail-card__val">{viewingPrograma.metodo || 'Entrevistas, muestreo y observación'}</div>
                </div>

                <div className="program-detail-card">
                  <div className="program-detail-card__label">4. Equipo de Auditores</div>
                  <div className="program-detail-card__val">{viewingPrograma.equipo_auditores || 'Equipo de auditores internos'}</div>
                </div>

                <div className="program-detail-card">
                  <div className="program-detail-card__label">5. Recursos Necesarios</div>
                  <div className="program-detail-card__val">{viewingPrograma.recursos || 'Tecnológicos, humanos y logísticos'}</div>
                </div>

                <div className="program-detail-card">
                  <div className="program-detail-card__label">6. Riesgos de la Auditoría</div>
                  <div className="program-detail-card__val">{viewingPrograma.riesgos || 'No reportados'}</div>
                </div>

                <div className="program-detail-card">
                  <div className="program-detail-card__label">7. Tipo de Informe</div>
                  <div className="program-detail-card__val">{viewingPrograma.tipo_informe || 'Informe Final con Hallazgos'}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn--secondary"
                onClick={() => {
                  const p = viewingPrograma
                  setViewingPrograma(null)
                  openEditPrograma(p)
                }}
                disabled={!canEdit}
              >
                ✏️ Editar este Programa
              </button>
              <button className="btn btn--primary" onClick={() => setViewingPrograma(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVA / EDITAR AUDITORÍA (CON LOS CAMPOS DE LA TABLA) ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card modal-card--lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar Auditoría' : 'Nueva Auditoría (Planificación)'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body modal-body--scrollable">
              <div className="form-row">
                <div className="form-group">
                  <label>Proceso a Auditar *</label>
                  <select
                    value={form.proceso_id || ''}
                    onChange={e => setForm(f => ({ ...f, proceso_id: parseInt(e.target.value) || undefined }))}
                    className="filter-select form-control"
                    disabled={!canEdit}
                  >
                    <option value="">Selecciona un proceso...</option>
                    {(procesos || []).map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} ({p.codigo || 'PR'})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Auditor Líder</label>
                  <select
                    value={form.auditor_lider}
                    onChange={e => setForm(f => ({ ...f, auditor_lider: e.target.value }))}
                    className="filter-select form-control"
                    disabled={!canEdit}
                  >
                    {AUDITORES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Fecha de la Auditoría *</label>
                  <input
                    type="date"
                    className="filter-input form-control"
                    value={form.fecha_inicio}
                    onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>
                <div className="form-group">
                  <label>Duración (días)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="filter-input form-control"
                    value={form.duracion_dias}
                    onChange={e => setForm(f => ({ ...f, duracion_dias: Math.max(1, parseInt(e.target.value) || 1) }))}
                    readOnly={isReadOnly()}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Auditado (Responsable / Interlocutor)</label>
                  <input
                    type="text"
                    className="filter-input form-control"
                    placeholder="Ej: Juan Pérez (Jefe de Producción)"
                    value={form.auditado}
                    onChange={e => setForm(f => ({ ...f, auditado: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select
                    value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value as Auditoria['estado'] }))}
                    className="filter-select form-control"
                    disabled={!canEdit}
                  >
                    <option value="Planificada">Planificada</option>
                    <option value="En Ejecución">En Ejecución</option>
                    <option value="Cerrada">Cerrada</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Requisito de Norma a Auditar</label>
                <input
                  type="text"
                  className="filter-input form-control"
                  placeholder="Ej: Cláusulas 4.4, 7.1.5, 8.5.1, 9.1 del Sistema de Gestión"
                  value={form.requisito_norma}
                  onChange={e => setForm(f => ({ ...f, requisito_norma: e.target.value }))}
                  readOnly={isReadOnly()}
                />
              </div>

              <div className="form-group">
                <label>Observación / Notas de Planificación</label>
                <textarea
                  className="filter-input form-control form-control-textarea"
                  placeholder="Observaciones previas, puntos críticos a verificar, muestreo requerido..."
                  value={form.observacion}
                  onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))}
                  readOnly={isReadOnly()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button
                className="btn btn--primary"
                onClick={handleSave}
                disabled={saving || !form.fecha_inicio || !canEdit}
                title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}
              >
                {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Guardar Auditoría'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVO HALLAZGO (CON LAS 4 CATEGORÍAS ISO 19011) ── */}
      {showHallazgoModal && (
        <div className="modal-overlay" onClick={() => setShowHallazgoModal(false)}>
          <div className="modal-card modal-card--lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ingresar Nuevo Hallazgo de Auditoría</h3>
              <button className="modal-close" onClick={() => setShowHallazgoModal(false)}>✕</button>
            </div>
            <div className="modal-body modal-body--scrollable">
              <div className="form-row">
                <div className="form-group">
                  <label>Auditoría de Origen *</label>
                  <select
                    className="filter-select form-control"
                    value={hallazgoForm.auditoria_id || ''}
                    onChange={e => setHallazgoForm(f => ({ ...f, auditoria_id: parseInt(e.target.value) || undefined }))}
                    disabled={!canEdit}
                  >
                    <option value="">Selecciona la auditoría...</option>
                    {(auditorias || []).map(a => (
                      <option key={a.id} value={a.id}>
                        {a.codigo} — {a.proceso_nombre || 'General'} ({formatFecha(a.fecha_inicio)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Naturaleza / Clasificación del Hallazgo *</label>
                  <select
                    className="filter-select form-control"
                    value={hallazgoForm.tipo}
                    onChange={e => setHallazgoForm(f => ({ ...f, tipo: e.target.value }))}
                    disabled={!canEdit}
                  >
                    <optgroup label="1. Aspectos Positivos">
                      <option value="Fortaleza">⭐ Fortaleza (Práctica destacada / Alto desempeño)</option>
                    </optgroup>
                    <optgroup label="2. Conformidades">
                      <option value="Conformidad">✓ Conformidad (Cumplimiento evidenciado del requisito)</option>
                    </optgroup>
                    <optgroup label="3. Incumplimientos Normativos">
                      <option value="No Conformidad Menor">⚠️ No Conformidad Menor</option>
                      <option value="No Conformidad Mayor">🚨 No Conformidad Mayor</option>
                    </optgroup>
                    <optgroup label="4. Mejoras y Observaciones">
                      <option value="Oportunidad de Mejora">💡 Oportunidad de Mejora</option>
                      <option value="Observación">ℹ️ Observación preventiva</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Cláusula / Requisito Normativo</label>
                  <input
                    type="text"
                    className="filter-input form-control"
                    placeholder="Ej: 8.5.1, 7.1.5, 9.2 o procedimiento interno"
                    value={hallazgoForm.clausula}
                    onChange={e => setHallazgoForm(f => ({ ...f, clausula: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>
                <div className="form-group">
                  <label>Estado del Hallazgo</label>
                  <select
                    className="filter-select form-control"
                    value={hallazgoForm.estado}
                    onChange={e => setHallazgoForm(f => ({ ...f, estado: e.target.value }))}
                    disabled={!canEdit}
                  >
                    <option value="Abierto">Abierto</option>
                    <option value="Cerrado">Cerrado / Atendido</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Descripción del Hallazgo y Evidencia Objetiva *</label>
                <textarea
                  className="filter-input form-control form-control-textarea"
                  style={{ minHeight: '100px' }}
                  placeholder="Redacta la declaración del hallazgo indicando la evidencia objetiva observada, los registros verificados y el criterio evaluado..."
                  value={hallazgoForm.descripcion}
                  onChange={e => setHallazgoForm(f => ({ ...f, descripcion: e.target.value }))}
                  readOnly={isReadOnly()}
                />
              </div>

              <div className="modal-preview">
                <span className="modal-preview__label">Destino automático del hallazgo:</span>
                {hallazgoForm.tipo.includes('No Conformidad') ? (
                  <span>Podrá ser transferido con 1 clic al módulo de <strong>No Conformidades (Cap. 10.2)</strong> para análisis de causa raíz.</span>
                ) : hallazgoForm.tipo.includes('Oportunidad') ? (
                  <span>Podrá ser transferido con 1 clic a <strong>Mejora Continua (Cap. 10.3)</strong>.</span>
                ) : hallazgoForm.tipo === 'Fortaleza' ? (
                  <span>Quedará registrado como fortaleza organizacional en el informe de auditoría.</span>
                ) : (
                  <span>Quedará registrado como evidencia de conformidad del proceso.</span>
                )}
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowHallazgoModal(false)}>Cancelar</button>
              <button
                className="btn btn--primary"
                onClick={handleSaveHallazgo}
                disabled={savingHallazgo || !hallazgoForm.auditoria_id || !hallazgoForm.descripcion.trim() || !canEdit}
                title={!canEdit ? 'Sin permiso para crear' : undefined}
              >
                {savingHallazgo ? 'Guardando...' : 'Registrar Hallazgo'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default AuditoriaPage
