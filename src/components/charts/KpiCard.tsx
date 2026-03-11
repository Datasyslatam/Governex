import React from "react";
import "./KpiCard.css";

type Variant = "success" | "warning" | "danger";

interface Props {
  label: string;
  value: string;
  trend?: string;
  variant?: Variant;
}

const KpiCard: React.FC<Props> = ({
  label,
  value,
  trend,
  variant = "success"
}) => {
  return (
    <div className={`kpi-card kpi-card--${variant}`}>
      <div className="kpi-card__header">{label}</div>
      <div className="kpi-card__value">{value}</div>
      {trend && <div className="kpi-card__trend">{trend}</div>}
    </div>
  );
};

export default KpiCard;
