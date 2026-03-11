import React from "react";
import "./Table.css";

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

const Table: React.FC<TableProps> = ({ children, className = "" }) => {
  return <table className={`ui-table ${className}`.trim()}>{children}</table>;
};

export default Table;
