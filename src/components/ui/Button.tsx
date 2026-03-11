import React from "react";
import "./Button.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  className = "",
  children,
  ...rest
}) => {
  return (
    <button
      className={`ui-button ui-button--${variant} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;
