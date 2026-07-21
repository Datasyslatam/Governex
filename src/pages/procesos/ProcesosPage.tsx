/**
 * ProcesosPage.tsx  (CORREGIDO — callbacks estables con useCallback)
 *
 * Fix: handleEmpresaConfirm y handleCancel se envuelven en useCallback
 * para que EmpresaFormModal no reciba nuevas referencias en cada render,
 * lo que causaba re-montaje del modal y pérdida de foco en los inputs.
 */

import React, { useState, useRef, useCallback } from 'react'
import './ProcesosPage.css'
import Swal from 'sweetalert2'
import { useFetch } from '../../hooks/useFetch'
import { procesosService } from '../../services'
import { useAIAnalysis, DatosEmpresa } from '../../context/AIAnalysisContext'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionGuard from '../../components/ui/PermissionGuard'
import EmpresaFormModal            from './EmpresaFormModal'
import ContextoOrganizacionalPanel from './ContextoOrganizacionalPanel'
import PlantillaOrganizacion       from './PlantillaOrganizacion'
import ActividadModal from './ActividadModal'
import { ActividadEmpresa } from '../../context/AIAnalysisContext'

/* ─────────────────────────── TIPOS ─────────────────────────── */
type Tab     = 'mapa' | 'contexto' | 'caracterizacion'
type MapMode = 'empty' | 'manual' | 'ai' | 'plantilla'

export interface ProcesoItem { nombre: string }

export interface MapaData {
  cliente:      string
  satisfaccion: string
  estrategicos: ProcesoItem[]
  misionales:   ProcesoItem[]
  apoyo:        ProcesoItem[]
}

interface PestelRow {
  factor:      string
  categoria:   string
  descripcion: string
  impacto:     string
  oportunidad: boolean
}

interface DofaRow {
  tipo:        string
  descripcion: string
}

interface CaracterizacionRow {
  codigo:      string
  proceso:     string
  objetivo:    string
  entradas:    string
  salidas:     string
  indicador:   string
  responsable: string
  estado:      string
}

interface AiAnalysis {
  pestel:             PestelRow[]
  dofa:               DofaRow[]
  caracterizacion:    CaracterizacionRow[]
  matrizRoles?:       any[]
  matrizCargos?:      any[]
  matrizRecursos?:    any[]
  indicadores?:       any[]
  contextoNarrativo?: string
}

/* ─────────────────── DATOS BASE DEL MAPA ─────────────────── */
const defaultMapa: MapaData = {
  cliente:      'Requisitos del Cliente y Contexto',
  satisfaccion: 'Satisfacción del Cliente y Triple Impacto',
  estrategicos: [{ nombre: 'Gestión de la Dirección' }, { nombre: 'Planificación del SGC' }, { nombre: 'Mejora Continua' }],
  misionales:   [{ nombre: 'Ventas y Gestión Comercial' }, { nombre: 'Diseño y Desarrollo' }, { nombre: 'Producción / Prestación' }],
  apoyo:        [{ nombre: 'Gestión del Talento Humano' }, { nombre: 'Control de Documentos' }, { nombre: 'Auditorías Internas' }, { nombre: 'Gestión de Infraestructura' }, { nombre: 'Gestión de Indicadores' }],
}

function mapaDesdeCaracterizacion(rows: CaracterizacionRow[]): MapaData | null {
  if (!rows || rows.length === 0) return null

  const estrategicos: ProcesoItem[] = []
  const misionales:   ProcesoItem[] = []
  const apoyo:        ProcesoItem[] = []

  for (const row of rows) {
    const item = { nombre: row.proceso }
    if      (row.codigo.startsWith('PE')) estrategicos.push(item)
    else if (row.codigo.startsWith('PO')) misionales.push(item)
    else                                   apoyo.push(item)
  }

  if (!estrategicos.length && !misionales.length && !apoyo.length) return null

  return {
    cliente:      'Requisitos del Cliente y Contexto',
    satisfaccion: 'Satisfacción del Cliente y Triple Impacto',
    estrategicos, misionales, apoyo,
  }
}

/* ─────────────────── DETALLE DE PROCESO (popup) ─────────────────── */
interface ProcessDetail {
  objetivo: string; entradas: string; salidas: string
  indicador: string; responsable: string; clausula: string; procedimiento: string
}

let processDetailsMap: Record<string, ProcessDetail> = {
  'gestión de la dirección': { objetivo: 'Asegurar el liderazgo y compromiso de la alta dirección con el SGC.', entradas: 'Resultados de auditorías, retroalimentación del cliente, indicadores de desempeño.', salidas: 'Política de calidad, objetivos estratégicos, actas de revisión por la dirección.', indicador: '% cumplimiento de objetivos de calidad', responsable: 'Gerente General', clausula: 'Cap. 5', procedimiento: 'PR-DIR-01: Revisión por la Dirección\n1. Recopilar informes de indicadores y auditorías.\n2. Revisar el desempeño del SGC en reunión.\n3. Identificar oportunidades de mejora y asignar responsables.\n4. Emitir acta y comunicar decisiones a las áreas.' },
  'planificación del sgc':   { objetivo: 'Establecer acciones para abordar riesgos y lograr objetivos de calidad.', entradas: 'Contexto organizacional, DOFA, PESTEL, requisitos de partes interesadas.', salidas: 'Matriz de riesgos y oportunidades, plan de acción, objetivos de calidad.', indicador: '% de riesgos con plan de tratamiento activo', responsable: 'Director de Calidad', clausula: 'Cap. 6', procedimiento: 'PR-PLA-01: Gestión de Riesgos\n1. Identificar riesgos y oportunidades del contexto.\n2. Valorar probabilidad e impacto de cada riesgo.\n3. Definir acciones de tratamiento y responsables.\n4. Hacer seguimiento trimestral y actualizar la matriz.' },
  'mejora continua':          { objetivo: 'Gestionar no conformidades y acciones correctivas para mejorar el SGC.', entradas: 'Hallazgos de auditorías, quejas, indicadores fuera de meta.', salidas: 'Acciones correctivas ejecutadas, informes de mejora, cierre de no conformidades.', indicador: '% de acciones correctivas cerradas en el plazo', responsable: 'Coordinador de Calidad', clausula: 'Cap. 10', procedimiento: 'PR-MEJ-01: Control de No Conformidades\n1. Registrar la no conformidad con evidencia objetiva.\n2. Analizar causa raíz (5 Por qués o Ishikawa).\n3. Definir e implementar acción correctiva.\n4. Verificar eficacia a los 30 días y cerrar el registro.' },
}

