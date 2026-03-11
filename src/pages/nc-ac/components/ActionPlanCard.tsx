import React from "react";
import "./ActionPlanCard.css";

const fields = [
  {
    label: "Acción:",
    value: "Implementar alertas automáticas de vencimiento proveedores"
  },
  {
    label: "Responsable:",
    value: "Juan Torres · Jefe de Compras"
  },
  {
    label: "Fecha límite:",
    value: "31 Marzo 2026"
  },
  {
    label: "Recursos:",
    value: "Configuración módulo proveedores Governex"
  },
  {
    label: "Actualiza riesgos:",
    value: "R-002 actualizado el 5 Mar 2026 en Governex"
  }
];

const ActionPlanCard: React.FC = () => {
  return (
    <div className="action-plan-card">
      <h4>Plan de Acción Correctiva — Governex</h4>
      <dl className="action-plan-card__list">
        {fields.map(f => (
          <div key={f.label} className="action-plan-card__item">
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default ActionPlanCard;
