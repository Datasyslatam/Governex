import React from "react";
import "./Heatmap.css";

const rows = ["Alta", "Media", "Baja"];
const cols = ["Bajo", "Medio", "Alto"];

const Heatmap: React.FC = () => {
  return (
    <div className="heatmap">
      <div className="heatmap__labels heatmap__labels--rows">
        {rows.map(r => (
          <span key={r}>{r}</span>
        ))}
      </div>
      <div className="heatmap__grid">
        {rows.map((row, rIndex) => (
          <div className="heatmap__row" key={row}>
            {cols.map((col, cIndex) => {
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
                  key={`${row}-${col}`}
                  className={`heatmap__cell heatmap__cell--${level}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="heatmap__labels heatmap__labels--cols">
        {cols.map(c => (
          <span key={c}>{c}</span>
        ))}
      </div>
    </div>
  );
};

export default Heatmap;
