import React from "react";
import "./NcKpiCards.css";

const cards = [
  { label: "Abiertas", value: "7", variant: "danger" },
  { label: "Vencidas", value: "3", variant: "danger" },
  { label: "En Proceso", value: "12", variant: "warning" },
  { label: "Cerradas", value: "28", variant: "success" },
  { label: "Eficacia AC", value: "85%", variant: "success" },
  { label: "Tiempo Prom.", value: "18d", variant: "warning" }
];

const NcKpiCards: React.FC = () => {
  return (
    <section className="nc-kpis">
      {cards.map(c => (
        <div
          key={c.label}
          className={`nc-kpis__card nc-kpis__card--${c.variant}`}
        >
          <div className="nc-kpis__value">{c.value}</div>
          <div className="nc-kpis__label">{c.label}</div>
        </div>
      ))}
    </section>
  );
};

export default NcKpiCards;
