import React from "react";
import "./IntegrityHashCard.css";

const IntegrityHashCard: React.FC = () => {
  return (
    <div className="integrity-card">
      <h4>Governex · Integridad Documental — SHA-256</h4>

      <div className="integrity-card__row">
        <span className="integrity-card__label">Hash:</span>
        <span className="integrity-card__value">
          a4f8c2d1e9b3...7f2c4a8e1b
        </span>
      </div>

      <div className="integrity-card__row">
        <span className="integrity-card__label">Elaborado:</span>
        <span className="integrity-card__value">
          J. Torres · 28 Feb 2026 · 14:32
        </span>
      </div>

      <div className="integrity-card__row">
        <span className="integrity-card__label">Estado aprobación:</span>
        <span className="integrity-card__value integrity-card__value--pending">
          Pendiente aprobación: Dirección de Calidad
        </span>
      </div>

      <div className="integrity-card__row">
        <span className="integrity-card__label">Próxima revisión:</span>
        <span className="integrity-card__value">28 Feb 2027</span>
      </div>

      <div className="integrity-card__row">
        <span className="integrity-card__label">Metadatos:</span>
        <span className="integrity-card__value">
          Formato: PDF · Idioma: Español · Proceso: Compras
        </span>
      </div>
    </div>
  );
};

export default IntegrityHashCard;
