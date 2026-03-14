import React from "react";
import "./DashboardPage.css";

const DashboardPage: React.FC = () => {
  return (
    <div className="page dashboard-page">
      {/* Resumen Ejecutivo Bar */}
      <div className="dash-summary-bar">
        <div className="dash-summary-bar__left">
          <h2>Resumen Ejecutivo del SGC</h2>
          <span>Periodo: Q1 2026 | Plataforma: Governex | Estado: ACTIVO</span>
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
          <span className="dash-kpi__title">Objetivos Calidad</span>
          <span className="dash-kpi__value text-success">78%</span>
          <span className="dash-kpi__trend">▲ 12% vs mes anterior</span>
        </div>
        <div className="dash-kpi-card" style={{ borderTopColor: '#dc3545' }}>
          <span className="dash-kpi__title">NC Abiertas</span>
          <span className="dash-kpi__value text-danger">7</span>
          <span className="dash-kpi__trend text-danger">3 vencidas - acción urgente</span>
        </div>
        <div className="dash-kpi-card" style={{ borderTopColor: '#ffc107' }}>
          <span className="dash-kpi__title">Riesgos Altos</span>
          <span className="dash-kpi__value text-warning">4</span>
          <span className="dash-kpi__trend text-warning">1 sin plan de tratamiento</span>
        </div>
        <div className="dash-kpi-card" style={{ borderTopColor: '#fd7e14' }}>
          <span className="dash-kpi__title">Docs. Vencidos</span>
          <span className="dash-kpi__value text-orange">2</span>
          <span className="dash-kpi__trend text-orange">Requieren revisión urgente</span>
        </div>
        <div className="dash-kpi-card" style={{ borderTopColor: '#20c997' }}>
          <span className="dash-kpi__title">Eficacia SGC</span>
          <span className="dash-kpi__value text-teal">92%</span>
          <span className="dash-kpi__trend text-teal-light">Índice global consolidado</span>
        </div>
      </div>

      <div className="dash-main-grid">
        {/* Cumplimiento por Proceso */}
        <div className="dash-panel">
          <div className="dash-panel__header">
            <h3>Cumplimiento por Proceso (%)</h3>
            <span>Meta: 85% | Governex Q1 2026</span>
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
              {/* Bars */}
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
                {/* Rejilla 3x3 dibujada desde Arriba hacia Abajo */}
                {/* Fila Alta */}
                <div className="risk-cell bg-yellow"></div>
                <div className="risk-cell bg-orange"></div>
                <div className="risk-cell bg-red"><div className="risk-dot">R2</div></div>
                {/* Fila Media */}
                <div className="risk-cell bg-light-green"><div className="risk-dot">R3</div></div>
                <div className="risk-cell bg-yellow"><div className="risk-dot">R1</div></div>
                <div className="risk-cell bg-orange"></div>
                {/* Fila Baja */}
                <div className="risk-cell bg-light-green"><div className="risk-dot">R4</div></div>
                <div className="risk-cell bg-light-green"></div>
                <div className="risk-cell bg-yellow"></div>
              </div>
              <div className="dash-risk-map__x-label">
                <div className="x-label-texts">
                  <span>Bajo</span>
                  <span>Medio</span>
                  <span>Alto</span>
                </div>
                <div className="x-label-title">IMPACTO</div>
              </div>
            </div>
          </div>
        </div>

        {/* Actividad Reciente */}
        <div className="dash-panel">
          <div className="dash-panel__header" style={{ marginBottom: "1.5rem" }}>
            <h3>Actividad Reciente</h3>
          </div>
          <div className="dash-activity-list">
            <div className="activity-item">
              <div className="activity-dot bg-success"></div>
              <div className="activity-content">
                <strong>NC-2026-014 cerrada eficazmente</strong>
                <span>Producción - hace 2h</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot dot-blue"></div>
              <div className="activity-content">
                <strong>Doc. PRO-023 enviado a aprobación</strong>
                <span>Rev. 3.0 - Governex - hace 4h</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot bg-danger"></div>
              <div className="activity-content">
                <strong>Riesgo R-07 escalado a crítico</strong>
                <span>Compras - sin tratamiento 5 días</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot bg-orange"></div>
              <div className="activity-content">
                <strong>Indicador fuera de meta G3</strong>
                <span>Sat. cliente: 78% - meta 85%</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot dot-purple"></div>
              <div className="activity-content">
                <strong>Auditoría AI-2026-04 planificada</strong>
                <span>Producción - 15 Marzo 2026</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot bg-success"></div>
              <div className="activity-content">
                <strong>Objetivo OC-05 logrado</strong>
                <span>RRHH - meta 90% competencias</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot bg-warning"></div>
              <div className="activity-content">
                <strong>Documento POL-001 por vencer</strong>
                <span>Revisión en 12 días - SGC</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
