import React, { useState } from "react";
import "./ProcesosPage.css";

/* ─────────────────────────── TIPOS ─────────────────────────── */
type Tab = "mapa" | "contexto" | "caracterizacion";

/* ─────────────────── DATOS: MAPA DE PROCESOS ───────────────── */
const procesosEstrategicos = [
  { codigo: "PE-01", nombre: "Gestión de la Dirección", clausula: "Cap. 5", icon: "🏛️", desc: "Liderazgo, política de calidad, revisión por la dirección y roles organizacionales." },
  { codigo: "PE-02", nombre: "Planificación del SGC", clausula: "Cap. 6", icon: "🎯", desc: "Planificación de objetivos, gestión de riesgos y oportunidades, cambios en el sistema." },
  { codigo: "PE-03", nombre: "Mejora Continua", clausula: "Cap. 10", icon: "🔄", desc: "No conformidades, acciones correctivas, innovación y mejora del SGC." },
];

const procesosOperativos = [
  { codigo: "PO-01", nombre: "Ventas y Gestión Comercial", clausula: "Cap. 8.2", icon: "📞", desc: "Determinación de requisitos del cliente, cotizaciones y revisión de contratos." },
  { codigo: "PO-02", nombre: "Diseño y Desarrollo", clausula: "Cap. 8.3", icon: "✏️", desc: "Planificación, entradas, controles y salidas del diseño de productos/servicios." },
  { codigo: "PO-03", nombre: "Compras y Proveedores", clausula: "Cap. 8.4", icon: "📦", desc: "Selección, evaluación y reevaluación de proveedores externos. Control de compras." },
  { codigo: "PO-04", nombre: "Producción / Prestación", clausula: "Cap. 8.5", icon: "⚙️", desc: "Control de producción, trazabilidad, propiedad del cliente y preservación del producto." },
  { codigo: "PO-05", nombre: "Control del Servicio NC", clausula: "Cap. 8.7", icon: "🚫", desc: "Tratamiento de productos y servicios no conformes." },
];

const procesosApoyo = [
  { codigo: "PA-01", nombre: "Gestión del Talento Humano", clausula: "Cap. 7.1-7.2", icon: "👥", desc: "Competencia, formación y toma de conciencia del personal." },
  { codigo: "PA-02", nombre: "Gestión de Infraestructura", clausula: "Cap. 7.1.3", icon: "🏭", desc: "Mantenimiento de instalaciones, equipos y tecnología de apoyo." },
  { codigo: "PA-03", nombre: "Control de Documentos", clausula: "Cap. 7.5", icon: "📄", desc: "Creación, actualización, control y distribución de información documentada." },
  { codigo: "PA-04", nombre: "Auditorías Internas", clausula: "Cap. 9.2", icon: "🔍", desc: "Programa de auditorías, criterios, hallazgos e informes de auditoría." },
  { codigo: "PA-05", nombre: "Gestión de Indicadores", clausula: "Cap. 9.1", icon: "📊", desc: "Seguimiento, medición, análisis y evaluación del desempeño del SGC." },
];

/* ─────────────────── DATOS: PESTEL ─────────────────────────── */
type Impacto = "Alto" | "Medio" | "Bajo";
interface PestelRow {
  factor: string;
  categoria: string;
  descripcion: string;
  impacto: Impacto;
  oportunidad: boolean;
}

