import React from "react";
import "./DocumentVersionTimeline.css";

interface VersionItem {
  version: string;
  date: string;
  status: "Aprobado" | "En Revisión" | "Obsoleto";
}

const versions: VersionItem[] = [
  { version: "v3.0", date: "28 Feb 2026", status: "En Revisión" },
  { version: "v2.1", date: "10 Ago 2025", status: "Aprobado" },
  { version: "v2.0", date: "01 Dic 2024", status: "Obsoleto" },
  { version: "v1.0", date: "15 May 2023", status: "Obsoleto" }
];

const DocumentVersionTimeline: React.FC = () => {
  return (
    <div className="doc-timeline">
      <h4>Historial de Versiones</h4>
      <ul className="doc-timeline__list">
        {versions.map((v, index) => (
          <li key={v.version} className="doc-timeline__item">
            <div
              className={`doc-timeline__dot doc-timeline__dot--${v.status.replace(/\s+/g, "-")}`}
            />
            {index < versions.length - 1 && (
              <div className="doc-timeline__line" />
            )}
            <div className="doc-timeline__content">
              <div className="doc-timeline__version">
                {v.version} · {v.date}
              </div>
              <div
                className={`doc-timeline__status doc-timeline__status--${v.status.replace(/\s+/g, "-")}`}
              >
                {v.status}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DocumentVersionTimeline;
