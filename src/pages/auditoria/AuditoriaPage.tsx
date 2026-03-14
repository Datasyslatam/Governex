import React, { useState } from "react";
import "./AuditoriaPage.css";

type Tab = "programa" | "auditorias" | "hallazgos";

const programasData = [
  { año: 2026, objetivo: "Verificar eficacia del SGC y transición a nuevos procesos digitales", duracion: "120 h (3 auditores)", estado: "En Ejecución", avance: 33 },
  { año: 2025, objetivo: "Auditoría integral pre-certificación", duracion: "160 h (4 auditores)", estado: "Cerrado", avance: 100 },
];

const auditoriasData = [
  { codigo: "AI-26-01", proceso: "Ventas y Gestión Comercial", fecha: "10/03/2026", auditor: "S. Martínez", estado: "Cerrada", hallazgos: 2 },
  { codigo: "AI-26-02", proceso: "Producción / Prestación", fecha: "15/03/2026", auditor: "L. Gómez", estado: "En Ejecución", hallazgos: 0 },
  { codigo: "AI-26-03", proceso: "Compras y Proveedores", fecha: "22/03/2026", auditor: "M. Vargas", estado: "Planificada", hallazgos: 0 },
  { codigo: "AI-26-04", proceso: "Talento Humano", fecha: "05/04/2026", auditor: "S. Martínez", estado: "Planificada", hallazgos: 0 },
];

const hallazgosData = [
  { codigo: "HL-26-001", auditoria: "AI-26-01", tipo: "No Conformidad Menor", descripcion: "No se encontró registro de revisión de contrato en pedido #1245", clausula: "8.2.3", estado: "Abierto" },
  { codigo: "HL-26-002", auditoria: "AI-26-01", tipo: "Observación", descripcion: "Formato de cotización desactualizado en 1 caso", clausula: "7.5", estado: "Cerrado" },
  { codigo: "HL-25-014", auditoria: "AI-25-03", tipo: "Oportunidad de Mejora", descripcion: "Centralizar almacenamiento de actas de reunión", clausula: "10.3", estado: "Cerrado" },
];

const AuditoriaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("programa");

  return (
    <div className="page audit-page">
      <header className="page__header audit-page__header">
        <div className="audit-page__header-left">
          <nav className="audit-page__breadcrumb">
            <span>Governex</span>
            <span className="audit-page__bc-sep">›</span>
            <span>Cap. 9.2</span>
            <span className="audit-page__bc-sep">›</span>
            <span className="audit-page__bc-active">Auditoría Interna</span>
          </nav>
          <h2>Gestión de Auditorías Internas</h2>
          <p className="audit-page__subtitle">Programa anual, planes de auditoría y gestión de hallazgos</p>
        </div>
        <div className="audit-page__actions">
          <button className="btn btn--primary">+ Nuevo Programa Anual</button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <nav className="audit-tabs">
        <button
          className={`audit-tabs__tab ${activeTab === "programa" ? "audit-tabs__tab--active" : ""}`}
          onClick={() => setActiveTab("programa")}
        >
          📅 Programas (2)
        </button>
        <button
          className={`audit-tabs__tab ${activeTab === "auditorias" ? "audit-tabs__tab--active" : ""}`}
          onClick={() => setActiveTab("auditorias")}
        >
          📋 Auditorías (4)
        </button>
        <button
          className={`audit-tabs__tab ${activeTab === "hallazgos" ? "audit-tabs__tab--active" : ""}`}
          onClick={() => setActiveTab("hallazgos")}
        >
          🔍 Hallazgos (3)
        </button>
      </nav>

      <main className="audit-main panel">
        {activeTab === "programa" && (
          <div className="audit-table-wrap">
            <div className="audit-section-header">
              <h3>Programas Anuales de Auditoría</h3>
              <span className="pill pill--muted">Requisito 9.2.2</span>
            </div>
            <table className="table audit-table">
              <thead>
                <tr>
                  <th>Año</th>
                  <th>Objetivo General</th>
                  <th>Estimación Tiempo/Recursos</th>
                  <th>Avance</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {programasData.map((prog, i) => (
                  <tr key={prog.año} className={i % 2 === 1 ? "table__row--alt" : ""}>
                    <td className="audit-table__code">{prog.año}</td>
                    <td className="audit-table__title">{prog.objetivo}</td>
                    <td className="audit-table__duration">{prog.duracion}</td>
                    <td>
                      <div className="audit-progress">
                        <div className="audit-progress__bar">
                          <div className={`audit-progress__fill ${prog.avance === 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${prog.avance}%` }}></div>
                        </div>
                        <span className="audit-progress__text">{prog.avance}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`pill ${prog.estado === "Cerrado" ? "pill--success" : "pill--warning"}`}>
                        {prog.estado}
                      </span>
                    </td>
                    <td className="audit-table__actions">
                      <button className="audit-action-btn" title="Ver programa">👁️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "auditorias" && (
          <div className="audit-table-wrap">
            <div className="audit-section-header">
              <h3>Planificación y Ejecución de Auditorías</h3>
              <button className="btn btn--primary audit-btn-small">+ Nueva Auditoría</button>
            </div>
            <table className="table audit-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Proceso Auditado</th>
                  <th>Fecha</th>
                  <th>Auditor Líder</th>
                  <th>Hallazgos</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {auditoriasData.map((aud, i) => (
                  <tr key={aud.codigo} className={i % 2 === 1 ? "table__row--alt" : ""}>
                    <td className="audit-table__code">{aud.codigo}</td>
                    <td className="audit-table__process">{aud.proceso}</td>
                    <td className="audit-table__date">{aud.fecha}</td>
                    <td>{aud.auditor}</td>
                    <td>
                      <span className={`pill ${aud.hallazgos > 0 ? "pill--danger" : "pill--muted"}`}>
                        {aud.hallazgos} hallazgos
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${
                        aud.estado === "Cerrada" ? "pill--success" : aud.estado === "En Ejecución" ? "pill--warning" : "pill--muted"
                      }`}>
                        {aud.estado}
                      </span>
                    </td>
                    <td className="audit-table__actions">
                      <button className="audit-action-btn" title="Plan de auditoría">📋</button>
                      {aud.estado === "Cerrada" && (
                        <button className="audit-action-btn" title="Informe final">📄</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "hallazgos" && (
          <div className="audit-table-wrap">
            <div className="audit-section-header">
              <h3>Registro de Hallazgos</h3>
              <span className="pill pill--muted">Evidencia objetiva extraída de informes</span>
            </div>
            <table className="table audit-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Auditoría</th>
                  <th>Naturaleza</th>
                  <th>Descripción</th>
                  <th>Cláusula</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {hallazgosData.map((hal, i) => (
                  <tr key={hal.codigo} className={i % 2 === 1 ? "table__row--alt" : ""}>
                    <td className="audit-table__code">{hal.codigo}</td>
                    <td className="audit-table__ref">{hal.auditoria}</td>
                    <td>
                      <span className={`pill ${
                        hal.tipo.includes("No Conformidad") ? "pill--danger" : hal.tipo.includes("Observación") ? "pill--warning" : "pill--success"
                      }`}>
                        {hal.tipo}
                      </span>
                    </td>
                    <td className="audit-table__desc">{hal.descripcion}</td>
                    <td className="audit-table__clausula">{hal.clausula}</td>
                    <td>
                      <span className={`pill ${hal.estado === "Cerrado" ? "pill--success" : "pill--danger"}`}>
                        {hal.estado}
                      </span>
                    </td>
                    <td className="audit-table__actions">
                      <button className="audit-action-btn" title="Ver detalle">👁️</button>
                      {hal.tipo.includes("No Conformidad") && hal.estado === "Abierto" && (
                        <button className="audit-action-btn" title="Abrir Acción Correctiva">⚠️</button>
                      )}
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

export default AuditoriaPage;
