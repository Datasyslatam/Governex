import React from "react";
import "./Card.css";

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, subtitle, children, className = "" }) => {
  return (
    <section className={`ui-card ${className}`.trim()}>
      {(title || subtitle) && (
        <header className="ui-card__header">
          {title && <h3 className="ui-card__title">{title}</h3>}
          {subtitle && <span className="ui-card__subtitle">{subtitle}</span>}
        </header>
      )}
      <div className="ui-card__body">{children}</div>
    </section>
  );
};

export default Card;
