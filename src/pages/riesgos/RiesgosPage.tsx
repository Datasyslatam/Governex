import React from "react";
import RiskHeatmap from "./components/RiskHeatmap";
import RiskSummaryBars from "./components/RiskSummaryBars";
import RiskTable from "./components/RiskTable";
import "./RiesgosPage.css";

const RiesgosPage: React.FC = () => {
  return (
    <div className="page riesgos-page">
      <header className="page__header riesgos-page__header">
        <div>
          <h2>Matriz de Riesgos y Oportunidades</h2>
          <span>Governex · Cap. 6.1 · Pensamiento basado en riesgos</span>
        </div>
        <button className="riesgos-page__action">+ Nuevo Riesgo</button>
      </header>

      <main className="riesgos-page__main">
        <div className="riesgos-page__panel riesgos-page__panel--left">
          <div className="riesgos-page__panel-body">
            <div className="riesgos-page__panel-header">
              <div>
                <h3>Mapa de Calor de Riesgos</h3>
                <span>Posición actual de riesgos identificados</span>
              </div>
            </div>

            <RiskHeatmap />

            <div className="riesgos-page__divider" />

            <div className="riesgos-page__panel-header riesgos-page__panel-header--compact">
              <h3>Riesgos por Nivel de Criticidad</h3>
            </div>
            <RiskSummaryBars />
          </div>
        </div>

        <div className="riesgos-page__panel riesgos-page__panel--right">
          <div className="riesgos-page__panel-header">
            <h3>Registro de Riesgos — Governex</h3>
          </div>
          <RiskTable />
        </div>
      </main>
    </div>
  );
};

export default RiesgosPage;

