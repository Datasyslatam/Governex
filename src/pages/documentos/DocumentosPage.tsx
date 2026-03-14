import React, { useState } from "react";
import "./DocumentosPage.css";

const documentosData = [
  { codigo: "MAN-001", titulo: "Manual del SGC", tipo: "Manual", version: "v4.0", estado: "Aprobado", proceso: "Calidad" },
  { codigo: "POL-001", titulo: "Política de Calidad", tipo: "Política", version: "v3.1", estado: "Aprobado", proceso: "Calidad" },
  { codigo: "PRO-010", titulo: "Control de Documentos", tipo: "Proceso", version: "v5.2", estado: "Aprobado", proceso: "Calidad" },
  { codigo: "PRO-023", titulo: "Gestion de Proveedores", tipo: "Proceso", version: "v3.0", estado: "En Revision", proceso: "Compras", isActive: true },
  { codigo: "PRO-031", titulo: "Auditoria Interna", tipo: "Proceso", version: "v2.1", estado: "Aprobado", proceso: "Calidad" },
  { codigo: "INS-007", titulo: "Calibracion de Equipos", tipo: "Instr.", version: "v1.3", estado: "Aprobado", proceso: "Produccion" },
  { codigo: "FOR-015", titulo: "Registro NC", tipo: "Formato", version: "v2.0", estado: "Aprobado", proceso: "Calidad" },
  { codigo: "PRO-044", titulo: "Diseno y Desarrollo", tipo: "Proceso", version: "v1.0", estado: "Borrador", proceso: "Ingenieria" },
  { codigo: "FOR-022", titulo: "Evaluacion Proveedores", tipo: "Formato", version: "v1.5", estado: "Aprobado", proceso: "Compras" },
];

