import React from "react";
import "./TreatmentCycle.css";

const steps = [
  { label: "Reacción", status: "done" },
  { label: "Análisis", status: "done" },
  { label: "Causa Raíz", status: "done" },
  { label: "Acción", status: "pending" },
  { label: "Verificar", status: "todo" }
];

const TreatmentCycle: React.FC = () => {
  return (
    <div className="treatment-cycle">
      <h4>Ciclo de Tratamiento Governex — ISO 10.2.1</h4>
      <div className="treatment-cycle__steps">
        {steps.map((s, index) => (
          <div key={s.label} className="treatment-cycle__step">
            <div className={`treatment-cycle__circle treatment-cycle__circle--${s.status}`}>
              {s.status === "done" ? "✔" : s.status === "pending" ? "!" : "·"}
            </div>
            <div className="treatment-cycle__label">{s.label}</div>
            {index < steps.length - 1 && (
              <div className="treatment-cycle__line" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TreatmentCycle;
