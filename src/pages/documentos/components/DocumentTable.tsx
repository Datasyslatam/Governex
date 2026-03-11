import React from "react";
import "./DocumentTable.css";

interface DocumentRow {
  code: string;
  title: string;
  type: "Manual" | "Política" | "Proceso" | "Instr." | "Formato";
  process: string;
  version: string;
  status: "Aprobado" | "En Revisión" | "Borrador" | "Obsoleto";
}

const rows: DocumentRow[] = [
  {
    code: "MAN-001",
    title: "Manual del SGC",
    type: "Manual",
    process: "Calidad",
    version: "v4.0",
    status: "Aprobado"
  },
  {
    code: "POL-001",
    title: "Política de Calidad",
    type: "Política",
    process: "Calidad",
    version: "v3.1",
    status: "Aprobado"
  },
  {
    code: "PRO-023",
    title: "Gestión de Proveedores",
    type: "Proceso",
    process: "Compras",
    version: "v3.0",
    status: "En Revisión"
  }
];

const DocumentTable: React.FC = () => {
  return (
    <table className="document-table">
      <thead>
        <tr>
          <th>Código</th>
          <th>Título del Documento</th>
          <th>Tipo</th>
          <th>Proceso</th>
          <th>Versión</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d, idx) => (
          <tr
            key={d.code}
            className={idx % 2 === 0 ? "document-table__row--alt" : ""}
          >
            <td className="document-table__code">{d.code}</td>
            <td>{d.title}</td>
            <td>{d.type}</td>
            <td>{d.process}</td>
            <td>{d.version}</td>
            <td>
              <span
                className={`document-table__status document-table__status--${d.status}`}
              >
                {d.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default DocumentTable;
