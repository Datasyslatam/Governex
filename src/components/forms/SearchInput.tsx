import React from "react";
import "./SearchInput.css";

interface SearchInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({
  className = "",
  ...rest
}) => {
  return (
    <div className={`search-input ${className}`.trim()}>
      <span className="search-input__icon">🔍</span>
      <input className="search-input__field" {...rest} />
    </div>
  );
};

export default SearchInput;