function generateProcessDetail(nombre: string, tipo: 'estrategico' | 'misional' | 'apoyo'): ProcessDetail {
  const prefix = tipo === 'estrategico' ? 'PE' : tipo === 'misional' ? 'PO' : 'PA'
  const code   = `${prefix}-${Math.floor(Math.random() * 90 + 10)}`
  const templates = {
    estrategico: { objetivo: `Garantizar la dirección estratégica en ${nombre} alineada con la política de calidad.`, entradas: 'Planes estratégicos, resultados de indicadores, informes de auditoría.', salidas: `Directrices de ${nombre}, actas de revisión, planes de acción aprobados.`, indicador: `% de cumplimiento de objetivos estratégicos de ${nombre}`, responsable: 'Gerencia / Alta Dirección', clausula: 'Cap. 5 / Cap. 6', procedimiento: `${code}-01: Procedimiento de ${nombre}\n1. Revisar el contexto y resultados del período anterior.\n2. Definir o ajustar los objetivos estratégicos.\n3. Asignar responsables y recursos necesarios.\n4. Comunicar las directrices a las áreas correspondientes.` },
    misional:    { objetivo: `Ejecutar y controlar ${nombre} conforme a los requisitos del cliente y los estándares de calidad.`, entradas: `Requisitos del cliente, orden de trabajo, especificaciones técnicas para ${nombre}.`, salidas: `Producto o servicio conforme de ${nombre}, registros de calidad.`, indicador: `% de conformidad en la entrega de ${nombre} (meta ≥95%)`, responsable: `Líder / Jefe de ${nombre}`, clausula: 'Cap. 8', procedimiento: `${code}-01: Procedimiento de ${nombre}\n1. Recibir y revisar los requisitos.\n2. Verificar disponibilidad de recursos.\n3. Ejecutar conforme a instrucciones de trabajo.\n4. Realizar controles de calidad y documentar.` },
    apoyo:       { objetivo: `Proveer recursos y soporte necesarios a través de ${nombre}.`, entradas: `Solicitudes de servicio interno, planes de ${nombre}, normativas aplicables.`, salidas: `Servicios de soporte de ${nombre} entregados, registros de actividades.`, indicador: `% de solicitudes de ${nombre} atendidas oportunamente (meta ≥90%)`, responsable: `Coordinador / Jefe de ${nombre}`, clausula: 'Cap. 7', procedimiento: `${code}-01: Procedimiento de ${nombre}\n1. Recibir y priorizar solicitudes según urgencia.\n2. Asignar el recurso o especialista responsable.\n3. Ejecutar con base en procedimientos vigentes.\n4. Registrar la actividad y el tiempo de respuesta.` },
  }
  const t = templates[tipo]
  return { objetivo: t.objetivo, entradas: t.entradas, salidas: t.salidas, indicador: t.indicador, responsable: t.responsable, clausula: t.clausula, procedimiento: t.procedimiento }
}

function injectAIDetails(mapa: MapaData): void {
  const inject = (items: ProcesoItem[], tipo: 'estrategico' | 'misional' | 'apoyo') => {
    for (const item of items) {
      const key = item.nombre.toLowerCase()
      if (!processDetailsMap[key]) processDetailsMap[key] = generateProcessDetail(item.nombre, tipo)
    }
  }
  inject(mapa.estrategicos, 'estrategico')
  inject(mapa.misionales,   'misional')
  inject(mapa.apoyo,        'apoyo')
}

function findProcessDetail(nombre: string): ProcessDetail | null {
  const lower = nombre.toLowerCase()
  for (const [key, val] of Object.entries(processDetailsMap)) {
    if (lower.includes(key) || key.includes(lower.split(' ')[0])) return val
  }
  return null
}

