import React from 'react'
import './IshikawaPanel.css'
import { AnalisisDetalleIshikawa } from '../../../services'

interface IshikawaPanelProps {
  efectoProblema?: string
  categorias6m?: AnalisisDetalleIshikawa
  causaRaiz?: string
  readOnly?: boolean
  onEditCategoriaItem?: (categoria: keyof AnalisisDetalleIshikawa, index: number, val: string) => void
}

const CATEGORIAS_CONFIG: Array<{
  key: keyof AnalisisDetalleIshikawa
  label: string
  icon: string
  color: string
}> = [
  { key: 'mano_de_obra', label: 'Mano de Obra (Personal)', icon: '👥', color: '#3b82f6' },
  { key: 'metodos', label: 'Métodos (Procedimientos)', icon: '📋', color: '#10b981' },
  { key: 'maquinaria', label: 'Maquinaria / Equipos', icon: '⚙️', color: '#f59e0b' },
  { key: 'materiales', label: 'Materiales / Insumos', icon: '📦', color: '#8b5cf6' },
  { key: 'medicion', label: 'Medición / Inspección', icon: '📏', color: '#ec4899' },
  { key: 'medio_ambiente', label: 'Medio Ambiente / Entorno', icon: '🌿', color: '#06b6d4' },
]

const IshikawaPanel: React.FC<IshikawaPanelProps> = ({
  efectoProblema = '',
  categorias6m,
  causaRaiz = '',
  readOnly = false,
  onEditCategoriaItem,
}) => {
  if (!categorias6m && !causaRaiz) {
    return (
      <div className="ishikawa ishikawa--empty">
        <p>No se ha realizado el análisis de Ishikawa (Espina de Pescado) aún. Haz clic en "Analizar con IA" para generarlo.</p>
      </div>
    )
  }

  return (
    <div className="ishikawa">
      <div className="ishikawa__header">
        <span className="ishikawa__badge">Diagrama Causa y Efecto (Ishikawa / 6M)</span>
        {efectoProblema && (
          <div className="ishikawa__efecto">
            <span className="ishikawa__efecto-tag">Efecto / Cabeza del Pez:</span>
            <span className="ishikawa__efecto-text">{efectoProblema}</span>
          </div>
        )}
      </div>

      <div className="ishikawa__grid">
        {CATEGORIAS_CONFIG.map(({ key, label, icon, color }) => {
          const items = categorias6m?.[key] || []
          return (
            <div key={key} className="ishikawa__card" style={{ borderTopColor: color }}>
              <div className="ishikawa__card-title" style={{ color }}>
                <span>{icon}</span> {label}
              </div>
              <ul className="ishikawa__list">
                {items.length === 0 ? (
                  <li className="ishikawa__item--none">Sin causas críticas identificadas</li>
                ) : (
                  items.map((it, idx) => (
                    <li key={idx} className="ishikawa__item">
                      {readOnly || !onEditCategoriaItem ? (
                        <span>{it}</span>
                      ) : (
                        <input
                          type="text"
                          className="ishikawa__input"
                          value={it}
                          onChange={e => onEditCategoriaItem(key, idx, e.target.value)}
                        />
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          )
        })}
      </div>

      {causaRaiz && (
        <div className="ishikawa__root-cause">
          <div className="ishikawa__root-title">🎯 Causa Raíz Principal Determinada</div>
          <p className="ishikawa__root-text">{causaRaiz}</p>
        </div>
      )}
    </div>
  )
}

export default IshikawaPanel
