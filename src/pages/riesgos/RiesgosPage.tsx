import React from "react";
import RiskHeatmap from "./components/RiskHeatmap";
import RiskSummaryBars from "./components/RiskSummaryBars";
import RiskTable from "./components/RiskTable";
import "./RiesgosPage.css";

const RiesgosPage: React.FC = () => {
  return (
    <div className="page riesgos-page">
      <header className="page__header">
        <h2>Matriz de Riesgos y Oportunidades</h2>
        <span>Governex · Cap. 6.1 · Pensamiento basado en riesgos</span>
      </header>

      <section className="riesgos-page__top">
        <div className="riesgos-page__panel">
          <div className="riesgos-page__panel-header">
            <h3>Mapa de Calor de Riesgos</h3>
            <span>Posición actual de riesgos identificados</span>
          </div>
          <RiskHeatmap />
        </div>

        <div className="riesgos-page__panel">
          <div className="riesgos-page__panel-header">
            <h3>Riesgos por Nivel de Criticidad</h3>
          </div>
          <RiskSummaryBars />
        </div>
      </section>

      <section className="riesgos-page__bottom">
        <div className="riesgos-page__panel">
          <div className="riesgos-page__panel-header">
            <h3>Registro de Riesgos — Governex</h3>
          </div>
          <RiskTable />
        </div>
      </section>
    </div>
  );
};

export default RiesgosPage;

