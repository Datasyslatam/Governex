import React from "react";
import "./DatePicker.css";

interface DatePickerProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
  label,
  error,
  className = "",
  ...rest
}) => {
  return (
    <label className={`form-field ${className}`.trim()}>
      <span className="form-field__label">{label}</span>
      <input type="date" className="form-field__input" {...rest} />
      {error && <span className="form-field__error">{error}</span>}
    </label>
  );
};

export default DatePicker;
