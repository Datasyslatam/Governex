import React from "react";
import DocumentFilterBar from "./components/DocumentFilterBar";
import DocumentTable from "./components/DocumentTable";
import DocumentVersionTimeline from "./components/DocumentVersionTimeline";
import ApprovalFlow from "./components/ApprovalFlow";
import IntegrityHashCard from "./components/IntegrityHashCard";
import "./DocumentosPage.css";

const DocumentosPage: React.FC = () => {
  return (
    <div className="page documentos-page">
      <header className="page__header">
        <h2>Gestión Documental — Control de Versiones</h2>
        <span>Governex · Cap. 7.5 · Información documentada</span>
      </header>

      <DocumentFilterBar />

      <section className="documentos-page__body">
        <div className="documentos-page__left">
          <DocumentTable />
        </div>
        <div className="documentos-page__right">
          <DocumentVersionTimeline />
          <ApprovalFlow />
          <IntegrityHashCard />
        </div>
      </section>
    </div>
  );
};

export default DocumentosPage;
