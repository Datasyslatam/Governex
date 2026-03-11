import React from "react";
import "./SelectField.css";

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  error?: string;
}

const SelectField: React.FC<SelectFieldProps> = ({
  label,
  options,
  error,
  className = "",
  ...rest
}) => {
  return (
    <label className={`form-field ${className}`.trim()}>
      <span className="form-field__label">{label}</span>
      <select className="form-field__select" {...rest}>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="form-field__error">{error}</span>}
    </label>
  );
};

export default SelectField;
