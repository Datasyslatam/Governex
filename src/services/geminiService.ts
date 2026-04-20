/**
 * geminiService.ts
 * Ruta: src/services/geminiService.ts
 *
 * Llama a Gemini para analizar un organigrama/mapa de procesos
 * y devuelve PESTEL, DOFA y Caracterización de Procesos generados.
 */

export interface ProcesoItem {
  nombre: string
}

export interface MapaData {
  cliente:      string
  satisfaccion: string
  estrategicos: ProcesoItem[]
  misionales:   ProcesoItem[]
  apoyo:        ProcesoItem[]
  nombreEmpresa?: string
  sector?:        string
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

export interface GeminiAnalysis {
  pestel:          PestelRow[]
  dofa:            DofaRow[]
  caracterizacion: CaracterizacionRow[]
  matrizRoles:     FilaMatriz[]
}

// ─────────────────────────────────────────────────────────────
// Helper: construir el prompt
// ─────────────────────────────────────────────────────────────
function buildPrompt(mapa: MapaData): string {
  const estrategicos = mapa.estrategicos.map(p => p.nombre).join(', ')
  const misionales   = mapa.misionales.map(p => p.nombre).join(', ')
  const apoyo        = mapa.apoyo.map(p => p.nombre).join(', ')

  const empresaInfo = mapa.nombreEmpresa
    ? `Empresa: ${mapa.nombreEmpresa}. Sector: ${mapa.sector || 'no especificado'}.`
    : ''

  return `Eres un consultor experto en sistemas de gestión ISO 9001, análisis estratégico y diseño de procesos organizacionales. ${empresaInfo}

Analiza el siguiente mapa de procesos de una organización:

MAPA DE PROCESOS:
- Procesos Estratégicos: ${estrategicos}
- Procesos Misionales: ${misionales}
- Procesos de Apoyo: ${apoyo}
- Entrada del mapa: ${mapa.cliente}
- Salida del mapa: ${mapa.satisfaccion}

Genera un análisis completo y detallado con tres secciones:

1. CONTEXTO ORGANIZACIONAL (PESTEL)
2. MATRIZ DOFA
3. CARACTERIZACIÓN DE PROCESOS

Responde ÚNICAMENTE con JSON válido.

Estructura:

{
  "pestel": [],
  "dofa": [],
  "caracterizacion": [],
  "matrizRoles": []
}

REGLAS DETALLADAS:

PESTEL:
- Genera exactamente 12 factores
- Debe haber al menos 5 oportunidades y 5 amenazas
- Usa oportunidad: true para oportunidades
- Usa oportunidad: false para amenazas
- Al menos 2 factores por cada categoría:
  - P: Político
  - E: Económico
  - S: Social
  - T: Tecnológico
  - A: Ambiental
  - L: Legal
- Cada factor debe:
  - Ser específico para la organización
  - Incluir impacto real sobre los procesos
  - No usar textos genéricos
- Cada elemento PESTEL debe incluir:

  - "factor": "P" | "E" | "S" | "T" | "A" | "L"

    Ejemplo:
    {
      "factor": "P",
      "categoria": "Político",
      "descripcion": "...",
      "impacto": "Alto",
      "oportunidad": true
    }

DOFA:
- La matriz DOFA debe basarse estrictamente en los procesos del mapa enviado.
- Evita generar factores genéricos.
- Relaciona cada elemento con procesos específicos.
- Genera exactamente:
  - 4 Fortalezas
  - 4 Oportunidades
  - 4 Debilidades
  - 4 Amenazas
- Cada elemento debe:
  - Basarse en los procesos
  - Ser concreto
  - Ser aplicable a una empresa real

CARACTERIZACIÓN:
Genera una fila por cada proceso con:

- Objetivo claro y medible
- Entradas detalladas
- Salidas detalladas
- Indicador KPI medible
- Responsable (cargo real)
- Estado

Reglas de códigos:
- Estratégicos: PE-01, PE-02...
- Misionales: PO-01, PO-02...
- Apoyo: PA-01, PA-02...

Formato de ejemplo:

{
  "codigo": "PE-01",
  "proceso": "",
  "objetivo": "",
  "entradas": "",
  "salidas": "",
  "indicador": "",
  "responsable": "",
  "estado": "Activo"
}

REGLAS GENERALES:
- No usar texto genérico
- No repetir información
- Usar lenguaje profesional
- Generar información detallada
- impacto: "Alto" | "Medio" | "Bajo"
- estado: "Activo" | "Revisión" | "Inactivo"

4. MATRIZ DE ROLES, RESPONSABILIDADES Y AUTORIDAD (ISO 9001:2015 §5.3)

Genera una fila por cada proceso del mapa con los siguientes campos:
- "id": número secuencial comenzando en 1
- "proceso": nombre del proceso (igual que en caracterización)
- "tipo": "estrategico" | "misional" | "apoyo" (según su clasificación en el mapa)
- "responsable": cargo concreto y real responsable del proceso
- "autoridad": cargo al que reporta o que tiene autoridad sobre el proceso
- "funciones": descripción de 2-3 funciones clave del responsable en este proceso
- "recursos": recursos humanos, tecnológicos o financieros asignados al proceso
- "rendicion": cargo o instancia a quien rinde cuentas el responsable
- "clausula": cláusula(s) relevantes de ISO 9001:2015 (ej. "§5.1, §5.3")

La estructura JSON debe ser:
{
  "matrizRoles": [
    {
      "id": 1,
      "proceso": "...",
      "tipo": "estrategico",
      "responsable": "...",
      "autoridad": "...",
      "funciones": "...",
      "recursos": "...",
      "rendicion": "...",
      "clausula": "..."
    }
  ]
}

REGLAS para matrizRoles:
- Usa cargos reales y concretos (ej. "Director de Calidad", no "Responsable del área")
- Alinea los responsables con los usados en la caracterización
- La autoridad debe ser el superior jerárquico real del responsable
- Las funciones deben ser específicas al proceso, no genéricas
- Incluye todos los procesos del mapa (estratégicos + misionales + apoyo)
`
}

// ─────────────────────────────────────────────────────────────
// Modelos con fallback
// ─────────────────────────────────────────────────────────────
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-flash-latest"
]

