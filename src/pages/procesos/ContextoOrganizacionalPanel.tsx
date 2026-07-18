/**
 * ContextoOrganizacionalPanel.tsx — Governex · ISO 9001:2015
 *
 * Muestra el contexto completo de la organización incluyendo:
 * - Identidad (Sección 1)
 * - Misión, Visión y Política de Calidad (generadas por IA)
 * - Contexto operacional: productos, mercado, partes interesadas, alcance SGC
 * - Narrativo de contexto (si lo generó Gemini)
 */

import React, { useState } from 'react'
import { DatosEmpresa } from '../../context/AIAnalysisContext'
import { usePermissions } from '../../hooks/usePermissions'
import './ContextoOrganizacionalPanel.css'

/* ── Props ─────────────────────────────────────────────────── */
interface Props {
  datos: DatosEmpresa
  onEditar?: () => void
}

/* ── Helpers de presentación ────────────────────────────────── */
const Badge: React.FC<{ label: string; variant?: 'blue' | 'navy' | 'green' | 'gray' }> = ({
  label, variant = 'gray',
}) => <span className={`ctx-badge ctx-badge--${variant}`}>{label}</span>

const InfoChip: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) =>
  value ? (
    <div className="ctx-chip">
      <span className="ctx-chip__icon">{icon}</span>
      <div>
        <div className="ctx-chip__label">{label}</div>
        <div className="ctx-chip__value">{value}</div>
      </div>
    </div>
  ) : null

const TextBlock: React.FC<{
  icon: string
  title: string
  subtitle: string
  text: string
  variant?: 'mision' | 'vision' | 'politica'
  badgeLabel?: string
}> = ({ icon, title, subtitle, text, variant = 'mision', badgeLabel }) => (
  <div className={`ctx-textblock ctx-textblock--${variant}`}>
    <div className="ctx-textblock__header">
      <span className="ctx-textblock__icon">{icon}</span>
      <div className="ctx-textblock__titles">
        <div className="ctx-textblock__title">{title}</div>
        <div className="ctx-textblock__subtitle">{subtitle}</div>
      </div>
      {badgeLabel && <span className="ctx-textblock__badge">{badgeLabel}</span>}
    </div>
    <p className="ctx-textblock__body">{text || <em className="ctx-empty">No definida aún.</em>}</p>
  </div>
)

const SectionHeader: React.FC<{ icon: string; title: string; clause?: string }> = ({
  icon, title, clause,
}) => (
  <div className="ctx-section-header">
    <span className="ctx-section-header__icon">{icon}</span>
    <h4 className="ctx-section-header__title">{title}</h4>
    {clause && <span className="ctx-section-header__clause">{clause}</span>}
  </div>
)

/* ── Bloque de texto con área expandible ────────────────────── */
const ExpandableText: React.FC<{ label: string; text: string }> = ({ label, text }) => {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 220

  return (
    <div className="ctx-expandable">
      <div className="ctx-expandable__label">{label}</div>
      <p className={`ctx-expandable__text ${!expanded && isLong ? 'ctx-expandable__text--clamped' : ''}`}>
        {text || <em className="ctx-empty">No especificado.</em>}
      </p>
      {isLong && (
        <button className="ctx-expandable__toggle" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Ver menos ▲' : 'Ver más ▼'}
        </button>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════════════ */
const ContextoOrganizacionalPanel: React.FC<Props> = ({ datos, onEditar }) => {
  const tieneIdeario = !!(datos.mision || datos.vision || datos.politicaCalidad)
  const tieneNarrativo = !!(datos.contextoNarrativo)
  const { canEdit } = usePermissions('procesos')

  return (
    <div className="ctx-panel">

      {/* ── ENCABEZADO DE LA EMPRESA ──────────────────────────── */}
      <div className="ctx-header">
        <div className="ctx-header__main">
          <div className="ctx-header__name-row">
            <h3 className="ctx-header__name">{datos.nombreEmpresa || 'Empresa sin nombre'}</h3>
            {datos.tipoEmpresa && <Badge label={datos.tipoEmpresa} variant="navy" />}
            {datos.sector && <Badge label={datos.sector} variant="blue" />}
          </div>
          <div className="ctx-header__chips">
            <InfoChip icon="📍" label="Ubicación"      value={datos.ubicacion        ?? ''} />
            <InfoChip icon="📅" label="Fundación"      value={datos.anoFundacion     ?? ''} />
            <InfoChip icon="👥" label="Empleados"      value={datos.cantidadEmpleados ?? ''} />
            <InfoChip icon="📏" label="Tamaño"         value={datos.tamano           ?? ''} />
            <InfoChip icon="🏅" label="Certificaciones" value={datos.certificaciones  ?? ''} />
          </div>
        </div>
        {onEditar && (
          <button
            className="ctx-header__edit-btn"
            onClick={canEdit ? onEditar : undefined}
            disabled={!canEdit}
            title={!canEdit ? 'Tu rol no tiene permiso para esta acción' : "Re-analizar con Governex IA"}
          >
            🔄 Re-analizar
          </button>
        )}
      </div>

      {/* ── MISIÓN · VISIÓN · POLÍTICA DE CALIDAD ─────────────── */}
      {tieneIdeario ? (
        <section className="ctx-section">
          <SectionHeader
            icon="✨"
            title="Ideario Estratégico"
            clause="Cláusula 5.2"
          />
          <div className="ctx-ideario-grid">
            <TextBlock
              icon="🎯"
              title="Misión"
              subtitle="Razón de ser de la organización"
              text={datos.mision ?? ''}
              variant="mision"
            />
            <TextBlock
              icon="🚀"
              title="Visión"
              subtitle="Proyección a 5–10 años"
              text={datos.vision ?? ''}
              variant="vision"
            />
            <TextBlock
              icon="📜"
              title="Política de Calidad"
              subtitle="Compromiso con la excelencia operativa y la mejora continua"
              text={datos.politicaCalidad ?? ''}
              variant="politica"
            />
          </div>
        </section>
      ) : (
        <div className="ctx-ideario-empty">
          <span>💡</span>
          <span>
            La Misión, Visión y Política de Calidad se generarán automáticamente al cargar el formulario PDF de la empresa.
          </span>
        </div>
      )}

      {/* ── CONTEXTO NARRATIVO (Gemini) ───────────────────────── */}
      {tieneNarrativo && (
        <section className="ctx-section">
          <SectionHeader icon="📝" title="Contexto Narrativo" clause="Cláusula 4.1" />
          <div className="ctx-narrativo">
            <ExpandableText label="" text={datos.contextoNarrativo ?? ''} />
          </div>
        </section>
      )}

      {/* ── CONTEXTO OPERACIONAL ──────────────────────────────── */}
      <section className="ctx-section">
        <SectionHeader icon="🏭" title="Contexto Operacional" clause="Cláusulas 4.2, 4.3 y 8" />
        <div className="ctx-operacional-grid">
          <ExpandableText
            label="🛒 Productos y/o Servicios"
            text={datos.productosServicios ?? ''}
          />
          <ExpandableText
            label="🎯 Mercado Objetivo"
            text={datos.mercadoObjetivo ?? ''}
          />
          <ExpandableText
            label="🤝 Partes Interesadas"
            text={datos.parteInteresadas ?? ''}
          />
          <ExpandableText
            label="🔭 Alcance del SGC"
            text={datos.alcanceSGC ?? ''}
          />
        </div>
      </section>

    </div>
  )
}

export default ContextoOrganizacionalPanel