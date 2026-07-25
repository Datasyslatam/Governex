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
export interface CaracterizacionRow { codigo:string; proceso:string; objetivo:string; entradas:string; actividades?:string; salidas:string; indicador:string; indicadorEntrada?:string; indicadorActividad?:string; indicadorSalida?:string; riesgoEntrada?:string; opEntrada?:string; riesgoActividad?:string; opActividad?:string; riesgoSalida?:string; opSalida?:string; responsable:string; estado:string }
export type TipoProceso = 'estrategico'|'misional'|'apoyo'
export interface FilaMatriz   { id:number; proceso:string; tipo:TipoProceso; responsable:string; autoridad:string; funciones:string; recursos:string; rendicion:string; clausula:string }
export interface FilaMatrizCargos {
  id:number; proceso:string; tipo:TipoProceso; actividades:string[];
  responsable:string; funciones:string; clausula:string; clausulaDetalle:string;
}
export interface FilaMatrizRecursos {
  proceso:string; nPersonas:string; infraestructura:string; hardwareSoftware:string; transporte:string;
  ambienteSocial:string; ambientePsicologico:string; ambienteFisico:string;
  varSocial:number; varPsicologica:number; varFisica:number; calificacionPromedio:number; nivelRiesgoVerde:string; accionRequerida:string;
  recursoEvaluado:string; hallazgo:string; riesgo:string; impacto:string; probabilidad:string; nivelRiesgoAzul:string; oportunidad:string; accion:string;
}

export interface IndicadorGenerado {
  codigo: string; titulo: string; proceso: string; frecuencia: string; meta: string;
}

