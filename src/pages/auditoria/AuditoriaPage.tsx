import React, { useState } from "react";
import "./AuditoriaPage.css";
import AuditCalendar from "./components/AuditCalendar";

type Tab = "programa" | "auditorias" | "hallazgos";

export interface Auditoria {
  codigo: string;
  proceso: string;
  fechaInicio: string; // "YYYY-MM-DD"
  duracionDias: number;
  auditor: string;
  estado: "Planificada" | "En Ejecución" | "Cerrada";
  hallazgos: number;
}

const programasData = [
  { año: 2026, objetivo: "Verificar eficacia del SGC y transición a nuevos procesos digitales", duracion: "120 h (3 auditores)", estado: "En Ejecución", avance: 33 },
  { año: 2025, objetivo: "Auditoría integral pre-certificación", duracion: "160 h (4 auditores)", estado: "Cerrado", avance: 100 },
];

const initialAuditoriasData: Auditoria[] = [
  { codigo: "AI-26-01", proceso: "Ventas y Gestión Comercial",   fechaInicio: "2026-03-10", duracionDias: 2, auditor: "S. Martínez", estado: "Cerrada",      hallazgos: 2 },
  { codigo: "AI-26-02", proceso: "Producción / Prestación",       fechaInicio: "2026-03-15", duracionDias: 3, auditor: "L. Gómez",    estado: "En Ejecución", hallazgos: 0 },
  { codigo: "AI-26-03", proceso: "Compras y Proveedores",         fechaInicio: "2026-03-22", duracionDias: 1, auditor: "M. Vargas",   estado: "Planificada",  hallazgos: 0 },
  { codigo: "AI-26-04", proceso: "Talento Humano",                fechaInicio: "2026-04-05", duracionDias: 2, auditor: "S. Martínez", estado: "Planificada",  hallazgos: 0 },
];

const hallazgosData = [
  { codigo: "HL-26-001", auditoria: "AI-26-01", tipo: "No Conformidad Menor",  descripcion: "No se encontró registro de revisión de contrato en pedido #1245", clausula: "8.2.3", estado: "Abierto"  },
  { codigo: "HL-26-002", auditoria: "AI-26-01", tipo: "Observación",           descripcion: "Formato de cotización desactualizado en 1 caso",                   clausula: "7.5",   estado: "Cerrado"  },
  { codigo: "HL-25-014", auditoria: "AI-25-03", tipo: "Oportunidad de Mejora", descripcion: "Centralizar almacenamiento de actas de reunión",                   clausula: "10.3",  estado: "Cerrado"  },
];

const AUDITORES = ["S. Martínez", "L. Gómez", "M. Vargas", "R. Torres", "A. Reyes"];
const PROCESOS = [
  "Ventas y Gestión Comercial",
  "Producción / Prestación",
  "Compras y Proveedores",
  "Talento Humano",
  "Calidad y Mejora Continua",
  "Gestión Financiera",
];

const emptyForm: Omit<Auditoria, "codigo" | "hallazgos"> = {
  proceso: PROCESOS[0],
  fechaInicio: new Date().toISOString().slice(0, 10),
  duracionDias: 1,
  auditor: AUDITORES[0],
  estado: "Planificada",
};

