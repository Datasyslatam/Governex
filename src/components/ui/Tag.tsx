import React from "react";
import "./Tag.css";

interface TagProps {
  children: React.ReactNode;
  className?: string;
}

const Tag: React.FC<TagProps> = ({ children, className = "" }) => {
  return <span className={`ui-tag ${className}`.trim()}>{children}</span>;
};

export default Tag;
