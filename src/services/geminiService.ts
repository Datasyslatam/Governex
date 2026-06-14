export interface ProcesoItem { nombre: string }

export interface DatosEmpresa {
  nombreEmpresa: string; sector: string; tipoEmpresa: string; tamano: string
  ubicacion: string; anoFundacion: string; mision: string; vision: string
  politicaCalidad: string; productosServicios: string; mercadoObjetivo: string
  cantidadEmpleados: string; alcanceSGC: string; certificaciones: string
  parteInteresadas: string; contextoNarrativo?: string
}

export interface MapaData {
  cliente: string; satisfaccion: string
  estrategicos: ProcesoItem[]; misionales: ProcesoItem[]; apoyo: ProcesoItem[]
  nombreEmpresa?: string; sector?: string; datosEmpresa?: DatosEmpresa
}

export interface PestelRow    { factor:string; categoria:string; descripcion:string; impacto:'Alto'|'Medio'|'Bajo'; oportunidad:boolean }
export interface DofaRow      { tipo:'Fortaleza'|'Oportunidad'|'Debilidad'|'Amenaza'; descripcion:string }
export interface CaracterizacionRow { codigo:string; proceso:string; objetivo:string; entradas:string; salidas:string; indicador:string; responsable:string; estado:string }
export type TipoProceso = 'estrategico'|'misional'|'apoyo'
export interface FilaMatriz   { id:number; proceso:string; tipo:TipoProceso; responsable:string; autoridad:string; funciones:string; recursos:string; rendicion:string; clausula:string }
export interface FilaMatrizRecursos { 
  proceso:string; nPersonas:string; infraestructura:string; hardwareSoftware:string; transporte:string; 
  ambienteSocial:string; ambientePsicologico:string; ambienteFisico:string; 
  varSocial:number; varPsicologica:number; varFisica:number; calificacionPromedio:number; nivelRiesgoVerde:string; accionRequerida:string;
  recursoEvaluado:string; hallazgo:string; riesgo:string; impacto:string; probabilidad:string; nivelRiesgoAzul:string; oportunidad:string; accion:string;
}

export interface GeminiAnalysis {
  pestel: PestelRow[]; dofa: DofaRow[]
  caracterizacion: CaracterizacionRow[]; matrizRoles: FilaMatriz[]; matrizRecursos: FilaMatrizRecursos[]
  contextoNarrativo?: string
}

