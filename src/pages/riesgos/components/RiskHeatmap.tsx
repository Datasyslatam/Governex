import React from 'react'
import './RiskHeatmap.css'
import { RiesgoDerivado } from '../../../context/AIAnalysisContext'

interface Props {
  riesgos: RiesgoDerivado[]
}

// Color de celda según P × I
function cellLevel(prob: number, imp: number): string {
  const n = prob * imp
  if (n >= 15) return 'critical'
  if (n >= 9)  return 'high'
  if (n >= 4)  return 'medium'
  return 'low'
}

const RiskHeatmap: React.FC<Props> = ({ riesgos }) => {
  const soloRiesgos = riesgos.filter(r => r.tipo === 'Riesgo')

  const getDotsAt = (probRow: number, impCol: number) =>
    soloRiesgos.filter(r => r.probabilidad === probRow && r.impacto === impCol)

  return (
    <div className="risk-heatmap">
      <div className="risk-heatmap__main">
        {/* Y axis */}
        <div className="risk-heatmap__y-axis">
          <span className="risk-heatmap__axis-title">PROB.</span>
          {[5, 4, 3, 2, 1].map(p => (
            <span key={p} className="risk-heatmap__row-label">{p}</span>
          ))}
        </div>

        {/* Grid */}
        <div className="risk-heatmap__grid-wrapper">
          <div className="risk-heatmap__grid">
            {[5, 4, 3, 2, 1].map(probRow => (
              <div className="risk-heatmap__row" key={probRow}>
                {[1, 2, 3, 4, 5].map(impCol => {
                  const dots = getDotsAt(probRow, impCol)
                  return (
                    <div
                      key={impCol}
                      className={`risk-heatmap__cell risk-heatmap__cell--${cellLevel(probRow, impCol)}`}
                      title={`P=${probRow} × I=${impCol} = ${probRow * impCol}`}
                    >
                      {dots.slice(0, 3).map(d => (
                        <span key={d.codigo} className="risk-heatmap__dot" title={d.descripcion.substring(0, 80)}>
                          {d.codigo.replace(/(R|OP)-0*/, '$1')}
                        </span>
                      ))}
                      {dots.length > 3 && (
                        <span className="risk-heatmap__dot" title={`+${dots.length - 3} más`}>
                          +{dots.length - 3}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="risk-heatmap__col-labels">
            {[1, 2, 3, 4, 5].map(i => <span key={i}>{i}</span>)}
          </div>
          <div className="risk-heatmap__x-axis-title">IMPACTO</div>
        </div>
      </div>

      <div className="risk-heatmap__legend-row">
        <span className="risk-heatmap__legend-item risk-heatmap__legend-item--low">Bajo (1–3)</span>
        <span className="risk-heatmap__legend-item risk-heatmap__legend-item--medium">Medio (4–8)</span>
        <span className="risk-heatmap__legend-item risk-heatmap__legend-item--high">Alto (9–14)</span>
        <span className="risk-heatmap__legend-item risk-heatmap__legend-item--critical">Crítico (≥15)</span>
      </div>
    </div>
  )
}

export default RiskHeatmap
