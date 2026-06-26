import React, { createContext, useState, useContext } from 'react'

/* ── Datos del formulario de empresa ─────────────────────────── */
export interface DatosEmpresa {
  nombreEmpresa:      string
  sector:             string
  tipoEmpresa:        string
  tamano:             string
  ubicacion:          string
  anoFundacion:       string
  mision:             string
  vision:             string
  politicaCalidad:    string
  productosServicios: string
  mercadoObjetivo:    string
  cantidadEmpleados:  string
  alcanceSGC:         string
  certificaciones:    string
  parteInteresadas:   string
  contextoNarrativo?: string
}

export interface PestelRow {
  factor:      string
  categoria:   string
  descripcion: string
  impacto:     'Alto' | 'Medio' | 'Bajo'
  oportunidad: boolean
}

export interface DofaRow {
  tipo:        'Fortaleza' | 'Oportunidad' | 'Debilidad' | 'Amenaza'
  descripcion: string
}

export interface CaracterizacionRow {
  codigo:      string
  proceso:     string
  objetivo:    string
  entradas:    string
  salidas:     string
  indicador:   string
  responsable: string
  estado:      string
}

export type TipoProceso = 'estrategico' | 'misional' | 'apoyo'

export interface FilaMatriz {
  id:          number
  proceso:     string
  tipo:        TipoProceso
  responsable: string
  autoridad:   string
  funciones:   string
  recursos:    string
  rendicion:   string
  clausula:    string
}

export interface FilaMatrizCargos {
  id:              number
  proceso:         string
  tipo:            TipoProceso
  actividades:     string[]
  responsable:     string
  funciones:       string
  clausula:        string
  clausulaDetalle: string
}

export interface FilaMatrizRecursos {
  proceso:             string
  nPersonas:           string
  infraestructura:     string
  hardwareSoftware:    string
  transporte:          string
  ambienteSocial:      string
  ambientePsicologico: string
  ambienteFisico:      string
  varSocial:           number
  varPsicologica:      number
  varFisica:           number
  calificacionPromedio:number
  nivelRiesgoVerde:    string
  accionRequerida:     string
  recursoEvaluado:     string
  hallazgo:            string
  riesgo:              string
  impacto:             string
  probabilidad:        string
  nivelRiesgoAzul:     string
  oportunidad:         string
  accion:              string
}

/* ── Actividades propias de la empresa (§4.1 / §8.1) ─────────── */
export interface EntradaSalida {
  id:    string
  valor: string
}

export interface ActividadEmpresa {
  id:           string
  nombre:       string
  proceso:      string
  responsable:  string
  objetivo:     string
  indicador:    string
  entradas:     EntradaSalida[]
  salidas:      EntradaSalida[]
  creadaEn:     string
}

export interface ProyectoDiseno {
  id:           string
  actividadId?: string
  entradas:     string
  desarrollo:   string
  control:      string
  responsable:  string
  fechaInicio:  string
  fechaEntrega: string
  etapa:        'Planificación' | 'Desarrollo' | 'Verificación' | 'Validación' | 'Completado'
  estado:       'En tiempo' | 'En riesgo' | 'Retrasado'
}

export interface AIAnalysis {
  pestel:           PestelRow[]
  dofa:             DofaRow[]
  caracterizacion:  CaracterizacionRow[]
  matrizRoles?:     FilaMatriz[]
  matrizCargos?:    FilaMatrizCargos[]
  matrizRecursos?:  FilaMatrizRecursos[]
  indicadores?:     any[]
  nombreEmpresa?:   string
  sector?:          string
  datosEmpresa?:    DatosEmpresa
}

/* ── Tipos derivados §6.1 ────────────────────────────────────── */
export interface RiesgoDerivado {
  codigo:          string
  descripcion:     string
  tipo:            'Riesgo' | 'Oportunidad'
  fuente:          'PESTEL' | 'DOFA' | 'Recursos' | 'ACTIVIDAD'
  /** Categoría visible en la matriz — para actividades usa etiqueta "Actividad Propia" */
  categoria:       string
  /** Nombre completo de la actividad de origen (solo para fuente ACTIVIDAD) */
  actividadNombre?: string
  /** ID de la actividad de origen (solo para fuente ACTIVIDAD) */
  actividadId?:    string
  probabilidad:    number
  impacto:         number
  nivel:           number
  estado:          'CRITICO' | 'TRATAMIENTO' | 'MONITOREO'
  responsable:     string
  acciones:        string
}

