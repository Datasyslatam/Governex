import React, { useState } from "react";
import "./CompetenciasPage.css";

const personalData = [
  { nombre: "Laura Gómez", cargo: "Jefe de Calidad", proceso: "SGC", brecha: "0%", ult_eval: "15/01/2026", estado: "Competente" },
  { nombre: "Carlos Herrera", cargo: "Operario Inyección", proceso: "Producción", brecha: "15%", ult_eval: "10/02/2026", estado: "En Formación" },
  { nombre: "Sofía Martínez", cargo: "Asesor Comercial", proceso: "Ventas", brecha: "5%", ult_eval: "22/12/2025", estado: "Competente" },
  { nombre: "Mario Vargas", cargo: "Auxiliar Compras", proceso: "Compras", brecha: "30%", ult_eval: "05/03/2026", estado: "Brecha Crítica" },
];

const planFormacion = [
  { tema: "Auditor Interno del SGC", asistentes: "Laura Gómez, Sofía Martínez", fecha: "20/04/2026", estado: "Planificado" },
  { tema: "Manejo Seguro de Montacargas", asistentes: "Carlos Herrera", fecha: "05/03/2026", estado: "Completado" },
  { tema: "Negociación Estratégica", asistentes: "Mario Vargas", fecha: "15/05/2026", estado: "Planificado" },
];

const CompetenciasPage: React.FC = () => {
  return (
    <div className="page comp-page">
      <header className="page__header comp-page__header">
        <div className="comp-page__header-left">
          <nav className="comp-page__breadcrumb">
            <span>Governex</span>
            <span className="comp-page__bc-sep">›</span>
            <span>Cap. 7.2</span>
            <span className="comp-page__bc-sep">›</span>
            <span className="comp-page__bc-active">Competencia</span>
          </nav>
          <h2>Gestión de Competencias y Formación</h2>
          <p className="comp-page__subtitle">Perfiles de cargo, evaluación de brechas y planes de capacitación</p>
        </div>
        <div className="comp-page__actions">
          <button className="btn btn--primary">+ Nueva Evaluación</button>
        </div>
      </header>

      <div className="comp-layout">
        <div className="comp-main-col panel">
          <div className="comp-toolbar">
            <h3 className="comp-section-title">Matriz de Competencias del Personal</h3>
            <div className="comp-filters">
              <select className="input comp-filter">
                <option value="">Todos los Procesos</option>
                <option value="SGC">SGC</option>
                <option value="Produccion">Producción</option>
                <option value="Ventas">Ventas</option>
              </select>
            </div>
          </div>

          <table className="table comp-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cargo</th>
                <th>Proceso</th>
                <th>Última Evaluación</th>
                <th>Brecha Identificada</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {personalData.map((prs, i) => (
                <tr key={prs.nombre} className={i % 2 === 1 ? "table__row--alt" : ""}>
                  <td className="comp-table__name">{prs.nombre}</td>
                  <td className="comp-table__cargo">{prs.cargo}</td>
                  <td className="comp-table__process">{prs.proceso}</td>
                  <td className="comp-table__date">{prs.ult_eval}</td>
                  <td>
                    <span className={`comp-brecha ${
                      parseInt(prs.brecha) === 0 ? "brecha-0" :
                      parseInt(prs.brecha) <= 15 ? "brecha-low" : "brecha-high"
                    }`}>
                      {prs.brecha}
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${
                      prs.estado === "Competente" ? "pill--success" :
                      prs.estado === "En Formación" ? "pill--warning" : "pill--danger"
                    }`}>
                      {prs.estado}
                    </span>
                  </td>
                  <td className="comp-table__actions">
                    <button className="comp-action-btn" title="Ver Perfil de Cargo">👤</button>
                    <button className="comp-action-btn" title="Resultados Evaluación">📊</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="comp-side-col panel">
          <div className="comp-side-header">
            <h3>Plan Anual de Formación 2026</h3>
            <button className="btn btn--muted" style={{padding: '0.3rem 0.5rem', fontSize: '0.75rem'}}>+ Tarea</button>
          </div>
          
          <div className="comp-plan-list">
            {planFormacion.map((plan, i) => (
              <div key={i} className={`comp-plan-card ${plan.estado === 'Completado' ? 'comp-plan-done' : ''}`}>
                <div className="comp-plan-card-header">
                  <strong>{plan.tema}</strong>
                </div>
                <div className="comp-plan-target">DIRIGIDO A:<br/>{plan.asistentes}</div>
                <div className="comp-plan-footer">
                  <span className="comp-plan-date">📅 {plan.fecha}</span>
                  <span className={`pill ${plan.estado === 'Completado' ? 'pill--success' : 'pill--muted'}`}>{plan.estado}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetenciasPage;