const pestelData: PestelRow[] = [
  { factor: "P", categoria: "Político", descripcion: "Requisitos legales de certificación ISO exigidos por licitaciones públicas y contratos con el Estado.", impacto: "Alto", oportunidad: true },
  { factor: "P", categoria: "Político", descripcion: "Cambios en regulaciones de comercio exterior que afectan la cadena de suministro de proveedores.", impacto: "Medio", oportunidad: false },
  { factor: "E", categoria: "Económico", descripcion: "Inflación en materias primas que incrementa costos de producción y presiona márgenes operativos.", impacto: "Alto", oportunidad: false },
  { factor: "E", categoria: "Económico", descripcion: "Crecimiento del mercado objetivo con aumento de demanda en un 12% proyectado para el año.", impacto: "Alto", oportunidad: true },
  { factor: "S", categoria: "Social", descripcion: "Mayor conciencia del cliente sobre calidad y sostenibilidad, exigiendo trazabilidad de productos.", impacto: "Medio", oportunidad: true },
  { factor: "S", categoria: "Social", descripcion: "Alta rotación de personal técnico especializado en el sector.", impacto: "Medio", oportunidad: false },
  { factor: "T", categoria: "Tecnológico", descripcion: "Digitalización de procesos mediante ERP y herramientas de gestión documental en la nube.", impacto: "Alto", oportunidad: true },
  { factor: "T", categoria: "Tecnológico", descripcion: "Ciberataques e interrupciones de sistemas de información.", impacto: "Medio", oportunidad: false },
  { factor: "A", categoria: "Ecológico", descripcion: "Normativas ambientales ISO 14001 que pueden integrarse con el SGC para valor agregado.", impacto: "Medio", oportunidad: true },
  { factor: "L", categoria: "Legal", descripcion: "Cumplimiento de normas técnicas y regulaciones sectoriales vigentes.", impacto: "Alto", oportunidad: false },
];

/* ─────────────────── DATOS: DOFA ─────────────────────────── */
const dofaData = {
  fortalezas: [
    "SGC implementado y validado en toda la cadena de valor",
    "Equipo técnico con alta competencia y experiencia",
    "Procesos documentados y estandarizados",
    "Alta satisfacción del cliente (índice > 90%)",
    "Infraestructura moderna y capacidad instalada suficiente",
  ],
  oportunidades: [
    "Expansión a nuevos mercados con certificación como ventaja",
    "Digitalización de procesos para reducir costos operativos",
    "Alianzas estratégicas con proveedores certificados",
    "Crecimiento de la demanda en el segmento objetivo",
    "Integración futura con ISO 14001 e ISO 45001",
  ],
  debilidades: [
    "Dependencia de pocos proveedores críticos sin alternativa",
    "Alta rotación del personal en áreas operativas",
    "Baja madurez en indicadores de proceso de apoyo",
    "Tiempo de respuesta a no conformidades superior al objetivo",
    "Capacitación insuficiente en normativa actualizada",
  ],
  amenazas: [
    "Cambios regulatorios que requieren adaptación rápida del SGC",
    "Competidores con certificación y precios más bajos",
    "Volatilidad económica que afecta la inversión en calidad",
    "Incumplimiento de proveedores en tiempos de entrega",
    "Ciberataques a sistemas de información documentada",
  ],
};

/* ─────────────────── DATOS: CARACTERIZACIÓN ─────────────────── */
interface ProcChar {
  codigo: string;
  proceso: string;
  objetivo: string;
  entradas: string;
  salidas: string;
  indicador: string;
  responsable: string;
  estado: "Activo" | "Revisión" | "Inactivo";
}

