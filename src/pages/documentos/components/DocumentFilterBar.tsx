import React from "react";
import "./DocumentFilterBar.css";

const DocumentFilterBar: React.FC = () => {
  return (
    <section className="document-filter">
      <input
        className="document-filter__search"
        placeholder="Buscar en Governex Docs..."
      />

      <div className="document-filter__types">
        <button className="document-filter__type document-filter__type--active">
          Todos
        </button>
        <button className="document-filter__type">Procedimientos</button>
        <button className="document-filter__type">Instructivos</button>
        <button className="document-filter__type">Formatos</button>
        <button className="document-filter__type">Políticas</button>
        <button className="document-filter__type">Manuales</button>
      </div>

      <div className="document-filter__statuses">
        <span className="status-pill status-pill--success">Aprobado</span>
        <span className="status-pill status-pill--warning">En Revisión</span>
        <span className="status-pill status-pill--muted">Borrador</span>
        <span className="status-pill status-pill--danger">Obsoleto</span>
      </div>

      <button className="document-filter__new">+ Nuevo Documento</button>
    </section>
  );
};

export default DocumentFilterBar;
