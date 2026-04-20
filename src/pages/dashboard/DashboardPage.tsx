import React, { useEffect, useState } from 'react'
import './DashboardPage.css'
import { api } from '../../services/api'

interface DashKpis {
  ncAbiertas: number
  ncVencidas: number
  riesgosAltos: number
  riesgosSinPlan: number
  docsEnRevision: number
  indicadoresCumpliendo: number
  indicadoresTotal: number
  auditoriasEnEjecucion: number
}

const DashboardPage: React.FC = () => {
  const [kpis, setKpis]           = useState<DashKpis | null>(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<any[]>('/api/nc-ac/no-conformidades'),
      api.get<any[]>('/api/nc-ac/acciones-correctivas'),
      api.get<any[]>('/api/riesgos'),
      api.get<any[]>('/api/documentos'),
      api.get<any[]>('/api/indicadores'),
      api.get<any[]>('/api/auditorias'),
    ])
      .then(([ncs, acs, riesgos, docs, indicadores, auditorias]) => {
        const hoy = new Date()
        setKpis({
          ncAbiertas:            ncs.filter((nc: any) => nc.estado !== 'Cerrada').length,
          ncVencidas:            acs.filter((ac: any) => ac.fecha_fin && new Date(ac.fecha_fin) < hoy && ac.estado !== 'Cerrada').length,
          riesgosAltos:          riesgos.filter((r: any) => r.nivel >= 6).length,
          riesgosSinPlan:        riesgos.filter((r: any) => r.nivel >= 6 && r.estado === 'MONITOREO').length,
          docsEnRevision:        docs.filter((d: any) => d.estado === 'En Revision').length,
          indicadoresCumpliendo: indicadores.filter((i: any) => i.ultima_medicion?.estado === 'Cumple').length,
          indicadoresTotal:      indicadores.length,
          auditoriasEnEjecucion: auditorias.filter((a: any) => a.estado === 'En Ejecución').length,
        })
      })
      .catch(() => setKpis(null))
      .finally(() => setLoading(false))
  }, [])

  const eficacia = kpis && kpis.indicadoresTotal > 0
    ? Math.round((kpis.indicadoresCumpliendo / kpis.indicadoresTotal) * 100)
    : 0

  return (
    <div className="page dashboard-page">
      {/* Resumen Ejecutivo Bar */}
      <div className="dash-summary-bar">
        <div className="dash-summary-bar__left">
          <h2>Resumen Ejecutivo del SGC</h2>
          <span>Periodo: {new Date().getFullYear()} | Plataforma: Governex | Estado: ACTIVO</span>
        </div>
        <div className="dash-summary-bar__right">
          <button className="dash-btn-active">
            <span className="dot dot--success"></span> SISTEMA ACTIVO
          </button>
        </div>
      </div>

      {/* KPIs Principales */}
      <div className="dash-kpis">
        <div className="dash-kpi-card" style={{ borderTopColor: '#28a745' }}>
          <span className="dash-kpi__title">Eficacia Indicadores</span>
          <span className="dash-kpi__value text-success">
            {loading ? '—' : `${eficacia}%`}
          </span>
          <span className="dash-kpi__trend">
            {loading ? 'Cargando...' : `${kpis?.indicadoresCumpliendo ?? 0} de ${kpis?.indicadoresTotal ?? 0} cumplen meta`}
          </span>
        </div>

        <div className="dash-kpi-card" style={{ borderTopColor: '#dc3545' }}>
          <span className="dash-kpi__title">NC Abiertas</span>
          <span className="dash-kpi__value text-danger">
            {loading ? '—' : kpis?.ncAbiertas ?? 0}
          </span>
          <span className="dash-kpi__trend text-danger">
            {loading ? 'Cargando...' : kpis?.ncVencidas
              ? `${kpis.ncVencidas} AC vencidas — acción urgente`
              : 'Sin acciones vencidas'}
          </span>
        </div>

        <div className="dash-kpi-card" style={{ borderTopColor: '#ffc107' }}>
          <span className="dash-kpi__title">Riesgos Altos</span>
          <span className="dash-kpi__value text-warning">
            {loading ? '—' : kpis?.riesgosAltos ?? 0}
          </span>
          <span className="dash-kpi__trend text-warning">
            {loading ? 'Cargando...' : kpis?.riesgosSinPlan
              ? `${kpis.riesgosSinPlan} sin plan de tratamiento`
              : 'Todos con plan asignado'}
          </span>
        </div>

        <div className="dash-kpi-card" style={{ borderTopColor: '#fd7e14' }}>
          <span className="dash-kpi__title">Docs. En Revisión</span>
          <span className="dash-kpi__value text-orange">
            {loading ? '—' : kpis?.docsEnRevision ?? 0}
          </span>
          <span className="dash-kpi__trend text-orange">
            {loading ? 'Cargando...' : kpis?.docsEnRevision
              ? 'Pendientes de aprobación'
              : 'Sin documentos pendientes'}
          </span>
        </div>

        <div className="dash-kpi-card" style={{ borderTopColor: '#20c997' }}>
          <span className="dash-kpi__title">Auditorías Activas</span>
          <span className="dash-kpi__value text-teal">
            {loading ? '—' : kpis?.auditoriasEnEjecucion ?? 0}
          </span>
          <span className="dash-kpi__trend text-teal-light">
            {loading ? 'Cargando...' : 'En ejecución actualmente'}
          </span>
        </div>
      </div>

      <div className="dash-main-grid">
        {/* Cumplimiento por Proceso — gráfica estática de referencia */}
        <div className="dash-panel">
          <div className="dash-panel__header">
            <h3>Cumplimiento por Proceso (%)</h3>
            <span>Meta: 85% | Governex {new Date().getFullYear()}</span>
          </div>
          <div className="dash-bar-chart-wrap">
            <div className="dash-bar-chart__y-axis">
              <span>100 —</span>
              <span>75 —</span>
              <span>50 —</span>
              <span>25 —</span>
              <span className="invisible">0</span>
            </div>
            <div className="dash-bar-chart__area">
              <div className="dash-bar-chart__target-line" style={{ bottom: '85%' }}></div>
              <div className="dash-bar-col">
                <span className="dash-bar-val text-success">95%</span>
                <div className="dash-bar-fill bg-success" style={{ height: '95%' }}></div>
                <span className="dash-bar-label">Estrategia</span>
              </div>
              <div className="dash-bar-col">
                <span className="dash-bar-val text-orange">72%</span>
                <div className="dash-bar-fill bg-orange" style={{ height: '72%' }}></div>
                <span className="dash-bar-label">Comercial</span>
              </div>
              <div className="dash-bar-col">
                <span className="dash-bar-val text-success">88%</span>
                <div className="dash-bar-fill bg-success" style={{ height: '88%' }}></div>
                <span className="dash-bar-label">Producción</span>
              </div>
              <div className="dash-bar-col">
                <span className="dash-bar-val text-danger">65%</span>
                <div className="dash-bar-fill bg-danger" style={{ height: '65%' }}></div>
                <span className="dash-bar-label">RRHH</span>
              </div>
              <div className="dash-bar-col">
                <span className="dash-bar-val text-success">91%</span>
                <div className="dash-bar-fill bg-success" style={{ height: '91%' }}></div>
                <span className="dash-bar-label">Compras</span>
              </div>
              <div className="dash-bar-col">
                <span className="dash-bar-val text-warning">78%</span>
                <div className="dash-bar-fill bg-warning" style={{ height: '78%' }}></div>
                <span className="dash-bar-label">TI</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mapa de Riesgos */}
        <div className="dash-panel">
          <div className="dash-panel__header">
            <h3>Mapa de Riesgos</h3>
            <span>Probabilidad x Impacto</span>
          </div>
          <div className="dash-risk-map-container">
            <div className="dash-risk-map__y-label">
              <span>Alta</span>
              <span>Media</span>
              <span>Baja</span>
            </div>
            <div className="dash-risk-map__core">
              <div className="dash-risk-grid">
                <div className="risk-cell bg-yellow"></div>
                <div className="risk-cell bg-orange"></div>
                <div className="risk-cell bg-red"><div className="risk-dot">R2</div></div>
                <div className="risk-cell bg-light-green"><div className="risk-dot">R3</div></div>
                <div className="risk-cell bg-yellow"><div className="risk-dot">R1</div></div>
                <div className="risk-cell bg-orange"></div>
                <div className="risk-cell bg-light-green"><div className="risk-dot">R4</div></div>
                <div className="risk-cell bg-light-green"></div>
                <div className="risk-cell bg-yellow"></div>
              </div>
              <div className="dash-risk-map__x-label">
                <div className="x-label-texts">
                  <span>Bajo</span><span>Medio</span><span>Alto</span>
                </div>
                <div className="x-label-title">IMPACTO</div>
              </div>
            </div>
          </div>
        </div>

        {/* Actividad Reciente — construida desde los datos reales */}
        <div className="dash-panel">
          <div className="dash-panel__header" style={{ marginBottom: '1.5rem' }}>
            <h3>Estado del Sistema</h3>
          </div>
          <div className="dash-activity-list">
            {loading ? (
              <div style={{ padding: '1rem', opacity: 0.5 }}>Cargando datos...</div>
            ) : kpis ? (
              <>
                <div className="activity-item">
                  <div className={`activity-dot ${kpis.ncAbiertas === 0 ? 'bg-success' : 'bg-danger'}`}></div>
                  <div className="activity-content">
                    <strong>No Conformidades abiertas: {kpis.ncAbiertas}</strong>
                    <span>{kpis.ncVencidas > 0 ? `${kpis.ncVencidas} AC vencidas — requieren atención` : 'Sin acciones correctivas vencidas'}</span>
                  </div>
                </div>
                <div className="activity-item">
                  <div className={`activity-dot ${kpis.riesgosAltos === 0 ? 'bg-success' : 'bg-warning'}`}></div>
                  <div className="activity-content">
                    <strong>Riesgos nivel alto o crítico: {kpis.riesgosAltos}</strong>
                    <span>{kpis.riesgosSinPlan > 0 ? `${kpis.riesgosSinPlan} sin plan de tratamiento asignado` : 'Todos los riesgos con plan asignado'}</span>
                  </div>
                </div>
                <div className="activity-item">
                  <div className={`activity-dot ${kpis.docsEnRevision === 0 ? 'bg-success' : 'dot-blue'}`}></div>
                  <div className="activity-content">
                    <strong>Documentos en revisión: {kpis.docsEnRevision}</strong>
                    <span>{kpis.docsEnRevision > 0 ? 'Pendientes de aprobación por responsable' : 'Sin documentos pendientes de aprobación'}</span>
                  </div>
                </div>
                <div className="activity-item">
                  <div className={`activity-dot ${eficacia >= 85 ? 'bg-success' : eficacia >= 70 ? 'bg-warning' : 'bg-danger'}`}></div>
                  <div className="activity-content">
                    <strong>Eficacia de indicadores: {eficacia}%</strong>
                    <span>{kpis.indicadoresCumpliendo} de {kpis.indicadoresTotal} indicadores cumpliendo la meta</span>
                  </div>
                </div>
                <div className="activity-item">
                  <div className={`activity-dot ${kpis.auditoriasEnEjecucion > 0 ? 'dot-purple' : 'bg-success'}`}></div>
                  <div className="activity-content">
                    <strong>Auditorías en ejecución: {kpis.auditoriasEnEjecucion}</strong>
                    <span>{kpis.auditoriasEnEjecucion > 0 ? 'Auditorías activas en este momento' : 'Sin auditorías en curso actualmente'}</span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '1rem', opacity: 0.5 }}>
                No se pudieron cargar los datos. Verifica la conexión al servidor.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
