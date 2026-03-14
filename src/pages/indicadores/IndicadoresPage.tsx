import React, { useState } from "react";
import "./IndicadoresPage.css";

const kpiData = [
  { codigo: "IND-VC-01", titulo: "Cumplimiento Presupuesto Ventas", proceso: "Ventas", frecuencia: "Mensual", meta: "> 95%", ultr: "92%", tendencia: "down", estado: "Riesgo" },
  { codigo: "IND-PR-02", titulo: "Nivel de Desperdicio en Línea", proceso: "Producción", frecuencia: "Semanal", meta: "< 2%", ultr: "1.8%", tendencia: "up", estado: "Cumple" },
  { codigo: "IND-CO-01", titulo: "Entregas a Tiempo de Proveedores", proceso: "Compras", frecuencia: "Mensual", meta: "> 90%", ultr: "88%", tendencia: "down", estado: "No Cumple" },
  { codigo: "IND-TH-03", titulo: "Eficacia de Formación", proceso: "Talento Humano", frecuencia: "Semestral", meta: "> 80%", ultr: "85%", tendencia: "up", estado: "Cumple" },
  { codigo: "IND-CA-01", titulo: "Eficacia Acciones Correctivas", proceso: "Calidad", frecuencia: "Trimestral", meta: "> 90%", ultr: "95%", tendencia: "up", estado: "Cumple" },
];

const IndicadoresPage: React.FC = () => {
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
        <div className="ind-page__actions">
          <button className="btn btn--primary">+ Crear Indicador (Ficha Técnica)</button>
        </div>
      </header>

      <div className="ind-top-cards">
        <div className="ind-summary-card">
          <div className="ind-sum-title">Indicadores Activos</div>
          <div className="ind-sum-val">12</div>
        </div>
        <div className="ind-summary-card success-card">
          <div className="ind-sum-title">Cumpliendo Meta</div>
          <div className="ind-sum-val">8</div>
        </div>
        <div className="ind-summary-card warning-card">
          <div className="ind-sum-title">En Riesgo / Zona Amarilla</div>
          <div className="ind-sum-val">3</div>
        </div>
        <div className="ind-summary-card danger-card">
          <div className="ind-sum-title">No Cumple</div>
          <div className="ind-sum-val">1</div>
        </div>
      </div>

      <main className="ind-main panel">
        <div className="ind-toolbar">
          <div className="ind-search">
            <input type="text" className="input ind-search__input" placeholder="Buscar indicador..." />
          </div>
          <div className="ind-filters">
            <select className="input ind-filter">
              <option value="">Todos los Procesos</option>
              <option value="Ventas">Ventas</option>
              <option value="Produccion">Producción</option>
              <option value="Compras">Compras</option>
              <option value="TalentoH">Talento Humano</option>
            </select>
          </div>
        </div>

        <div className="ind-table-wrap">
          <table className="table ind-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre del Indicador</th>
                <th>Proceso Responsable</th>
                <th>Frecuencia</th>
                <th>Meta Aprobada</th>
                <th>Última Medición</th>
                <th>Cumplimiento</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {kpiData.map((kpi, i) => (
                <tr key={kpi.codigo} className={i % 2 === 1 ? "table__row--alt" : ""}>
                  <td className="ind-table__code">{kpi.codigo}</td>
                  <td className="ind-table__title">{kpi.titulo}</td>
                  <td className="ind-table__process">{kpi.proceso}</td>
                  <td className="ind-table__freq">{kpi.frecuencia}</td>
                  <td className="ind-table__meta">{kpi.meta}</td>
                  <td>
                    <div className="ind-table__ultr">
                      <span>{kpi.ultr}</span>
                      <span className={`ind-trend ${kpi.tendencia === 'up' ? 'ind-trend--up' : 'ind-trend--down'}`}>
                        {kpi.tendencia === 'up' ? '↗' : '↘'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${
                      kpi.estado === "Cumple" ? "pill--success" :
                      kpi.estado === "En Riesgo" ? "pill--warning" :
                      kpi.estado === "Riesgo" ? "pill--warning" :
                      "pill--danger"
                    }`}>
                      {kpi.estado}
                    </span>
                  </td>
                  <td className="ind-table__actions">
                    <button className="ind-action-btn btn-record" title="Registrar Medición Mensual">📝 Medir</button>
                    <button className="ind-action-btn" title="Ver Gráfica y Tendencias">📊</button>
                    <button className="ind-action-btn" title="Ficha Técnica">📋</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default IndicadoresPage;