export interface GeminiAnalysis {
  pestel: PestelRow[]; dofa: DofaRow[]
  caracterizacion: CaracterizacionRow[]; matrizRoles: FilaMatriz[]; matrizCargos: FilaMatrizCargos[]; matrizRecursos: FilaMatrizRecursos[]
  indicadores: IndicadorGenerado[]
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
` : `Empresa: ${mapa.nombreEmpresa || 'No especificada'}. Sector: ${mapa.sector || 'No especificado'}.`;

  return `Eres un consultor senior certificado en ISO 9001:2015, análisis estratégico y diseño organizacional.
${empresaBlock}

MAPA DE PROCESOS:
- Procesos Estratégicos: ${estrategicos}
- Procesos Misionales:   ${misionales}
- Procesos de Apoyo:     ${apoyo}
- Entrada del mapa:      ${mapa.cliente}
- Salida del mapa:       ${mapa.satisfaccion}

Responde ÚNICAMENTE con JSON válido sin texto adicional.

La estructura JSON debe ser:
{
  "contextoNarrativo": "string de 400-600 palabras con análisis narrativo del contexto organizacional. Incluye: descripción del negocio y propósito basada en misión/visión reales, análisis del sector y posición competitiva, características operativas, fortalezas estratégicas, desafíos del entorno, perspectiva SGC y conclusión sobre mejora continua. Usa saltos de línea para párrafos. Lenguaje profesional y específico para esta empresa.",
  "pestel": [
    { "factor":"P", "categoria":"Político", "descripcion":"descripción específica para esta empresa", "impacto":"Alto", "oportunidad":true }
  ],
  "dofa": [
    { "tipo":"Fortaleza", "descripcion":"descripción concreta basada en procesos y datos reales" }
  ],
  "caracterizacion": [
    { "codigo":"PE-01", "proceso":"nombre", "objetivo":"objetivo medible", "entradas":"...", "actividades":"...", "salidas":"...", "indicador":"KPI general", "indicadorEntrada":"...", "indicadorActividad":"...", "indicadorSalida":"...", "riesgoEntrada":"...", "opEntrada":"...", "riesgoActividad":"...", "opActividad":"...", "riesgoSalida":"...", "opSalida":"...", "responsable":"cargo", "estado":"Activo" }
  ],
  "matrizRoles": [
    { "id":1, "proceso":"nombre", "tipo":"estrategico", "responsable":"cargo", "autoridad":"quien autoriza", "funciones":"funciones principales", "recursos":"recursos necesarios", "rendicion":"a quien rinde cuentas", "clausula":"§5.1, §5.3" }
  ],
  "matrizCargos": [
    { "id":1, "proceso":"nombre del proceso", "tipo":"estrategico", "actividades":["Actividad concreta 1 del proceso","Actividad concreta 2","Actividad concreta 3"], "responsable":"cargo del responsable", "funciones":"funciones y responsabilidades del cargo frente al proceso", "clausula":"§5.3", "clausulaDetalle":"§5.3 – Roles, responsabilidades y autoridades en la organización" }
  ],
  "indicadores": [
    { "codigo":"IND-XX-01", "titulo":"Nombre del indicador", "proceso":"nombre del proceso", "frecuencia":"Mensual", "meta":"≥90%" }
  ]
}

REGLAS:
- pestel: exactamente 12 factores, mínimo 2 por letra PESTEL, mínimo 5 oportunidades y 5 amenazas. TODO específico para la empresa.
- dofa: exactamente 4 Fortalezas, 4 Oportunidades, 4 Debilidades, 4 Amenazas. Basadas en los procesos y datos reales.
- caracterizacion: una fila por cada proceso del mapa (estratégicos PE-xx, misionales PO-xx, apoyo PA-xx). Añade en cada uno actividades detalladas, indicadores para entrada, actividad y salida. Identifica riesgos y oportunidades para la entrada, actividad y salida, y colócalos en los campos correspondientes.
- matrizRoles: una fila por proceso con cargos reales de la empresa.
- matrizCargos: una fila por proceso. El campo "actividades" debe contener un array de 3 a 5 actividades concretas y específicas que se realizan en ese proceso. El campo "clausula" debe ser el código de la cláusula ISO 9001:2015 más relevante (ej: "§4.1", "§5.3", "§7.1", "§8.1"). El campo "clausulaDetalle" debe incluir el código y el nombre completo de la cláusula (ej: "§8.4 – Control de los procesos, productos y servicios suministrados externamente"). Usa las cláusulas reales de ISO 9001:2015.
- indicadores: al menos un indicador por cada proceso para medir el cumplimiento del mismo y de los objetivos de calidad. "frecuencia" debe ser estrictamente una de: "Diaria", "Semanal", "Mensual", "Trimestral", "Semestral", "Anual".
- impacto: "Alto" | "Medio" | "Bajo"
- estado: "Activo" | "Revisión" | "Inactivo"
- tipo en matrizRoles y matrizCargos: "estrategico" | "misional" | "apoyo"
- JSON completo y válido sin truncar.`;
}

// Prompt that asks only for the resource matrix
function buildResourcesPrompt(mapa: MapaData): string {
  const estrategicos = mapa.estrategicos.map(p => p.nombre).join(', ')
  const misionales   = mapa.misionales.map(p => p.nombre).join(', ')
  const apoyo        = mapa.apoyo.map(p => p.nombre).join(', ')
  const d = mapa.datosEmpresa
  const empresaBlock = d ? `
═══════════════════════════════════════════════════════
INFORMACIÓN DE LA EMPRESA (usa estos datos en TODO el análisis)
═══════════════════════════════════════════════════════
- Nombre:              ${d.nombreEmpresa    || 'No especificado'}
- Sector / Industria:  ${d.sector           || 'No especificado'}
- Tamaño:              ${d.tamano           || 'No especificado'}
` : `Empresa: ${mapa.nombreEmpresa || 'No especificada'}. Sector: ${mapa.sector || 'No especificado'}.`;

  return `Eres un consultor senior especializado en generación de la Matriz de Recursos y Ambiente de Trabajo (ISO 9001:2015, cláusula 7.1).
${empresaBlock}

MAPA DE PROCESOS:
- Procesos Estratégicos: ${estrategicos}
- Procesos Misionales:   ${misionales}
- Procesos de Apoyo:     ${apoyo}

Genera **únicamente** el campo "matrizRecursos" con la estructura completa. Devuelve JSON válido sin ningún otro campo ni texto.

La estructura debe ser:
{
  "matrizRecursos": [
    {
      "proceso": "Nombre del proceso (uno por cada proceso del mapa)",
      "nPersonas": "Ej: 3 analistas, 1 coordinador",
      "infraestructura": "Ej: Oficina administrativa, red local",
      "hardwareSoftware": "Ej: 4 PC, Licencia ERP",
      "transporte": "Ej: No aplica / Vehículo de reparto",
      "ambienteSocial": "Ej: Clima de colaboración",
      "ambientePsicologico": "Ej: Manejo de estrés alto",
      "ambienteFisico": "Ej: Iluminación LED, aire acondicionado",
      "varSocial": 4,
      "varPsicologica": 3,
      "varFisica": 5,
      "calificacionPromedio": 4.0,
      "nivelRiesgoVerde": "Bajo",
      "accionRequerida": "Monitoreo continuo",
      "recursoEvaluado": "Ej: Falta de licencias de software",
      "hallazgo": "Solo 2 licencias disponibles",
      "riesgo": "Retrasos operativos por falta de herramientas",
      "impacto": "Alto",
      "probabilidad": "Medio",
      "nivelRiesgoAzul": "Alto",
      "oportunidad": "Adquirir plan corporativo",
      "accion": "Cotizar y comprar 2 licencias extra"
    }
  ]
}

REGLAS:
- varSocial, varPsicologica, varFisica: valores numéricos enteros del 1 al 5.
- calificacionPromedio: promedio de las 3 variables.
- nivelRiesgoVerde, nivelRiesgoAzul: "Bajo", "Medio", "Alto" o "Crítico".
- impacto, probabilidad: "Alto", "Medio" o "Bajo".
- Incluye ABSOLUTAMENTE TODOS los procesos del mapa (Estratégicos, Misionales y de Apoyo).
- No devuelvas ningún texto extra, solo el JSON.`;
}

const MODELS = ['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.0-flash','gemini-flash-latest'];

/**
 * Helper para reparar JSONs incompletos/truncados por límites de tokens de salida.
 */
function tryRepairTruncatedJson(str: string): string {
  let trimmed = str.trim();
  if (trimmed.endsWith(',')) trimmed = trimmed.slice(0, -1);
  
  const quoteCount = (trimmed.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    trimmed += '"';
  }

  const openBraces = (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
  const openBrackets = (trimmed.match(/\[/g) || []).length - (trimmed.match(/\]/g) || []).length;

  for (let i = 0; i < Math.max(0, openBrackets); i++) trimmed += ']';
  for (let i = 0; i < Math.max(0, openBraces); i++) trimmed += '}';

  return trimmed;
}

function safeParseJson<T = any>(jsonString: string): T {
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.warn('[Gemini] JSON.parse falló en primera instancia. Intentando reparar JSON trunco...');
    const repaired = tryRepairTruncatedJson(jsonString);
    return JSON.parse(repaired);
  }
}

/**
 * Helper: builds the request body for a Gemini model, applying the
 * thinkingBudget: 0 fix for gemini-2.5-* models to prevent JSON truncation.
 */
function buildGeminiBody(model: string, prompt: string, maxOutputTokens: number) {
  const body: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, topP: 0.9, maxOutputTokens, responseMimeType: 'application/json' },
  };
  // Disable thinking tokens for gemini-2.5 models to avoid truncated JSON
  if (model.startsWith('gemini-2.5')) {
    body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  return body;
}

export async function analyzeWithGemini(mapa: MapaData): Promise<GeminiAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada');

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Gemini] ${model} | intento ${attempt}`);
        const body = buildGeminiBody(model, buildPrompt(mapa), 16384);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body)
        });

        const text = await response.text();

        if (response.status === 429) {
          console.warn(`[Gemini] Límite de cuota superado (429) en ${model}. Esperando ${attempt * 4}s antes de reintentar...`);
          await new Promise(r => setTimeout(r, attempt * 4000));
          continue;
        }

        if (response.status === 503) {
          await new Promise(r => setTimeout(r, attempt * 2000));
          continue;
        }

        if (!response.ok) {
          console.error(`[Gemini] Error ${model}:`, text);
          continue;
        }

        const data = JSON.parse(text);
        const candidate = data?.candidates?.[0];

        if (candidate?.finishReason === 'MAX_TOKENS') {
          console.warn(`[Gemini] La respuesta de ${model} alcanzó MAX_TOKENS y fue truncada.`);
        }

        const rawText = candidate?.content?.parts?.[0]?.text ?? '';
        const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

        const parsed = safeParseJson<any>(cleaned);

        if ((!parsed.matrizRoles?.length || !parsed.pestel?.length || !parsed.dofa?.length || !parsed.caracterizacion?.length) && attempt < 3) {
          console.warn(`[${model}] JSON incompleto (faltan matrices principales), reintentando...`);
          continue;
        }

        return {
          pestel:            Array.isArray(parsed.pestel)          ? parsed.pestel          : [],
          dofa:              Array.isArray(parsed.dofa)            ? parsed.dofa            : [],
          caracterizacion:   Array.isArray(parsed.caracterizacion) ? parsed.caracterizacion : [],
          matrizRoles:       Array.isArray(parsed.matrizRoles)     ? parsed.matrizRoles     : [],
          matrizCargos:      Array.isArray(parsed.matrizCargos)    ? parsed.matrizCargos    : [],
          matrizRecursos:    [], // This is generated separately now
          indicadores:       Array.isArray(parsed.indicadores)     ? parsed.indicadores     : [],
          contextoNarrativo: typeof parsed.contextoNarrativo === 'string' ? parsed.contextoNarrativo : '',
        };
      } catch (error) {
        console.error(`[Gemini] Error inesperado ${model} intento ${attempt}:`, error);
      }
    }
  }
  throw new Error('Todos los modelos de Governex IA fallaron. Intenta nuevamente.');
}

