import React from "react";
import "./NcTable.css";

interface NcRow {
  code: string;
  description: string;
  origin: string;
  clause: string;
  due: string;
  status: "ABIERTA" | "EN PROCESO" | "VENCIDA" | "CERRADA";
}

const rows: NcRow[] = [
  {
    code: "NC-014",
    description: "Proveedor sin evaluación vigente",
    origin: "Auditoría",
    clause: "8.4.1",
    due: "15 Mar",
    status: "VENCIDA"
  },
  {
    code: "NC-013",
    description: "Indicador sin medición Q4",
    origin: "Rev. Dirección",
    clause: "9.1.1",
    due: "20 Mar",
    status: "ABIERTA"
  },
  {
    code: "NC-012",
    description: "Documento sin aprobación",
    origin: "Proceso",
    clause: "7.5.2",
    due: "25 Mar",
    status: "EN PROCESO"
  }
];

const NcTable: React.FC = () => {
  return (
    <table className="nc-table">
      <thead>
        <tr>
          <th>Código</th>
          <th>Descripción</th>
          <th>Origen</th>
          <th>Cláusula</th>
          <th>Vence</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((n, idx) => (
          <tr key={n.code} className={idx % 2 === 0 ? "nc-table__row--alt" : ""}>
            <td className="nc-table__code">{n.code}</td>
            <td>{n.description}</td>
            <td>{n.origin}</td>
            <td>{n.clause}</td>
            <td>{n.due}</td>
            <td>
              <span className={`nc-table__status nc-table__status--${n.status}`}>
                {n.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default NcTable;
