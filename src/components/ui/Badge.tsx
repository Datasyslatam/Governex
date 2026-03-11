import React from "react";
import "./Badge.css";

type Variant = "success" | "warning" | "danger" | "info" | "muted";

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ variant = "info", children, className = "" }) => {
  return (
    <span className={`ui-badge ui-badge--${variant} ${className}`.trim()}>
      {children}
    </span>
  );
};

export default Badge;
