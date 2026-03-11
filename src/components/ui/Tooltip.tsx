import React, { useState } from "react";
import "./Tooltip.css";

interface TooltipProps {
  label: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ label, children }) => {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="ui-tooltip"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && <span className="ui-tooltip__bubble">{label}</span>}
    </span>
  );
};

export default Tooltip;