// ─────────────────────────────────────────────────────────────
// Función principal
// ─────────────────────────────────────────────────────────────
export async function analyzeWithGemini(mapa: MapaData): Promise<GeminiAnalysis> {

  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada')
  }

  const body = {
    contents: [
      {
        parts: [{ text: buildPrompt(mapa) }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  }

  const MAX_RETRIES = 3

  for (const model of MODELS) {

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {

      try {

        console.log(`Modelo: ${model} | Intento: ${attempt}`)

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify(body)
          }
        )

        const text = await response.text()

        if (response.status === 503) {
          const delay = attempt * 2000
          console.log(`Modelo saturado. Reintentando en ${delay}ms...`)
          await new Promise(r => setTimeout(r, delay))
          continue
        }

        if (!response.ok) {
          console.error(`Error con ${model}:`, text)
          continue
        }

        const data = JSON.parse(text)

        const rawText =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

        const cleaned = rawText
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim()

        const parsed = JSON.parse(cleaned)

        // Validate that matrizRoles was generated (not truncated)
        if (!parsed.matrizRoles || !Array.isArray(parsed.matrizRoles) || parsed.matrizRoles.length === 0) {
          console.warn(`[${model}] matrizRoles vacío o ausente. Reintentando...`)
          if (attempt < MAX_RETRIES) continue
        }

        return parsed

      } catch (error) {
        console.error("Error:", error)
      }
    }
  }

  throw new Error("Todos los modelos Gemini están saturados. Intenta nuevamente.")
}