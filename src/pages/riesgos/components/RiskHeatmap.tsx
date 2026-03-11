import React from "react";
import "./RiskHeatmap.css";

const rows = ["Alta", "Media", "Baja"];
const cols = ["Bajo", "Medio", "Alto"];

const RiskHeatmap: React.FC = () => {
  return (
    <div className="risk-heatmap">
      <div className="risk-heatmap__labels risk-heatmap__labels--rows">
        {rows.map(r => (
          <span key={r}>{r}</span>
        ))}
      </div>

      <div className="risk-heatmap__grid">
        {rows.map((row, rIndex) => (
          <div className="risk-heatmap__row" key={row}>
            {cols.map((col, cIndex) => {
              const key = `${row}-${col}`;
              const level =
                rIndex === 0 && cIndex === 2
                  ? "critical"
                  : rIndex === 0 || cIndex === 2
                  ? "high"
                  : rIndex === 1 && cIndex === 1
                  ? "medium"
                  : "low";

              return (
                <div
                  key={key}
                  className={`risk-heatmap__cell risk-heatmap__cell--${level}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="risk-heatmap__labels risk-heatmap__labels--cols">
        {cols.map(c => (
          <span key={c}>{c}</span>
        ))}
      </div>

      <div className="risk-heatmap__legend">
        <span className="risk-heatmap__legend-item risk-heatmap__legend-item--low">
          Bajo
        </span>
        <span className="risk-heatmap__legend-item risk-heatmap__legend-item--medium">
          Medio
        </span>
        <span className="risk-heatmap__legend-item risk-heatmap__legend-item--high">
          Alto
        </span>
        <span className="risk-heatmap__legend-item risk-heatmap__legend-item--critical">
          Crítico
        </span>
      </div>
    </div>
  );
};

export default RiskHeatmap;