export type FrecuenciaMedicion =
  | 'Mensual' | 'Bimestral' | 'Trimestral'
  | 'Cuatrimestral' | 'Semestral' | 'Anual'

export interface ObjetivoDerivado {
  codigo:                    string
  objetivo:                  string
  proceso_relacionado:       string
  fuente_riesgo_oportunidad: string
  tipo_fuente:               'Riesgo' | 'Oportunidad'
  accion:                    string
  responsable:               string
  recursos:                  string
  frecuencia_medicion:       FrecuenciaMedicion
  meta:                      string
  indicador:                 string
  fecha_inicio:              string
  fecha_fin:                 string
  estado:                    'Pendiente'
  mediciones:                []
  _riesgoCodigo:             string
  _riesgoNivel:              number
}

/* ── Context ─────────────────────────────────────────────────── */
interface AIAnalysisContextValue {
  analysis:        AIAnalysis | null
  datosEmpresa:    DatosEmpresa | null
  actividades:     ActividadEmpresa[]
  proyectosDiseno: ProyectoDiseno[]
  setAnalysis:     (a: AIAnalysis) => void
  setDatosEmpresa: (d: DatosEmpresa) => void
  setActividades:  (list: ActividadEmpresa[]) => void
  setProyectosDiseno: (list: ProyectoDiseno[]) => void
  addActividad:    (a: ActividadEmpresa) => void
  removeActividad: (id: string) => void
  addProyectoDiseno: (p: ProyectoDiseno) => void
  updateProyectoDiseno: (id: string, p: ProyectoDiseno) => void
  removeProyectoDiseno: (id: string) => void
  clearAnalysis:   () => void
}

const AIAnalysisContext = createContext<AIAnalysisContextValue | undefined>(undefined)

export const AIAnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [analysis, setAnalysisState] = useState<AIAnalysis | null>(() => {
    try { const s = sessionStorage.getItem('governex_ai_analysis'); return s ? JSON.parse(s) : null }
    catch { return null }
  })

  const [datosEmpresa, setDatosEmpresaState] = useState<DatosEmpresa | null>(() => {
    try { const s = sessionStorage.getItem('governex_datos_empresa'); return s ? JSON.parse(s) : null }
    catch { return null }
  })

  const [actividades, setActividadesState] = useState<ActividadEmpresa[]>(() => {
    try { const s = sessionStorage.getItem('governex_actividades'); return s ? JSON.parse(s) : [] }
    catch { return [] }
  })

  const [proyectosDiseno, setProyectosDisenoState] = useState<ProyectoDiseno[]>(() => {
    try { const s = sessionStorage.getItem('governex_proyectos_diseno'); return s ? JSON.parse(s) : [] }
    catch { return [] }
  })

  const setAnalysis = (a: AIAnalysis) => {
    setAnalysisState(a)
    try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(a)) } catch {}
  }

  const setDatosEmpresa = (d: DatosEmpresa) => {
    setDatosEmpresaState(d)
    try { sessionStorage.setItem('governex_datos_empresa', JSON.stringify(d)) } catch {}
  }

  const setActividades = (list: ActividadEmpresa[]) => {
    setActividadesState(list)
    try { sessionStorage.setItem('governex_actividades', JSON.stringify(list)) } catch {}
  }

  const setProyectosDiseno = (list: ProyectoDiseno[]) => {
    setProyectosDisenoState(list)
    try { sessionStorage.setItem('governex_proyectos_diseno', JSON.stringify(list)) } catch {}
  }

  const addActividad    = (a: ActividadEmpresa) => setActividades([...actividades, a])
  const removeActividad = (id: string) => setActividades(actividades.filter(a => a.id !== id))

  const addProyectoDiseno    = (p: ProyectoDiseno) => setProyectosDiseno([...proyectosDiseno, p])
  const updateProyectoDiseno = (id: string, updated: ProyectoDiseno) => setProyectosDiseno(proyectosDiseno.map(p => p.id === id ? updated : p))
  const removeProyectoDiseno = (id: string) => setProyectosDiseno(proyectosDiseno.filter(p => p.id !== id))

  const clearAnalysis = () => {
    setAnalysisState(null); setDatosEmpresaState(null); setActividadesState([]); setProyectosDisenoState([])
    try {
      sessionStorage.removeItem('governex_ai_analysis')
      sessionStorage.removeItem('governex_datos_empresa')
      sessionStorage.removeItem('governex_actividades')
      sessionStorage.removeItem('governex_proyectos_diseno')
    } catch {}
  }

  return (
    <AIAnalysisContext.Provider value={{
      analysis, datosEmpresa, actividades, proyectosDiseno,
      setAnalysis, setDatosEmpresa, setActividades, setProyectosDiseno,
      addActividad, removeActividad,
      addProyectoDiseno, updateProyectoDiseno, removeProyectoDiseno,
      clearAnalysis,
    }}>
      {children}
    </AIAnalysisContext.Provider>
  )
}