// Helper that generates only the resource matrix (matrizRecursos)
export async function generateResourcesOnly(mapa: MapaData): Promise<FilaMatrizRecursos[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada');
  for (const model of MODELS) {
    try {
      const body = buildGeminiBody(model, buildResourcesPrompt(mapa), 8192);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey },
        body: JSON.stringify(body)
      });
      const text = await response.text();
      if (!response.ok) continue;
      const data = JSON.parse(text);
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed.matrizRecursos)) {
        return parsed.matrizRecursos as FilaMatrizRecursos[];
      }
    } catch (_) { /* ignore and try next model */ }
  }
  throw new Error('Failed to generate matrizRecursos');
}

export async function generarDetalleProcesoManual(proceso: string, objetivo: string, entradas: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada');

  const prompt = `Eres un consultor experto en ISO 9001:2015. Se ha definido el siguiente proceso manualmente:
- Proceso: ${proceso}
- Objetivo: ${objetivo}
- Entradas: ${entradas}

Genera los detalles faltantes para caracterizar el proceso y la gestión de riesgos en formato JSON estrictamente.
Estructura JSON esperada:
{
  "actividades": "Descripción de las actividades paso a paso",
  "salidas": "Resultados esperados del proceso",
  "indicador": "Indicador general para medir el desempeño global del proceso",
  "indicadorEntrada": "Indicador para medir las entradas",
  "indicadorActividad": "Indicador para medir las actividades",
  "indicadorSalida": "Indicador para medir las salidas",
  "riesgoEntrada": "Riesgo asociado a las entradas",
  "opEntrada": "Oportunidad asociada a las entradas",
  "riesgoActividad": "Riesgo asociado a las actividades",
  "opActividad": "Oportunidad asociada a las actividades",
  "riesgoSalida": "Riesgo asociado a las salidas",
  "opSalida": "Oportunidad asociada a las salidas"
}
Devuelve ÚNICAMENTE el JSON sin markdown adicional.`;

  for (const model of MODELS) {
    try {
      const body = buildGeminiBody(model, prompt, 2048);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey },
        body: JSON.stringify(body)
      });
      const text = await response.text();
      if (!response.ok) continue;
      const data = JSON.parse(text);
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error(`[Gemini] Error generarDetalleProcesoManual con ${model}:`, error);
    }
  }
  throw new Error('Fallaron los modelos de Gemini');
}

