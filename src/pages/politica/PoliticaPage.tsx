import React from "react";
import "./PoliticaPage.css";

const registrosLectura = [
  { nombre: "Laura Gómez", area: "Calidad", fecha: "21/02/2026", estado: "Leído y Aceptado" },
  { nombre: "Carlos Herrera", area: "Producción", fecha: "25/02/2026", estado: "Leído y Aceptado" },
  { nombre: "Mario Vargas", area: "Compras", fecha: "-", estado: "Pendiente" },
];

const PoliticaPage: React.FC = () => {
  return (
    <div className="page pol-page">
      <header className="page__header pol-page__header">
        <div className="pol-page__header-left">
          <nav className="pol-page__breadcrumb">
            <span>Governex</span>
            <span className="pol-page__bc-sep">›</span>
            <span>Cap. 5.2</span>
            <span className="pol-page__bc-sep">›</span>
            <span className="pol-page__bc-active">Política de Calidad</span>
          </nav>
          <h2>Política y Objetivos de Calidad</h2>
          <p className="pol-page__subtitle">Establecimiento, comunicación y despliegue de la directriz principal del SGC</p>
        </div>
        <div className="pol-page__actions">
          <button className="btn btn--primary">Editar Política</button>
        </div>
      </header>

      <div className="pol-layout">
        <div className="pol-main-col panel">
           <div className="pol-doc-header">
             <div>
               <h3 className="pol-doc-title">Política de Calidad Institucional</h3>
               <span className="pill pill--success">Versión 2.1 · Vigente</span>
             </div>
             <button className="pol-btn-download">PDF 📥</button>
           </div>
           
           <div className="pol-doc-content">
             <p>
               En <strong>Governex</strong> nos comprometemos a liderar en el sector a través del desarrollo y 
               distribución de soluciones de alta tecnología que cumplan consistentemente con los requerimientos 
               de nuestros clientes y las normas legales aplicables.
             </p>
             <p>
               Nuestra dirección estratégica se fundamenta en los siguientes pilares:
             </p>
             <ul>
               <li><strong>Satisfacción del Cliente:</strong> Entendiendo siempre sus necesidades para superar sus expectativas.</li>
               <li><strong>Excelencia Operativa:</strong> Manteniendo procesos eficientes y controlados en cada etapa productiva.</li>
               <li><strong>Talento Humano:</strong> Fomentando el desarrollo de competencias y la toma de conciencia en materia de Calidad.</li>
               <li><strong>Mejora Continua:</strong> Evaluando y elevando continuamente la eficacia de nuestro Sistema de Gestión de Calidad.</li>
             </ul>
             <p>
               La Alta Dirección se hace responsable de disponer de los recursos necesarios y 
               revisar periódicamente esta política para asegurar su continua conveniencia y adecuación.
             </p>
           </div>

           <div className="pol-doc-footer">
             <div className="pol-sign">
               <span className="pol-sign-name">Eduardo Martínez H.</span>
               <span className="pol-sign-role">Director General</span>
               <span className="pol-sign-date">Fecha de Aprobación: 20/02/2026</span>
             </div>
             <div className="pol-hash">
               Fingerprint: <code>a5b8c9d...f0e1d2</code>
             </div>
           </div>
        </div>

        <div className="pol-side-col">
          <div className="panel pol-side-panel">
            <h3>Comunicación y Toma de Conciencia (7.3)</h3>
            <div className="pol-progress-wrap mt-3 mb-4">
              <div className="pol-progress-labels">
                <span>Personal que ha aceptado</span>
                <strong>66%</strong>
              </div>
              <div className="pol-progress-bar">
                <div className="pol-progress-fill bg-primary" style={{width: '66%'}}></div>
              </div>
            </div>

            <h4 className="pol-sub-hdr">Registros de Aceptación Recientes</h4>
            <div className="pol-lecturas">
              {registrosLectura.map((reg, i) => (
                <div key={i} className="pol-lec-item">
                  <div className="pol-lec-top">
                    <strong>{reg.nombre}</strong>
                    <span className="pol-lec-area">{reg.area}</span>
                  </div>
                  <div className="pol-lec-bot">
                    <span className={`pill ${reg.estado === 'Pendiente' ? 'pill--warning' : 'pill--success'}`}>
                      {reg.estado}
                    </span>
                    <span className="pol-lec-date">{reg.fecha}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="btn btn--muted w-100 mt-3">Enviar Recordatorio</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoliticaPage;
