import React from "react";
import "./BarChart.css";

interface Props {
  categories: string[];
  values: number[];
}

const BarChart: React.FC<Props> = ({ categories, values }) => {
  const max = Math.max(...values, 100);

  return (
    <div className="bar-chart">
      {categories.map((cat, i) => (
        <div key={cat} className="bar-chart__item">
          <div className="bar-chart__bar-bg">
            <div
              className="bar-chart__bar"
              style={{ height: `${(values[i] / max) * 100}%` }}
            />
          </div>
          <div className="bar-chart__value">{values[i]}%</div>
          <div className="bar-chart__label">{cat}</div>
        </div>
      ))}
    </div>
  );
};

export default BarChart;
