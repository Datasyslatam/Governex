import React from "react";
import "./RiskHeatmap.css";

const rows = ["Alta", "Media", "Baja"];
const cols = ["Bajo", "Medio", "Alto", "Crítico"];

// [row][col] color level
const cellLevels: string[][] = [
  ["low",    "medium", "high",   "critical"],
  ["low",    "medium", "high",   "high"    ],
  ["low",    "low",    "medium", "high"    ],
];

const riskDots = [
  { label: "R2", row: 0, col: 1 },
  { label: "R1", row: 0, col: 3 },
  { label: "R5", row: 1, col: 0 },
  { label: "R4", row: 2, col: 0 },
  { label: "R6", row: 2, col: 1 },
];

const RiskHeatmap: React.FC = () => {
  return (
    <div className="risk-heatmap">
      {/* Main area: row-labels + grid */}
      <div className="risk-heatmap__main">
        {/* Y axis label + row labels */}
        <div className="risk-heatmap__y-axis">
          <span className="risk-heatmap__axis-title">PROB.</span>
          {rows.map(r => (
            <span key={r} className="risk-heatmap__row-label">{r}</span>
          ))}
        </div>

        {/* Grid + col labels + x-axis title */}
        <div className="risk-heatmap__grid-wrapper">
          <div className="risk-heatmap__grid">
            {rows.map((row, rIndex) => (
              <div className="risk-heatmap__row" key={row}>
                {cols.map((col, cIndex) => {
                  const dotsHere = riskDots.filter(
                    d => d.row === rIndex && d.col === cIndex
                  );
                  return (
                    <div
                      key={`${row}-${col}`}
                      className={`risk-heatmap__cell risk-heatmap__cell--${cellLevels[rIndex][cIndex]}`}
                    >
                      {dotsHere.map(d => (
                        <span key={d.label} className="risk-heatmap__dot">
                          {d.label}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Column labels */}
          <div className="risk-heatmap__col-labels">
            {cols.map(c => (
              <span key={c}>{c}</span>
            ))}
          </div>

          <div className="risk-heatmap__x-axis-title">IMPACTO</div>
        </div>
      </div>

      {/* Legend */}
      <div className="risk-heatmap__legend-row">
        <span className="risk-heatmap__legend-item risk-heatmap__legend-item--low">Bajo</span>
        <span className="risk-heatmap__legend-item risk-heatmap__legend-item--medium">Medio</span>
        <span className="risk-heatmap__legend-item risk-heatmap__legend-item--high">Alto</span>
        <span className="risk-heatmap__legend-item risk-heatmap__legend-item--critical">Crítico</span>
      </div>
    </div>
  );
};

export default RiskHeatmap;