function showProcessPopup(nombre: string, tipo: 'estrategico' | 'misional' | 'apoyo') {
  const detail     = findProcessDetail(nombre)
  const badgeColor = tipo === 'estrategico' ? '#c2410c' : tipo === 'misional' ? '#1e40af' : '#065f46'
  const badgeBg    = tipo === 'estrategico' ? '#fdba74' : tipo === 'misional' ? '#93c5fd' : '#6ee7b7'
  const tipoLabel  = tipo === 'estrategico' ? 'Estratégico' : tipo === 'misional' ? 'Misional' : 'Apoyo'

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
  ` : `<p style="color:#64748b;font-size:.85rem">Haz clic en <strong>Construir Manualmente</strong> o sube un organigrama para agregar la caracterización detallada de este proceso.</p>`

  Swal.fire({
    html: `
      <div style="text-align:left;font-family:inherit">
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:1rem">
          <span style="background:${badgeBg};color:${badgeColor};padding:3px 12px;border-radius:999px;font-size:.75rem;font-weight:700">${tipoLabel}</span>
          <strong style="font-size:1rem;color:#1a2b45">${nombre}</strong>
        </div>
        ${detailHtml}
      </div>`,
    showConfirmButton: false, showCloseButton: true, width: 620, padding: '1.5rem', background: '#ffffff',
  })
}

/* ─────────────────── MAPA CLÁSICO ISO ─────────────────── */
const ClassicMap: React.FC<{ mapa: MapaData }> = ({ mapa }) => (
  <div className="iso-map">
    <div className="iso-map__side iso-map__side--left">
      <div className="iso-map__client-box"><span className="iso-map__client-icon">👤</span><span className="iso-map__client-text">{mapa.cliente}</span></div>
      <div className="iso-map__arrow iso-map__arrow--right">→</div>
    </div>
    <div className="iso-map__center">
      <div className="iso-map__layer iso-map__layer--estrategico">
        <div className="iso-map__layer-label">PROCESOS ESTRATÉGICOS</div>
        <div className="iso-map__layer-cards">
          {mapa.estrategicos.map((p, i) => (
            <button key={i} className="iso-card iso-card--estrategico" onClick={() => showProcessPopup(p.nombre, 'estrategico')}>{p.nombre}</button>
          ))}
        </div>
      </div>
      <div className="iso-map__vert-arrow">▼</div>
      <div className="iso-map__layer iso-map__layer--misional">
        <div className="iso-map__layer-label">PROCESOS MISIONALES / CADENA DE VALOR</div>
        <div className="iso-map__layer-cards iso-map__layer-cards--flow">
          {mapa.misionales.map((p, i) => (
            <React.Fragment key={i}>
              <button className="iso-card iso-card--misional" onClick={() => showProcessPopup(p.nombre, 'misional')}>{p.nombre}</button>
              {i < mapa.misionales.length - 1 && <span className="iso-flow-arrow">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="iso-map__vert-arrow">▲</div>
      <div className="iso-map__layer iso-map__layer--apoyo">
        <div className="iso-map__layer-label">PROCESOS DE APOYO Y SOPORTE</div>
        <div className="iso-map__layer-cards">
          {mapa.apoyo.map((p, i) => (
            <button key={i} className="iso-card iso-card--apoyo" onClick={() => showProcessPopup(p.nombre, 'apoyo')}>{p.nombre}</button>
          ))}
        </div>
      </div>
    </div>
    <div className="iso-map__side iso-map__side--right">
      <div className="iso-map__arrow iso-map__arrow--right">→</div>
      <div className="iso-map__client-box"><span className="iso-map__client-icon">😊</span><span className="iso-map__client-text">{mapa.satisfaccion}</span></div>
    </div>
  </div>
)

/* ─────────────────── FORMULARIO MANUAL ─────────────────── */
type ProcessField = keyof Pick<MapaData, 'estrategicos' | 'misionales' | 'apoyo'>

interface SectionProps {
  label: string; field: ProcessField; items: ProcesoItem[]
  onUpdate: (field: ProcessField, idx: number, val: string) => void
  onAdd: (field: ProcessField) => void
  onRemove: (field: ProcessField, idx: number) => void
}

const FormSection: React.FC<SectionProps> = ({ label, field, items, onUpdate, onAdd, onRemove }) => (
  <div className="manual-form__section">
    <div className="manual-form__section-label">{label}</div>
    {items.map((p, i) => (
      <div key={i} className="manual-form__row">
        <input className="filter-input manual-form__input" placeholder="Nombre del proceso..."
          value={p.nombre} onChange={e => onUpdate(field, i, e.target.value)} />
        {items.length > 1 && <button className="manual-form__del-btn" onClick={() => onRemove(field, i)}>✕</button>}
      </div>
    ))}
    <button className="manual-form__add-btn" onClick={() => onAdd(field)}>+ Agregar proceso</button>
  </div>
)

const ManualForm: React.FC<{ onSave: (m: MapaData) => void; onCancel: () => void }> = ({ onSave, onCancel }) => {
  const [data, setData] = useState<MapaData>({
    cliente: 'Requisitos del Cliente y Contexto', satisfaccion: 'Satisfacción del Cliente',
    estrategicos: [{ nombre: '' }], misionales: [{ nombre: '' }], apoyo: [{ nombre: '' }],
  })
  const addItem    = (key: ProcessField) => setData(d => ({ ...d, [key]: [...d[key], { nombre: '' }] }))
  const removeItem = (key: ProcessField, idx: number) => setData(d => ({ ...d, [key]: d[key].filter((_, i) => i !== idx) }))
  const updateItem = (key: ProcessField, idx: number, val: string) => setData(d => ({ ...d, [key]: d[key].map((p, i) => i === idx ? { nombre: val } : p) }))
  const handleSave = () => {
    const clean = (arr: ProcesoItem[]) => arr.filter(p => p.nombre.trim())
    if (!clean(data.estrategicos).length && !clean(data.misionales).length && !clean(data.apoyo).length) {
      Swal.fire({ icon: 'warning', title: 'Agrega al menos un proceso', timer: 2000, showConfirmButton: false }); return
    }
    onSave({ ...data, estrategicos: clean(data.estrategicos), misionales: clean(data.misionales), apoyo: clean(data.apoyo) })
  }
  return (
    <div className="manual-form panel">
      <div className="manual-form__header"><h3>✏️ Construcción Manual del Mapa de Procesos</h3><p>Ingresa los procesos de tu organización por categoría.</p></div>
      <div className="manual-form__clients">
        <div className="form-group"><label>Entrada (izquierda del mapa)</label><input className="filter-input form-control" value={data.cliente} onChange={e => setData(d => ({ ...d, cliente: e.target.value }))} /></div>
        <div className="form-group"><label>Salida (derecha del mapa)</label><input className="filter-input form-control" value={data.satisfaccion} onChange={e => setData(d => ({ ...d, satisfaccion: e.target.value }))} /></div>
      </div>
      <FormSection label="🔵 Procesos Estratégicos"                field="estrategicos" items={data.estrategicos} onUpdate={updateItem} onAdd={addItem} onRemove={removeItem} />
      <FormSection label="🟦 Procesos Misionales / Cadena de Valor" field="misionales"   items={data.misionales}   onUpdate={updateItem} onAdd={addItem} onRemove={removeItem} />
      <FormSection label="🟩 Procesos de Apoyo y Soporte"           field="apoyo"        items={data.apoyo}        onUpdate={updateItem} onAdd={addItem} onRemove={removeItem} />
      <div className="manual-form__footer">
        <button className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
        <button className="btn btn--primary" onClick={handleSave}>Generar Mapa →</button>
      </div>
    </div>
  )
}

/* ─────────────────── UPLOAD AI ─────────────────── */
const UploadAI: React.FC<{ onSave: (m: MapaData) => void; onCancel: () => void }> = ({ onSave, onCancel }) => {
  const [file, setFile]       = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef               = useRef<HTMLInputElement>(null)

  const classify = (text: string): 'estrategico' | 'misional' | 'apoyo' | null => {
    const t = text.toLowerCase()
    if (['gerencia','dirección','directivo','estrategia','calidad','planificación','mejora','innovación'].some(k => t.includes(k))) return 'estrategico'
    if (['ventas','comercial','producción','operaciones','diseño','desarrollo','servicio al cliente','manufactura','proyectos','prestación','fabricación'].some(k => t.includes(k))) return 'misional'
    if (['talento humano','recursos humanos','rrhh','finanzas','contabilidad','infraestructura','mantenimiento','ti ','tecnología','compras','logística','documentos','jurídica','legal','auditoria'].some(k => t.includes(k))) return 'apoyo'
    return null
  }

  const parseContent = (content: string): MapaData => {
    const lines = content.split(/[\n\r,;|\t•·\-–—]+/).map(l => l.replace(/[^a-zA-Zà-üÀ-Ü ]/g, ' ').trim()).filter(l => l.length > 3 && l.length < 80)
    const estrategicos: ProcesoItem[] = [], misionales: ProcesoItem[] = [], apoyo: ProcesoItem[] = []
    const seen = new Set<string>()
    for (const line of lines) {
      const cat = classify(line); if (!cat) continue
      const nombre = line.trim().replace(/\b\w/g, c => c.toUpperCase())
      if (seen.has(nombre.toLowerCase())) continue
      seen.add(nombre.toLowerCase())
      if (cat === 'estrategico' && estrategicos.length < 5) estrategicos.push({ nombre })
      if (cat === 'misional'    && misionales.length   < 6) misionales.push({ nombre })
      if (cat === 'apoyo'       && apoyo.length         < 7) apoyo.push({ nombre })
    }
    if (!estrategicos.length) estrategicos.push({ nombre: 'Gestión Directiva' }, { nombre: 'Planificación Estratégica' })
    if (!misionales.length)   misionales.push({ nombre: 'Producción / Operaciones' }, { nombre: 'Ventas y Comercial' })
    if (!apoyo.length)        apoyo.push({ nombre: 'Talento Humano' }, { nombre: 'Finanzas' }, { nombre: 'TI e Infraestructura' })
    return { cliente: 'Requisitos del Cliente y Contexto', satisfaccion: 'Satisfacción del Cliente', estrategicos, misionales, apoyo }
  }

  const handleGenerate = async () => {
    if (!file) { Swal.fire({ icon: 'warning', title: 'Selecciona un archivo primero', timer: 2000, showConfirmButton: false }); return }
    setLoading(true)
    if (file.type.startsWith('image/')) {
      try {
        const toBase64 = (f: File): Promise<string> => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve((r.result as string).split(',')[1]); r.onerror = reject; r.readAsDataURL(f) })
        const base64 = await toBase64(file)
        const token  = localStorage.getItem('governex_token')
        const BASE   = import.meta.env.VITE_API_URL || ''
        const res = await fetch(`${BASE}/api/gemini/extraer-procesos-imagen`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) }, body: JSON.stringify({ base64, mimeType: file.type, fileName: file.name }) })
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const generated: MapaData = await res.json()
        injectAIDetails(generated); setLoading(false)
        const total = generated.estrategicos.length + generated.misionales.length + generated.apoyo.length
        Swal.fire({ icon:'success', title:'¡Organigrama procesado!', html:`<p>Governex Vision analizó <b>${file.name}</b> e identificó <b>${total} procesos</b>. Ahora completa los datos de tu empresa.</p>`, confirmButtonText:'Continuar', confirmButtonColor:'#1a6ebd' }).then(() => onSave(generated))
      } catch {
        setLoading(false)
        const generated: MapaData = { cliente:'Requisitos del Cliente y Contexto', satisfaccion:'Satisfacción del Cliente', estrategicos:[{nombre:'Gerencia General'},{nombre:'Gestión de Calidad'},{nombre:'Planeación Estratégica'}], misionales:[{nombre:'Desarrollo de Producto'},{nombre:'Producción / Operaciones'},{nombre:'Ventas y Atención al Cliente'}], apoyo:[{nombre:'Talento Humano'},{nombre:'Finanzas y Contabilidad'},{nombre:'Compras y Logística'},{nombre:'TI e Infraestructura'}] }
        injectAIDetails(generated)
        Swal.fire({ icon:'info', title:'Usando procesos base', html:`<p>No se pudo leer el organigrama. Se usarán procesos base.</p>`, confirmButtonText:'Continuar', confirmButtonColor:'#1a6ebd' }).then(() => onSave(generated))
      }
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => { const content = ev.target?.result as string ?? ''; const generatedMapa = parseContent(content); injectAIDetails(generatedMapa); setLoading(false); const total = generatedMapa.estrategicos.length + generatedMapa.misionales.length + generatedMapa.apoyo.length; Swal.fire({ icon:'success', title:'¡Documento procesado!', html:`<p>Se analizó <b>${file.name}</b> e identificaron <b>${total} procesos</b>.</p>`, confirmButtonText:'Continuar', confirmButtonColor:'#1a6ebd' }).then(() => onSave(generatedMapa)) }
      reader.onerror = () => { setLoading(false); Swal.fire({ icon:'error', title:'Error al leer el archivo' }) }
      reader.readAsText(file, 'utf-8')
    }
  }

  return (
    <div className="upload-ai panel">
      <div className="upload-ai__header"><h3>🤖 Generar Mapa con Governex IA</h3><p>Sube tu organigrama, descripción de la empresa o cualquier documento con la estructura organizacional.</p></div>
      <div className={`upload-ai__dropzone ${file ? 'has-file' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f) }} onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg" style={{ display:'none' }} onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
        {file ? (<><span className="upload-ai__file-icon">📄</span><span className="upload-ai__file-name">{file.name}</span><span className="upload-ai__file-size">{(file.size/1024).toFixed(1)} KB · Listo para analizar</span></>) : (<><span className="upload-ai__drop-icon">☁️</span><span className="upload-ai__drop-title">Arrastra tu archivo aquí</span><span className="upload-ai__drop-sub">o haz clic para seleccionar · PDF, DOCX, TXT, Imagen</span></>)}
      </div>
      <div className="upload-ai__tips"><strong>💡 ¿Qué puedes subir?</strong><ul><li>Organigrama de la empresa (imagen JPG/PNG o PDF)</li><li>Descripción de áreas y cargos (.txt o .docx)</li><li>Manual de funciones o de calidad existente</li></ul></div>
      {loading && (<div className="upload-ai__loading"><div className="upload-ai__spinner"></div><span>Procesando archivo...</span></div>)}
      <div className="upload-ai__footer">
        <button className="btn btn--secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
        <button className="btn btn--primary" onClick={handleGenerate} disabled={loading}>{loading ? 'Procesando...' : '🤖 Procesar con IA'}</button>
      </div>
    </div>
  )
}

