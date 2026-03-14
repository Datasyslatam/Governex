import React, { useState } from "react";
import "./NcAcPage.css";

type Tab = "no_conformidades" | "acciones_correctivas";

const ncData = [
  { codigo: "NC-26-001", fecha: "11/03/2026", origen: "Auditoría Interna", proceso: "Ventas", descripcion: "No se encontró registro de revisión de contrato", estado: "Abierta", gravedad: "Menor" },
  { codigo: "NC-26-002", fecha: "05/03/2026", origen: "Cliente (Queja)", proceso: "Producción", descripcion: "Producto rayado en lote 4500", estado: "En Análisis", gravedad: "Mayor" },
  { codigo: "NC-26-003", fecha: "20/02/2026", origen: "Proceso Interno", proceso: "Talento Humano", descripcion: "Personal sin inducción registrada", estado: "Verificación", gravedad: "Mayor" },
  { codigo: "NC-26-004", fecha: "15/01/2026", origen: "Proveedor", proceso: "Compras", descripcion: "Materia prima fuera de especificación", estado: "Cerrada", gravedad: "Crítica" },
];

const acData = [
  { codigo: "AC-26-001", nc_ref: "NC-26-003", analisis: "5 Por Qué's", accion: "Actualizar programa de inducción con firma digital obligatoria", responsable: "L. Gómez", fecha_fin: "30/03/2026", estado: "En Implementación", eficacia: "-" },
  { codigo: "AC-26-002", nc_ref: "NC-26-004", analisis: "Ishikawa", accion: "Cambiar proveedor por opción alternativa homologada", responsable: "M. Vargas", fecha_fin: "28/02/2026", estado: "Verificación", eficacia: "Pendiente 30 días" },
  { codigo: "AC-25-015", nc_ref: "NC-25-021", analisis: "Pareto", accion: "Calibrar máquina inyectora 3", responsable: "Carlos H.", fecha_fin: "15/12/2025", estado: "Cerrada", eficacia: "Eficaz" },
];

const NcAcPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("no_conformidades");

  return (
    <div className="page ncac-page">
      <header className="page__header ncac-page__header">
        <div className="ncac-page__header-left">
          <nav className="ncac-page__breadcrumb">
            <span>Governex</span>
            <span className="ncac-page__bc-sep">›</span>
            <span>Cap. 10.2</span>
            <span className="ncac-page__bc-sep">›</span>
            <span className="ncac-page__bc-active">Mejora Continua</span>
          </nav>
          <h2>No Conformidades y Acciones Correctivas (NC/AC)</h2>
          <p className="ncac-page__subtitle">Registro, análisis de causas (Ishikawa/5W) y planes de acción</p>
        </div>
        <div className="ncac-page__actions">
          {activeTab === "acciones_correctivas" && (
            <button className="btn btn--primary">
              + Nueva Acción Correctiva
            </button>
          )}
        </div>
      </header>

      {/* ── KPIs NC/AC ── */}
      <div className="ncac-kpis">
        <div className="kpi-card-mini">
          <span className="kpi-mini-title">NC Abiertas</span>
          <span className="kpi-mini-value danger">2</span>
        </div>
        <div className="kpi-card-mini">
          <span className="kpi-mini-title">AC Vencidas</span>
          <span className="kpi-mini-value warning">0</span>
        </div>
        <div className="kpi-card-mini">
          <span className="kpi-mini-title">Eficacia AC (YTD)</span>
          <span className="kpi-mini-value success">85%</span>
        </div>
        <div className="kpi-card-mini">
          <span className="kpi-mini-title">Promedio de Cierre</span>
          <span className="kpi-mini-value primary">14 días</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <nav className="ncac-tabs">
        <button
          className={`ncac-tabs__tab ${activeTab === "no_conformidades" ? "ncac-tabs__tab--active" : ""}`}
          onClick={() => setActiveTab("no_conformidades")}
        >
          🚨 No Conformidades (4)
        </button>
        <button
          className={`ncac-tabs__tab ${activeTab === "acciones_correctivas" ? "ncac-tabs__tab--active" : ""}`}
          onClick={() => setActiveTab("acciones_correctivas")}
        >
          🛠️ Acciones Correctivas (3)
        </button>
      </nav>

      <main className="ncac-main panel">
        {/* ── No Conformidades View ── */}
        {activeTab === "no_conformidades" && (
          <div className="ncac-table-wrap">
            <div className="ncac-toolbar">
              <input type="text" className="input ncac-search" placeholder="Buscar NC..." />
              <select className="input ncac-filter">
                <option value="">Todos los Estados</option>
                <option value="Abierta">Abierta</option>
                <option value="En Análisis">En Análisis</option>
                <option value="Verificación">Verificación</option>
                <option value="Cerrada">Cerrada</option>
              </select>
            </div>
            <table className="table ncac-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Fecha</th>
                  <th>Origen</th>
                  <th>Proceso Afectado</th>
                  <th>Descripción del Problema</th>
                  <th>Gravedad</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ncData.map((nc, i) => (
                  <tr key={nc.codigo} className={i % 2 === 1 ? "table__row--alt" : ""}>
                    <td className="ncac-table__code">{nc.codigo}</td>
                    <td className="ncac-table__date">{nc.fecha}</td>
                    <td>{nc.origen}</td>
                    <td className="ncac-table__process">{nc.proceso}</td>
                    <td className="ncac-table__desc">{nc.descripcion}</td>
                    <td>
                      <span className={`ncac-severity ncac-severity--${
                        nc.gravedad === "Crítica" ? "critical" : nc.gravedad === "Mayor" ? "high" : "low"
                      }`}>
                        {nc.gravedad}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${
                        nc.estado === "Cerrada" ? "pill--success" :
                        nc.estado === "Abierta" ? "pill--danger" :
                        nc.estado === "Verificación" ? "pill--primary" : "pill--warning"
                      }`}>
                        {nc.estado}
                      </span>
                    </td>
                    <td className="ncac-table__actions">
                      <button className="ncac-action-btn" title="Ver Detalle / Disposición Inmediata">👁️</button>
                      <button className="ncac-action-btn" title="Vincular a AC">🔗</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Acciones Correctivas View ── */}
        {activeTab === "acciones_correctivas" && (
          <div className="ncac-table-wrap">
            <div className="ncac-toolbar">
              <input type="text" className="input ncac-search" placeholder="Buscar AC..." />
            </div>
            <table className="table ncac-table">
              <thead>
                <tr>
                  <th>Código AC</th>
                  <th>NC Ref.</th>
                  <th>Método Análisis</th>
                  <th>Acción a Implementar</th>
                  <th>Responsable</th>
                  <th>Plazo</th>
                  <th>Estado AC</th>
                  <th>Verificación Eficacia</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {acData.map((ac, i) => (
                  <tr key={ac.codigo} className={i % 2 === 1 ? "table__row--alt" : ""}>
                    <td className="ncac-table__code">{ac.codigo}</td>
                    <td className="ncac-table__ref">{ac.nc_ref}</td>
                    <td>
                      <span className="pill pill--muted">{ac.analisis}</span>
                    </td>
                    <td className="ncac-table__desc">{ac.accion}</td>
                    <td>{ac.responsable}</td>
                    <td className="ncac-table__date">{ac.fecha_fin}</td>
                    <td>
                      <span className={`pill ${
                        ac.estado === "Cerrada" ? "pill--success" :
                        ac.estado === "Verificación" ? "pill--primary" : "pill--warning"
                      }`}>
                        {ac.estado}
                      </span>
                    </td>
                    <td>
                      <span className={`ncac-efficacy ${
                        ac.eficacia === "Eficaz" ? "ncac-efficacy--good" :
                        ac.eficacia === "-" ? "" : "ncac-efficacy--pending"
                      }`}>
                        {ac.eficacia}
                      </span>
                    </td>
                    <td className="ncac-table__actions">
                      <button className="ncac-action-btn" title="Análisis de Causa Raíz">🧠</button>
                      <button className="ncac-action-btn" title="Ver / Cerrar">👁️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default NcAcPage;
