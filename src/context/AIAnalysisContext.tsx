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

export interface AIAnalysis {
  pestel:           PestelRow[]
  dofa:             DofaRow[]
  caracterizacion:  CaracterizacionRow[]
  matrizRoles?:     FilaMatriz[]
  matrizRecursos?:  FilaMatrizRecursos[]
  indicadores?:     any[]
  nombreEmpresa?:   string
  sector?:          string
  datosEmpresa?:    DatosEmpresa
}

/* ── Tipos derivados §6.1 ────────────────────────────────────── */
export interface RiesgoDerivado {
  codigo:       string
  descripcion:  string
  tipo:         'Riesgo' | 'Oportunidad'
  fuente:       'PESTEL' | 'DOFA' | 'Recursos'
  categoria:    string
  probabilidad: number
  impacto:      number
  nivel:        number
  estado:       'CRITICO' | 'TRATAMIENTO' | 'MONITOREO'
  responsable:  string
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
  setAnalysis:     (a: AIAnalysis) => void
  setDatosEmpresa: (d: DatosEmpresa) => void
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

  const setAnalysis = (a: AIAnalysis) => {
    setAnalysisState(a)
    try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(a)) } catch {}
  }

  const setDatosEmpresa = (d: DatosEmpresa) => {
    setDatosEmpresaState(d)
    try { sessionStorage.setItem('governex_datos_empresa', JSON.stringify(d)) } catch {}
  }

  const clearAnalysis = () => {
    setAnalysisState(null); setDatosEmpresaState(null)
    try { sessionStorage.removeItem('governex_ai_analysis'); sessionStorage.removeItem('governex_datos_empresa') } catch {}
  }

  return (
    <AIAnalysisContext.Provider value={{ analysis, datosEmpresa, setAnalysis, setDatosEmpresa, clearAnalysis }}>
      {children}
    </AIAnalysisContext.Provider>
  )
}

export const useAIAnalysis = (): AIAnalysisContextValue => {
  const ctx = useContext(AIAnalysisContext)
  if (!ctx) throw new Error('useAIAnalysis must be used within AIAnalysisProvider')
  return ctx
}

/* ── derivarRiesgos ──────────────────────────────────────────── */
function impactoToNum(i: string) { return i === 'Alto' ? 4 : i === 'Medio' ? 3 : 2 }
function estadoDesdeNivel(n: number): 'CRITICO' | 'TRATAMIENTO' | 'MONITOREO' {
  return n >= 15 ? 'CRITICO' : n >= 8 ? 'TRATAMIENTO' : 'MONITOREO'
}

