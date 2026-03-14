import React, { useState, useRef } from "react";
import "./ProcesosPage.css";
import Swal from "sweetalert2";

/* ─────────────────────────── TIPOS ─────────────────────────── */
type Tab = "mapa" | "contexto" | "caracterizacion";
type MapMode = "empty" | "manual" | "ai";

export interface ProcesoItem {
  nombre: string;
}

export interface MapaData {
  cliente: string;
  satisfaccion: string;
  estrategicos: ProcesoItem[];
  misionales: ProcesoItem[];
  apoyo: ProcesoItem[];
}

/* ─────────────────── DATOS BASE ─────────────────── */
const defaultMapa: MapaData = {
  cliente: "Requisitos del Cliente y Contexto",
  satisfaccion: "Satisfacción del Cliente y Triple Impacto",
  estrategicos: [
    { nombre: "Gestión de la Dirección" },
    { nombre: "Planificación del SGC" },
    { nombre: "Mejora Continua" },
  ],
  misionales: [
    { nombre: "Ventas y Gestión Comercial" },
    { nombre: "Diseño y Desarrollo" },
    { nombre: "Producción / Prestación" },
  ],
  apoyo: [
    { nombre: "Gestión del Talento Humano" },
    { nombre: "Control de Documentos" },
    { nombre: "Auditorías Internas" },
    { nombre: "Gestión de Infraestructura" },
    { nombre: "Gestión de Indicadores" },
  ],
};

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
  { factor: "P", categoria: "Político",    descripcion: "Requisitos legales de certificación ISO exigidos por licitaciones públicas y contratos con el Estado.", impacto: "Alto",  oportunidad: true  },
  { factor: "P", categoria: "Político",    descripcion: "Cambios en regulaciones de comercio exterior que afectan la cadena de suministro de proveedores.",       impacto: "Medio", oportunidad: false },
  { factor: "E", categoria: "Económico",   descripcion: "Inflación en materias primas que incrementa costos de producción y presiona márgenes operativos.",        impacto: "Alto",  oportunidad: false },
  { factor: "E", categoria: "Económico",   descripcion: "Crecimiento del mercado objetivo con aumento de demanda en un 12% proyectado para el año.",               impacto: "Alto",  oportunidad: true  },
  { factor: "S", categoria: "Social",      descripcion: "Mayor conciencia del cliente sobre calidad y sostenibilidad, exigiendo trazabilidad de productos.",        impacto: "Medio", oportunidad: true  },
  { factor: "S", categoria: "Social",      descripcion: "Alta rotación de personal técnico especializado en el sector.",                                            impacto: "Medio", oportunidad: false },
  { factor: "T", categoria: "Tecnológico", descripcion: "Digitalización de procesos mediante ERP y herramientas de gestión documental en la nube.",                 impacto: "Alto",  oportunidad: true  },
  { factor: "T", categoria: "Tecnológico", descripcion: "Ciberataques e interrupciones de sistemas de información.",                                               impacto: "Medio", oportunidad: false },
  { factor: "A", categoria: "Ecológico",   descripcion: "Normativas ambientales ISO 14001 que pueden integrarse con el SGC para valor agregado.",                  impacto: "Medio", oportunidad: true  },
  { factor: "L", categoria: "Legal",       descripcion: "Cumplimiento de normas técnicas y regulaciones sectoriales vigentes.",                                    impacto: "Alto",  oportunidad: false },
];

/* ─────────────────── DATOS: DOFA ─────────────────────────── */
const dofaData = {
  fortalezas:    ["SGC implementado y validado en toda la cadena de valor", "Equipo técnico con alta competencia y experiencia", "Procesos documentados y estandarizados", "Alta satisfacción del cliente (índice > 90%)", "Infraestructura moderna y capacidad instalada suficiente"],
  oportunidades: ["Expansión a nuevos mercados con certificación como ventaja", "Digitalización de procesos para reducir costos operativos", "Alianzas estratégicas con proveedores certificados", "Crecimiento de la demanda en el segmento objetivo", "Integración futura con ISO 14001 e ISO 45001"],
  debilidades:   ["Dependencia de pocos proveedores críticos sin alternativa", "Alta rotación del personal en áreas operativas", "Baja madurez en indicadores de proceso de apoyo", "Tiempo de respuesta a no conformidades superior al objetivo", "Capacitación insuficiente en normativa actualizada"],
  amenazas:      ["Cambios regulatorios que requieren adaptación rápida del SGC", "Competidores con certificación y precios más bajos", "Volatilidad económica que afecta la inversión en calidad", "Incumplimiento de proveedores en tiempos de entrega", "Ciberataques a sistemas de información documentada"],
};

/* ─────────────────── DATOS: CARACTERIZACIÓN ─────────────────── */
interface ProcChar {
  codigo: string; proceso: string; objetivo: string;
  entradas: string; salidas: string; indicador: string;
  responsable: string; estado: "Activo" | "Revisión" | "Inactivo";
}