const caracterizacionData: ProcChar[] = [
  {
    codigo: "PE-01",
    proceso: "Gestión de la Dirección",
    objetivo: "Asegurar el liderazgo y compromiso de la alta dirección con el SGC",
    entradas: "Resultados auditorías, retroalim. cliente, indicadores",
    salidas: "Política de calidad, objetivos, actas de revisión",
    indicador: "% cumplimiento objetivos calidad",
    responsable: "Gerente General",
    estado: "Activo",
  },
  {
    codigo: "PE-02",
    proceso: "Planificación del SGC",
    objetivo: "Establecer acciones para abordar riesgos y lograr objetivos de calidad",
    entradas: "Contexto organizacional, DOFA, PESTEL",
    salidas: "Matriz de riesgos, plan de acción, objetivos de calidad",
    indicador: "% riesgos con plan de tratamiento",
    responsable: "Dir. de Calidad",
    estado: "Activo",
  },
  {
    codigo: "PO-01",
    proceso: "Ventas y Gestión Comercial",
    objetivo: "Captar y gestionar requisitos del cliente asegurando su satisfacción",
    entradas: "Solicitud del cliente, catálogo, tarifas",
    salidas: "Pedido confirmado, contrato, oferta",
    indicador: "Índice de satisfacción del cliente",
    responsable: "Dir. Comercial",
    estado: "Activo",
  },
  {
    codigo: "PO-02",
    proceso: "Diseño y Desarrollo",
    objetivo: "Transformar requisitos en especificaciones de producto/servicio verificadas",
    entradas: "Requisitos cliente, normativas técnicas",
    salidas: "Especificaciones, planos, prototipos validados",
    indicador: "% diseños aprobados sin reproceso",
    responsable: "Jefe de Ingeniería",
    estado: "Activo",
  },
  {
    codigo: "PO-03",
    proceso: "Compras y Proveedores",
    objetivo: "Garantizar la calidad de los insumos y servicios adquiridos externamente",
    entradas: "Requisición de compra, lista de proveedores aprobados",
    salidas: "Orden de compra, evaluación de proveedor",
    indicador: "% proveedores evaluados favorablemente",
    responsable: "Jefe de Compras",
    estado: "Activo",
  },
  {
    codigo: "PO-04",
    proceso: "Producción / Prestación",
    objetivo: "Producir bienes/servicios conformes con los requisitos establecidos",
    entradas: "Orden de producción, materias primas, especificaciones",
    salidas: "Producto terminado, registros de control",
    indicador: "% productos conformes en primera inspección",
    responsable: "Jefe de Producción",
    estado: "Activo",
  },
  {
    codigo: "PA-01",
    proceso: "Gestión del Talento Humano",
    objetivo: "Mantener la competencia del personal para satisfacer los requisitos del SGC",
    entradas: "Perfil de cargos, brechas de competencia, plan de formación",
    salidas: "Registros de formación, evaluaciones de desempeño",
    indicador: "% personal con competencias verificadas",
    responsable: "Dir. RRHH",
    estado: "Activo",
  },
  {
    codigo: "PA-03",
    proceso: "Control de Documentos",
    objetivo: "Asegurar la disponibilidad, idoneidad y protección de la información documentada",
    entradas: "Solicitud de creación/modificación de documento",
    salidas: "Documentos aprobados, listado maestro actualizado",
    indicador: "% documentos vigentes vs. total emitidos",
    responsable: "Coord. de Calidad",
    estado: "Activo",
  },
  {
    codigo: "PA-04",
    proceso: "Auditorías Internas",
    objetivo: "Verificar la conformidad y eficacia del SGC a través de auditorías planificadas",
    entradas: "Programa de auditorías, criterios, evidencia objetiva",
    salidas: "Informe de auditoría, hallazgos, acciones correctivas",
    indicador: "% hallazgos cerrados en el plazo",
    responsable: "Auditor Líder",
    estado: "Revisión",
  },
];