const formatFecha = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const AuditoriaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("programa");
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [auditorias, setAuditorias] = useState<Auditoria[]>(initialAuditoriasData);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Omit<Auditoria, "codigo" | "hallazgos">>(emptyForm);

  // Filter States
  const [filterProgYear, setFilterProgYear]     = useState("");
  const [filterAudProcess, setFilterAudProcess] = useState("");
  const [filterAudAuditor, setFilterAudAuditor] = useState("");
  const [filterAudStatus, setFilterAudStatus]   = useState("");
  const [filterHalAudit, setFilterHalAudit]     = useState("");
  const [filterHalType, setFilterHalType]       = useState("");
  const [filterHalStatus, setFilterHalStatus]   = useState("");

  const filteredProgramas   = programasData.filter(p  => !filterProgYear   || p.año.toString().includes(filterProgYear));
  const filteredAuditorias  = auditorias.filter(a     =>
    (!filterAudProcess || a.proceso.toLowerCase().includes(filterAudProcess.toLowerCase())) &&
    (!filterAudAuditor || a.auditor.toLowerCase().includes(filterAudAuditor.toLowerCase())) &&
    (!filterAudStatus  || a.estado === filterAudStatus)
  );
  const filteredHallazgos   = hallazgosData.filter(h =>
    (!filterHalAudit   || h.auditoria.toLowerCase().includes(filterHalAudit.toLowerCase())) &&
    (!filterHalType    || h.tipo   === filterHalType) &&
    (!filterHalStatus  || h.estado === filterHalStatus)
  );

  const handleAddAudit = () => {
    const nextNum = String(auditorias.length + 1).padStart(2, "0");
    const year = form.fechaInicio.slice(2, 4);
    const newAudit: Auditoria = {
      ...form,
      codigo: `AI-${year}-${nextNum}`,
      hallazgos: 0,
    };
    setAuditorias(prev => [...prev, newAudit]);
    setShowModal(false);
    setForm(emptyForm);
  };

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
          📅 Programas ({filteredProgramas.length})
        </button>
        <button
          className={`audit-tabs__tab ${activeTab === "auditorias" ? "audit-tabs__tab--active" : ""}`}
          onClick={() => setActiveTab("auditorias")}
        >
          📋 Auditorías ({filteredAuditorias.length})
        </button>
        <button
          className={`audit-tabs__tab ${activeTab === "hallazgos" ? "audit-tabs__tab--active" : ""}`}
          onClick={() => setActiveTab("hallazgos")}
        >
          🔍 Hallazgos ({filteredHallazgos.length})
        </button>
      </nav>

      <main className="audit-main panel">
        {/* ── Programas Tab ── */}
        {activeTab === "programa" && (
          <div className="audit-table-wrap">
            <div className="audit-section-header">
              <div className="audit-section-header__title">
                <h3>Programas Anuales de Auditoría</h3>
                <span className="pill pill--muted">Requisito 9.2.2</span>
              </div>
              <div className="audit-section-controls">
                <div className="audit-view-toggle">
                  <button className={`toggle-btn ${viewMode === "table"    ? "active" : ""}`} onClick={() => setViewMode("table")}>Tabla</button>
                  <button className={`toggle-btn ${viewMode === "calendar" ? "active" : ""}`} onClick={() => setViewMode("calendar")}>Calendario</button>
                </div>
                <div className="audit-filters">
                  <input type="text" placeholder="Filtrar por año..." value={filterProgYear}
                    onChange={e => setFilterProgYear(e.target.value)} className="filter-input" />
                </div>
              </div>
            </div>

            {viewMode === "table" ? (
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
                  {filteredProgramas.map((prog, i) => (
                    <tr key={prog.año} className={i % 2 === 1 ? "table__row--alt" : ""}>
                      <td className="audit-table__code">{prog.año}</td>
                      <td className="audit-table__title">{prog.objetivo}</td>
                      <td className="audit-table__duration">{prog.duracion}</td>
                      <td>
                        <div className="audit-progress">
                          <div className="audit-progress__bar">
                            <div className={`audit-progress__fill ${prog.avance === 100 ? "bg-success" : "bg-primary"}`} style={{ width: `${prog.avance}%` }}></div>
                          </div>
                          <span className="audit-progress__text">{prog.avance}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`pill ${prog.estado === "Cerrado" ? "pill--success" : "pill--warning"}`}>{prog.estado}</span>
                      </td>
                      <td className="audit-table__actions">
                        <button className="audit-action-btn" title="Ver programa">👁️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <AuditCalendar auditorias={auditorias} />
            )}
          </div>
        )}

        {/* ── Auditorías Tab ── */}
        {activeTab === "auditorias" && (
          <div className="audit-table-wrap">
            <div className="audit-section-header">
              <div className="audit-section-header__title">
                <h3>Planificación y Ejecución de Auditorías</h3>
              </div>
              <div className="audit-section-controls">
                <div className="audit-filters">
                  <input type="text" placeholder="Proceso..." value={filterAudProcess}
                    onChange={e => setFilterAudProcess(e.target.value)} className="filter-input" />
                  <input type="text" placeholder="Auditor..." value={filterAudAuditor}
                    onChange={e => setFilterAudAuditor(e.target.value)} className="filter-input" />
                  <select value={filterAudStatus} onChange={e => setFilterAudStatus(e.target.value)} className="filter-select">
                    <option value="">Todos los estados</option>
                    <option value="Planificada">Planificada</option>
                    <option value="En Ejecución">En Ejecución</option>
                    <option value="Cerrada">Cerrada</option>
                  </select>
                </div>
                <button className="btn btn--primary audit-btn-small" onClick={() => setShowModal(true)}>+ Nueva Auditoría</button>
              </div>
            </div>
            <table className="table audit-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Proceso Auditado</th>
                  <th>Fecha Inicio</th>
                  <th>Duración</th>
                  <th>Auditor Líder</th>
                  <th>Hallazgos</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditorias.map((aud, i) => (
                  <tr key={aud.codigo} className={i % 2 === 1 ? "table__row--alt" : ""}>
                    <td className="audit-table__code">{aud.codigo}</td>
                    <td className="audit-table__process">{aud.proceso}</td>
                    <td className="audit-table__date">{formatFecha(aud.fechaInicio)}</td>
                    <td className="audit-table__date">{aud.duracionDias} día{aud.duracionDias !== 1 ? "s" : ""}</td>
                    <td>{aud.auditor}</td>
                    <td>
                      <span className={`pill ${aud.hallazgos > 0 ? "pill--danger" : "pill--muted"}`}>
                        {aud.hallazgos} hallazgos
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${
                        aud.estado === "Cerrada" ? "pill--success" :
                        aud.estado === "En Ejecución" ? "pill--warning" : "pill--muted"
                      }`}>{aud.estado}</span>
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

        {/* ── Hallazgos Tab ── */}
        {activeTab === "hallazgos" && (
          <div className="audit-table-wrap">
            <div className="audit-section-header">
              <div className="audit-section-header__title">
                <h3>Registro de Hallazgos</h3>
                <span className="pill pill--muted">Evidencia objetiva extraída de informes</span>
              </div>
              <div className="audit-section-controls">
                <div className="audit-filters">
                  <input type="text" placeholder="Cód. Auditoría..." value={filterHalAudit}
                    onChange={e => setFilterHalAudit(e.target.value)} className="filter-input" />
                  <select value={filterHalType} onChange={e => setFilterHalType(e.target.value)} className="filter-select">
                    <option value="">Todas las naturalezas</option>
                    <option value="No Conformidad Menor">No Conformidad Menor</option>
                    <option value="No Conformidad Mayor">No Conformidad Mayor</option>
                    <option value="Observación">Observación</option>
                    <option value="Oportunidad de Mejora">Oportunidad de Mejora</option>
                  </select>
                  <select value={filterHalStatus} onChange={e => setFilterHalStatus(e.target.value)} className="filter-select">
                    <option value="">Todos los estados</option>
                    <option value="Abierto">Abierto</option>
                    <option value="Cerrado">Cerrado</option>
                  </select>
                </div>
              </div>
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
                {filteredHallazgos.map((hal, i) => (
                  <tr key={hal.codigo} className={i % 2 === 1 ? "table__row--alt" : ""}>
                    <td className="audit-table__code">{hal.codigo}</td>
                    <td className="audit-table__ref">{hal.auditoria}</td>
                    <td>
                      <span className={`pill ${
                        hal.tipo.includes("No Conformidad") ? "pill--danger" :
                        hal.tipo.includes("Observación") ? "pill--warning" : "pill--success"
                      }`}>{hal.tipo}</span>
                    </td>
                    <td className="audit-table__desc">{hal.descripcion}</td>
                    <td className="audit-table__clausula">{hal.clausula}</td>
                    <td>
                      <span className={`pill ${hal.estado === "Cerrado" ? "pill--success" : "pill--danger"}`}>{hal.estado}</span>
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

      {/* ── Modal Nueva Auditoría ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Nueva Auditoría</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Proceso a auditar</label>
                <select value={form.proceso} onChange={e => setForm(f => ({ ...f, proceso: e.target.value }))} className="filter-select form-control">
                  {PROCESOS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Auditor Líder</label>
                <select value={form.auditor} onChange={e => setForm(f => ({ ...f, auditor: e.target.value }))} className="filter-select form-control">
                  {AUDITORES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha de inicio</label>
                  <input type="date" className="filter-input form-control" value={form.fechaInicio}
                    onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Duración (días)</label>
                  <input type="number" min={1} max={30} className="filter-input form-control" value={form.duracionDias}
                    onChange={e => setForm(f => ({ ...f, duracionDias: Math.max(1, parseInt(e.target.value) || 1) }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Estado inicial</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as Auditoria["estado"] }))} className="filter-select form-control">
                  <option value="Planificada">Planificada</option>
                  <option value="En Ejecución">En Ejecución</option>
                </select>
              </div>

              {/* Preview block */}
              <div className="modal-preview">
                <span className="modal-preview__label">Período:</span>
                <span>
                  {form.fechaInicio ? (() => {
                    const start = new Date(form.fechaInicio + "T00:00:00");
                    const end   = new Date(start);
                    end.setDate(end.getDate() + form.duracionDias - 1);
                    return `${start.getDate().toString().padStart(2,"0")}/${(start.getMonth()+1).toString().padStart(2,"0")}/${start.getFullYear()}
                      — ${end.getDate().toString().padStart(2,"0")}/${(end.getMonth()+1).toString().padStart(2,"0")}/${end.getFullYear()}`;
                  })() : "—"}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={handleAddAudit} disabled={!form.fechaInicio || !form.proceso}>
                Guardar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditoriaPage;