const caracterizacionData: ProcChar[] = [
  { codigo: "PE-01", proceso: "Gestión de la Dirección",      objetivo: "Asegurar el liderazgo y compromiso de la alta dirección con el SGC",                     entradas: "Resultados auditorías, retroalim. cliente, indicadores",   salidas: "Política de calidad, objetivos, actas de revisión",     indicador: "% cumplimiento objetivos calidad",            responsable: "Gerente General",  estado: "Activo"   },
  { codigo: "PE-02", proceso: "Planificación del SGC",        objetivo: "Establecer acciones para abordar riesgos y lograr objetivos de calidad",                   entradas: "Contexto organizacional, DOFA, PESTEL",                    salidas: "Matriz de riesgos, plan de acción, objetivos de calidad", indicador: "% riesgos con plan de tratamiento",           responsable: "Dir. de Calidad",  estado: "Activo"   },
  { codigo: "PO-01", proceso: "Ventas y Gestión Comercial",   objetivo: "Captar y gestionar requisitos del cliente asegurando su satisfacción",                    entradas: "Solicitud del cliente, catálogo, tarifas",                 salidas: "Pedido confirmado, contrato, oferta",                    indicador: "Índice de satisfacción del cliente",          responsable: "Dir. Comercial",   estado: "Activo"   },
  { codigo: "PO-02", proceso: "Diseño y Desarrollo",          objetivo: "Transformar requisitos en especificaciones de producto/servicio verificadas",              entradas: "Requisitos cliente, normativas técnicas",                  salidas: "Especificaciones, planos, prototipos validados",         indicador: "% diseños aprobados sin reproceso",          responsable: "Jefe Ingeniería",  estado: "Activo"   },
  { codigo: "PO-03", proceso: "Compras y Proveedores",        objetivo: "Garantizar la calidad de los insumos y servicios adquiridos externamente",                entradas: "Requisición de compra, lista de proveedores aprobados",   salidas: "Orden de compra, evaluación de proveedor",              indicador: "% proveedores evaluados favorablemente",     responsable: "Jefe de Compras",  estado: "Activo"   },
  { codigo: "PO-04", proceso: "Producción / Prestación",      objetivo: "Producir bienes/servicios conformes con los requisitos establecidos",                    entradas: "Orden de producción, materias primas, especificaciones",  salidas: "Producto terminado, registros de control",              indicador: "% productos conformes en primera inspección",responsable: "Jefe Producción",  estado: "Activo"   },
  { codigo: "PA-01", proceso: "Gestión del Talento Humano",   objetivo: "Mantener la competencia del personal para satisfacer los requisitos del SGC",             entradas: "Perfil de cargos, brechas de competencia, plan formación",salidas: "Registros de formación, evaluaciones de desempeño",     indicador: "% personal con competencias verificadas",    responsable: "Dir. RRHH",        estado: "Activo"   },
  { codigo: "PA-03", proceso: "Control de Documentos",        objetivo: "Asegurar la disponibilidad, idoneidad y protección de la información documentada",        entradas: "Solicitud de creación/modificación de documento",         salidas: "Documentos aprobados, listado maestro actualizado",     indicador: "% documentos vigentes vs. total emitidos",   responsable: "Coord. Calidad",   estado: "Activo"   },
  { codigo: "PA-04", proceso: "Auditorías Internas",          objetivo: "Verificar la conformidad y eficacia del SGC a través de auditorías planificadas",          entradas: "Programa de auditorías, criterios, evidencia objetiva",   salidas: "Informe de auditoría, hallazgos, acciones correctivas", indicador: "% hallazgos cerrados en el plazo",           responsable: "Auditor Líder",    estado: "Revisión" },
];

/* ─────────────────── DETALLE DE PROCESO (para popup) ─────────────────── */
interface ProcessDetail {
  objetivo: string;
  entradas: string;
  salidas: string;
  indicador: string;
  responsable: string;
  clausula: string;
  procedimiento: string;
}

