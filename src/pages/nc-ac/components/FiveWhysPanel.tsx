import React from 'react'
import './FiveWhysPanel.css'
import { AnalisisDetallePaso5W } from '../../../services'

interface FiveWhysPanelProps {
  pasos?: AnalisisDetallePaso5W[]
  causaRaiz?: string
  problemaSintoma?: string
  onEditPaso?: (index: number, field: 'porque' | 'respuesta', val: string) => void
  readOnly?: boolean
}

const FiveWhysPanel: React.FC<FiveWhysPanelProps> = ({
  pasos = [],
  causaRaiz = '',
  problemaSintoma = '',
  onEditPaso,
  readOnly = false,
}) => {
  if (!pasos.length && !causaRaiz) {
    return (
      <div className="fivewhys fivewhys--empty">
        <p>No se ha realizado el análisis de 5 Por Qués aún. Haz clic en "Analizar con IA" para generarlo.</p>
      </div>
    )
  }

  return (
    <div className="fivewhys">
      <div className="fivewhys__header">
        <span className="fivewhys__badge">Metodología 5 Por Qués</span>
        {problemaSintoma && (
          <span className="fivewhys__sintoma">
            <strong>Problema / Síntoma:</strong> {problemaSintoma}
          </span>
        )}
      </div>

      <div className="fivewhys__timeline">
        {pasos.map((p, idx) => (
          <div key={idx} className="fivewhys__step">
            <div className="fivewhys__step-num">{p.nivel || idx + 1}</div>
            <div className="fivewhys__step-content">
              {readOnly || !onEditPaso ? (
                <>
                  <div className="fivewhys__pregunta">{p.porque}</div>
                  <div className="fivewhys__respuesta">{p.respuesta}</div>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    className="fivewhys__input-q"
                    value={p.porque}
                    onChange={e => onEditPaso(idx, 'porque', e.target.value)}
                    placeholder="¿Por qué...?"
                  />
                  <textarea
                    rows={2}
                    className="fivewhys__input-a"
                    value={p.respuesta}
                    onChange={e => onEditPaso(idx, 'respuesta', e.target.value)}
                    placeholder="Respuesta / Causa inmediata..."
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {causaRaiz && (
        <div className="fivewhys__root-cause">
          <div className="fivewhys__root-title">🎯 Causa Raíz Identificada</div>
          <p className="fivewhys__root-text">{causaRaiz}</p>
        </div>
      )}
    </div>
  )
}

export default FiveWhysPanel