function buildPrompt(mapa: MapaData): string {
  const estrategicos = mapa.estrategicos.map(p => p.nombre).join(', ')
  const misionales   = mapa.misionales.map(p => p.nombre).join(', ')
  const apoyo        = mapa.apoyo.map(p => p.nombre).join(', ')
  const d = mapa.datosEmpresa

  const empresaBlock = d ? `
═══════════════════════════════════════════════════════
INFORMACIÓN DE LA EMPRESA (usa estos datos en TODO el análisis)
═══════════════════════════════════════════════════════
- Nombre:              ${d.nombreEmpresa    || 'No especificado'}
- Tipo de empresa:     ${d.tipoEmpresa      || 'No especificado'}
- Sector / Industria:  ${d.sector           || 'No especificado'}
- Tamaño:              ${d.tamano           || 'No especificado'}
- Ubicación:           ${d.ubicacion        || 'No especificado'}
- Año de fundación:    ${d.anoFundacion     || 'No especificado'}
- N.º de empleados:    ${d.cantidadEmpleados|| 'No especificado'}
- Certificaciones:     ${d.certificaciones  || 'Ninguna'}

DIRECCIONAMIENTO ESTRATÉGICO:
- Misión:              ${d.mision            || 'No definida'}
- Visión:              ${d.vision            || 'No definida'}
- Política de Calidad: ${d.politicaCalidad   || 'No definida'}

OPERACIÓN:
- Productos / Servicios: ${d.productosServicios|| 'No especificado'}
- Mercado objetivo:      ${d.mercadoObjetivo   || 'No especificado'}
- Partes interesadas:    ${d.parteInteresadas  || 'No especificado'}

SGC:
- Alcance del SGC:     ${d.alcanceSGC || 'No definido'}
` : `Empresa: ${mapa.nombreEmpresa || 'No especificada'}. Sector: ${mapa.sector || 'No especificado'}.`

  return `Eres un consultor senior certificado en ISO 9001:2015, análisis estratégico y diseño organizacional.
${empresaBlock}

MAPA DE PROCESOS:
- Procesos Estratégicos: ${estrategicos}
- Procesos Misionales:   ${misionales}
- Procesos de Apoyo:     ${apoyo}
- Entrada del mapa:      ${mapa.cliente}
- Salida del mapa:       ${mapa.satisfaccion}

Responde ÚNICAMENTE con JSON válido sin texto adicional.

{
  "contextoNarrativo": "string de 400-600 palabras con análisis narrativo del contexto organizacional. Incluye: descripción del negocio y propósito basada en misión/visión reales, análisis del sector y posición competitiva, características operativas, fortalezas estratégicas, desafíos del entorno, perspectiva SGC y conclusión sobre mejora continua. Usa saltos de línea para párrafos. Lenguaje profesional y específico para esta empresa.",
  "pestel": [
    { "factor":"P", "categoria":"Político", "descripcion":"descripción específica para esta empresa", "impacto":"Alto", "oportunidad":true }
  ],
  "dofa": [
    { "tipo":"Fortaleza", "descripcion":"descripción concreta basada en procesos y datos reales" }
  ],
  "caracterizacion": [
    { "codigo":"PE-01", "proceso":"nombre", "objetivo":"objetivo medible", "entradas":"...", "salidas":"...", "indicador":"KPI concreto", "responsable":"cargo", "estado":"Activo" }
  ],
  "matrizRoles": [
    { "id":1, "proceso":"nombre", "tipo":"estrategico", "responsable":"cargo", "autoridad":"quien autoriza", "funciones":"funciones principales", "recursos":"recursos necesarios", "rendicion":"a quien rinde cuentas", "clausula":"§5.1, §5.3" }
  ],
  "matrizRecursos": [
    { 
      "proceso":"nombre", "nPersonas":"...", "infraestructura":"...", "hardwareSoftware":"...", "transporte":"...", 
      "ambienteSocial":"- viñeta...", "ambientePsicologico":"- viñeta...", "ambienteFisico":"- viñeta...",
      "varSocial":4, "varPsicologica":3, "varFisica":5, "calificacionPromedio":4.0, "nivelRiesgoVerde":"Bajo", "accionRequerida":"Mantener",
      "recursoEvaluado":"Equipos", "hallazgo":"obsoletos", "riesgo":"Paradas", "impacto":"Alto", "probabilidad":"Alto", "nivelRiesgoAzul":"Crítico", "oportunidad":"Renovar", "accion":"Comprar"
    }
  ]
}

REGLAS:
- pestel: exactamente 12 factores, mínimo 2 por letra PESTEL, mínimo 5 oportunidades y 5 amenazas. TODO específico para la empresa.
- dofa: exactamente 4 Fortalezas, 4 Oportunidades, 4 Debilidades, 4 Amenazas. Basadas en los procesos y datos reales.
- caracterizacion: una fila por cada proceso del mapa (estratégicos PE-xx, misionales PO-xx, apoyo PA-xx).
- matrizRoles y matrizRecursos: una fila por cada proceso. En matrizRecursos:
  * Evalúa el ambiente (Social, Psicológico, Físico) respondiendo con viñetas (-) a estos aspectos específicos:
    - ambienteSocial: Trabajo en equipo, Comunicación, Liderazgo, Resolución de conflictos, Participación.
    - ambientePsicologico: Estrés laboral, Motivación, Reconocimiento, Bienestar emocional, Claridad de funciones.
    - ambienteFisico: Iluminación, Temperatura, Ruido, Ergonomía, Orden y limpieza, Seguridad.
  * Variables cuantitativas (varSocial, varPsicologica, varFisica): califica de 1 a 5 (1=Deficiente, 5=Excelente).
  * calificacionPromedio: promedio matemático de las 3 anteriores.
  * nivelRiesgoVerde: "Bajo", "Medio", "Alto", "Crítico" según el promedio (menor promedio = mayor riesgo).
  * accionRequerida: Ej. "Plan de clima laboral" o "Mantener".
  * Evaluación Azul: recursoEvaluado, hallazgo, riesgo (descripción detallada y profesional de 1-2 oraciones, no básico), impacto (Alto/Medio/Bajo), probabilidad (Alto/Medio/Bajo), nivelRiesgoAzul (Crítico/Alto/Medio/Bajo), oportunidad (descripción detallada equivalente al PESTEL/DOFA) y accion.
- impacto: "Alto" | "Medio" | "Bajo"
- estado: "Activo" | "Revisión" | "Inactivo"
- tipo en matrizRoles: "estrategico" | "misional" | "apoyo"
- JSON completo y válido sin truncar.`
}

const MODELS = ['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.0-flash','gemini-flash-latest']

export async function analyzeWithGemini(mapa: MapaData): Promise<GeminiAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada')

  const body = {
    contents: [{ parts: [{ text: buildPrompt(mapa) }] }],
    generationConfig: { temperature:0.4, topP:0.9, maxOutputTokens:8192, responseMimeType:'application/json' },
  }

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Gemini] ${model} | intento ${attempt}`)
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          { method:'POST', headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey }, body: JSON.stringify(body) }
        )
        const text = await response.text()
        if (response.status === 503) { await new Promise(r => setTimeout(r, attempt * 2000)); continue }
        if (!response.ok) { console.error(`[Gemini] Error ${model}:`, text); continue }
        const data    = JSON.parse(text)
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        const cleaned = rawText.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim()
        const parsed  = JSON.parse(cleaned)
        if ((!parsed.matrizRoles?.length || !parsed.matrizRecursos?.length || !parsed.pestel?.length || !parsed.dofa?.length || !parsed.caracterizacion?.length) && attempt < 3) { 
          console.warn(`[${model}] JSON incompleto (faltan matrices), reintentando...`); 
          continue 
        }
        return {
          pestel:            Array.isArray(parsed.pestel)          ? parsed.pestel          : [],
          dofa:              Array.isArray(parsed.dofa)            ? parsed.dofa            : [],
          caracterizacion:   Array.isArray(parsed.caracterizacion) ? parsed.caracterizacion : [],
          matrizRoles:       Array.isArray(parsed.matrizRoles)     ? parsed.matrizRoles     : [],
          matrizRecursos:    Array.isArray(parsed.matrizRecursos)  ? parsed.matrizRecursos  : [],
          contextoNarrativo: typeof parsed.contextoNarrativo === 'string' ? parsed.contextoNarrativo : '',
        }
      } catch (error) {
        console.error(`[Gemini] Error inesperado ${model} intento ${attempt}:`, error)
      }
    }
  }
  throw new Error('Todos los modelos Gemini fallaron. Intenta nuevamente.')
}