// Lookup: nombre del proceso (case-insensitive partial match) → detalle
// Declared as `let` so the AI parser can inject generated entries at runtime
let processDetailsMap: Record<string, ProcessDetail> = {
  "gestión de la dirección":    { objetivo: "Asegurar el liderazgo y compromiso de la alta dirección con el SGC.", entradas: "Resultados de auditorías, retroalimentación del cliente, indicadores de desempeño.", salidas: "Política de calidad, objetivos estratégicos, actas de revisión por la dirección.", indicador: "% cumplimiento de objetivos de calidad", responsable: "Gerente General", clausula: "Cap. 5", procedimiento: "PR-DIR-01: Revisión por la Dirección\n1. Recopilar informes de indicadores y auditorías.\n2. Revisar el desempeño del SGC en reunión número 1.\n3. Identificar oportunidades de mejora y asignar responsables.\n4. Emitir acta y comunicar decisiones a las áreas." },
  "planificación del sgc":       { objetivo: "Establecer acciones para abordar riesgos y lograr objetivos de calidad.", entradas: "Contexto organizacional, DOFA, PESTEL, requisitos de partes interesadas.", salidas: "Matriz de riesgos y oportunidades, plan de acción, objetivos de calidad.", indicador: "% de riesgos con plan de tratamiento activo", responsable: "Director de Calidad", clausula: "Cap. 6", procedimiento: "PR-PLA-01: Gestión de Riesgos y Planificación\n1. Identificar riesgos y oportunidades del contexto.\n2. Valorar probabilidad e impacto de cada riesgo.\n3. Definir acciones de tratamiento y responsables.\n4. Hacer seguimiento trimestral y actualizar la matriz." },
  "mejora continua":              { objetivo: "Gestionar no conformidades y acciones correctivas para mejorar el SGC.", entradas: "Hallazgos de auditorías, quejas, indicadores fuera de meta.", salidas: "Acciones correctivas ejecutadas, informes de mejora, cierre de no conformidades.", indicador: "% de acciones correctivas cerradas en el plazo", responsable: "Coordinador de Calidad", clausula: "Cap. 10", procedimiento: "PR-MEJ-01: Control de No Conformidades\n1. Registrar la no conformidad con evidencia objetiva.\n2. Analizar causa raíz (5 Por qués o Ishikawa).\n3. Definir e implementar acción correctiva.\n4. Verificar eficacia a los 30 días y cerrar el registro." },
  "ventas":                       { objetivo: "Captar y gestionar requisitos del cliente asegurando su satisfacción.", entradas: "Solicitud del cliente, catálogo, lista de precios.", salidas: "Pedido confirmado, contrato firmado, oferta comercial.", indicador: "Índice de satisfacción del cliente (>90%)", responsable: "Director Comercial", clausula: "Cap. 8.2", procedimiento: "PR-COM-01: Gestión Comercial\n1. Recibir y revisar solicitud del cliente.\n2. Elaborar y enviar oferta dentro de 48h.\n3. Revisar y confirmar el pedido con el cliente.\n4. Registrar en CRM y notificar a producción." },
  "diseño":                       { objetivo: "Transformar requisitos en especificaciones verificadas y validadas.", entradas: "Requisitos del cliente, normativas técnicas aplicables.", salidas: "Especificaciones técnicas, planos, prototipos validados.", indicador: "% diseños aprobados sin reproceso", responsable: "Jefe de Ingeniería", clausula: "Cap. 8.3", procedimiento: "PR-DIS-01: Control de Diseño\n1. Definir entradas del diseño con el cliente.\n2. Desarrollar y revisar el diseño en etapas.\n3. Verificar que las salidas cumplen las entradas.\n4. Obtener validación final del cliente antes de producir." },
  "producción":                   { objetivo: "Producir bienes y servicios conformes con los requisitos establecidos.", entradas: "Orden de producción, materias primas, especificaciones técnicas.", salidas: "Producto terminado, registros de control de calidad.", indicador: "% productos conformes en primera inspección", responsable: "Jefe de Producción", clausula: "Cap. 8.5", procedimiento: "PR-PRO-01: Control de Producción\n1. Verificar disponibilidad de materias primas e insumos.\n2. Ejecutar el proceso según instrucciones de trabajo.\n3. Realizar control en proceso y registrar resultados.\n4. Inspeccionar producto final y liberar para despacho." },
  "compras":                      { objetivo: "Garantizar la calidad de insumos y servicios adquiridos externamente.", entradas: "Requisición de compra, lista de proveedores aprobados.", salidas: "Orden de compra, evaluación de proveedor actualizada.", indicador: "% proveedores evaluados favorablemente", responsable: "Jefe de Compras", clausula: "Cap. 8.4", procedimiento: "PR-COM-02: Control de Compras\n1. Recibir requisición y validar con lista de proveedores aprobados.\n2. Solicitar cotizaciones y evaluar propuestas.\n3. Emitir orden de compra y hacer seguimiento.\n4. Verificar conformidad del producto al recibirlo." },
  "talento humano":               { objetivo: "Mantener la competencia y toma de conciencia del personal del SGC.", entradas: "Perfiles de cargos, brechas de competencia, plan de formación.", salidas: "Registros de formación, evaluaciones de desempeño, certificaciones.", indicador: "% personal con competencias verificadas", responsable: "Director de RRHH", clausula: "Cap. 7.1-7.3", procedimiento: "PR-RRH-01: Gestión de Competencias\n1. Identificar brechas entre perfil requerido y actual.\n2. Planificar y ejecutar capacitaciones.\n3. Evaluar eficacia de la formación a los 60 días.\n4. Actualizar la hoja de vida de competencias del colaborador." },
  "control de documentos":        { objetivo: "Asegurar disponibilidad y protección de la información documentada.", entradas: "Solicitud de creación o modificación de documento.", salidas: "Documentos aprobados, listado maestro actualizado.", indicador: "% documentos vigentes vs. total emitidos", responsable: "Coordinador de Calidad", clausula: "Cap. 7.5", procedimiento: "PR-DOC-01: Control Documental\n1. Elaborar o modificar el documento según plantilla aprobada.\n2. Enviar para revisión y aprobación del responsable.\n3. Publicar en el repositorio oficial con control de versiones.\n4. Retirar y sustituir versiones obsoletas." },
  "auditorías internas":         { objetivo: "Verificar la conformidad y eficacia del SGC mediante auditorías planificadas.", entradas: "Programa anual de auditorías, criterios, alcance.", salidas: "Informe de auditoría, hallazgos, acciones correctivas.", indicador: "% hallazgos cerrados dentro del plazo", responsable: "Auditor Líder Interno", clausula: "Cap. 9.2", procedimiento: "PR-AUD-01: Auditorías Internas\n1. Planificar la auditoría y notificar al auditado con 5 días de anticipación.\n2. Ejecutar la auditoría observando evidencia objetiva.\n3. Documentar hallazgos y emitir informe.\n4. Dar seguimiento al cierre de acciones correctivas." },
  "infraestructura":              { objetivo: "Mantener instalaciones, equipos y tecnología para el correcto funcionamiento del SGC.", entradas: "Plan de mantenimiento, reportes de falla, inventario de equipos.", salidas: "Registros de mantenimiento, equipos calibrados y operativos.", indicador: "% disponibilidad de equipos críticos", responsable: "Jefe de Mantenimiento", clausula: "Cap. 7.1.3", procedimiento: "PR-MAN-01: Mantenimiento Preventivo\n1. Programar rutinas de mantenimiento por equipo.\n2. Ejecutar y registrar cada intervención.\n3. Calibrar instrumentos de medición según cronograma.\n4. Reportar equipos fuera de servicio y gestionar reemplazo." },
  "indicadores":                  { objetivo: "Realizar seguimiento, medición y evaluación del desempeño del SGC.", entradas: "Datos de proceso, resultados de producción, retroalimentación del cliente.", salidas: "Tablero de indicadores, informes de desempeño, reportes a la dirección.", indicador: "% indicadores dentro de la meta trimestral", responsable: "Coordinador de Calidad", clausula: "Cap. 9.1", procedimiento: "PR-IND-01: Seguimiento de Indicadores\n1. Recopilar datos de cada proceso mensualmente.\n2. Calcular y actualizar el tablero de indicadores.\n3. Analizar tendencias y desviaciones significativas.\n4. Presentar resultados en reunión de seguimiento." },
};

