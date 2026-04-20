import React from 'react'
import './RiskSummaryBars.css'
import { RiesgoDerivado } from '../../../context/AIAnalysisContext'

interface Props {
  riesgos: RiesgoDerivado[]
}

const RiskSummaryBars: React.FC<Props> = ({ riesgos }) => {
  const criticos     = riesgos.filter(r => r.tipo === 'Riesgo' && r.nivel >= 15).length
  const altos        = riesgos.filter(r => r.tipo === 'Riesgo' && r.nivel >= 9 && r.nivel < 15).length
  const medios       = riesgos.filter(r => r.tipo === 'Riesgo' && r.nivel >= 4 && r.nivel < 9).length
  const bajos        = riesgos.filter(r => r.tipo === 'Riesgo' && r.nivel < 4).length
  const oportunidades = riesgos.filter(r => r.tipo === 'Oportunidad').length

  const data = [
    { label: 'Críticos',  value: criticos,      variant: 'critical' },
    { label: 'Altos',     value: altos,          variant: 'high' },
    { label: 'Medios',    value: medios,         variant: 'medium' },
    { label: 'Bajos',     value: bajos,          variant: 'low' },
    { label: 'Oport.',    value: oportunidades,  variant: 'opportunity' },
  ]

  const MAX = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="risk-summary-bars">
      {data.map(item => (
        <div key={item.label} className="risk-summary-bars__item">
          <span className="risk-summary-bars__value">{item.value}</span>
          <div className="risk-summary-bars__bar-bg">
            <div
              className={`risk-summary-bars__bar risk-summary-bars__bar--${item.variant}`}
              style={{ height: `${(item.value / MAX) * 100}%` }}
            />
          </div>
          <span className="risk-summary-bars__label">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export default RiskSummaryBars