export const useAIAnalysis = (): AIAnalysisContextValue => {
  const ctx = useContext(AIAnalysisContext)
  if (!ctx) throw new Error('useAIAnalysis must be used within AIAnalysisProvider')
  return ctx
}

/* ── Generador de acciones por tipo/fuente/categoría ─────────── */
function generarAccion(
  tipo:        'Riesgo' | 'Oportunidad',
  categoria:   string,
  fuente:      'PESTEL' | 'DOFA' | 'Recursos' | 'ACTIVIDAD',
  nivel:       number,
  descripcion: string
): string {
  const cat  = categoria.toLowerCase()
  const desc = descripcion.toLowerCase()

  if (tipo === 'Oportunidad') {
    if (cat.includes('tecnol') || desc.includes('tecnol') || desc.includes('digital') || desc.includes('software'))
      return 'Diseñar e implementar un plan de adopción tecnológica; asignar presupuesto para pilotos y formación del equipo en las nuevas herramientas.'
    if (cat.includes('mercado') || cat.includes('comercial') || desc.includes('mercado') || desc.includes('client'))
      return 'Desarrollar estrategia de expansión de mercado; fortalecer canales de distribución y elaborar propuesta de valor diferenciada para el segmento identificado.'
    if (cat.includes('social') || desc.includes('tendencia') || desc.includes('demograf'))
      return 'Adaptar portafolio de productos/servicios a las tendencias sociales detectadas; lanzar campaña de posicionamiento orientada al nuevo perfil de cliente.'
    if (cat.includes('político') || cat.includes('legal') || cat.includes('regulat') || desc.includes('normativ'))
      return 'Anticiparse al marco regulatorio favorable; solicitar certificaciones o habilitaciones que otorguen ventaja competitiva ante el cambio normativo.'
    if (cat.includes('económi') || desc.includes('financ') || desc.includes('inversión'))
      return 'Elaborar propuesta de inversión para capturar la oportunidad financiera; evaluar alianzas estratégicas o acceso a líneas de crédito para su aprovechamiento.'
    if (cat.includes('ambiental') || desc.includes('sostenib') || desc.includes('verde'))
      return 'Implementar prácticas de producción sostenible; certificar procesos bajo estándares ambientales y comunicar la ventaja a clientes con enfoque ESG.'
    if (fuente === 'ACTIVIDAD')
      return 'Capitalizar los resultados del proceso para generar nuevo valor; revisar si alguna salida puede convertirse en un producto o servicio diferenciador para el cliente.'
    if (fuente === 'DOFA')
      return 'Diseñar plan de aprovechamiento con responsable, fechas e indicadores; alinear la oportunidad con los objetivos estratégicos de la organización.'
    return 'Formular plan de acción para capitalizar la oportunidad; definir responsable, recursos, cronograma e indicador de seguimiento.'
  }

  const prefijo = nivel >= 15 ? 'ACCIÓN INMEDIATA: ' : nivel >= 9 ? 'PRIORITARIO: ' : ''

  if (fuente === 'ACTIVIDAD')
    return `${prefijo}Establecer controles preventivos sobre el proceso completo para garantizar la continuidad de las operaciones y la calidad de las salidas; documentar criterios de aceptación y verificación en cada etapa.`
  if (cat.includes('tecnol') || desc.includes('sistema') || desc.includes('software'))
    return `${prefijo}Establecer plan de continuidad tecnológica; implementar copias de seguridad, redundancia y protocolo de recuperación ante fallos de sistemas.`
  if (cat.includes('legal') || cat.includes('regulat') || cat.includes('normativ') || desc.includes('normativ'))
    return `${prefijo}Revisar y actualizar procedimientos para asegurar cumplimiento normativo; designar responsable de seguimiento regulatorio y programar auditorías internas periódicas.`
  if (cat.includes('económi') || desc.includes('financ') || desc.includes('costo'))
    return `${prefijo}Diversificar proveedores y fuentes de ingresos; establecer reserva financiera de contingencia y monitorear indicadores económicos mensualmente.`
  if (cat.includes('social') || desc.includes('personal') || desc.includes('talento'))
    return `${prefijo}Implementar plan de retención y desarrollo del talento humano; documentar conocimiento crítico y diseñar programa de sucesión para roles clave.`
  if (cat.includes('ambiental') || desc.includes('ambiental') || desc.includes('clima'))
    return `${prefijo}Desarrollar plan de gestión ambiental y protocolo de respuesta ante emergencias; asegurar cumplimiento de requisitos legales ambientales aplicables.`
  if (cat.includes('político') || desc.includes('político') || desc.includes('gobierno'))
    return `${prefijo}Monitorear el entorno político-legal; establecer planes de contingencia operativa y diversificar mercados para reducir dependencia del contexto local.`
  if (fuente === 'DOFA')
    return `${prefijo}Elaborar plan de mejora con acciones correctivas específicas; asignar responsable, recursos y fechas de verificación para eliminar o reducir la debilidad/amenaza.`
  if (fuente === 'Recursos')
    return `${prefijo}Implementar controles operativos sobre el recurso afectado; definir protocolo de inspección periódica y criterios de aceptación para reducir la probabilidad de ocurrencia.`

  return `${prefijo}Definir e implementar plan de tratamiento del riesgo con acciones preventivas y correctivas; asignar responsable y fecha límite de ejecución.`
}