const DocumentosPage: React.FC = () => {
  return (
    <div className="page docs-page">
      {/* ── Topbar de la sección Documentos ── */}
      <div className="docs-topbar">
        <div className="docs-topbar__left">
          <h2>Gestion Documental — Control de Versiones</h2>
          <span>Governex — Cap. 7.5 — Informacion Documentada</span>
        </div>
        <div className="docs-topbar__right">
          <span>Gerente General | Alta Direccion | Notif.</span>
        </div>
      </div>

      {/* ── Tabs y Búsqueda ── */}
      <div className="docs-filter-bar">
        <div className="docs-search-wrapper">
          <input 
            type="text" 
            className="docs-search-input" 
            placeholder="Buscar en Governex Docs.."
          />
        </div>
        <div className="docs-nav-tabs">
          <button className="docs-tab docs-tab--active">Todos</button>
          <button className="docs-tab">Procedimientos</button>
          <button className="docs-tab">Instructivos</button>
          <button className="docs-tab">Formatos</button>
          <button className="docs-tab">Politicas</button>
          <button className="docs-tab">Manuales</button>
        </div>
        <div className="docs-status-filters">
          <select className="docs-filter-select">
            <option value="">Todos los Estados</option>
            <option value="Aprobado">Aprobado</option>
            <option value="En Revision">En Revision</option>
            <option value="Borrador">Borrador</option>
            <option value="Obsoleto">Obsoleto</option>
          </select>
        </div>
      </div>

      {/* ── Contenido Principal ── */}
      <div className="docs-main-grid">
        {/* Tabla Izquierda */}
        <div className="docs-table-container panel">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Titulo del Documento</th>
                <th>Tipo</th>
                <th>Proceso</th>
                <th>Version</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {documentosData.map((doc, i) => (
                <tr key={i} className={doc.isActive ? "row-active" : ""}>
                  <td className="doc-code text-blue">{doc.codigo}</td>
                  <td className="doc-title">{doc.titulo}</td>
                  <td>
                    <span className={`type-badge type-${doc.tipo.toLowerCase().replace('.', '')}`}>{doc.tipo}</span>
                  </td>
                  <td className="doc-process">{doc.proceso}</td>
                  <td className={`doc-version ${doc.isActive ? 'text-orange font-bold' : doc.estado === 'Aprobado' ? 'text-green font-bold' : ''}`}>
                    {doc.version}
                  </td>
                  <td>
                    <span className={`status-pill ${
                      doc.estado === 'Aprobado' ? 'bg-light-green text-green' :
                      doc.estado === 'En Revision' ? 'bg-light-orange text-orange' :
                      'bg-light-gray text-gray'
                    }`}>
                      {doc.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Panel Derecho de Detalles */}
        <div className="docs-detail-panel panel">
          {/* Header del panel derecho */}
          <div className="detail-header">
            <div className="detail-header-top">
              <span className="status-pill status-pill--large bg-light-orange text-orange">En Revision</span>
              <h3 className="detail-title">PRO-023 — Gestion de Proveedores</h3>
            </div>
          </div>

          {/* Historial de Versiones */}
          <div className="detail-section">
            <h4 className="detail-section-title">Historial de Versiones</h4>
            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-node timeline-node--current bg-orange"></div>
                <div className="timeline-content">
                  <div className="timeline-title">v3.0 - 28 Feb 2026</div>
                  <div className="timeline-status text-orange">En Revision</div>
                </div>
              </div>
              
              <div className="timeline-connector"></div>
              
              <div className="timeline-item">
                <div className="timeline-node bg-green"></div>
                <div className="timeline-content">
                  <div className="timeline-title">v2.1 - 10 Ago 2025</div>
                  <div className="timeline-status text-green">Aprobado</div>
                </div>
              </div>
              
              <div className="timeline-connector"></div>

              <div className="timeline-item">
                <div className="timeline-node bg-gray"></div>
                <div className="timeline-content">
                  <div className="timeline-title">v2.0 - 01 Dic 2024</div>
                  <div className="timeline-status text-gray">Obsoleto</div>
                </div>
              </div>

              <div className="timeline-connector"></div>

              <div className="timeline-item">
                <div className="timeline-node bg-gray"></div>
                <div className="timeline-content">
                  <div className="timeline-title">v1.0 - 15 May 2023</div>
                  <div className="timeline-status text-gray">Obsoleto</div>
                </div>
              </div>
            </div>
          </div>

          <hr className="detail-divider" />

          {/* Flujo de Aprobación */}
          <div className="detail-section">
            <h4 className="detail-section-title">Flujo de Aprobacion (Cap. 7.5.2)</h4>
            <div className="approval-flow">
              <div className="flow-step">
                <div className="flow-box flow-box--ok bg-green">OK</div>
                <div className="flow-role">Elaboracion</div>
                <div className="flow-user">J. Torres</div>
              </div>
              <div className="flow-line"></div>
              <div className="flow-step">
                <div className="flow-box flow-box--pend bg-orange">PEND</div>
                <div className="flow-role">Revision</div>
                <div className="flow-user">Dir. Calidad</div>
              </div>
              <div className="flow-line"></div>
              <div className="flow-step">
                <div className="flow-box flow-box--empty bg-light-gray text-gray">---</div>
                <div className="flow-role">Aprobacion</div>
                <div className="flow-user">Gerente Gral</div>
              </div>
            </div>
          </div>

          {/* Metadata Block */}
          <div className="metadata-block">
            <div className="metadata-title">Governex - Integridad Documental — SHA-256</div>
            <div className="metadata-row">
              <span className="metadata-label">Hash:</span>
              <span className="metadata-value">a4f8c2d1e9b3...7f2c4a8e1b</span>
            </div>
            <div className="metadata-row">
              <span className="metadata-label">Elaborado:</span>
              <span className="metadata-value">J. Torres - 28 Feb 2026 14:32</span>
            </div>
            <div className="metadata-row">
              <span className="metadata-label">Pendiente aprobacion:</span>
              <span className="metadata-value text-orange font-bold">Direccion de Calidad</span>
            </div>
            <div className="metadata-row">
              <span className="metadata-label">Proxima revision:</span>
              <span className="metadata-value">28 Feb 2027</span>
            </div>
            <div className="metadata-footer text-gray">
              Formato: PDF - Idioma: Espanol - Proceso: Compras
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DocumentosPage;
