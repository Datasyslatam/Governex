import React from "react";
import "./FiveWhysPanel.css";

const items = [
  { label: "Por qué 1:", text: "Proveedor sin evaluación anual vigente" },
  { label: "Por qué 2:", text: "No se programó re-evaluación en calendario" },
  { label: "Por qué 3:", text: "Responsable no recibió alerta del sistema" },
  { label: "Por qué 4:", text: "Sistema anterior sin alertas automáticas" },
  {
    label: "Causa raíz:",
    text: "Falta control automatizado de vencimientos"
  }
];

const FiveWhysPanel: React.FC = () => {
  return (
    <div className="fivewhys">
      <h4>Análisis 5 Por Qués — Governex</h4>
      <ul className="fivewhys__list">
        {items.map(item => (
          <li
            key={item.label}
            className={`fivewhys__item ${
              item.label === "Causa raíz:" ? "fivewhys__item--root" : ""
            }`}
          >
            <span className="fivewhys__label">{item.label}</span>
            <span className="fivewhys__text">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FiveWhysPanel;
