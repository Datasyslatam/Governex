import React from "react";
import KpiCard from "../../components/charts/KpiCard";
import BarChart from "../../components/charts/BarChart";
import Heatmap from "../../components/charts/Heatmap";
import "./DashboardPage.css";

const DashboardPage: React.FC = () => {
  return (
    <div className="page dashboard-page">
      <header className="page__header">
        <h2>Resumen Ejecutivo del SGC</h2>
        <span>Periodo: Q1 2026 · Plataforma: Governex · Estado: ACTIVO</span>
      </header>

      <section className="dashboard-page__kpis">
        <KpiCard
          label="Objetivos Calidad"
          value="78%"
          trend="▲ 12% vs mes anterior"
          variant="success"
        />
        <KpiCard
          label="NC Abiertas"
          value="7"
          trend="3 vencidas · acción urgente"
          variant="danger"
        />
        <KpiCard
          label="Riesgos Altos"
          value="4"
          trend="1 sin plan de tratamiento"
          variant="warning"
        />
        <KpiCard
          label="Docs. Vencidos"
          value="2"
          trend="Requieren revisión urgente"
          variant="warning"
        />
        <KpiCard
          label="Eficacia SGC"
          value="92%"
          trend="Índice global consolidado"
          variant="success"
        />
      </section>

      <section className="dashboard-page__bottom">
        <div className="dashboard-page__panel">
          <h3>Cumplimiento por Proceso (%)</h3>
          <span>Meta: 85% · Governex Q1 2026</span>
          <BarChart
            categories={["Estrategia", "Comercial", "Producción", "RRHH", "Compras", "TI"]}
            values={[95, 72, 88, 65, 91, 78]}
          />
        </div>

        <div className="dashboard-page__panel">
          <h3>Mapa de Riesgos</h3>
          <span>Probabilidad x Impacto</span>
          <Heatmap />
        </div>

        <div className="dashboard-page__panel dashboard-page__activity">
          <h3>Actividad Reciente</h3>
          <ul>
            <li>NC-2026-014 cerrada eficazmente · Producción · hace 2h</li>
            <li>PRO-023 enviado a aprobación · Governex · hace 4h</li>
            <li>R-07 escalado a crítico · Compras · sin tratamiento 5 días</li>
            <li>Indicador Sat. Cliente fuera de meta · meta 85%</li>
          </ul>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
