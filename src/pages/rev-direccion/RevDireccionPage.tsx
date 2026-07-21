import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import './RevDireccionPage.css'
import { useFetch } from '../../hooks/useFetch'
import {
  revDireccionService,
  objetivosCalidadService,
  riesgosService,
  indicadoresService,
  ncAcService,
  auditoriasService,
  proveedoresService,
  type SalidaRevision,
  type RevDireccionAnalisis,
} from '../../services'
import { useAIAnalysis } from '../../context/AIAnalysisContext'
import { api } from '../../services/api'
import { usePermissions } from '../../hooks/usePermissions'

// ── Tipos locales ──────────────────────────────────────────────────────────────

interface InsumoCard {
  req:        string
  clausula:   string
  titulo:     string
  kpis:       { label: string; value: string | number; alerta?: boolean }[]
  detalle:    string
}

type TabSalida = 'oportunidades' | 'cambiosSGC' | 'recursos'

const PRIORIDAD_CLASS: Record<string, string> = {
  Alta:  'prioridad--alta',
  Media: 'prioridad--media',
  Baja:  'prioridad--baja',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function pct(val: number, total: number) {
  if (!total) return '0 %'
  return `${Math.round((val / total) * 100)} %`
}

// ── Componente principal ───────────────────────────────────────────────────────

const RevDireccionPage: React.FC = () => {
  const { canEdit, canApprove, isReadOnly } = usePermissions('rev_direccion')
  // Historial de actas
  const { data: revisiones, loading: loadingRev, error: errorRev, refetch: refetchRev } =
    useFetch(revDireccionService.getAll, [])

  // Insumos desde la BD
  const { data: riesgos,          refetch: refetchRiesgos }     = useFetch(riesgosService.getAll, [])
  const { data: indicadores,      refetch: refetchIndicadores } = useFetch(indicadoresService.getAll, [])
  const { data: ncs,              refetch: refetchNcs }         = useFetch(ncAcService.getNCs, [])
  const { data: acs,              refetch: refetchAcs }         = useFetch(ncAcService.getACs, [])
  const { data: auditorias,       refetch: refetchAuditorias }  = useFetch(auditoriasService.getAll, [])
  const { data: hallazgos,        refetch: refetchHallazgos }   = useFetch(auditoriasService.getHallazgos, [])
  const { data: proveedores,      refetch: refetchProveedores } = useFetch(proveedoresService.getAll, [])
  const { data: objetivosCalidad, refetch: refetchObjetivos }   = useFetch(objetivosCalidadService.getAll, [])

  // Insumos desde el contexto IA (4.1 y 7.1)
  const { analysis, datosEmpresa } = useAIAnalysis()

  // Estado UI
  const [analizando, setAnalizando]             = useState(false)
  const [errorAnalisis, setErrorAnalisis]       = useState<string | null>(null)
  const [analisis, setAnalisis]                 = useState<RevDireccionAnalisis | null>(null)
  const [tabActiva, setTabActiva]               = useState<TabSalida>('oportunidades')
  const [showActaModal, setShowActaModal]       = useState(false)
  const [editandoId, setEditandoId]             = useState<number | null>(null)
  const [guardando, setGuardando]               = useState(false)
  const [formActa, setFormActa]                 = useState({
    fecha: new Date().toISOString().slice(0, 10),
    asistentes: '', proxima_rev: '',
  })

  // ── Refresco de insumos (manual + automático al recuperar foco) ─────────────
  // Los insumos (riesgos, objetivos de calidad, etc.) se editan en otros módulos.
  // Si el usuario vuelve a esta pestaña después de marcar algo como "Cumplido"
  // u otro cambio, refrescamos automáticamente para que las tarjetas reflejen
  // el estado real, sin necesidad de recargar toda la página.
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date())
  const [refrescando, setRefrescando]                 = useState(false)
  const lastFetchRef = useRef<number>(Date.now())
  const REFRESH_THROTTLE_MS = 8000

  const refrescarInsumos = useCallback(async (force = false) => {
    const ahora = Date.now()
    if (!force && ahora - lastFetchRef.current < REFRESH_THROTTLE_MS) return
    lastFetchRef.current = ahora
    setRefrescando(true)
    try {
      await Promise.all([
        refetchRiesgos(), refetchIndicadores(), refetchNcs(), refetchAcs(),
        refetchAuditorias(), refetchHallazgos(), refetchProveedores(), refetchObjetivos(),
      ])
      setUltimaActualizacion(new Date())
    } finally {
      setRefrescando(false)
    }
  }, [refetchRiesgos, refetchIndicadores, refetchNcs, refetchAcs,
      refetchAuditorias, refetchHallazgos, refetchProveedores, refetchObjetivos])

  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') refrescarInsumos()
    }
    window.addEventListener('focus', handleFocusOrVisible)
    document.addEventListener('visibilitychange', handleFocusOrVisible)
    return () => {
      window.removeEventListener('focus', handleFocusOrVisible)
      document.removeEventListener('visibilitychange', handleFocusOrVisible)
    }
  }, [refrescarInsumos])

  // ── Cómputos de KPIs por insumo ─────────────────────────────────────────────

  const insumos: InsumoCard[] = useMemo(() => {
    const rCriticos   = (riesgos as any[]).filter(r => r.estado === 'CRITICO').length
    const rTotal      = (riesgos as any[]).length
    const oportunidades = (riesgos as any[]).filter(r => r.tipo === 'Oportunidad').length

    const indCumple   = (indicadores as any[]).filter(i => i.ultima_medicion?.estado === 'Cumple').length
    const indTotal    = (indicadores as any[]).length

    const ncAbiertas  = (ncs as any[]).filter(n => n.estado !== 'Cerrada').length
    const acCerradas  = (acs as any[]).filter(a => a.estado === 'Cerrada').length
    const acTotal     = (acs as any[]).length

    const audCerradas = (auditorias as any[]).filter(a => a.estado === 'Cerrada').length
    const audTotal    = (auditorias as any[]).length
    const hallAbiert  = (hallazgos as any[]).filter(h => h.estado === 'Abierto').length

    const provAprobados  = (proveedores as any[]).filter(p => p.estado === 'Aprobado').length
    const provTotal      = (proveedores as any[]).length
    const provConEval    = (proveedores as any[]).filter(p => p.ultima_evaluacion).length
    const promedioEval   = provConEval
      ? Math.round((proveedores as any[]).filter(p => p.ultima_evaluacion)
          .reduce((sum: number, p: any) => sum + p.ultima_evaluacion.total, 0) / provConEval)
      : null

    const objCumplidos = (objetivosCalidad as any[]).filter(o => o.estado === 'Cumplido').length
    const objTotal     = (objetivosCalidad as any[]).length

    const pestelCount = analysis?.pestel?.length ?? 0
    const dofaCount   = analysis?.dofa?.length ?? 0
    const recursosNivel = analysis?.matrizRecursos
      ? analysis.matrizRecursos.filter((m: any) =>
          m.nivelRiesgoAzul === 'Alto' || m.nivelRiesgoAzul === 'Crítico').length
      : 0

    return [
      {
        req: '9.3.2 b)', clausula: '4.1 Contexto',
        titulo: 'Cambios en el contexto externo e interno',
        kpis: [
          { label: 'Factores PESTEL', value: pestelCount },
          { label: 'Items DOFA', value: dofaCount },
          { label: 'Recursos con riesgo alto', value: recursosNivel, alerta: recursosNivel > 0 },
        ],
        detalle: pestelCount
          ? `${pestelCount} factores PESTEL y ${dofaCount} items DOFA analizados. ${recursosNivel} proceso(s) con nivel de riesgo alto en recursos.`
          : 'Sin análisis de contexto generado. Ejecuta el análisis IA en el módulo de Procesos.',
      },
      {
        req: '9.3.2 e)', clausula: '6.1 Riesgos',
        titulo: 'Eficacia de acciones sobre riesgos y oportunidades',
        kpis: [
          { label: 'Riesgos críticos', value: rCriticos, alerta: rCriticos > 0 },
          { label: 'Total registrados', value: rTotal },
          { label: 'Oportunidades', value: oportunidades },
        ],
        detalle: rTotal
          ? `${rCriticos} riesgo(s) en estado CRÍTICO de ${rTotal} registrados. ${oportunidades} oportunidades identificadas.`
          : 'Sin riesgos registrados.',
      },
      {
        req: '9.3.2 c.2)', clausula: '6.2 Objetivos',
        titulo: 'Cumplimiento de objetivos de calidad',
        kpis: [
          { label: 'Cumplidos', value: objCumplidos },
          { label: 'Total', value: objTotal },
          { label: 'Cumplimiento', value: pct(objCumplidos, objTotal), alerta: objTotal > 0 && objCumplidos / objTotal < 0.7 },
        ],
        detalle: objTotal
          ? `${objCumplidos} de ${objTotal} objetivos cumplidos (${pct(objCumplidos, objTotal)}).`
          : 'Sin objetivos de calidad registrados.',
      },
      {
        req: '9.3.2 c.3)', clausula: '9.1 Indicadores',
        titulo: 'Desempeño de procesos y conformidad del producto',
        kpis: [
          { label: 'Indicadores en meta', value: indCumple },
          { label: 'Total indicadores', value: indTotal },
          { label: 'Cumplimiento', value: pct(indCumple, indTotal), alerta: indTotal > 0 && indCumple / indTotal < 0.6 },
        ],
        detalle: indTotal
          ? `${indCumple} de ${indTotal} indicadores cumplen su meta (${pct(indCumple, indTotal)}).`
          : 'Sin indicadores registrados.',
      },
      {
        req: '9.3.2 c.4)', clausula: '10.2 NC/AC',
        titulo: 'No conformidades y acciones correctivas',
        kpis: [
          { label: 'NC abiertas', value: ncAbiertas, alerta: ncAbiertas > 0 },
          { label: 'AC cerradas', value: `${acCerradas}/${acTotal}` },
          { label: 'Eficacia AC', value: pct(acCerradas, acTotal), alerta: acTotal > 0 && acCerradas / acTotal < 0.5 },
        ],
        detalle: `${ncAbiertas} no conformidades pendientes de cierre. ${acCerradas} de ${acTotal} acciones correctivas cerradas.`,
      },
      {
        req: '9.3.2 c.6)', clausula: '9.2 Auditorías',
        titulo: 'Resultados de auditorías internas',
        kpis: [
          { label: 'Auditorías cerradas', value: `${audCerradas}/${audTotal}` },
          { label: 'Hallazgos abiertos', value: hallAbiert, alerta: hallAbiert > 0 },
        ],
        detalle: audTotal
          ? `${audCerradas} de ${audTotal} auditorías cerradas. ${hallAbiert} hallazgo(s) pendiente(s) de cierre.`
          : 'Sin auditorías registradas.',
      },
      {
        req: '9.3.2 c.7)', clausula: '8.4 Proveedores',
        titulo: 'Desempeño de proveedores externos',
        kpis: [
          { label: 'Aprobados', value: `${provAprobados}/${provTotal}` },
          { label: 'Puntaje promedio', value: promedioEval !== null ? `${promedioEval}/100` : 'N/A', alerta: promedioEval !== null && promedioEval < 70 },
        ],
        detalle: provTotal
          ? `${provAprobados} proveedores aprobados. ${provConEval} con evaluación registrada.${promedioEval !== null ? ` Puntaje promedio: ${promedioEval}/100.` : ''}`
          : 'Sin proveedores registrados.',
      },
    ]
  }, [riesgos, indicadores, ncs, acs, auditorias, hallazgos, proveedores, objetivosCalidad, analysis])

  // ── Disparar análisis IA ─────────────────────────────────────────────────────

  const handleAnalizar = useCallback(async () => {
    setAnalizando(true)
    setErrorAnalisis(null)
    setAnalisis(null)
    try {
      const resultado = await api.post<RevDireccionAnalisis>(
        '/api/gemini/analizar-rev-direccion',
        {
          riesgos,
          indicadores,
          noConformidades:      ncs,
          accionesCorrectivas:  acs,
          auditorias,
          hallazgos,
          proveedores,
          objetivosCalidad,
          pestel:           analysis?.pestel        ?? [],
          dofa:             analysis?.dofa          ?? [],
          matrizRecursos:   analysis?.matrizRecursos ?? [],
          contextoNarrativo: (analysis as any)?.contextoNarrativo ?? '',
          datosEmpresa,
        }
      )
      setAnalisis(resultado)
    } catch (e: any) {
      setErrorAnalisis(e.message || 'Error al analizar con IA')
    } finally {
      setAnalizando(false)
    }
  }, [riesgos, indicadores, ncs, acs, auditorias, hallazgos, proveedores,
      objetivosCalidad, analysis, datosEmpresa])

  // ── Guardar acta ─────────────────────────────────────────────────────────────

  const handleGuardarActa = useCallback(async () => {
    if (!analisis) return
    setGuardando(true)
    try {
      const salidaTexto = [
        '═══ OPORTUNIDADES DE MEJORA ═══',
        ...analisis.oportunidadesMejora.map(s => `[${s.prioridad}] ${s.titulo}\n${s.justificacion}`),
        '\n═══ NECESIDADES DE CAMBIO EN EL SGC ═══',
        ...analisis.necesidadesCambioSGC.map(s => `[${s.prioridad}] ${s.titulo}\n${s.justificacion}`),
        '\n═══ NECESIDADES DE RECURSOS ═══',
        ...analisis.necesidadesRecursos.map(s => `[${s.prioridad}] ${s.titulo}\n${s.justificacion}`),
      ].join('\n')

      const body = {
        ...formActa,
        temas:        insumos.map(i => `${i.req} — ${i.titulo}`).join('\n'),
        conclusiones: `${analisis.resumenEjecutivo}\n\n${analisis.conclusionGeneral}`,
        decisiones:   salidaTexto,
      }

      if (editandoId) {
        await revDireccionService.update(editandoId, body)
      } else {
        await revDireccionService.create(body)
      }
      await refetchRev()
      setShowActaModal(false)
      setEditandoId(null)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setGuardando(false)
    }
  }, [analisis, formActa, editandoId, insumos, refetchRev])

  // ── Salidas tabuladas ────────────────────────────────────────────────────────

  const salidaActiva: SalidaRevision[] = analisis
    ? tabActiva === 'oportunidades' ? analisis.oportunidadesMejora
    : tabActiva === 'cambiosSGC'   ? analisis.necesidadesCambioSGC
    :                                analisis.necesidadesRecursos
    : []

  const alertCount = insumos.reduce((n, i) =>
    n + i.kpis.filter(k => k.alerta).length, 0)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="page rev9-page">

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="page__header rev9-header">
        <div className="rev9-header-left">
          <nav className="rev9-breadcrumb">
            <span>Governex</span>
            <span className="rev9-bc-sep">›</span>
            <span>Cap. 9</span>
            <span className="rev9-bc-sep">›</span>
            <span className="rev9-bc-active">9.3 Revisión por la Dirección</span>
          </nav>
          <h2>Revisión por la Dirección</h2>
          <p className="rev9-subtitle">
            Evaluación estratégica del desempeño y eficacia del SGC · ISO 9001:2015 §9.3
          </p>
        </div>
        <div className="rev9-header-actions">
          {alertCount > 0 && (
            <span className="rev9-alert-badge">⚠ {alertCount} alerta{alertCount > 1 ? 's' : ''}</span>
          )}
          <button
            className={`btn btn--primary rev9-btn-analizar ${analizando ? 'rev9-btn-analizar--loading' : ''}`}
            onClick={handleAnalizar}
            disabled={analizando || !canEdit}
            title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : undefined}
          >
            {analizando
              ? <><span className="rev9-spinner" />Analizando…</>
              : <><span className="rev9-icon-ai">✦</span>Analizar con IA</>
            }
          </button>
        </div>
      </header>

      <div className="rev9-layout">

        {/* ── Columna principal ────────────────────────────── */}
        <div className="rev9-main">

          {/* Insumos §9.3.2 */}
          <section className="rev9-section">
            <div className="rev9-section-title">
              <span className="rev9-section-num">§9.3.2</span>
              <h3>Insumos de la Revisión</h3>
              <span className="rev9-section-sub">Datos en tiempo real del SGC</span>
              <div className="rev9-refresh-group">
                <span className="rev9-refresh-time">
                  Actualizado {ultimaActualizacion.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  className={`rev9-refresh-btn ${refrescando ? 'rev9-refresh-btn--spinning' : ''}`}
                  onClick={() => refrescarInsumos(true)}
                  disabled={refrescando}
                  title="Actualizar insumos"
                  aria-label="Actualizar insumos"
                >
                  ↻
                </button>
              </div>
            </div>

            <div className="rev9-insumos-grid">
              {insumos.map((ins, i) => (
                <div key={i} className={`rev9-insumo-card ${ins.kpis.some(k => k.alerta) ? 'rev9-insumo-card--alerta' : ''}`}>
                  <div className="rev9-insumo-head">
                    <span className="rev9-insumo-req">{ins.req}</span>
                    <span className="rev9-insumo-clausula">{ins.clausula}</span>
                  </div>
                  <p className="rev9-insumo-titulo">{ins.titulo}</p>
                  <div className="rev9-insumo-kpis">
                    {ins.kpis.map((kpi, j) => (
                      <div key={j} className={`rev9-kpi ${kpi.alerta ? 'rev9-kpi--alerta' : ''}`}>
                        <span className="rev9-kpi-value">{kpi.value}</span>
                        <span className="rev9-kpi-label">{kpi.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="rev9-insumo-detalle">{ins.detalle}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Error análisis */}
          {errorAnalisis && (
            <div className="rev9-error-banner">
              <span>⚠</span>
              <div>
                <strong>Error al analizar</strong>
                <p>{errorAnalisis}</p>
              </div>
            </div>
          )}

          {/* Placeholder vacío */}
          {!analisis && !analizando && !errorAnalisis && (
            <section className="rev9-empty-analisis">
              <div className="rev9-empty-icon">✦</div>
              <h3>Listo para analizar</h3>
              <p>
                Haz clic en <strong>Analizar con IA</strong> para que el sistema consolide
                todos los insumos anteriores y genere las salidas de la revisión según §9.3.3.
              </p>
            </section>
          )}

          {/* Skeleton mientras carga */}
          {analizando && (
            <section className="rev9-skeleton">
              <div className="rev9-skeleton-bar rev9-skeleton-bar--wide" />
              <div className="rev9-skeleton-bar" />
              <div className="rev9-skeleton-bar rev9-skeleton-bar--short" />
              <div className="rev9-skeleton-cards">
                {[1,2,3].map(n => <div key={n} className="rev9-skeleton-card" />)}
              </div>
            </section>
          )}

          {/* ── Resultados IA ──────────────────────────────── */}
          {analisis && (
            <section className="rev9-resultados">
              <div className="rev9-section-title">
                <span className="rev9-section-num">§9.3.3</span>
                <h3>Salidas de la Revisión</h3>
                <span className="rev9-section-sub">Generado por análisis IA · editable antes de cerrar acta</span>
              </div>

              {/* Resumen ejecutivo */}
              <div className="rev9-resumen-card">
                <div className="rev9-resumen-header">
                  <span className="rev9-resumen-label">Resumen Ejecutivo</span>
                </div>
                <p className="rev9-resumen-texto">{analisis.resumenEjecutivo}</p>
              </div>

              {/* Tabs de salidas */}
              <div className="rev9-tabs">
                {([
                  { key: 'oportunidades', label: 'Oportunidades de Mejora',    count: analisis.oportunidadesMejora.length },
                  { key: 'cambiosSGC',    label: 'Cambios en el SGC',          count: analisis.necesidadesCambioSGC.length },
                  { key: 'recursos',      label: 'Necesidades de Recursos',    count: analisis.necesidadesRecursos.length },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    className={`rev9-tab ${tabActiva === tab.key ? 'rev9-tab--active' : ''}`}
                    onClick={() => setTabActiva(tab.key)}
                  >
                    {tab.label}
                    <span className="rev9-tab-count">{tab.count}</span>
                  </button>
                ))}
              </div>

              <div className="rev9-salidas-lista">
                {salidaActiva.map((s, i) => (
                  <div key={i} className="rev9-salida-item">
                    <div className="rev9-salida-head">
                      <span className={`rev9-prioridad ${PRIORIDAD_CLASS[s.prioridad]}`}>
                        {s.prioridad}
                      </span>
                      <span className="rev9-salida-req">{s.requisitoFuente}</span>
                    </div>
                    <p className="rev9-salida-titulo">{s.titulo}</p>
                    <p className="rev9-salida-just">{s.justificacion}</p>
                  </div>
                ))}
              </div>

              {/* Conclusión */}
              <div className="rev9-conclusion">
                <span className="rev9-conclusion-label">Conclusión y Enfoque Estratégico</span>
                <p>{analisis.conclusionGeneral}</p>
              </div>

              {/* Botón cerrar acta */}
              <div className="rev9-acta-action">
                <button
                  className="btn btn--primary rev9-btn-acta"
                  onClick={() => setShowActaModal(true)}
                  disabled={!canApprove}
                  title={!canApprove ? 'Tu rol no tiene permiso para esta acción' : undefined}
                >
                  📋 Registrar Acta de Revisión
                </button>
                <p className="rev9-acta-hint">
                  El acta incluirá todos los insumos, el resumen y las salidas generadas.
                </p>
              </div>
            </section>
          )}
        </div>

        {/* ── Columna lateral: historial ───────────────────── */}
        <aside className="rev9-sidebar">
          <div className="rev9-hist-panel">
            <h3>Historial de Actas</h3>

            {loadingRev ? (
              <div className="rev9-hist-loading">Cargando…</div>
            ) : errorRev ? (
              <div className="rev9-hist-error">Error: {errorRev}</div>
            ) : revisiones.length === 0 ? (
              <div className="rev9-hist-empty">
                <p>Aún no hay actas registradas.</p>
                <p>Ejecuta el análisis IA y registra la primera revisión.</p>
              </div>
            ) : (
              <div className="rev9-hist-list">
                {(revisiones as any[]).map((rev: any, i: number) => (
                  <div key={rev.id} className="rev9-hist-item">
                    <div className="rev9-hist-item-top">
                      <strong>RD-{new Date(rev.fecha).getFullYear()}-{String(i + 1).padStart(2, '0')}</strong>
                      <span className="rev9-hist-fecha">
                        {new Date(rev.fecha).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}
                      </span>
                    </div>
                    {rev.proxima_rev && (
                      <p className="rev9-hist-prox">
                        Próxima: {new Date(rev.proxima_rev).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}
                      </p>
                    )}
                    <span className="rev9-hist-badge">Registrada</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Guía rápida */}
          <div className="rev9-guide-panel">
            <h4>Flujo de la Revisión</h4>
            <ol className="rev9-guide-steps">
              <li><strong>Insumos</strong> — El sistema carga automáticamente los datos del SGC</li>
              <li><strong>Análisis IA</strong> — Governex IA consolida y genera las salidas §9.3.3</li>
              <li><strong>Revisión</strong> — La dirección evalúa y edita las recomendaciones</li>
              <li><strong>Acta</strong> — Se registra formalmente con fecha y asistentes</li>
            </ol>
          </div>
        </aside>
      </div>

      {/* ── Modal: registrar acta ────────────────────────────── */}
      {showActaModal && (
        <div className="modal-overlay" onClick={() => setShowActaModal(false)}>
          <div
            className="modal-card rev9-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>📋 Registrar Acta de Revisión</h3>
              <button className="modal-close" onClick={() => setShowActaModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha de la revisión</label>
                  <input
                    type="date" className="filter-input form-control"
                    value={formActa.fecha}
                    onChange={e => setFormActa(f => ({ ...f, fecha: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>
                <div className="form-group">
                  <label>Próxima revisión</label>
                  <input
                    type="date" className="filter-input form-control"
                    value={formActa.proxima_rev}
                    onChange={e => setFormActa(f => ({ ...f, proxima_rev: e.target.value }))}
                    readOnly={isReadOnly()}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Asistentes</label>
                <input
                  type="text" className="filter-input form-control"
                  placeholder="Ej: Gerente General, Director de Calidad…"
                  value={formActa.asistentes}
                  onChange={e => setFormActa(f => ({ ...f, asistentes: e.target.value }))}
                  readOnly={isReadOnly()}
                />
              </div>
              {analisis && (
                <div className="rev9-modal-preview">
                  <p className="rev9-modal-preview-label">Vista previa de salidas incluidas:</p>
                  <ul>
                    <li>✅ {analisis.oportunidadesMejora.length} oportunidades de mejora</li>
                    <li>✅ {analisis.necesidadesCambioSGC.length} necesidades de cambio en el SGC</li>
                    <li>✅ {analisis.necesidadesRecursos.length} necesidades de recursos</li>
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowActaModal(false)}>
                Cancelar
              </button>
              <button
                className="btn btn--primary"
                onClick={handleGuardarActa}
                disabled={guardando || !formActa.asistentes.trim() || !canApprove}
                title={!canApprove ? 'Tu rol no tiene permiso para esta acción' : undefined}
              >
                {guardando ? 'Guardando…' : 'Registrar Acta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RevDireccionPage