export async function regenerarCaracterizacionCompleta(rows: CaracterizacionRow[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada');

  const prompt = `Eres un experto en ISO 9001:2015. Aquí tienes una lista de procesos de una empresa representados en formato JSON:
${JSON.stringify(rows)}

Para CADA UNO de ellos, si les faltan las actividades, salidas, o indicadores/riesgos/oportunidades específicos de (entrada, actividad, salida), complétalos de acuerdo a su información.
Devuelve ÚNICAMENTE un array JSON con los objetos actualizados. Estructura esperada por objeto:
{
  "codigo": "...",
  "proceso": "...",
  "objetivo": "...",
  "entradas": "...",
  "actividades": "...",
  "salidas": "...",
  "indicador": "...",
  "indicadorEntrada": "...",
  "indicadorActividad": "...",
  "indicadorSalida": "...",
  "riesgoEntrada": "...",
  "opEntrada": "...",
  "riesgoActividad": "...",
  "opActividad": "...",
  "riesgoSalida": "...",
  "opSalida": "...",
  "responsable": "...",
  "estado": "..."
}
Devuelve estrictamente el JSON (array de objetos) sin markdown adicional.`;

  for (const model of MODELS) {
    try {
      const body = buildGeminiBody(model, prompt, 8192);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey },
        body: JSON.stringify(body)
      });
      const text = await response.text();
      if (!response.ok) continue;
      const data = JSON.parse(text);
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error(`[Gemini] Error regenerarCaracterizacionCompleta con ${model}:`, error);
    }
  }
  throw new Error('Fallaron los modelos de Gemini al regenerar caracterización');
}