/* ── Helpers ─────────────────────────────────────────────────── */
function impactoToNum(i: string) { return i === 'Alto' ? 4 : i === 'Medio' ? 3 : 2 }
function estadoDesdeNivel(n: number): 'CRITICO' | 'TRATAMIENTO' | 'MONITOREO' {
  return n >= 15 ? 'CRITICO' : n >= 8 ? 'TRATAMIENTO' : 'MONITOREO'
}

/* ── derivarRiesgosDeActividades ─────────────────────────────────
   Genera EXACTAMENTE 1 Riesgo + 1 Oportunidad por actividad.

   • El Riesgo consolida TODAS las entradas en una sola descripción
     (riesgo de fallo/indisponibilidad de los insumos del proceso).
   • La Oportunidad consolida TODAS las salidas en una sola descripción
     (potencial de mejora/escala de los resultados generados).
   • Si una actividad no tiene entradas registradas, no se genera Riesgo.
   • Si una actividad no tiene salidas registradas, no se genera Oportunidad.
   • Las descripciones aprovechan el campo `objetivo` e `indicador`
     guardados en la actividad para enriquecer el contexto.            */
export function derivarRiesgosDeActividades(
  actividades: ActividadEmpresa[],
  startIdx = 1
): RiesgoDerivado[] {
  const resultado: RiesgoDerivado[] = []
  let idx = startIdx

  for (const act of actividades) {
    const categoria = 'Actividad Propia'
    const proc      = act.proceso ? ` en el proceso "${act.proceso}"` : ''
    const resp      = act.responsable || 'Responsable del proceso'

    /* ── 1 RIESGO por actividad (consolida todas las entradas) ── */
    const entradasValidas = act.entradas.filter(e => e.valor.trim())
    if (entradasValidas.length > 0) {
      const listaEntradas =
        entradasValidas.length === 1
          ? `"${entradasValidas[0].valor}"`
          : entradasValidas.map(e => `"${e.valor}"`).join(', ')

      const descripcion =
        `Riesgo de fallo, retraso o indisponibilidad de los insumos (${listaEntradas}) ` +
        `requeridos por la actividad "${act.nombre}"${proc}. ` +
        `Su ausencia o deficiencia puede comprometer la continuidad del proceso ` +
        `y el cumplimiento del objetivo: ${act.objetivo || 'no definido'}.`

      const prob  = 3
      const imp   = 3
      const nivel = prob * imp

      resultado.push({
        codigo:          `ACT-R-${String(idx).padStart(3, '0')}`,
        descripcion,
        tipo:            'Riesgo',
        fuente:          'ACTIVIDAD',
        categoria,
        actividadNombre: act.nombre,
        actividadId:     act.id,
        probabilidad:    prob,
        impacto:         imp,
        nivel,
        estado:          estadoDesdeNivel(nivel),
        responsable:     resp,
        acciones:        generarAccion('Riesgo', categoria, 'ACTIVIDAD', nivel, descripcion),
      })
      idx++
    }

    /* ── 1 OPORTUNIDAD por actividad (consolida todas las salidas) ── */
    const salidasValidas = act.salidas.filter(s => s.valor.trim())
    if (salidasValidas.length > 0) {
      const listaSalidas =
        salidasValidas.length === 1
          ? `"${salidasValidas[0].valor}"`
          : salidasValidas.map(s => `"${s.valor}"`).join(', ')

      const descripcion =
        `Oportunidad de optimización y aprovechamiento de los resultados (${listaSalidas}) ` +
        `generados por la actividad "${act.nombre}"${proc}. ` +
        `Escalar, reutilizar o mejorar estas salidas puede incrementar el valor ` +
        `entregado al cliente y fortalecer la competitividad del proceso. ` +
        `Indicador de referencia: ${act.indicador || 'no definido'}.`

      const prob  = 2
      const imp   = 2
      const nivel = prob * imp

      resultado.push({
        codigo:          `ACT-OP-${String(idx).padStart(3, '0')}`,
        descripcion,
        tipo:            'Oportunidad',
        fuente:          'ACTIVIDAD',
        categoria,
        actividadNombre: act.nombre,
        actividadId:     act.id,
        probabilidad:    prob,
        impacto:         imp,
        nivel,
        estado:          estadoDesdeNivel(nivel),
        responsable:     resp,
        acciones:        generarAccion('Oportunidad', categoria, 'ACTIVIDAD', nivel, descripcion),
      })
      idx++
    }
  }

  return resultado
}