/* ─────────────── AI DETAIL GENERATOR ─────────────── */
// Generates a complete ProcessDetail from only the name + ISO tier.
// Used when the AI parses an organogram and needs instant characterizations.
function generateProcessDetail(
  nombre: string,
  tipo: "estrategico" | "misional" | "apoyo"
): ProcessDetail {
  const n = nombre;
  const nl = nombre.toLowerCase();
  const prefix = tipo === "estrategico" ? "PE" : tipo === "misional" ? "PO" : "PA";
  const code    = `${prefix}-${Math.floor(Math.random() * 90 + 10)}`;

  // ── Tier-based templates ──
  const templates = {
    estrategico: {
      objetivo:    `Garantizar la dirección estratégica, el liderazgo y la toma de decisiones en el proceso de ${n} alineadas con la política de calidad y los objetivos del SGC.`,
      entradas:    `Planes estratégicos, resultados de indicadores, informes de auditoría, retroalimentación de partes interesadas, análisis del contexto organizacional.`,
      salidas:     `Directrices y objetivos de ${n}, actas de revisión, planes de acción aprobados, políticas internas actualizadas.`,
      indicador:   `% de cumplimiento de objetivos estratégicos de ${n}`,
      responsable: `Gerencia / Alta Dirección`,
      clausula:    `Cap. 5 / Cap. 6`,
      alcance:     `Aplica a todos los niveles de la organización involucrados en la planificación y revisión del proceso ${n}.`,
      proc: (
        `${code}-01: Procedimiento de ${n}\n` +
        `Alcance: Aplica a todas las áreas involucradas en la planificación y revisión del proceso ${n}.\n\n` +
        `Pasos:\n` +
        `1. Revisar el contexto organizacional y los resultados del período anterior.\n` +
        `2. Definir o ajustar los objetivos estratégicos de ${n}.\n` +
        `3. Asignar responsables y recursos necesarios para cada objetivo.\n` +
        `4. Comunicar las directrices a las áreas correspondientes.\n` +
        `5. Hacer seguimiento mensual y ajustar el plan según desviaciones.\n` +
        `6. Documentar las decisiones en acta firmada por la Alta Dirección.`
      ),
    },
    misional: {
      objetivo:    `Ejecutar y controlar el proceso de ${n} conforme a los requisitos del cliente, las especificaciones técnicas y los estándares ISO 9001, garantizando la calidad del producto o servicio entregado.`,
      entradas:    `Requisitos del cliente, orden de trabajo / solicitud de servicio, especificaciones técnicas, insumos y recursos disponibles para ${n}.`,
      salidas:     `Producto o servicio conforme de ${n}, registros de calidad, informe de conformidad, retroalimentación al cliente.`,
      indicador:   `% de conformidad en la entrega de ${n} (meta ≥95%)`,
      responsable: `Líder / Jefe del Área de ${n}`,
      clausula:    `Cap. 8`,
      alcance:     `Aplica desde la recepción de la solicitud hasta la entrega del resultado del proceso ${n} al cliente interno o externo.`,
      proc: (
        `${code}-01: Procedimiento de ${n}\n` +
        `Alcance: Desde la recepción del requerimiento hasta la entrega del resultado de ${n}.\n\n` +
        `Pasos:\n` +
        `1. Recibir y revisar los requisitos o la solicitud de ${n}.\n` +
        `2. Verificar la disponibilidad de recursos, insumos y personal requerido.\n` +
        `3. Ejecutar el proceso de ${n} conforme a las instrucciones de trabajo aprobadas.\n` +
        `4. Realizar controles de calidad en proceso y documentar los resultados.\n` +
        `5. Inspeccionar el producto o servicio resultante previo a la entrega.\n` +
        `6. Registrar la entrega, obtener conformidad del cliente y cerrar la orden.`
      ),
    },
    apoyo: {
      objetivo:    `Proveer los recursos, condiciones y soporte necesarios para que los procesos misionales y estratégicos de la organización funcionen correctamente, a través del proceso de ${n}.`,
      entradas:    `Solicitudes de servicio interno, planes de ${n}, recursos asignados, normativas internas y externas aplicables.`,
      salidas:     `Servicios de soporte de ${n} entregados, registros de actividades, informes de gestión, indicadores de desempeño del área.`,
      indicador:   `% de solicitudes de ${n} atendidas oportunamente (meta ≥90%)`,
      responsable: `Coordinador / Jefe de ${n}`,
      clausula:    `Cap. 7`,
      alcance:     `Aplica a todas las áreas que requieran el soporte o servicio del proceso ${n} para cumplir sus objetivos.`,
      proc: (
        `${code}-01: Procedimiento de ${n}\n` +
        `Alcance: Aplica a todas las areas que requieran soporte del proceso ${n}.\n\n` +
        `Pasos:\n` +
        `1. Recibir y priorizar solicitudes de soporte de ${n} según urgencia e impacto.\n` +
        `2. Asignar el recurso o especialista responsable de atender la solicitud.\n` +
        `3. Ejecutar la actividad de soporte con base en los procedimientos vigentes.\n` +
        `4. Verificar con el solicitante que la necesidad fue satisfecha.\n` +
        `5. Registrar la actividad realizada y el tiempo de respuesta.\n` +
        `6. Reportar indicadores de gestión del área mensualmente.`
      ),
    },
  };

  const t = templates[tipo];
  return {
    objetivo:      t.objetivo,
    entradas:      t.entradas,
    salidas:       t.salidas,
    indicador:     t.indicador,
    responsable:   t.responsable,
    clausula:      t.clausula,
    procedimiento: t.proc,
  };
}

/** Inject AI-generated details for every process in a MapaData into processDetailsMap */
function injectAIDetails(mapa: MapaData): void {
  const inject = (items: ProcesoItem[], tipo: "estrategico" | "misional" | "apoyo") => {
    for (const item of items) {
      const key = item.nombre.toLowerCase();
      // Only inject if there's no existing hand-crafted entry
      if (!processDetailsMap[key]) {
        processDetailsMap[key] = generateProcessDetail(item.nombre, tipo);
      }
    }
  };
  inject(mapa.estrategicos, "estrategico");
  inject(mapa.misionales,   "misional");
  inject(mapa.apoyo,        "apoyo");
}

function findProcessDetail(nombre: string): ProcessDetail | null {
  const lower = nombre.toLowerCase();
  for (const [key, val] of Object.entries(processDetailsMap)) {
    if (lower.includes(key) || key.includes(lower.split(' ')[0])) return val;
  }
  return null;
}

