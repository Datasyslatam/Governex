import React from "react";
import RiskHeatmap from "./components/RiskHeatmap";
import RiskSummaryBars from "./components/RiskSummaryBars";
import RiskTable from "./components/RiskTable";
import "./RiesgosPage.css";

const RiesgosPage: React.FC = () => {
  return (
    <div className="page riesgos-page">
      {/* ── Header ── */}
      <header className="page__header riesgos-page__header">
        <div className="riesgos-page__header-left">
          <nav className="riesgos-page__breadcrumb">
            <span>Governex</span>
            <span className="riesgos-page__bc-sep">›</span>
            <span>Cap. 6.1</span>
            <span className="riesgos-page__bc-sep">›</span>
            <span className="riesgos-page__breadcrumb-active">Pensamiento basado en riesgos</span>
          </nav>
          <h2>Matriz de Riesgos y Oportunidades</h2>
        </div>
        <button className="riesgos-page__action">+ Nuevo Riesgo</button>
      </header>

      {/* ── Main two-panel layout ── */}
      <main className="riesgos-page__main">
        {/* Left panel: heatmap + bar chart */}
        <div className="riesgos-page__panel riesgos-page__panel--left">
          {/* Heatmap section */}
          <div className="riesgos-page__section-header">
            <div>
              <h3 className="riesgos-page__section-title">Mapa de Calor de Riesgos</h3>
              <span className="riesgos-page__section-subtitle">
                Governex · Posición actual de riesgos identificados
              </span>
            </div>
          </div>

          <div className="riesgos-page__heatmap-wrap">
            <RiskHeatmap />
          </div>

          <div className="riesgos-page__divider" />

          {/* Bar chart section */}
          <h3 className="riesgos-page__section-title">Riesgos por Nivel de Criticidad</h3>
          <RiskSummaryBars />
        </div>

        {/* Right panel: risk register table */}
        <div className="riesgos-page__panel riesgos-page__panel--right">
          <div className="riesgos-page__section-header">
            <h3 className="riesgos-page__section-title">Registro de Riesgos — Governex</h3>
          </div>
          <div className="riesgos-page__table-wrap">
            <RiskTable />
          </div>
        </div>
      </main>
    </div>
  );
};

export default RiesgosPage;
