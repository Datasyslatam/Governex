import React from "react";
import "./TextField.css";

interface TextFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const TextField: React.FC<TextFieldProps> = ({
  label,
  error,
  className = "",
  ...rest
}) => {
  return (
    <label className={`form-field ${className}`.trim()}>
      <span className="form-field__label">{label}</span>
      <input className="form-field__input" {...rest} />
      {error && <span className="form-field__error">{error}</span>}
    </label>
  );
};

export default TextField;