/* ─────────────────── COMPONENTE PRINCIPAL ─────────────────── */
const ProcesosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("mapa");

  return (
    <div className="page procesos-page">
      {/* ── Header ── */}
      <header className="page__header procesos-page__header">
        <div className="procesos-page__header-left">
          <nav className="procesos-page__breadcrumb">
            <span>Governex</span>
            <span className="procesos-page__bc-sep">›</span>
            <span>Cap. 4</span>
            <span className="procesos-page__bc-sep">›</span>
            <span className="procesos-page__bc-active">Contexto de la Organización</span>
          </nav>
          <h2>Gestión de Contexto y Procesos</h2>
          <p className="procesos-page__subtitle">
            Enfoque basado en procesos — Cláusulas 4, 6 y 8
          </p>
        </div>
        <div className="procesos-page__header-kpis">
          <div className="procesos-kpi">
            <span className="procesos-kpi__value">13</span>
            <span className="procesos-kpi__label">Procesos totales</span>
          </div>
          <div className="procesos-kpi">
            <span className="procesos-kpi__value">3</span>
            <span className="procesos-kpi__label">Estratégicos</span>
          </div>
          <div className="procesos-kpi">
            <span className="procesos-kpi__value">5</span>
            <span className="procesos-kpi__label">Operativos</span>
          </div>
          <div className="procesos-kpi">
            <span className="procesos-kpi__value">5</span>
            <span className="procesos-kpi__label">De Apoyo</span>
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <nav className="procesos-tabs">
        {([
          { id: "mapa", label: "🗺️ Mapa de Procesos" },
          { id: "contexto", label: "🌐 Contexto Organizacional" },
          { id: "caracterizacion", label: "📋 Caracterización" },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            className={`procesos-tabs__tab${activeTab === t.id ? " procesos-tabs__tab--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ══════════ TAB 1: MAPA DE PROCESOS ══════════ */}
      {activeTab === "mapa" && (
        <div className="procesos-mapa">
          {/* Flujo de valor */}
          <div className="procesos-mapa__flujo panel">
            <div className="procesos-mapa__flujo-item procesos-mapa__flujo-item--client">
              <span className="procesos-mapa__flujo-icon">👤</span>
              <strong>CLIENTE</strong>
              <span>Requisitos</span>
            </div>
            <div className="procesos-mapa__flujo-arrow">→</div>
            <div className="procesos-mapa__flujo-center">
              <div className="procesos-mapa__tier procesos-mapa__tier--estrategico">
                <span className="procesos-mapa__tier-label">PROCESOS ESTRATÉGICOS</span>
                <div className="procesos-mapa__cards">
                  {procesosEstrategicos.map(p => (
                    <ProcessCard key={p.codigo} {...p} tipo="estrategico" />
                  ))}
                </div>
              </div>
              <div className="procesos-mapa__tier procesos-mapa__tier--operativo">
                <span className="procesos-mapa__tier-label">PROCESOS OPERATIVOS / MISIONALES</span>
                <div className="procesos-mapa__cards">
                  {procesosOperativos.map(p => (
                    <ProcessCard key={p.codigo} {...p} tipo="operativo" />
                  ))}
                </div>
              </div>
              <div className="procesos-mapa__tier procesos-mapa__tier--apoyo">
                <span className="procesos-mapa__tier-label">PROCESOS DE APOYO</span>
                <div className="procesos-mapa__cards">
                  {procesosApoyo.map(p => (
                    <ProcessCard key={p.codigo} {...p} tipo="apoyo" />
                  ))}
                </div>
              </div>
            </div>
            <div className="procesos-mapa__flujo-arrow">→</div>
            <div className="procesos-mapa__flujo-item procesos-mapa__flujo-item--client">
              <span className="procesos-mapa__flujo-icon">😊</span>
              <strong>CLIENTE</strong>
              <span>Satisfacción</span>
            </div>
          </div>

          {/* Leyenda */}
          <div className="procesos-mapa__legend panel">
            <span className="procesos-mapa__legend-title">Convenciones:</span>
            <span className="procesos-mapa__badge procesos-mapa__badge--estrategico">Estratégico</span>
            <span className="procesos-mapa__badge procesos-mapa__badge--operativo">Operativo</span>
            <span className="procesos-mapa__badge procesos-mapa__badge--apoyo">Apoyo</span>
            <span className="procesos-mapa__legend-ref">· Referencia: Cap. 4.4</span>
          </div>
        </div>
      )}

      {/* ══════════ TAB 2: CONTEXTO ORGANIZACIONAL ══════════ */}
      {activeTab === "contexto" && (
        <div className="procesos-contexto">
          {/* PESTEL */}
          <section className="panel">
            <div className="procesos-section-header">
              <div>
                <h3 className="procesos-section-title">Análisis PESTEL</h3>
                <p className="procesos-section-desc">
                  Análisis del contexto externo de la organización · Cláusula 4.1
                </p>
              </div>
              <span className="pill pill--muted">10 factores identificados</span>
            </div>
            <div className="procesos-pestel__table-wrap">
              <table className="procesos-pestel__table">
                <thead>
                  <tr>
                    <th>Factor</th>
                    <th>Categoría</th>
                    <th>Descripción</th>
                    <th>Impacto</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {pestelData.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <span className={`pestel-factor pestel-factor--${row.factor.toLowerCase()}`}>
                          {row.factor}
                        </span>
                      </td>
                      <td className="pestel-categoria">{row.categoria}</td>
                      <td className="pestel-desc">{row.descripcion}</td>
                      <td>
                        <span className={`pill ${row.impacto === "Alto" ? "pill--danger" : row.impacto === "Medio" ? "pill--warning" : "pill--muted"}`}>
                          {row.impacto}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${row.oportunidad ? "pill--success" : "pill--danger"}`}>
                          {row.oportunidad ? "Oportunidad" : "Amenaza"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* DOFA */}
          <section className="panel">
            <div className="procesos-section-header">
              <div>
                <h3 className="procesos-section-title">Matriz DOFA</h3>
                <p className="procesos-section-desc">
                  Análisis del contexto interno y externo · Cláusula 4.1 y 6.1
                </p>
              </div>
            </div>
            <div className="dofa-grid">
              <DofaQuadrant
                title="Fortalezas"
                subtitle="Factores internos positivos"
                icon="💪"
                variant="fortaleza"
                items={dofaData.fortalezas}
              />
              <DofaQuadrant
                title="Oportunidades"
                subtitle="Factores externos positivos"
                icon="🚀"
                variant="oportunidad"
                items={dofaData.oportunidades}
              />
              <DofaQuadrant
                title="Debilidades"
                subtitle="Factores internos negativos"
                icon="⚠️"
                variant="debilidad"
                items={dofaData.debilidades}
              />
              <DofaQuadrant
                title="Amenazas"
                subtitle="Factores externos negativos"
                icon="🛡️"
                variant="amenaza"
                items={dofaData.amenazas}
              />
            </div>
          </section>
        </div>
      )}

      {/* ══════════ TAB 3: CARACTERIZACIÓN ══════════ */}
      {activeTab === "caracterizacion" && (
        <div className="procesos-char panel">
          <div className="procesos-section-header">
            <div>
              <h3 className="procesos-section-title">Caracterización de Procesos</h3>
              <p className="procesos-section-desc">
                Ficha de entradas, salidas e indicadores por proceso · Cláusula 4.4
              </p>
            </div>
            <span className="pill pill--muted">{caracterizacionData.length} procesos</span>
          </div>
          <div className="procesos-char__table-wrap">
            <table className="procesos-char__table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Proceso</th>
                  <th>Objetivo</th>
                  <th>Entradas</th>
                  <th>Salidas</th>
                  <th>Indicador</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {caracterizacionData.map((row, i) => (
                  <tr key={row.codigo} className={i % 2 === 1 ? "procesos-char__row--alt" : ""}>
                    <td className="procesos-char__code">{row.codigo}</td>
                    <td className="procesos-char__name">{row.proceso}</td>
                    <td className="procesos-char__objetivo">{row.objetivo}</td>
                    <td className="procesos-char__io">{row.entradas}</td>
                    <td className="procesos-char__io">{row.salidas}</td>
                    <td className="procesos-char__indicador">{row.indicador}</td>
                    <td className="procesos-char__resp">{row.responsable}</td>
                    <td>
                      <span className={`pill ${row.estado === "Activo" ? "pill--success" : row.estado === "Revisión" ? "pill--warning" : "pill--muted"}`}>
                        {row.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ────────────── SUB-COMPONENTES ────────────── */
interface ProcessCardProps {
  codigo: string;
  nombre: string;
  clausula: string;
  icon: string;
  desc: string;
  tipo: "estrategico" | "operativo" | "apoyo";
}

const ProcessCard: React.FC<ProcessCardProps> = ({ codigo, nombre, clausula, icon, desc, tipo }) => (
  <div className={`proc-card proc-card--${tipo}`}>
    <div className="proc-card__top">
      <span className="proc-card__icon">{icon}</span>
      <span className="proc-card__clausula">{clausula}</span>
    </div>
    <div className="proc-card__codigo">{codigo}</div>
    <div className="proc-card__nombre">{nombre}</div>
    <div className="proc-card__desc">{desc}</div>
  </div>
);

interface DofaQuadrantProps {
  title: string;
  subtitle: string;
  icon: string;
  variant: "fortaleza" | "oportunidad" | "debilidad" | "amenaza";
  items: string[];
}

const DofaQuadrant: React.FC<DofaQuadrantProps> = ({ title, subtitle, icon, variant, items }) => (
  <div className={`dofa-quadrant dofa-quadrant--${variant}`}>
    <div className="dofa-quadrant__header">
      <span className="dofa-quadrant__icon">{icon}</span>
      <div>
        <div className="dofa-quadrant__title">{title}</div>
        <div className="dofa-quadrant__subtitle">{subtitle}</div>
      </div>
    </div>
    <ul className="dofa-quadrant__list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  </div>
);

export default ProcesosPage;