/* ── derivarRiesgos ──────────────────────────────────────────── */
export function derivarRiesgos(
  analysis:    AIAnalysis,
  actividades: ActividadEmpresa[] = []
): RiesgoDerivado[] {
  const riesgos: RiesgoDerivado[] = []; let idx = 1

  for (const row of analysis.pestel) {
    const prob  = row.oportunidad ? 2 : 3 + (row.impacto === 'Alto' ? 1 : 0)
    const imp   = impactoToNum(row.impacto)
    const nivel = prob * imp
    const tipo: 'Riesgo' | 'Oportunidad' = row.oportunidad ? 'Oportunidad' : 'Riesgo'
    riesgos.push({
      codigo:       `${tipo === 'Oportunidad' ? 'OP' : 'R'}-${String(idx).padStart(3, '0')}`,
      descripcion:  row.descripcion,
      tipo,
      fuente:       'PESTEL',
      categoria:    row.categoria,
      probabilidad: prob,
      impacto:      imp,
      nivel,
      estado:       estadoDesdeNivel(nivel),
      responsable:  'Director de Calidad',
      acciones:     generarAccion(tipo, row.categoria, 'PESTEL', nivel, row.descripcion),
    }); idx++
  }

  for (const row of analysis.dofa) {
    const esR   = row.tipo === 'Debilidad' || row.tipo === 'Amenaza'
    const tipo: 'Riesgo' | 'Oportunidad' = esR ? 'Riesgo' : 'Oportunidad'
    const prob  = esR ? 3 : 2
    const imp   = esR ? 3 : 2
    const nivel = prob * imp
    riesgos.push({
      codigo:       `${esR ? 'R' : 'OP'}-${String(idx).padStart(3, '0')}`,
      descripcion:  row.descripcion,
      tipo,
      fuente:       'DOFA',
      categoria:    row.tipo,
      probabilidad: prob,
      impacto:      imp,
      nivel,
      estado:       estadoDesdeNivel(nivel),
      responsable:  'Director de Calidad',
      acciones:     generarAccion(tipo, row.tipo, 'DOFA', nivel, row.descripcion),
    }); idx++
  }

  if (analysis.matrizRecursos) {
    for (const row of analysis.matrizRecursos) {
      if (row.riesgo && row.riesgo.trim() !== '' && row.riesgo.toLowerCase() !== 'ninguno' && row.riesgo.toLowerCase() !== 'n/a') {
        const prob  = row.probabilidad ? impactoToNum(row.probabilidad) : 3
        const imp   = row.impacto      ? impactoToNum(row.impacto)      : 3
        const nivel = prob * imp
        riesgos.push({
          codigo:       `R-${String(idx).padStart(3, '0')}`,
          descripcion:  row.riesgo + (row.hallazgo ? ` (Hallazgo: ${row.hallazgo})` : ''),
          tipo:         'Riesgo',
          fuente:       'Recursos',
          categoria:    `Recursos - ${row.proceso}`,
          probabilidad: prob,
          impacto:      imp,
          nivel,
          estado:       estadoDesdeNivel(nivel),
          responsable:  'Director de Calidad',
          acciones:     generarAccion('Riesgo', `Recursos - ${row.proceso}`, 'Recursos', nivel, row.riesgo),
        }); idx++
      }
      if (row.oportunidad && row.oportunidad.trim() !== '' && row.oportunidad.toLowerCase() !== 'ninguna' && row.oportunidad.toLowerCase() !== 'n/a') {
        const prob = 2; const imp = 2; const nivel = prob * imp
        riesgos.push({
          codigo:       `OP-${String(idx).padStart(3, '0')}`,
          descripcion:  row.oportunidad + (row.accion ? ` (Acción: ${row.accion})` : ''),
          tipo:         'Oportunidad',
          fuente:       'Recursos',
          categoria:    `Recursos - ${row.proceso}`,
          probabilidad: prob,
          impacto:      imp,
          nivel,
          estado:       estadoDesdeNivel(nivel),
          responsable:  'Director de Calidad',
          acciones:     generarAccion('Oportunidad', `Recursos - ${row.proceso}`, 'Recursos', nivel, row.oportunidad),
        }); idx++
      }
    }
  }

  if (actividades.length > 0) {
    const fromActividades = derivarRiesgosDeActividades(actividades, idx)
    riesgos.push(...fromActividades)
  }

  return riesgos
}

