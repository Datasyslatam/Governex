import React from "react";
import NcKpiCards from "./components/NcKpiCards";
import NcTable from "./components/NcTable";
import TreatmentCycle from "./components/TreatmentCycle";
import FiveWhysPanel from "./components/FiveWhysPanel";
import ActionPlanCard from "./components/ActionPlanCard";
import "./NcAcPage.css";

const NcAcPage: React.FC = () => {
  return (
    <div className="page ncac-page">
      <header className="page__header">
        <h2>No Conformidades y Acciones Correctivas</h2>
        <span>Governex · Cap. 10.2 · Tratamiento y análisis de causas</span>
      </header>

      <NcKpiCards />

      <section className="ncac-page__body">
        <div className="ncac-page__left">
          <NcTable />
        </div>
        <div className="ncac-page__right">
          <TreatmentCycle />
          <FiveWhysPanel />
          <ActionPlanCard />
        </div>
      </section>
    </div>
  );
};

export default NcAcPage;

