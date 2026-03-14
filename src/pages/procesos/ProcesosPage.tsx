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
            <div key={i} className="iso-card iso-card--estrategico">{p.nombre}</div>
          ))}
        </div>
      </div>

      {/* Flecha descendente */}
      <div className="iso-map__vert-arrow">▼</div>

      {/* Misionales */}
      <div className="iso-map__layer iso-map__layer--misional">
        <div className="iso-map__layer-label">PROCESOS MISIONALES / CADENA DE VALOR</div>
        <div className="iso-map__layer-cards iso-map__layer-cards--flow">
          {mapa.misionales.map((p, i) => (
            <React.Fragment key={i}>
              <div className="iso-card iso-card--misional">{p.nombre}</div>
              {i < mapa.misionales.length - 1 && <span className="iso-flow-arrow">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Flecha ascendente */}
      <div className="iso-map__vert-arrow">▲</div>

      {/* Apoyo */}
      <div className="iso-map__layer iso-map__layer--apoyo">
        <div className="iso-map__layer-label">PROCESOS DE APOYO Y SOPORTE</div>
        <div className="iso-map__layer-cards">
          {mapa.apoyo.map((p, i) => (
            <div key={i} className="iso-card iso-card--apoyo">{p.nombre}</div>
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

  const handleGenerate = () => {
    if (!file) {
      Swal.fire({ icon: "warning", title: "Selecciona un archivo primero", timer: 2000, showConfirmButton: false });
      return;
    }
    setLoading(true);
    // Simulate AI processing — in production this would call your backend / LLM API
    setTimeout(() => {
      setLoading(false);
      // Example AI-generated result based on a typical org chart
      const generatedMapa: MapaData = {
        cliente: "Requisitos del Cliente y Contexto",
        satisfaccion: "Satisfacción del Cliente y Valor Entregado",
        estrategicos: [
          { nombre: "Gestión Directiva y Estrategia" },
          { nombre: "Planificación y Calidad" },
          { nombre: "Mejora e Innovación" },
        ],
        misionales: [
          { nombre: "Desarrollo de Productos/Servicios" },
          { nombre: "Producción / Operaciones" },
          { nombre: "Ventas y Atención al Cliente" },
        ],
        apoyo: [
          { nombre: "Talento Humano" },
          { nombre: "Finanzas y Contabilidad" },
          { nombre: "Compras y Logística" },
          { nombre: "TI e Infraestructura" },
          { nombre: "Gestión Documental" },
        ],
      };
      Swal.fire({
        icon: "success",
        title: "¡Mapa generado por IA!",
        text: `Se analizó "${file.name}" y se construyó el mapa de procesos ISO 9001 automáticamente.`,
        confirmButtonText: "Ver mapa",
        confirmButtonColor: "#1a6ebd",
      }).then(() => onSave(generatedMapa));
    }, 2800);
  };

  return (
    <div className="upload-ai panel">
      <div className="upload-ai__header">
        <h3>🤖 Generar Mapa con IA</h3>
        <p>Sube tu organigrama, descripción de la empresa o cualquier documento con la estructura organizacional. La IA analizará el contenido y generará el mapa de procesos ISO 9001 automáticamente.</p>
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
          <li>Organigrama de la empresa (imagen o PDF)</li>
          <li>Descripción de áreas y cargos (Word o texto)</li>
          <li>Manual de funciones o de calidad existente</li>
          <li>Cualquier documento con los procesos de tu organización</li>
        </ul>
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
