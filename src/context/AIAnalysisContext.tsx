/**
 * AIAnalysisContext.tsx
 * Contexto global para compartir el análisis IA (Gemini) generado en
 * "Contexto de la Organización" con otros módulos como "Riesgos y Oportunidades".
 */

import React, { createContext, useState, useContext } from 'react'

/* ── Tipos exportados ────────────────────────────────────────── */
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

export interface AIAnalysis {
  pestel:          PestelRow[]
  dofa:            DofaRow[]
  caracterizacion: CaracterizacionRow[]
  matrizRoles?:    FilaMatriz[]
  nombreEmpresa?:  string
  sector?:         string
}

/* ── Tipos de riesgo derivados del análisis ──────────────────── */
export interface RiesgoDerivado {
  codigo:       string
  descripcion:  string
  tipo:         'Riesgo' | 'Oportunidad'
  fuente:       'PESTEL' | 'DOFA'
  categoria:    string
  probabilidad: number   // 1–5
  impacto:      number   // 1–5
  nivel:        number   // probabilidad × impacto
  estado:       'CRITICO' | 'TRATAMIENTO' | 'MONITOREO'
  responsable:  string
}

/* ── Context ─────────────────────────────────────────────────── */
interface AIAnalysisContextValue {
  analysis:      AIAnalysis | null
  setAnalysis:   (a: AIAnalysis) => void
  clearAnalysis: () => void
}

const AIAnalysisContext = createContext<AIAnalysisContextValue | undefined>(undefined)

export const AIAnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [analysis, setAnalysisState] = useState<AIAnalysis | null>(() => {
    try {
      const stored = sessionStorage.getItem('governex_ai_analysis')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const setAnalysis = (a: AIAnalysis) => {
    setAnalysisState(a)
    try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(a)) } catch {}
  }

  const clearAnalysis = () => {
    setAnalysisState(null)
    try { sessionStorage.removeItem('governex_ai_analysis') } catch {}
  }

  return (
    <AIAnalysisContext.Provider value={{ analysis, setAnalysis, clearAnalysis }}>
      {children}
    </AIAnalysisContext.Provider>
  )
}

export const useAIAnalysis = (): AIAnalysisContextValue => {
  const ctx = useContext(AIAnalysisContext)
  if (!ctx) throw new Error('useAIAnalysis must be used within AIAnalysisProvider')
  return ctx
}

/* ── Función derivadora: genera riesgos desde PESTEL + DOFA ─── */
function impactoToNum(impacto: string): number {
  if (impacto === 'Alto')  return 4
  if (impacto === 'Medio') return 3
  return 2
}

function estadoDesdeNivel(nivel: number): 'CRITICO' | 'TRATAMIENTO' | 'MONITOREO' {
  if (nivel >= 15) return 'CRITICO'
  if (nivel >= 8)  return 'TRATAMIENTO'
  return 'MONITOREO'
}

export function derivarRiesgos(analysis: AIAnalysis): RiesgoDerivado[] {
  const riesgos: RiesgoDerivado[] = []
  let idx = 1

  /* ── Desde PESTEL ─────────────────────────────────────────── */
  for (const row of analysis.pestel) {
    const prob   = row.oportunidad ? 2 : 3 + (row.impacto === 'Alto' ? 1 : 0)
    const imp    = impactoToNum(row.impacto)
    const nivel  = prob * imp
    riesgos.push({
      codigo:      `${row.oportunidad ? 'OP' : 'R'}-${String(idx).padStart(3, '0')}`,
      descripcion: row.descripcion,
      tipo:        row.oportunidad ? 'Oportunidad' : 'Riesgo',
      fuente:      'PESTEL',
      categoria:   row.categoria,
      probabilidad: prob,
      impacto:     imp,
      nivel,
      estado:      estadoDesdeNivel(nivel),
      responsable: 'Director de Calidad',
    })
    idx++
  }

  /* ── Desde DOFA (Debilidades y Amenazas → Riesgos; Fortalezas y Oportunidades → Oportunidades) */
  for (const row of analysis.dofa) {
    const esRiesgo = row.tipo === 'Debilidad' || row.tipo === 'Amenaza'
    const prob     = esRiesgo ? 3 : 2
    const imp      = esRiesgo ? 3 : 2
    const nivel    = prob * imp
    riesgos.push({
      codigo:      `${esRiesgo ? 'R' : 'OP'}-${String(idx).padStart(3, '0')}`,
      descripcion: row.descripcion,
      tipo:        esRiesgo ? 'Riesgo' : 'Oportunidad',
      fuente:      'DOFA',
      categoria:   row.tipo,
      probabilidad: prob,
      impacto:     imp,
      nivel,
      estado:      estadoDesdeNivel(nivel),
      responsable: 'Director de Calidad',
    })
    idx++
  }

  return riesgos
}