export async function regenerarMapaCompleto(rows: CaracterizacionRow[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada');

  const prompt = `Eres un experto en ISO 9001:2015. Tienes la siguiente tabla de caracterización de procesos:
${JSON.stringify(rows)}

Genera una matriz de roles y responsabilidades (Mapa de Procedimiento) asociando CADA UNO de los procesos de la tabla a sus funciones principales, autoridad y cláusula aplicable (por defecto §8.1 si no aplica otra). 
Debes clasificar el tipo de proceso en 'estrategico', 'misional' o 'apoyo'.

CRÍTICO: Debes generar EXACTAMENTE el mismo número de elementos que la tabla de entrada (no puedes omitir NINGÚN proceso). Cada objeto en la respuesta debe corresponder a un proceso de la tabla de entrada.

Devuelve ÚNICAMENTE un array JSON con esta estructura por cada objeto:
[
  {
    "proceso": "Nombre del proceso (igual que en caracterizacion)",
    "tipo": "estrategico | misional | apoyo",
    "responsable": "Rol responsable",
    "clausula": "§...",
    "funciones": "Descripción de funciones principales"
  }
]
NO incluyas markdown, solo el array JSON.`;

  for (const model of MODELS) {
    try {
      const body = buildGeminiBody(model, prompt, 8192);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey },
        body: JSON.stringify(body)
      });
      const text = await response.text();
      if (!response.ok) continue;
      const data = JSON.parse(text);
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error(`[Gemini] Error regenerarMapaCompleto con ${model}:`, error);
    }
  }
  throw new Error('Fallaron los modelos de Gemini al regenerar mapa');
}
