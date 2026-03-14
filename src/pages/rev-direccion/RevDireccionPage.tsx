import React from "react";
import "./RevDireccionPage.css";

const actasData = [
  { codigo: "RD-2026-01", fecha: "28/02/2026", tipo: "Ordinaria", estado: "Aprobada", avance: 100 },
  { codigo: "RD-2025-02", fecha: "15/12/2025", tipo: "Extraordinaria", estado: "Deuda Acciones", avance: 80 },
];

const entradasRequeridas = [
  { req: "9.3.2 a)", desc: "Estado de las acciones de revisiones previas", check: true },
  { req: "9.3.2 b)", desc: "Cambios en el contexto externo e interno (PESTEL/DOFA)", check: true },
  { req: "9.3.2 c.1)", desc: "Satisfacción del cliente y retroalimentación de partes interesadas", check: true },
  { req: "9.3.2 c.2)", desc: "Grado de cumplimiento de los objetivos de la calidad", check: true },
  { req: "9.3.2 c.3)", desc: "Desempeño de los procesos y conformidad del producto", check: true },
  { req: "9.3.2 c.4)", desc: "No conformidades y acciones correctivas", check: true },
  { req: "9.3.2 c.5)", desc: "Resultados de seguimiento y medición", check: false },
  { req: "9.3.2 c.6)", desc: "Resultados de las auditorías", check: false },
  { req: "9.3.2 c.7)", desc: "Desempeño de los proveedores externos", check: false },
  { req: "9.3.2 d)", desc: "Adecuación de los recursos", check: false },
  { req: "9.3.2 e)", desc: "Eficacia de las acciones tomadas para abordar riesgos y oportunidades", check: false },
  { req: "9.3.2 f)", desc: "Oportunidades de mejora", check: false },
];

const RevDireccionPage: React.FC = () => {
  return (
    <div className="page rev-page">
      <header className="page__header rev-page__header">
        <div className="rev-page__header-left">
          <nav className="rev-page__breadcrumb">
            <span>Governex</span>
            <span className="rev-page__bc-sep">›</span>
            <span>Cap. 9.3</span>
            <span className="rev-page__bc-sep">›</span>
            <span className="rev-page__bc-active">Revisión por la Dirección</span>
          </nav>
          <h2>Revisión por la Dirección</h2>
          <p className="rev-page__subtitle">Evaluación estratégica del desempeño y eficacia del SGC por la Alta Dirección</p>
        </div>
        <div className="rev-page__actions">
          <button className="btn btn--primary">+ Planificar Nueva Revisión</button>
        </div>
      </header>

      <div className="rev-layout">
        <div className="rev-main-col panel">
          <div className="rev-section-header">
            <h3>Preparación de Acta: RD-2026-02 (Planificada)</h3>
            <span className="pill pill--warning">Borrador / Preparando Entradas</span>
          </div>
          
          <p className="rev-desc">
            Para el desempeño eficaz del SGC, la revisión por la dirección requiere que se analicen obligatoriamente las siguientes entradas documentadas.
          </p>

          <div className="rev-inputs-grid">
            {entradasRequeridas.map((entrada, idx) => (
              <div key={idx} className={`rev-input-card ${entrada.check ? 'rev-input-card--done' : ''}`}>
                <div className="rev-input-top">
                  <span className="rev-input-req">{entrada.req}</span>
                  {entrada.check ? (
                    <span className="rev-check icon-success">✅ Completado</span>
                  ) : (
                    <span className="rev-check icon-pending">⚠️ Pendiente</span>
                  )}
                </div>
                <p className="rev-input-desc">{entrada.desc}</p>
                {entrada.check ? (
                  <button className="rev-btn-small btn-view">Ver Informe Adjunto</button>
                ) : (
                  <button className="rev-btn-small btn-action">+ Adjuntar Evidencia</button>
                )}
              </div>
            ))}
          </div>
          
          <div className="rev-footer-action">
            <p className="rev-lock-msg">
              <span className="lock-icon">🔒</span> No se puede cerrar y firmar el acta de revisión hasta que el 100% de las entradas obligatorias estén documentadas.
            </p>
            <button className="btn btn--muted" disabled>Bloqueado: Faltan Entradas</button>
          </div>
        </div>

        <div className="rev-side-col">
          <div className="panel rev-hist-panel">
            <h3>Historial de Revisiones</h3>
            <div className="rev-hist-list">
              {actasData.map((acta, i) => (
                <div key={i} className="rev-hist-item">
                  <div className="rev-hist-item-header">
                    <strong>{acta.codigo}</strong>
                    <span className="rev-hist-date">{acta.fecha}</span>
                  </div>
                  <div className="rev-hist-item-body">
                    <span className="rev-hist-type">{acta.tipo}</span>
                    <span className={`pill ${acta.estado === "Aprobada" ? "pill--success" : "pill--danger"}`}>
                      {acta.estado}
                    </span>
                  </div>
                  <button className="rev-hist-btn">Descargar Acta PDF</button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel rev-hist-panel">
            <h3>Salidas de Revisión (Compromisos)</h3>
            <ul className="rev-commit-list">
              <li>
                <div className="rev-commit-header">
                  <span className="pill pill--warning">Desempeño</span>
                  <span className="rev-commit-date">RD-2025-02</span>
                </div>
                <p>Presupuestar nuevo software ERP para 2026. <strong>(Pendiente)</strong></p>
              </li>
              <li>
                <div className="rev-commit-header">
                  <span className="pill pill--success">Recursos</span>
                  <span className="rev-commit-date">RD-2025-02</span>
                </div>
                <p>Contratación de 2 operarios extra. <strong>(Cumplido)</strong></p>
              </li>
            </ul>
          </div>

          <div className="panel rev-hist-panel">
            <h3>Objetivos de Calidad (Progreso)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.5rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#4a5e78', marginBottom: '0.3rem' }}>
                  <span>Crecimiento de Ventas (Meta: 15%)</span>
                  <strong>12%</strong>
                </div>
                <div style={{ height: '6px', background: '#eef3fb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '80%', background: '#1a6ebd' }}></div>
                </div>
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#4a5e78', marginBottom: '0.3rem' }}>
                  <span>Satisfacción del Cliente (Meta: &gt;90%)</span>
                  <strong>94%</strong>
                </div>
                <div style={{ height: '6px', background: '#eef3fb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '100%', background: '#1a9c5b' }}></div>
                </div>
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#4a5e78', marginBottom: '0.3rem' }}>
                  <span>Desperdicio de Material (Meta: &lt;2%)</span>
                  <strong>1.8%</strong>
                </div>
                <div style={{ height: '6px', background: '#eef3fb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '100%', background: '#1a9c5b' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevDireccionPage;