export function derivarRiesgos(analysis: AIAnalysis): RiesgoDerivado[] {
  const riesgos: RiesgoDerivado[] = []; let idx = 1
  for (const row of analysis.pestel) {
    const prob = row.oportunidad ? 2 : 3 + (row.impacto === 'Alto' ? 1 : 0)
    const imp  = impactoToNum(row.impacto); const nivel = prob * imp
    riesgos.push({ codigo: `${row.oportunidad ? 'OP' : 'R'}-${String(idx).padStart(3,'0')}`, descripcion: row.descripcion, tipo: row.oportunidad ? 'Oportunidad' : 'Riesgo', fuente: 'PESTEL', categoria: row.categoria, probabilidad: prob, impacto: imp, nivel, estado: estadoDesdeNivel(nivel), responsable: 'Director de Calidad' }); idx++
  }
  for (const row of analysis.dofa) {
    const esR = row.tipo === 'Debilidad' || row.tipo === 'Amenaza'
    const prob = esR ? 3 : 2; const imp = esR ? 3 : 2; const nivel = prob * imp
    riesgos.push({ codigo: `${esR ? 'R' : 'OP'}-${String(idx).padStart(3,'0')}`, descripcion: row.descripcion, tipo: esR ? 'Riesgo' : 'Oportunidad', fuente: 'DOFA', categoria: row.tipo, probabilidad: prob, impacto: imp, nivel, estado: estadoDesdeNivel(nivel), responsable: 'Director de Calidad' }); idx++
  }
  if (analysis.matrizRecursos) {
    for (const row of analysis.matrizRecursos) {
      if (row.riesgo && row.riesgo.trim() !== '' && row.riesgo.toLowerCase() !== 'ninguno' && row.riesgo.toLowerCase() !== 'n/a') {
        const prob = row.probabilidad ? impactoToNum(row.probabilidad) : 3
        const imp = row.impacto ? impactoToNum(row.impacto) : 3
        const nivel = prob * imp
        riesgos.push({ codigo: `R-${String(idx).padStart(3,'0')}`, descripcion: row.riesgo + (row.hallazgo ? ` (Hallazgo: ${row.hallazgo})` : ''), tipo: 'Riesgo', fuente: 'Recursos', categoria: `Recursos - ${row.proceso}`, probabilidad: prob, impacto: imp, nivel, estado: estadoDesdeNivel(nivel), responsable: 'Director de Calidad' }); idx++
      }
      if (row.oportunidad && row.oportunidad.trim() !== '' && row.oportunidad.toLowerCase() !== 'ninguna' && row.oportunidad.toLowerCase() !== 'n/a') {
        const prob = 2; const imp = 2; const nivel = prob * imp
        riesgos.push({ codigo: `OP-${String(idx).padStart(3,'0')}`, descripcion: row.oportunidad + (row.accion ? ` (Acción: ${row.accion})` : ''), tipo: 'Oportunidad', fuente: 'Recursos', categoria: `Recursos - ${row.proceso}`, probabilidad: prob, impacto: imp, nivel, estado: estadoDesdeNivel(nivel), responsable: 'Director de Calidad' }); idx++
      }
    }
  }
  return riesgos
}

/* ── derivarObjetivos ────────────────────────────────────────── */
function frecDesdeNivel(n: number): FrecuenciaMedicion {
  return n >= 15 ? 'Mensual' : n >= 9 ? 'Trimestral' : n >= 4 ? 'Semestral' : 'Anual'
}

export function derivarObjetivos(analysis: AIAnalysis): ObjetivoDerivado[] {
  const riesgos = derivarRiesgos(analysis)
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
    const fmt = (d: Date) => d.toISOString().slice(0,10)
    const desc = r.descripcion.length > 120 ? r.descripcion.slice(0,117)+'...' : r.descripcion
    objetivos.push({
      codigo: `OC-${String(idx).padStart(3,'0')}`,
      objetivo: r.tipo === 'Oportunidad' ? `Aprovechar la oportunidad en ${r.categoria.toLowerCase()}: ${desc}` : `Reducir el riesgo en ${r.categoria.toLowerCase()}: ${desc}`,
      proceso_relacionado: '', fuente_riesgo_oportunidad: r.descripcion, tipo_fuente: r.tipo,
      accion: r.tipo === 'Oportunidad' ? `Diseñar plan de aprovechamiento en ${r.categoria} (${r.fuente}).` : `Implementar acciones de mitigación para el riesgo en ${r.categoria} (${r.fuente}).`,
      responsable: r.responsable, recursos: 'Por definir', frecuencia_medicion: frecuencia,
      meta: r.tipo === 'Oportunidad' ? '≥ 80% de cumplimiento' : r.nivel >= 15 ? '100% acciones ejecutadas' : '≥ 90% acciones ejecutadas',
      indicador: r.tipo === 'Oportunidad' ? `% aprovechamiento en ${r.categoria}` : `% reducción del riesgo en ${r.categoria}`,
      fecha_inicio: fmt(hoy), fecha_fin: fmt(fin), estado: 'Pendiente', mediciones: [],
      _riesgoCodigo: r.codigo, _riesgoNivel: r.nivel,
    }); idx++
  }
  return objetivos
}