/* ── derivarObjetivos ────────────────────────────────────────── */
function frecDesdeNivel(n: number): FrecuenciaMedicion {
  return n >= 15 ? 'Mensual' : n >= 9 ? 'Trimestral' : n >= 4 ? 'Semestral' : 'Anual'
}

export function derivarObjetivos(
  analysis:    AIAnalysis,
  actividades: ActividadEmpresa[] = []
): ObjetivoDerivado[] {
  const riesgos = derivarRiesgos(analysis, actividades)
  const objetivos: ObjetivoDerivado[] = []; let idx = 1
  const ordenados = [...riesgos].sort((a, b) => {
    if (a.tipo === 'Riesgo' && b.tipo === 'Oportunidad') return -1
    if (a.tipo === 'Oportunidad' && b.tipo === 'Riesgo') return 1
    return b.nivel - a.nivel
  })
  for (const r of ordenados) {
    if (r.tipo === 'Riesgo' && r.nivel < 4) continue
    const frecuencia = frecDesdeNivel(r.nivel)
    const hoy = new Date(); const fin = new Date(hoy)
    const meses: Record<FrecuenciaMedicion, number> = { Mensual:1,Bimestral:2,Trimestral:3,Cuatrimestral:4,Semestral:6,Anual:12 }
    fin.setMonth(fin.getMonth() + meses[frecuencia])
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const desc = r.descripcion.length > 120 ? r.descripcion.slice(0, 117) + '...' : r.descripcion
    objetivos.push({
      codigo: `OC-${String(idx).padStart(3, '0')}`,
      objetivo: r.tipo === 'Oportunidad'
        ? `Aprovechar la oportunidad en ${r.categoria.toLowerCase()}: ${desc}`
        : `Reducir el riesgo en ${r.categoria.toLowerCase()}: ${desc}`,
      proceso_relacionado:       '',
      fuente_riesgo_oportunidad: r.descripcion,
      tipo_fuente:               r.tipo,
      accion:                    r.acciones,
      responsable:               r.responsable,
      recursos:                  'Por definir',
      frecuencia_medicion:       frecuencia,
      meta: r.tipo === 'Oportunidad'
        ? '≥ 80% de cumplimiento'
        : r.nivel >= 15 ? '100% acciones ejecutadas' : '≥ 90% acciones ejecutadas',
      indicador: r.tipo === 'Oportunidad'
        ? `% aprovechamiento en ${r.categoria}`
        : `% reducción del riesgo en ${r.categoria}`,
      fecha_inicio:  fmt(hoy),
      fecha_fin:     fmt(fin),
      estado:        'Pendiente',
      mediciones:    [],
      _riesgoCodigo: r.codigo,
      _riesgoNivel:  r.nivel,
    }); idx++
  }
  return objetivos
}