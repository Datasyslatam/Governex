import React from "react";
import "./RiskSummaryBars.css";

const data = [
  { label: "Críticos", value: 2, variant: "critical" },
  { label: "Medios",   value: 3, variant: "medium"   },
  { label: "Bajos",    value: 2, variant: "low"       },
  { label: "Oport.",   value: 1, variant: "opportunity" }
];

const MAX = 3;

const RiskSummaryBars: React.FC = () => {
  return (
    <div className="risk-summary-bars">
      {data.map(item => (
        <div key={item.label} className="risk-summary-bars__item">
          <span className="risk-summary-bars__value">{item.value}</span>
          <div className="risk-summary-bars__bar-bg">
            <div
              className={`risk-summary-bars__bar risk-summary-bars__bar--${item.variant}`}
              style={{ height: `${(item.value / MAX) * 100}%` }}
            />
          </div>
          <span className="risk-summary-bars__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default RiskSummaryBars;
