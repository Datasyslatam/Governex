import React from "react";
import "./ApprovalFlow.css";

const steps = [
  { label: "Elaboración", person: "J. Torres", status: "OK" },
  { label: "Revisión", person: "Dir. Calidad", status: "PEND" },
  { label: "Aprobación", person: "Gerente Gral", status: "---" }
];

const ApprovalFlow: React.FC = () => {
  return (
    <div className="approval-flow">
      <h4>Flujo de Aprobación (Cap. 7.5.2)</h4>
      <div className="approval-flow__steps">
        {steps.map((s, index) => (
          <div key={s.label} className="approval-flow__step">
            <div
              className={`approval-flow__icon approval-flow__icon--${
                s.status === "OK" ? "done" : s.status === "PEND" ? "pending" : "empty"
              }`}
            >
              {s.status === "OK" ? "✔" : s.status === "PEND" ? "!" : "·"}
            </div>
            <div className="approval-flow__label">{s.label}</div>
            <div className="approval-flow__person">{s.person}</div>
            {index < steps.length - 1 && (
              <div className="approval-flow__arrow">⟶</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApprovalFlow;