/* ─────────────────── DOFA QUADRANT ─────────────────── */
interface DofaQuadrantProps { title:string; subtitle:string; icon:string; variant:'fortaleza'|'oportunidad'|'debilidad'|'amenaza'; items:string[] }
const DofaQuadrant: React.FC<DofaQuadrantProps> = ({ title, subtitle, icon, variant, items }) => (
  <div className={`dofa-quadrant dofa-quadrant--${variant}`}>
    <div className="dofa-quadrant__header"><span className="dofa-quadrant__icon">{icon}</span><div><div className="dofa-quadrant__title">{title}</div><div className="dofa-quadrant__subtitle">{subtitle}</div></div></div>
    <ul className="dofa-quadrant__list">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
  </div>
)

/* ─── SPINNER OVERLAY ─────────────────── */
const GovernexIALoadingOverlay: React.FC = () => (
  <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:9999 }}>
    <div style={{ background:'#fff',borderRadius:'1rem',padding:'2.5rem 3rem',display:'flex',flexDirection:'column',alignItems:'center',gap:'1rem',boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
      <div style={{ width:52,height:52,border:'5px solid #e2e8f0',borderTop:'5px solid #1a6ebd',borderRadius:'50%',animation:'spin 0.9s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontWeight:700,fontSize:'1.1rem',color:'#1a2b45' }}>Analizando con Governex IA</div>
        <div style={{ color:'#64748b',fontSize:'0.875rem',marginTop:4 }}>Generando PESTEL, DOFA, Caracterización y Contexto Organizacional…</div>
      </div>
    </div>
  </div>
)

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
const ProcesosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('mapa')
  const [mapMode,   setMapMode]   = useState<MapMode>('empty')
  const [mapa,      setMapa]      = useState<MapaData>(defaultMapa)
  const [showMap,   setShowMap]   = useState(true)

  const {
    analysis: globalAnalysis,
    setAnalysis: setGlobalAnalysis,
    setDatosEmpresa,
    datosEmpresa,
    actividades,
    addActividad,
    removeActividad,
  } = useAIAnalysis()

  const { canEdit, canCreate, canDelete } = usePermissions('procesos')

  const [aiAnalysis,    setAiAnalysis]    = useState<AiAnalysis | null>(globalAnalysis as any)
  const [governexIALoading, setGovernexIALoading] = useState(false)
  const [showEmpresaForm, setShowEmpresaForm] = useState(false)
  const [showActividadModal, setShowActividadModal] = useState(false)

  React.useEffect(() => {
    if (globalAnalysis) setAiAnalysis(globalAnalysis as any)
  }, [globalAnalysis])

  React.useEffect(() => {
    if (globalAnalysis?.caracterizacion?.length) {
      const reconstruido = mapaDesdeCaracterizacion(globalAnalysis.caracterizacion as CaracterizacionRow[])
      if (reconstruido) {
        injectAIDetails(reconstruido)
        setMapa(reconstruido)
      }
    }
  }, [globalAnalysis])

  // Ref para el mapa pendiente — evita incluirlo en deps de useCallback
  const pendingMapaRef = useRef<MapaData | null>(null)

  const { data: procesosDB, loading: lProc }  = useFetch(procesosService.getAll,   [])
  const { data: pestelDB,   loading: lPestel } = useFetch(procesosService.getPestel, [])
  const { data: dofaDB,     loading: lDofa }   = useFetch(procesosService.getDofa,   [])

  /* ── Governex IA call — estable (solo deps que no cambian cada render) */
  const callGovernexIA = useCallback(async (newMapa: MapaData, datos: DatosEmpresa) => {
    setGovernexIALoading(true)
    try {
      const token = localStorage.getItem('governex_token')
      const BASE  = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${BASE}/api/gemini/analizar-organigrama`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mapa: newMapa, nombreEmpresa: datos.nombreEmpresa, sector: datos.sector, datosEmpresa: datos, guardarEnBD: true }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({ error:'Error desconocido' })); throw new Error(err.error || `Error ${res.status}`) }

      const data: AiAnalysis = await res.json()
      setAiAnalysis(data)

      const datosConNarrativo: DatosEmpresa = { ...datos, contextoNarrativo: data.contextoNarrativo ?? '' }
      setDatosEmpresa(datosConNarrativo)
      setGlobalAnalysis({
        pestel:          Array.isArray(data.pestel)          ? data.pestel          as any : [],
        dofa:            Array.isArray(data.dofa)            ? data.dofa            as any : [],
        caracterizacion: Array.isArray(data.caracterizacion) ? data.caracterizacion as any : [],
        matrizRoles:     Array.isArray(data.matrizRoles) && data.matrizRoles.length > 0 ? data.matrizRoles as any : undefined,
        matrizCargos:    Array.isArray(data.matrizCargos) && data.matrizCargos.length > 0 ? data.matrizCargos as any : undefined,
        matrizRecursos:  Array.isArray(data.matrizRecursos) && data.matrizRecursos.length > 0 ? data.matrizRecursos as any : undefined,
        indicadores:     Array.isArray(data.indicadores) && data.indicadores.length > 0 ? data.indicadores as any : undefined,
        datosEmpresa:    datosConNarrativo,
      })

      const total = newMapa.estrategicos.length + newMapa.misionales.length + newMapa.apoyo.length
      Swal.fire({
        icon: 'success', title: '¡Análisis generado!',
        html: `<p>Governex analizó <b>${total} procesos</b> de <b>${datos.nombreEmpresa || 'tu empresa'}</b> y generó:<br>
          ✅ <b>${data.pestel?.length ?? 0}</b> factores PESTEL<br>
          ✅ <b>${data.dofa?.length ?? 0}</b> elementos DOFA<br>
          ✅ <b>${data.caracterizacion?.length ?? 0}</b> fichas de caracterización<br>
          ✅ <b>${data.matrizRoles?.length ?? 0}</b> roles en matriz<br>
          ✅ <b>${data.matrizRecursos?.length ?? 0}</b> evaluaciones de recursos y ambiente<br>
          ✅ <b>${data.indicadores?.length ?? 0}</b> indicadores de proceso y desempeño<br>
          ✅ Contexto organizacional narrativo</p>`,
        confirmButtonText: 'Ver resultados', confirmButtonColor: '#1a6ebd',
      }).then(() => setActiveTab('contexto'))
    } catch (err: any) {
      Swal.fire({ icon:'error', title:'Error al analizar con Governex', text: err.message ?? 'Error inesperado' })
    } finally {
      setGovernexIALoading(false)
    }
  }, [setDatosEmpresa, setGlobalAnalysis])

  /* ── handleSave: guarda mapa y abre modal empresa ─────── */
  const handleSave = useCallback((newMapa: MapaData) => {
    setMapa(newMapa)
    setMapMode('empty')
    setShowMap(true)
    injectAIDetails(newMapa)
    pendingMapaRef.current = newMapa
    setShowEmpresaForm(true)
  }, [])

  /* ── ESTABLE: no se recrea en cada render ────────────── */
  const handleEmpresaConfirm = useCallback(async (datos: DatosEmpresa) => {
    setShowEmpresaForm(false)
    const mapaActual = pendingMapaRef.current
    if (mapaActual) {
      pendingMapaRef.current = null
      await callGovernexIA(mapaActual, datos)
    }
  }, [callGovernexIA])

  /* ── ESTABLE: cierre del modal ──────────────────────── */
  const handleEmpresaCancel = useCallback(() => {
    setShowEmpresaForm(false)
    pendingMapaRef.current = null
  }, [])

  /* ── Handler para guardar actividad ─────────────────── */
  const handleGuardarActividad = useCallback((act: ActividadEmpresa) => {
    addActividad(act)
    setShowActividadModal(false)
  }, [addActividad])

  /* ── Re-analizar desde el panel de contexto ─────────── */
  const handleReanalizar = useCallback(() => {
    pendingMapaRef.current = mapa
    setShowEmpresaForm(true)
  }, [mapa])

  /* ── Plantilla: datos empresa + organigrama listos ───── */
  const handlePlantillaListos = useCallback(async (
    datos: DatosEmpresa,
    orgBase64: string,
    orgMime:   string,
    orgNombre: string,
  ) => {
    setMapMode('empty')
    setShowMap(true)

    if (orgBase64) {
      // Hay organigrama: extraer procesos con la misma ruta que UploadAI imagen
      setGovernexIALoading(true)
      try {
        const token = localStorage.getItem('governex_token')
        const BASE  = import.meta.env.VITE_API_URL || ''
        const res   = await fetch(`${BASE}/api/gemini/extraer-procesos-imagen`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body:    JSON.stringify({ base64: orgBase64, mimeType: orgMime, fileName: orgNombre }),
        })
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const generatedMapa: MapaData = await res.json()
        injectAIDetails(generatedMapa)
        setMapa(generatedMapa)
        setGovernexIALoading(false)
        await callGovernexIA(generatedMapa, datos)
      } catch {
        // Fallback: analizar con mapa actual si falla la extracción
        setGovernexIALoading(false)
        const fallbackMapa: MapaData = {
          cliente: 'Requisitos del Cliente y Contexto',
          satisfaccion: 'Satisfacción del Cliente',
          estrategicos: [{ nombre: 'Gestión Directiva' }, { nombre: 'Planificación Estratégica' }, { nombre: 'Gestión de Calidad' }],
          misionales:   [{ nombre: 'Desarrollo de Producto' }, { nombre: 'Producción / Operaciones' }, { nombre: 'Ventas y Comercial' }],
          apoyo:        [{ nombre: 'Talento Humano' }, { nombre: 'Finanzas' }, { nombre: 'TI e Infraestructura' }, { nombre: 'Compras y Logística' }],
        }
        injectAIDetails(fallbackMapa)
        setMapa(fallbackMapa)
        await callGovernexIA(fallbackMapa, datos)
      }
    } else {
      // Sin organigrama: analizar directamente con los datos de empresa
      const mapaActual = mapa
      await callGovernexIA(mapaActual, datos)
    }
  }, [mapa, callGovernexIA])

  /* ── Lista de procesos para el modal de actividad ────── */
  const procesosParaModal = React.useMemo(() => {
    return [
      ...mapa.estrategicos.map(p => p.nombre),
      ...mapa.misionales.map(p => p.nombre),
      ...mapa.apoyo.map(p => p.nombre),
    ].filter(Boolean)
  }, [mapa])

  const total = mapa.estrategicos.length + mapa.misionales.length + mapa.apoyo.length
  const pestelData: PestelRow[] = aiAnalysis?.pestel ?? []

  const dofaFinal = (() => {
    if (!aiAnalysis?.dofa?.length) return { fortalezas:[], oportunidades:[], debilidades:[], amenazas:[] }
    return {
      fortalezas:    aiAnalysis.dofa.filter(d => d.tipo==='Fortaleza').map(d => d.descripcion),
      oportunidades: aiAnalysis.dofa.filter(d => d.tipo==='Oportunidad').map(d => d.descripcion),
      debilidades:   aiAnalysis.dofa.filter(d => d.tipo==='Debilidad').map(d => d.descripcion),
      amenazas:      aiAnalysis.dofa.filter(d => d.tipo==='Amenaza').map(d => d.descripcion),
    }
  })()

  const caracterizacionData: CaracterizacionRow[] = aiAnalysis?.caracterizacion ?? []

  return (
    <div className="page procesos-page">
      {governexIALoading && <GovernexIALoadingOverlay />}

      {/* Modal empresa — callbacks estables, no se re-monta */}
      {showEmpresaForm && (
        <EmpresaFormModal
          initial={datosEmpresa ?? {}}
          onConfirm={handleEmpresaConfirm}
          onCancel={handleEmpresaCancel}
        />
      )}

      {/* Modal de actividad */}
      {showActividadModal && (
        <ActividadModal
          procesosDisponibles={procesosParaModal}
          onGuardar={handleGuardarActividad}
          onCerrar={() => setShowActividadModal(false)}
        />
      )}

      <header className="page__header procesos-page__header">
        <div className="procesos-page__header-left">
          <nav className="procesos-page__breadcrumb">
            <span>Governex</span><span className="procesos-page__bc-sep">›</span>
            <span>Cap. 4</span><span className="procesos-page__bc-sep">›</span>
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
          {aiAnalysis && (
            <div className="procesos-kpi" style={{ borderLeft:'3px solid #1a6ebd' }}>
              <span className="procesos-kpi__value" style={{ color:'#1a6ebd' }}>✓</span>
              <span className="procesos-kpi__label">Analizado por IA</span>
            </div>
          )}
        </div>
      </header>

      <nav className="procesos-tabs">
        {([{id:'mapa',label:'🗺️ Mapa de Procesos'},{id:'contexto',label:'🌐 Contexto Organizacional'},{id:'caracterizacion',label:'📋 Caracterización'}] as {id:Tab;label:string}[]).map(t => (
          <button key={t.id} className={`procesos-tabs__tab${activeTab===t.id?' procesos-tabs__tab--active':''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      {/* TAB 1: MAPA */}
      {activeTab === 'mapa' && (
        <div className="procesos-mapa-wrap">
          {mapMode === 'empty' && (
            <>
              <div className="iso-map__actions">
                <button className="iso-action-btn iso-action-btn--manual" onClick={() => { setShowMap(false); setMapMode('manual') }}>
                  <span className="iso-action-btn__icon">✏️</span>
                  <div><div className="iso-action-btn__title">Construir Manualmente</div><div className="iso-action-btn__desc">Ingresa los procesos de tu empresa uno a uno</div></div>
                </button>
                <button className="iso-action-btn iso-action-btn--ai" onClick={() => { setShowMap(false); setMapMode('plantilla') }}>
                  <span className="iso-action-btn__icon">🤖</span>
                  <div><div className="iso-action-btn__title">Generar con IA</div><div className="iso-action-btn__desc">Descarga la plantilla, añade tu organigrama y datos de empresa, y Governex construye el análisis completo</div></div>
                </button>
              </div>
              {showMap && (
                <div className="panel iso-map-panel">
                  <div className="iso-map-panel__header">
                    <h3>Mapa de Procesos — Estructura de Procesos</h3>
                    <span className="pill pill--muted">Cláusula 4.4</span>
                    {aiAnalysis && <span className="pill pill--success" style={{ marginLeft:8 }}>✓ Analizado por Governex</span>}
                  </div>
                  <ClassicMap mapa={mapa} />
                  {!aiAnalysis && (
                    <div style={{ marginTop:'1rem',padding:'0.75rem 1rem',background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:'0.5rem',fontSize:'0.85rem',color:'#0369a1' }}>
                      💡 <strong>Consejo:</strong> Usa <em>Construir Manualmente</em> o <em>Generar con IA</em> para que Governex analice tus procesos y genere PESTEL, DOFA y Caracterización personalizados.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {mapMode === 'manual'    && <ManualForm         onSave={handleSave}  onCancel={() => { setMapMode('empty'); setShowMap(true) }} />}
          {mapMode === 'ai'        && <UploadAI            onSave={handleSave}  onCancel={() => { setMapMode('empty'); setShowMap(true) }} />}
          {mapMode === 'plantilla' && <PlantillaOrganizacion currentDatos={datosEmpresa} onDatosYOrganigramaListos={handlePlantillaListos} onCancel={() => { setMapMode('empty'); setShowMap(true) }} />}
        </div>
      )}

      {/* TAB 2: CONTEXTO */}
      {activeTab === 'contexto' && (
        <div className="procesos-contexto">
          {datosEmpresa ? (
            <ContextoOrganizacionalPanel datos={datosEmpresa} onEditar={handleReanalizar} />
          ) : (
            <div style={{ padding:'1rem 1.25rem',background:'#fffbeb',border:'1px solid #fde68a',borderLeft:'4px solid #f59e0b',borderRadius:'0.75rem',marginBottom:'1.5rem',color:'#92400e',fontSize:'0.875rem',lineHeight:1.6 }}>
              ⚠️ <strong>Sin datos de la empresa.</strong> Ve a la pestaña <em>Mapa de Procesos</em>, construye o sube tu organigrama y completa el formulario de la empresa para que Governex genere el análisis personalizado.
            </div>
          )}

          {!aiAnalysis && !lPestel && pestelDB.length === 0 && (
            <div style={{ padding:'1.5rem',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'0.75rem',marginBottom:'1.5rem',color:'#92400e',fontSize:'0.875rem' }}>
              ⚠️ <strong>Sin análisis personalizado.</strong> Ve a la pestaña <em>Mapa de Procesos</em>, construye o sube tu organigrama y Governex generará el PESTEL y DOFA específico.
            </div>
          )}

          <section className="panel">
            <div className="procesos-section-header">
              <div>
                <h3 className="procesos-section-title">Análisis PESTEL</h3>
                <p className="procesos-section-desc">Análisis del contexto externo · Cláusula 4.1{aiAnalysis && <span style={{ marginLeft:8,color:'#1a6ebd',fontWeight:600 }}>— Generado por Governex IA ✓</span>}</p>
              </div>
              <span className="pill pill--muted">{pestelData.length} factores identificados</span>
            </div>
            {lPestel && !aiAnalysis ? <div style={{ padding:'1rem',opacity:0.5 }}>Cargando PESTEL...</div> : (
              <div className="procesos-pestel__table-wrap">
                <table className="procesos-pestel__table">
                  <thead><tr><th>Factor</th><th>Categoría</th><th>Descripción</th><th>Impacto</th><th>Tipo</th></tr></thead>
                  <tbody>
                    {pestelData.map((row: PestelRow, i: number) => (
                      <tr key={i}>
                        <td>
                          {(() => {
                            const letter = (row.categoria || row.factor || 'P').charAt(0).toUpperCase();
                            return (
                              <span className={`pestel-factor pestel-factor--${letter.toLowerCase()}`}>{letter}</span>
                            );
                          })()}
                        </td>
                        <td className="pestel-categoria">{row.categoria}</td>
                        <td className="pestel-desc">{row.descripcion}</td>
                        <td><span className={`pill ${row.impacto==='Alto'?'pill--danger':row.impacto==='Medio'?'pill--warning':'pill--muted'}`}>{row.impacto}</span></td>
                        <td><span className={`pill ${row.oportunidad?'pill--success':'pill--danger'}`}>{row.oportunidad?'Oportunidad':'Amenaza'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="procesos-section-header">
              <div>
                <h3 className="procesos-section-title">Matriz DOFA</h3>
                <p className="procesos-section-desc">Análisis interno y externo · Cláusula 4.1 y 6.1{aiAnalysis && <span style={{ marginLeft:8,color:'#1a6ebd',fontWeight:600 }}>— Generado por Governex IA ✓</span>}</p>
              </div>
            </div>
            {lDofa && !aiAnalysis ? <div style={{ padding:'1rem',opacity:0.5 }}>Cargando DOFA...</div> : (
              <div className="dofa-grid">
                <DofaQuadrant title="Fortalezas"    subtitle="Factores internos positivos" icon="💪" variant="fortaleza"  items={dofaFinal.fortalezas}    />
                <DofaQuadrant title="Oportunidades" subtitle="Factores externos positivos" icon="🚀" variant="oportunidad" items={dofaFinal.oportunidades} />
                <DofaQuadrant title="Debilidades"   subtitle="Factores internos negativos" icon="⚠️" variant="debilidad"  items={dofaFinal.debilidades}   />
                <DofaQuadrant title="Amenazas"      subtitle="Factores externos negativos" icon="🛡️" variant="amenaza"    items={dofaFinal.amenazas}      />
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: CARACTERIZACIÓN */}
      {activeTab === 'caracterizacion' && (
        <div className="procesos-char panel">
          <div className="procesos-section-header">
            <div>
              <h3 className="procesos-section-title">Caracterización de Procesos</h3>
              <p className="procesos-section-desc">
                Fichas de entradas, salidas e indicadores · Cláusula 4.4
                {aiAnalysis && (
                  <span style={{ marginLeft: 8, color: '#1a6ebd', fontWeight: 600 }}>
                    — Generado por Governex IA ✓
                  </span>
                )}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="pill pill--muted">{caracterizacionData.length} procesos</span>
              <button
                className="btn btn--primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                onClick={() => setShowActividadModal(true)}
                disabled={!canCreate}
                title={!canCreate ? 'Tu rol no tiene permiso para esta acción' : undefined}
              >
                <span>⚙️</span> Registrar Actividad
              </button>
            </div>
          </div>

          {!aiAnalysis && !lProc && procesosDB.length === 0 && (
            <div style={{ padding:'1.5rem', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'0.75rem', marginBottom:'1.5rem', color:'#92400e', fontSize:'0.875rem' }}>
              ⚠️ <strong>Sin caracterización personalizada.</strong> Construye tu organigrama para que Governex genere las fichas.
            </div>
          )}

          {lProc && !aiAnalysis ? (
            <div style={{ padding:'1rem', opacity: 0.5 }}>Cargando procesos...</div>
          ) : (
            <div className="procesos-char__table-wrap">
              <table className="procesos-char__table">
                <thead>
                  <tr>
                    <th>Código</th><th>Proceso</th><th>Objetivo</th>
                    <th>Entradas</th><th>Salidas</th>
                    <th>Indicador</th><th>Responsable</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {caracterizacionData.map((row: CaracterizacionRow, i: number) => (
                    <tr key={row.codigo} className={i % 2 === 1 ? 'procesos-char__row--alt' : ''}>
                      <td className="procesos-char__code">{row.codigo}</td>
                      <td className="procesos-char__name">{row.proceso}</td>
                      <td className="procesos-char__objetivo">{row.objetivo}</td>
                      <td className="procesos-char__io">{row.entradas}</td>
                      <td className="procesos-char__io">{row.salidas}</td>
                      <td className="procesos-char__indicador">{row.indicador}</td>
                      <td className="procesos-char__resp">{row.responsable}</td>
                      <td>
                        <span className={`pill ${row.estado === 'Activo' ? 'pill--success' : row.estado === 'Revisión' ? 'pill--warning' : 'pill--muted'}`}>
                          {row.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── ACTIVIDADES REGISTRADAS ── */}
          {actividades.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '0.85rem', paddingBottom: '0.6rem',
                borderTop: '2px solid #e8edf4', paddingTop: '1rem',
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1a2b45' }}>
                    ⚙️ Actividades de la Empresa
                  </h4>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#7a8fa6' }}>
                    {actividades.length} actividad{actividades.length !== 1 ? 'es' : ''} registrada{actividades.length !== 1 ? 's' : ''} ·
                    Sus entradas y salidas se reflejan en §6.1 y §8.1
                  </p>
                </div>
                <span className="pill pill--success">{actividades.length} activ.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {actividades.map(act => (
                  <div
                    key={act.id}
                    style={{
                      border: '1px solid #e2e8f0', borderRadius: '0.65rem',
                      overflow: 'hidden', background: '#fafcff',
                    }}
                  >
                    {/* ── Encabezado de actividad ── */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.7rem 1rem',
                      background: 'linear-gradient(135deg, #eff6ff, #f8faff)',
                      borderBottom: '1px solid #e2e8f0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>⚙️</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a2b45' }}>
                            {act.nombre}
                          </div>
                          {act.proceso && (
                            <div style={{ fontSize: '0.73rem', color: '#7a8fa6', marginTop: 1 }}>
                              Proceso: {act.proceso}
                            </div>
                          )}
                        </div>
                      </div>
                      <PermissionGuard recurso="procesos" accion="eliminar" mode="hide">
                        <button
                          onClick={() => removeActividad(act.id)}
                          style={{
                            background: 'none', border: '1px solid #e2e8f0',
                            borderRadius: '0.35rem', padding: '0.25rem 0.6rem',
                            fontSize: '0.75rem', color: '#9ca3af', cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            (e.target as HTMLButtonElement).style.background = '#fee2e2'
                            ;(e.target as HTMLButtonElement).style.color = '#dc2626'
                            ;(e.target as HTMLButtonElement).style.borderColor = '#fca5a5'
                          }}
                          onMouseLeave={e => {
                            (e.target as HTMLButtonElement).style.background = 'none'
                            ;(e.target as HTMLButtonElement).style.color = '#9ca3af'
                            ;(e.target as HTMLButtonElement).style.borderColor = '#e2e8f0'
                          }}
                          title="Eliminar actividad"
                        >
                          ✕ Eliminar
                        </button>
                      </PermissionGuard>
                    </div>

                    {/* ── NUEVO: Objetivo e Indicador generados por IA ── */}
                    {(act.objetivo || act.indicador) && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: act.objetivo && act.indicador ? '1fr 1fr' : '1fr',
                        gap: 0,
                        borderBottom: '1px solid #e2e8f0',
                        background: 'linear-gradient(135deg, #f8fbff, #f0f7ff)',
                      }}>
                        {act.objetivo && (
                          <div style={{
                            padding: '0.65rem 1rem',
                            borderRight: act.indicador ? '1px solid #e2e8f0' : 'none',
                          }}>
                            <div style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: '#1e40af',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              marginBottom: '0.3rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}>
                              🎯 Objetivo
                              <span style={{
                                background: '#eff6ff',
                                color: '#1e40af',
                                fontSize: '0.6rem',
                                padding: '0.05rem 0.35rem',
                                borderRadius: 999,
                                fontWeight: 700,
                              }}>✨ IA</span>
                            </div>
                            <div style={{
                              fontSize: '0.82rem',
                              color: '#1e3a5f',
                              lineHeight: 1.5,
                            }}>
                              {act.objetivo}
                            </div>
                          </div>
                        )}
                        {act.indicador && (
                          <div style={{ padding: '0.65rem 1rem' }}>
                            <div style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: '#166534',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              marginBottom: '0.3rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}>
                              📊 Indicador de desempeño
                              <span style={{
                                background: '#f0fdf4',
                                color: '#166534',
                                fontSize: '0.6rem',
                                padding: '0.05rem 0.35rem',
                                borderRadius: 999,
                                fontWeight: 700,
                              }}>✨ IA</span>
                            </div>
                            <div style={{
                              fontSize: '0.82rem',
                              color: '#14532d',
                              lineHeight: 1.5,
                              fontWeight: 600,
                            }}>
                              {act.indicador}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Entradas / Salidas ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                      {/* Entradas */}
                      <div style={{ padding: '0.75rem 1rem', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{
                          fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8',
                          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem',
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                        }}>
                          <span>📥</span> Entradas
                          <span style={{
                            background: '#eff6ff', color: '#1d4ed8', fontSize: '0.65rem',
                            padding: '0.05rem 0.4rem', borderRadius: 999, fontWeight: 700,
                          }}>{act.entradas.length}</span>
                        </div>
                        {act.entradas.length === 0 ? (
                          <span style={{ fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic' }}>Sin entradas</span>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {act.entradas.map(e => (
                              <li key={e.id} style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.45 }}>
                                {e.valor}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Salidas */}
                      <div style={{ padding: '0.75rem 1rem' }}>
                        <div style={{
                          fontSize: '0.7rem', fontWeight: 700, color: '#166534',
                          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem',
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                        }}>
                          <span>📤</span> Salidas
                          <span style={{
                            background: '#f0fdf4', color: '#166534', fontSize: '0.65rem',
                            padding: '0.05rem 0.4rem', borderRadius: 999, fontWeight: 700,
                          }}>{act.salidas.length}</span>
                        </div>
                        {act.salidas.length === 0 ? (
                          <span style={{ fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic' }}>Sin salidas</span>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {act.salidas.map(s => (
                              <li key={s.id} style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.45 }}>
                                {s.valor}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* ── Footer de la actividad: KPIs generados ── */}
                    <div style={{
                      display: 'flex', gap: '0.5rem', padding: '0.55rem 1rem',
                      background: '#f8fafc', borderTop: '1px solid #e2e8f0',
                      fontSize: '0.73rem', color: '#7a8fa6',
                    }}>
                      <span style={{
                        background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
                        borderRadius: 999, padding: '0.1rem 0.55rem', fontWeight: 700,
                      }}>
                        ⚠️ {act.entradas.filter(e => e.valor.trim()).length} riesgo{act.entradas.filter(e => e.valor.trim()).length !== 1 ? 's' : ''} generado{act.entradas.filter(e => e.valor.trim()).length !== 1 ? 's' : ''}
                      </span>
                      <span style={{
                        background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
                        borderRadius: 999, padding: '0.1rem 0.55rem', fontWeight: 700,
                      }}>
                        🚀 {act.salidas.filter(s => s.valor.trim()).length} oportunidad{act.salidas.filter(s => s.valor.trim()).length !== 1 ? 'es' : ''} generada{act.salidas.filter(s => s.valor.trim()).length !== 1 ? 's' : ''}
                      </span>
                      <span style={{ marginLeft: 'auto', color: '#b0bdcc' }}>
                        Registrada {new Date(act.creadaEn).toLocaleDateString('es-CO')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ProcesosPage