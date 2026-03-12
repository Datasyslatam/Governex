import React from "react";
import "./RiskTable.css";

interface RiskRow {
  code: string;
  description: string;
  process: string;
  level: number;
  status: "CRITICO" | "TRATAMIENTO" | "MONITOREO";
  owner: string;
}

const rows: RiskRow[] = [
  {
    code: "R-001",
    description: "Falla proveedor MMPP",
    process: "Producción",
    level: 9,
    status: "CRITICO",
    owner: "A. Martínez"
  },
  {
    code: "R-002",
    description: "Pérdida personal clave",
    process: "RRHH",
    level: 6,
    status: "TRATAMIENTO",
    owner: "L. García"
  },
  {
    code: "R-003",
    description: "Incumplimiento normativo",
    process: "SGC",
    level: 6,
    status: "TRATAMIENTO",
    owner: "Dir. Calidad"
  },
  {
    code: "R-004",
    description: "Fallo sistema TI",
    process: "TI",
    level: 4,
    status: "MONITOREO",
    owner: "C. Ramos"
  },
  {
    code: "R-005",
    description: "Queja masiva cliente",
    process: "Comercial",
    level: 9,
    status: "CRITICO",
    owner: "V. Pérez"
  }
];

const RiskTable: React.FC = () => {
  return (
    <table className="risk-table">
      <thead>
        <tr>
          <th>Código</th>
          <th>Descripción</th>
          <th>Proceso</th>
          <th>PxI</th>
          <th>Estado</th>
          <th>Responsable</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr
            key={r.code}
            className={idx % 2 === 0 ? "risk-table__row--alt" : ""}
          >
            <td className="risk-table__code">{r.code}</td>
            <td>{r.description}</td>
            <td>{r.process}</td>
            <td>
              <span className="risk-table__level">{r.level}</span>
            </td>
            <td>
              <span
                className={`risk-table__status risk-table__status--${r.status.toLowerCase()}`}
              >
                {r.status}
              </span>
            </td>
            <td>{r.owner}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default RiskTable;
