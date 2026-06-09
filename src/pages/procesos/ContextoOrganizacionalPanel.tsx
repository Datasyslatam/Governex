import React, { useState } from 'react'
import { DatosEmpresa } from '../../context/AIAnalysisContext'
import './ContextoOrganizacionalPanel.css'

interface Props {
  datos:    DatosEmpresa
  onEditar: () => void
}

const SeccionDatos: React.FC<{ titulo:string; icon:string; items:{label:string;value:string}[] }> = ({ titulo, icon, items }) => {
  const activos = items.filter(i => i.value?.trim())
  if (!activos.length) return null
  return (
    <div className="cop-seccion">
      <h4 className="cop-seccion__titulo"><span>{icon}</span> {titulo}</h4>
      <div className="cop-seccion__grid">
        {activos.map(item => (
          <div className="cop-dato" key={item.label}>
            <span className="cop-dato__label">{item.label}</span>
            <span className="cop-dato__value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const ContextoOrganizacionalPanel: React.FC<Props> = ({ datos, onEditar }) => {
  const [expandido, setExpandido] = useState(true)

  return (
    <div className="cop-wrapper">
      <div className="cop-header">
        <div className="cop-header__left">
          <span className="cop-header__icon">🏢</span>
          <div>
            <h3 className="cop-header__title">{datos.nombreEmpresa || 'Organización'}</h3>
            <div className="cop-header__chips">
              {datos.sector      && <span className="cop-chip cop-chip--sector">{datos.sector}</span>}
              {datos.tipoEmpresa && <span className="cop-chip cop-chip--tipo">{datos.tipoEmpresa}</span>}
              {datos.tamano      && <span className="cop-chip cop-chip--tamano">{datos.tamano}</span>}
              {datos.ubicacion   && <span className="cop-chip cop-chip--ubic">📍 {datos.ubicacion}</span>}
            </div>
          </div>
        </div>
        <div className="cop-header__actions">
          <button className="cop-btn-edit" onClick={onEditar}>✏️ Editar</button>
          <button className="cop-btn-toggle" onClick={() => setExpandido(v => !v)}>
            {expandido ? '▲ Colapsar' : '▼ Ver datos'}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="cop-body">
          <div className="cop-datos">
            <SeccionDatos titulo="Identidad" icon="🏢" items={[
              { label:'Nombre',           value: datos.nombreEmpresa },
              { label:'Tipo',             value: datos.tipoEmpresa },
              { label:'Sector',           value: datos.sector },
              { label:'Tamaño',           value: datos.tamano },
              { label:'Ubicación',        value: datos.ubicacion },
              { label:'Año de fundación', value: datos.anoFundacion },
              { label:'N.º empleados',    value: datos.cantidadEmpleados },
              { label:'Certificaciones',  value: datos.certificaciones },
            ]} />

            <SeccionDatos titulo="Direccionamiento Estratégico" icon="🧭" items={[
              { label:'Misión',              value: datos.mision },
              { label:'Visión',              value: datos.vision },
              { label:'Política de Calidad', value: datos.politicaCalidad },
            ]} />

            <SeccionDatos titulo="Productos / Servicios y Mercado" icon="⚙️" items={[
              { label:'Productos / Servicios', value: datos.productosServicios },
              { label:'Mercado objetivo',       value: datos.mercadoObjetivo },
              { label:'Partes interesadas',     value: datos.parteInteresadas },
            ]} />

            <SeccionDatos titulo="Sistema de Gestión de Calidad" icon="📋" items={[
              { label:'Alcance del SGC', value: datos.alcanceSGC },
            ]} />
          </div>

          {datos.contextoNarrativo && (
            <div className="cop-narrativo">
              <div className="cop-narrativo__header">
                <span className="cop-narrativo__icon">🤖</span>
                <div>
                  <h4>Análisis del Contexto Organizacional</h4>
                  <p>Generado por Governex a partir de la información proporcionada</p>
                </div>
              </div>
              <div className="cop-narrativo__content">
                {datos.contextoNarrativo.split('\n').map((linea, i) => {
                  const t = linea.trim()
                  if (!t) return null
                  if (t.startsWith('##') || t.startsWith('# '))
                    return <h5 key={i} className="cop-narrativo__h5">{t.replace(/^#+\s*/,'')}</h5>
                  if (t.startsWith('- ') || t.startsWith('• '))
                    return <li key={i} className="cop-narrativo__li">{t.replace(/^[-•]\s*/,'')}</li>
                  if (/^\*\*[^*]+\*\*/.test(t))
                    return <p key={i} className="cop-narrativo__p" dangerouslySetInnerHTML={{ __html: t.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>') }} />
                  return <p key={i} className="cop-narrativo__p">{t}</p>
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ContextoOrganizacionalPanel