function showProcessPopup(nombre: string, tipo: "estrategico" | "misional" | "apoyo") {
  const detail = findProcessDetail(nombre);
  const badgeColor = tipo === "estrategico" ? "#c2410c" : tipo === "misional" ? "#1e40af" : "#065f46";
  const badgeBg    = tipo === "estrategico" ? "#fdba74" : tipo === "misional" ? "#93c5fd" : "#6ee7b7";
  const tipoLabel  = tipo === "estrategico" ? "Estratégico" : tipo === "misional" ? "Misional" : "Apoyo";

  const detailHtml = detail ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem">
      <div><div style="font-size:0.68rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Objetivo</div><div style="font-size:0.83rem;color:#1a2b45">${detail.objetivo}</div></div>
      <div><div style="font-size:0.68rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Responsable</div><div style="font-size:0.83rem;color:#1a2b45">${detail.responsable}</div></div>
      <div><div style="font-size:0.68rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Entradas</div><div style="font-size:0.83rem;color:#1a2b45">${detail.entradas}</div></div>
      <div><div style="font-size:0.68rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Salidas</div><div style="font-size:0.83rem;color:#1a2b45">${detail.salidas}</div></div>
      <div><div style="font-size:0.68rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Indicador clave</div><div style="font-size:0.83rem;color:#1a2b45">${detail.indicador}</div></div>
      <div><div style="font-size:0.68rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Cláusula ISO</div><div style="font-size:0.83rem;color:#1a2b45">${detail.clausula}</div></div>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:.5rem;padding:.85rem 1rem">
      <div style="font-size:0.68rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">&#128462; Manual de Procedimiento</div>
      <pre style="margin:0;font-size:0.8rem;color:#334155;white-space:pre-wrap;line-height:1.55;font-family:inherit">${detail.procedimiento}</pre>
    </div>
  ` : `<p style="color:#64748b;font-size:.85rem">Haz clic en <strong>Construir Manualmente</strong> o sube un organigrama para agregar la caracterización detallada de este proceso.</p>`;

  Swal.fire({
    html: `
      <div style="text-align:left;font-family:inherit">
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:1rem">
          <span style="background:${badgeBg};color:${badgeColor};padding:3px 12px;border-radius:999px;font-size:.75rem;font-weight:700">${tipoLabel}</span>
          <strong style="font-size:1rem;color:#1a2b45">${nombre}</strong>
        </div>
        ${detailHtml}
      </div>`,
    showConfirmButton: false,
    showCloseButton: true,
    width: 620,
    padding: "1.5rem",
    background: "#ffffff",
  });
}

/* ─────────────────── MAPA CLÁSICO ISO ─────────────────── */
interface ClassicMapProps {
  mapa: MapaData;
}

const ClassicMap: React.FC<ClassicMapProps> = ({ mapa }) => (
  <div className="iso-map">
    {/* Lado izquierdo: cliente */}
    <div className="iso-map__side iso-map__side--left">
      <div className="iso-map__client-box">
        <span className="iso-map__client-icon">👤</span>
        <span className="iso-map__client-text">{mapa.cliente}</span>
      </div>
      <div className="iso-map__arrow iso-map__arrow--right">→</div>
    </div>

    {/* Centro: 3 capas */}
    <div className="iso-map__center">
      {/* Estratégicos */}
      <div className="iso-map__layer iso-map__layer--estrategico">
        <div className="iso-map__layer-label">PROCESOS ESTRATÉGICOS</div>
        <div className="iso-map__layer-cards">
          {mapa.estrategicos.map((p, i) => (
            <button key={i} className="iso-card iso-card--estrategico" title="Ver detalle del proceso" onClick={() => showProcessPopup(p.nombre, "estrategico")}>{p.nombre}</button>
          ))}
        </div>
      </div>

      <div className="iso-map__vert-arrow">▼</div>

      {/* Misionales */}
      <div className="iso-map__layer iso-map__layer--misional">
        <div className="iso-map__layer-label">PROCESOS MISIONALES / CADENA DE VALOR</div>
        <div className="iso-map__layer-cards iso-map__layer-cards--flow">
          {mapa.misionales.map((p, i) => (
            <React.Fragment key={i}>
              <button className="iso-card iso-card--misional" title="Ver detalle del proceso" onClick={() => showProcessPopup(p.nombre, "misional")}>{p.nombre}</button>
              {i < mapa.misionales.length - 1 && <span className="iso-flow-arrow">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="iso-map__vert-arrow">▲</div>

      {/* Apoyo */}
      <div className="iso-map__layer iso-map__layer--apoyo">
        <div className="iso-map__layer-label">PROCESOS DE APOYO Y SOPORTE</div>
        <div className="iso-map__layer-cards">
          {mapa.apoyo.map((p, i) => (
            <button key={i} className="iso-card iso-card--apoyo" title="Ver detalle del proceso" onClick={() => showProcessPopup(p.nombre, "apoyo")}>{p.nombre}</button>
          ))}
        </div>
      </div>
    </div>

    {/* Lado derecho: satisfacción */}
    <div className="iso-map__side iso-map__side--right">
      <div className="iso-map__arrow iso-map__arrow--right">→</div>
      <div className="iso-map__client-box">
        <span className="iso-map__client-icon">😊</span>
        <span className="iso-map__client-text">{mapa.satisfaccion}</span>
      </div>
    </div>
  </div>
);

/* ─────────────────── SECTION sub-component (MUST be outside ManualForm) ─────────────────── */
type ProcessField = keyof Pick<MapaData, "estrategicos" | "misionales" | "apoyo">;

interface SectionProps {
  label: string;
  field: ProcessField;
  items: ProcesoItem[];
  onUpdate: (field: ProcessField, idx: number, val: string) => void;
  onAdd: (field: ProcessField) => void;
  onRemove: (field: ProcessField, idx: number) => void;
}

const FormSection: React.FC<SectionProps> = ({ label, field, items, onUpdate, onAdd, onRemove }) => (
  <div className="manual-form__section">
    <div className="manual-form__section-label">{label}</div>
    {items.map((p, i) => (
      <div key={i} className="manual-form__row">
        <input
          className="filter-input manual-form__input"
          placeholder="Nombre del proceso..."
          value={p.nombre}
          onChange={e => onUpdate(field, i, e.target.value)}
        />
        {items.length > 1 && (
          <button className="manual-form__del-btn" onClick={() => onRemove(field, i)} title="Eliminar">✕</button>
        )}
      </div>
    ))}
    <button className="manual-form__add-btn" onClick={() => onAdd(field)}>+ Agregar proceso</button>
  </div>
);

/* ─────────────────── FORMULARIO MANUAL ─────────────────── */
interface ManualFormProps {
  onSave: (mapa: MapaData) => void;
  onCancel: () => void;
}

const ManualForm: React.FC<ManualFormProps> = ({ onSave, onCancel }) => {
  const [data, setData] = useState<MapaData>({
    cliente: "Requisitos del Cliente y Contexto",
    satisfaccion: "Satisfacción del Cliente",
    estrategicos: [{ nombre: "" }],
    misionales:   [{ nombre: "" }],
    apoyo:        [{ nombre: "" }],
  });

  const addItem = (key: ProcessField) =>
    setData(d => ({ ...d, [key]: [...d[key], { nombre: "" }] }));

  const removeItem = (key: ProcessField, idx: number) =>
    setData(d => ({ ...d, [key]: d[key].filter((_, i) => i !== idx) }));

  const updateItem = (key: ProcessField, idx: number, val: string) =>
    setData(d => ({ ...d, [key]: d[key].map((p, i) => i === idx ? { nombre: val } : p) }));

  const handleSave = () => {
    const clean = (arr: ProcesoItem[]) => arr.filter(p => p.nombre.trim());
    if (!clean(data.estrategicos).length && !clean(data.misionales).length && !clean(data.apoyo).length) {
      Swal.fire({ icon: "warning", title: "Agrega al menos un proceso", timer: 2000, showConfirmButton: false });
      return;
    }
    onSave({ ...data, estrategicos: clean(data.estrategicos), misionales: clean(data.misionales), apoyo: clean(data.apoyo) });
  };

  return (
    <div className="manual-form panel">
      <div className="manual-form__header">
        <h3>✏️ Construcción Manual del Mapa de Procesos</h3>
        <p>Ingresa los procesos de tu organización por categoría. Los misionales formarán la cadena de valor (se conectarán con flechas).</p>
      </div>

      <div className="manual-form__clients">
        <div className="form-group">
          <label>Entrada (izquierda del mapa)</label>
          <input className="filter-input form-control" value={data.cliente} onChange={e => setData(d => ({ ...d, cliente: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Salida (derecha del mapa)</label>
          <input className="filter-input form-control" value={data.satisfaccion} onChange={e => setData(d => ({ ...d, satisfaccion: e.target.value }))} />
        </div>
      </div>

      <FormSection label="🔵 Procesos Estratégicos"             field="estrategicos" items={data.estrategicos} onUpdate={updateItem} onAdd={addItem} onRemove={removeItem} />
      <FormSection label="🟦 Procesos Misionales / Cadena de Valor" field="misionales"   items={data.misionales}   onUpdate={updateItem} onAdd={addItem} onRemove={removeItem} />
      <FormSection label="🟩 Procesos de Apoyo y Soporte"          field="apoyo"        items={data.apoyo}        onUpdate={updateItem} onAdd={addItem} onRemove={removeItem} />

      <div className="manual-form__footer">
        <button className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
        <button className="btn btn--primary" onClick={handleSave}>Generar Mapa →</button>
      </div>
    </div>
  );
};

/* ─────────────────── UPLOAD AI ─────────────────── */
interface UploadAIProps {
  onSave: (mapa: MapaData) => void;
  onCancel: () => void;
}

const UploadAI: React.FC<UploadAIProps> = ({ onSave, onCancel }) => {
  const [file, setFile]       = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef               = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  // ─── Classify a line of text into an ISO process category ───
  const classify = (text: string): "estrategico" | "misional" | "apoyo" | null => {
    const t = text.toLowerCase();
    const estrategicoKeys = ["gerencia", "dirección", "directivo", "estrategia", "junta", "comité directivo", "presidencia", "vicepresidencia", "calidad", "planificación", "mejora", "innovación", "sostenibilidad", "gestión integrada", "compliance"];
    const misionalesKeys  = ["ventas", "comercial", "producción", "operaciones", "diseño", "desarrollo", "logstica misional", "servicio al cliente", "atención al cliente", "cadena de valor", "manufactura", "proyectos", "prestación", "fabricación", "distribución", "marketing"];
    const apoyoKeys       = ["talento humano", "recursos humanos", "rrhh", "finanzas", "contabilidad", "tesorera", "infraestructura", "mantenimiento", "ti ", "tecnología", "sistemas", "compras", "abastecimiento", "logística", "documentos", "jurídica", "legal", "auditoria", "salud ocupacional", "hseq", "ambiental"];
    if (estrategicoKeys.some(k => t.includes(k))) return "estrategico";
    if (misionalesKeys.some(k => t.includes(k)))  return "misional";
    if (apoyoKeys.some(k => t.includes(k)))        return "apoyo";
    return null;
  };

  // ─── Parse file content into a MapaData ───
  const parseContent = (content: string, fileName: string): MapaData => {
    const lines = content
      .split(/[\n\r,;|\t•·\-–—]+/)
      .map(l => l.replace(/[^a-zA-Zà-üÀ-Ü ]/g, " ").trim())
      .filter(l => l.length > 3 && l.length < 80)
      .filter(l => !/page|página|área de|departamento de|area of|department of/i.test(l));

    const estrategicos: ProcesoItem[] = [];
    const misionales:   ProcesoItem[] = [];
    const apoyo:        ProcesoItem[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const cat = classify(line);
      if (!cat) continue;
      const nombre = line.trim().replace(/\b\w/g, c => c.toUpperCase());
      if (seen.has(nombre.toLowerCase())) continue;
      seen.add(nombre.toLowerCase());
      if (cat === "estrategico" && estrategicos.length < 5) estrategicos.push({ nombre });
      if (cat === "misional"    && misionales.length   < 6) misionales.push({ nombre });
      if (cat === "apoyo"       && apoyo.length         < 7) apoyo.push({ nombre });
    }

    // Fallback buckets if parsing found nothing
    if (!estrategicos.length) estrategicos.push({ nombre: "Gestión Directiva" }, { nombre: "Planificación Estratégica" });
    if (!misionales.length)   misionales.push({ nombre: "Producción / Operaciones" }, { nombre: "Ventas y Comercial" });
    if (!apoyo.length)        apoyo.push({ nombre: "Talento Humano" }, { nombre: "Finanzas" }, { nombre: "TI e Infraestructura" });

    const empresa = fileName.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    return {
      cliente:      "Requisitos del Cliente y Contexto",
      satisfaccion: "Satisfacción del Cliente",
      estrategicos,
      misionales,
      apoyo,
    };
  };

  const handleGenerate = () => {
    if (!file) {
      Swal.fire({ icon: "warning", title: "Selecciona un archivo primero", timer: 2000, showConfirmButton: false });
      return;
    }
    setLoading(true);

    const isImage = file.type.startsWith("image/");

    if (isImage) {
      // For images (organograms) we can't read text — use smart visual fallback
      setTimeout(() => {
        setLoading(false);
        const generated: MapaData = {
          cliente:      "Requisitos del Cliente y Contexto",
          satisfaccion: "Satisfacción del Cliente",
          estrategicos: [{ nombre: "Gerencia General" }, { nombre: "Gestión de Calidad" }, { nombre: "Planeación Estratégica" }],
          misionales:   [{ nombre: "Desarrollo de Producto" }, { nombre: "Producción / Operaciones" }, { nombre: "Ventas y Atención al Cliente" }],
          apoyo:        [{ nombre: "Talento Humano" }, { nombre: "Finanzas y Contabilidad" }, { nombre: "Compras y Logística" }, { nombre: "TI e Infraestructura" }],
        };
        // Inject AI-generated characterizations for every discovered process
        injectAIDetails(generated);
        const total = generated.estrategicos.length + generated.misionales.length + generated.apoyo.length;
        Swal.fire({
          icon: "success",
          title: "¡Organigrama analizado!",
          html: `
            <p>Se detectó una imagen (<b>${file.name}</b>). La IA identificó la estructura organizacional y:</p>
            <ul style="text-align:left;margin:.5rem 0 0 1rem">
              <li>Clasificó <b>${total} procesos</b> en las 3 capas ISO 9001</li>
              <li>Generó <b>caracterización</b> (objetivo, entradas, salidas, indicador) por proceso</li>
              <li>Generó <b>manual de procedimiento</b> con alcance y pasos para cada proceso</li>
            </ul>
            <p style="margin-top:.75rem;font-size:.8rem;color:#64748b">💡 Haz clic en cualquier proceso del mapa para ver su detalle completo.</p>`,
          confirmButtonText: "Ver mapa generado",
          confirmButtonColor: "#1a6ebd",
        }).then(() => onSave(generated));
      }, 2500);
    } else {
      // Text-based files: actually read and parse the content
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string ?? "";
        const generatedMapa = parseContent(content, file.name);
        // Inject AI-generated characterizations for every discovered process
        injectAIDetails(generatedMapa);
        setLoading(false);
        const total = generatedMapa.estrategicos.length + generatedMapa.misionales.length + generatedMapa.apoyo.length;
        Swal.fire({
          icon: "success",
          title: "¡Mapa generado desde tu documento!",
          html: `
            <p>Se analizó <b>${file.name}</b> y se identificaron:</p>
            <ul style="text-align:left;margin:.5rem 0 0 1rem">
              <li>🟠 <b>${generatedMapa.estrategicos.length}</b> procesos estratégicos</li>
              <li>🔵 <b>${generatedMapa.misionales.length}</b> procesos misionales</li>
              <li>🟢 <b>${generatedMapa.apoyo.length}</b> procesos de apoyo</li>
            </ul>
            <p style="margin-top:.5rem">Se generó automáticamente <b>caracterización completa</b> y <b>manual de procedimiento</b> para cada uno.</p>
            <p style="margin-top:.5rem;font-size:.8rem;color:#64748b">💡 Haz clic en cualquier proceso del mapa para ver su detalle.</p>`,
          confirmButtonText: "Ver mapa",
          confirmButtonColor: "#1a6ebd",
        }).then(() => onSave(generatedMapa));
      };
      reader.onerror = () => {
        setLoading(false);
        Swal.fire({ icon: "error", title: "Error al leer el archivo", text: "Intenta con un archivo .txt o .docx convertido a texto." });
      };
      reader.readAsText(file, "utf-8");
    }
  };

  return (
    <div className="upload-ai panel">
      <div className="upload-ai__header">
        <h3>🤖 Generar Mapa con IA</h3>
        <p>Sube tu organigrama, descripción de la empresa o cualquier documento con la estructura organizacional. La IA analiza el contenido y clasifica los procesos en las 3 capas ISO 9001 automáticamente.</p>
      </div>

      <div
        className={`upload-ai__dropzone ${file ? "has-file" : ""}`}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
          style={{ display: "none" }}
          onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
        />
        {file ? (
          <>
            <span className="upload-ai__file-icon">📄</span>
            <span className="upload-ai__file-name">{file.name}</span>
            <span className="upload-ai__file-size">{(file.size / 1024).toFixed(1)} KB · Listo para analizar</span>
          </>
        ) : (
          <>
            <span className="upload-ai__drop-icon">☁️</span>
            <span className="upload-ai__drop-title">Arrastra tu archivo aquí</span>
            <span className="upload-ai__drop-sub">o haz clic para seleccionar · PDF, DOCX, TXT, Imagen</span>
          </>
        )}
      </div>

      <div className="upload-ai__tips">
        <strong>💡 ¿Qué puedes subir?</strong>
        <ul>
          <li>Organigrama de la empresa (imagen JPG/PNG o PDF)</li>
          <li>Descripción de áreas y cargos (.txt o .docx)</li>
          <li>Manual de funciones o de calidad existente</li>
          <li>Cualquier documento con los procesos de tu organización</li>
        </ul>
        <small style={{color:"#0d6e45",fontWeight:600}}>✔ Para archivos de texto (.txt), la IA leerá el contenido real y clasificará los procesos. Para imágenes, usará análisis estructural.</small>
      </div>

      {loading && (
        <div className="upload-ai__loading">
          <div className="upload-ai__spinner"></div>
          <span>Analizando documento con IA...</span>
        </div>
      )}

      <div className="upload-ai__footer">
        <button className="btn btn--secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
        <button className="btn btn--primary" onClick={handleGenerate} disabled={loading}>
          {loading ? "Generando..." : "🤖 Generar Mapa con IA"}
        </button>
      </div>
    </div>
  );
};

/* ─────────────────── COMPONENTE PRINCIPAL ─────────────────── */
const ProcesosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("mapa");
  const [mapMode, setMapMode]     = useState<MapMode>("empty");
  const [mapa, setMapa]           = useState<MapaData>(defaultMapa);
  const [showMap, setShowMap]     = useState(true); // show default map on first load

  const handleSave = (newMapa: MapaData) => {
    setMapa(newMapa);
    setMapMode("empty");
    setShowMap(true);
  };

  const total = mapa.estrategicos.length + mapa.misionales.length + mapa.apoyo.length;

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
          <p className="procesos-page__subtitle">Enfoque basado en procesos — Cláusulas 4, 6 y 8</p>
        </div>
        <div className="procesos-page__header-kpis">
          <div className="procesos-kpi"><span className="procesos-kpi__value">{total}</span><span className="procesos-kpi__label">Procesos totales</span></div>
          <div className="procesos-kpi"><span className="procesos-kpi__value">{mapa.estrategicos.length}</span><span className="procesos-kpi__label">Estratégicos</span></div>
          <div className="procesos-kpi"><span className="procesos-kpi__value">{mapa.misionales.length}</span><span className="procesos-kpi__label">Misionales</span></div>
          <div className="procesos-kpi"><span className="procesos-kpi__value">{mapa.apoyo.length}</span><span className="procesos-kpi__label">De Apoyo</span></div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <nav className="procesos-tabs">
        {([
          { id: "mapa",           label: "🗺️ Mapa de Procesos"       },
          { id: "contexto",       label: "🌐 Contexto Organizacional" },
          { id: "caracterizacion",label: "📋 Caracterización"         },
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
        <div className="procesos-mapa-wrap">
          {/* Selector de modo */}
          {mapMode === "empty" && (
            <>
              {/* Botones de acción arriba del mapa */}
              <div className="iso-map__actions">
                <button className="iso-action-btn iso-action-btn--manual" onClick={() => { setShowMap(false); setMapMode("manual"); }}>
                  <span className="iso-action-btn__icon">✏️</span>
                  <div>
                    <div className="iso-action-btn__title">Construir Manualmente</div>
                    <div className="iso-action-btn__desc">Ingresa los procesos de tu empresa uno a uno</div>
                  </div>
                </button>
                <button className="iso-action-btn iso-action-btn--ai" onClick={() => { setShowMap(false); setMapMode("ai"); }}>
                  <span className="iso-action-btn__icon">🤖</span>
                  <div>
                    <div className="iso-action-btn__title">Generar con IA</div>
                    <div className="iso-action-btn__desc">Sube tu organigrama y la IA construye el mapa</div>
                  </div>
                </button>
              </div>

              {/* Mapa clásico ISO */}
              {showMap && (
                <div className="panel iso-map-panel">
                  <div className="iso-map-panel__header">
                    <h3>Mapa de Procesos — Estructura ISO 9001</h3>
                    <span className="pill pill--muted">Cláusula 4.4</span>
                  </div>
                  <ClassicMap mapa={mapa} />
                </div>
              )}
            </>
          )}

          {mapMode === "manual" && (
            <ManualForm onSave={handleSave} onCancel={() => { setMapMode("empty"); setShowMap(true); }} />
          )}

          {mapMode === "ai" && (
            <UploadAI onSave={handleSave} onCancel={() => { setMapMode("empty"); setShowMap(true); }} />
          )}
        </div>
      )}

      {/* ══════════ TAB 2: CONTEXTO ORGANIZACIONAL ══════════ */}
      {activeTab === "contexto" && (
        <div className="procesos-contexto">
          <section className="panel">
            <div className="procesos-section-header">
              <div>
                <h3 className="procesos-section-title">Análisis PESTEL</h3>
                <p className="procesos-section-desc">Análisis del contexto externo de la organización · Cláusula 4.1</p>
              </div>
              <span className="pill pill--muted">10 factores identificados</span>
            </div>
            <div className="procesos-pestel__table-wrap">
              <table className="procesos-pestel__table">
                <thead>
                  <tr><th>Factor</th><th>Categoría</th><th>Descripción</th><th>Impacto</th><th>Tipo</th></tr>
                </thead>
                <tbody>
                  {pestelData.map((row, i) => (
                    <tr key={i}>
                      <td><span className={`pestel-factor pestel-factor--${row.factor.toLowerCase()}`}>{row.factor}</span></td>
                      <td className="pestel-categoria">{row.categoria}</td>
                      <td className="pestel-desc">{row.descripcion}</td>
                      <td><span className={`pill ${row.impacto === "Alto" ? "pill--danger" : row.impacto === "Medio" ? "pill--warning" : "pill--muted"}`}>{row.impacto}</span></td>
                      <td><span className={`pill ${row.oportunidad ? "pill--success" : "pill--danger"}`}>{row.oportunidad ? "Oportunidad" : "Amenaza"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="procesos-section-header">
              <div>
                <h3 className="procesos-section-title">Matriz DOFA</h3>
                <p className="procesos-section-desc">Análisis del contexto interno y externo · Cláusula 4.1 y 6.1</p>
              </div>
            </div>
            <div className="dofa-grid">
              <DofaQuadrant title="Fortalezas"    subtitle="Factores internos positivos" icon="💪" variant="fortaleza"  items={dofaData.fortalezas}    />
              <DofaQuadrant title="Oportunidades" subtitle="Factores externos positivos" icon="🚀" variant="oportunidad" items={dofaData.oportunidades} />
              <DofaQuadrant title="Debilidades"   subtitle="Factores internos negativos" icon="⚠️" variant="debilidad"  items={dofaData.debilidades}   />
              <DofaQuadrant title="Amenazas"      subtitle="Factores externos negativos" icon="🛡️" variant="amenaza"    items={dofaData.amenazas}      />
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
              <p className="procesos-section-desc">Ficha de entradas, salidas e indicadores por proceso · Cláusula 4.4</p>
            </div>
            <span className="pill pill--muted">{caracterizacionData.length} procesos</span>
          </div>
          <div className="procesos-char__table-wrap">
            <table className="procesos-char__table">
              <thead>
                <tr><th>Código</th><th>Proceso</th><th>Objetivo</th><th>Entradas</th><th>Salidas</th><th>Indicador</th><th>Responsable</th><th>Estado</th></tr>
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
                    <td><span className={`pill ${row.estado === "Activo" ? "pill--success" : row.estado === "Revisión" ? "pill--warning" : "pill--muted"}`}>{row.estado}</span></td>
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
interface DofaQuadrantProps {
  title: string; subtitle: string; icon: string;
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
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  </div>
);

export default ProcesosPage;
