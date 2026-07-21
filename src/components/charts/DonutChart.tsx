import React from "react";
import "./DonutChart.css";

interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
}

/** Gráfico de dona en SVG puro (sin dependencias externas). */
const DonutChart: React.FC<Props> = ({ data, size = 160, thickness = 24, centerLabel }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulative = 0;

  return (
    <div className="donut-chart">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          data
            .filter(d => d.value > 0)
            .map((d, i) => {
              const fraction = d.value / total;
              const dash = fraction * circumference;
              const offset = circumference - (cumulative / total) * circumference;
              cumulative += d.value;
              return (
                <circle
                  key={i}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                  transform={`rotate(-90 ${center} ${center})`}
                  strokeLinecap="butt"
                />
              );
            })}
        <text x={center} y={center - 2} textAnchor="middle" className="donut-chart__total">
          {total}
        </text>
        {centerLabel && (
          <text x={center} y={center + 16} textAnchor="middle" className="donut-chart__caption">
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="donut-chart__legend">
        {data.map((d, i) => (
          <li key={i}>
            <span className="donut-chart__dot" style={{ background: d.color }} />
            <span className="donut-chart__legend-label">{d.label}</span>
            <span className="donut-chart__legend-value">
              {d.value} {total > 0 ? `(${Math.round((d.value / total) * 100)}%)` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DonutChart;
