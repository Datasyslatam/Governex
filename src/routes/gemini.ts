import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { analyzeWithGemini, generateResourcesOnly, MapaData, DatosEmpresa } from '../services/geminiService'

/** Allowed PESTEL factor codes as required by the DB constraint. */
const VALID_PESTEL_FACTORS = new Set(['P', 'E', 'S', 'T', 'A', 'L'])

/**
 * Maps a raw factor value returned by Gemini to a valid single-letter
 * PESTEL code.  Handles both already-correct single letters and full
 * Spanish/English category names, case-insensitively.
 * Falls back to 'P' when the value cannot be resolved.
 */
function mapPestelFactor(raw: string | undefined | null): 'P' | 'E' | 'S' | 'T' | 'A' | 'L' {
  if (!raw) return 'P'

  const normalised = raw.trim().toUpperCase()

  // Already a valid single-letter code
  if (VALID_PESTEL_FACTORS.has(normalised)) {
    return normalised as 'P' | 'E' | 'S' | 'T' | 'A' | 'L'
  }

  // Map full category names (Spanish & English) to their codes
  const lower = raw.trim().toLowerCase()
  if (lower.startsWith('pol'))  return 'P'   // Político / Political
  if (lower.startsWith('eco'))  return 'E'   // Económico / Economic
  if (lower.startsWith('soc'))  return 'S'   // Social
  if (lower.startsWith('tec'))  return 'T'   // Tecnológico / Technological
  if (lower.startsWith('amb') || lower.startsWith('env')) return 'A'  // Ambiental / Environmental
  if (lower.startsWith('leg'))  return 'L'   // Legal

  // Last-resort: try the first character if it happens to be valid
  const firstChar = normalised.charAt(0)
  if (VALID_PESTEL_FACTORS.has(firstChar)) {
    return firstChar as 'P' | 'E' | 'S' | 'T' | 'A' | 'L'
  }

  // Fallback — default to 'P' to satisfy the DB constraint
  console.warn(`[Gemini] mapPestelFactor: unrecognised factor "${raw}", defaulting to 'P'`)
  return 'P'
}

const router = Router()
router.use(authMiddleware)

/* POST /api/gemini/analizar-organigrama */
router.post('/analizar-organigrama', async (req: AuthRequest, res: Response) => {
  const { mapa, nombreEmpresa, sector, datosEmpresa, guardarEnBD = true } = req.body as {
    mapa: MapaData; nombreEmpresa?: string; sector?: string
    datosEmpresa?: DatosEmpresa; guardarEnBD?: boolean
  }

  if (!mapa || !Array.isArray(mapa.estrategicos)) {
    return res.status(400).json({ error: 'Se requiere un objeto mapa con estrategicos, misionales y apoyo' })
  }

  const mapaConInfo: MapaData = {
    ...mapa,
    nombreEmpresa: datosEmpresa?.nombreEmpresa ?? nombreEmpresa,
    sector:        datosEmpresa?.sector        ?? sector,
    datosEmpresa,
  }

  try {
    console.log('[Gemini] Iniciando análisis concurrente (Principal + Recursos)...');
    const [analysis, matrizRecursos] = await Promise.all([
      analyzeWithGemini(mapaConInfo),
      generateResourcesOnly(mapaConInfo).catch(e => {
        console.error('[Gemini] Error al generar matriz de recursos separada:', e);
        return [];
      })
    ]);

    // Combinar el resultado
    analysis.matrizRecursos = matrizRecursos;
    console.log(`[Gemini] Análisis completado. Roles: ${analysis.matrizRoles?.length}, Recursos: ${analysis.matrizRecursos?.length}`);

    if (guardarEnBD) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('DELETE FROM pestel')
        await client.query('DELETE FROM dofa')

        for (const row of analysis.pestel) {
          const factorChar = mapPestelFactor(row.factor)
          await client.query(
            `INSERT INTO pestel (factor, categoria, descripcion, impacto, oportunidad) VALUES ($1,$2,$3,$4,$5)`,
            [factorChar, row.categoria, row.descripcion, row.impacto, row.oportunidad]
          )
        }

        for (const row of analysis.dofa) {
          await client.query(`INSERT INTO dofa (tipo, descripcion) VALUES ($1,$2)`, [row.tipo, row.descripcion])
        }

        const { rows: tipos } = await client.query('SELECT id, nombre FROM tipos_proceso')
        const tipoMap: Record<string, number> = {}
        for (const t of tipos) tipoMap[t.nombre.toLowerCase()] = t.id

        const procesoIdMap: Record<string, number> = {}

        for (const row of analysis.caracterizacion) {
          let tipo_id: number
          if      (row.codigo.startsWith('PE')) tipo_id = tipoMap['estratégico'] ?? tipoMap['estrategico'] ?? 1
          else if (row.codigo.startsWith('PO')) tipo_id = tipoMap['misional']    ?? tipoMap['operacional']  ?? 2
          else                                  tipo_id = tipoMap['apoyo']       ?? tipoMap['soporte']      ?? 3

          const procRes = await client.query(
            `INSERT INTO procesos (codigo, nombre, objetivo, entradas, salidas, indicador_kpi, responsable, tipo_id, estado)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (codigo) DO UPDATE SET
               nombre=EXCLUDED.nombre, objetivo=EXCLUDED.objetivo, entradas=EXCLUDED.entradas,
               salidas=EXCLUDED.salidas, indicador_kpi=EXCLUDED.indicador_kpi,
               responsable=EXCLUDED.responsable, tipo_id=EXCLUDED.tipo_id, estado=EXCLUDED.estado
             RETURNING id`,
            [row.codigo, row.proceso, row.objetivo, row.entradas, row.salidas,
             row.indicador, row.responsable, tipo_id, row.estado ?? 'Activo']
          )
          procesoIdMap[row.proceso.toLowerCase()] = procRes.rows[0].id
        }

        if (analysis.indicadores && analysis.indicadores.length > 0) {
          // Eliminar todos los indicadores anteriores antes de generar los nuevos
          await client.query('DELETE FROM indicador_mediciones');
          await client.query('DELETE FROM indicadores');

          for (const ind of analysis.indicadores) {
            const procId = procesoIdMap[(ind.proceso || '').toLowerCase()] || null
            const validFreqs = ['Diaria','Semanal','Mensual','Trimestral','Semestral','Anual']
            let freq = ind.frecuencia;
            if (!validFreqs.includes(freq)) {
              freq = 'Mensual'; // Fallback
            }

            await client.query(
              `INSERT INTO indicadores (codigo, titulo, proceso_id, frecuencia, meta, activo)
               VALUES ($1,$2,$3,$4,$5,$6)`,
              [ind.codigo, ind.titulo, procId, freq, ind.meta, true]
            )
          }
        }
        await client.query('COMMIT')
      } catch (dbErr) {
        await client.query('ROLLBACK')
        console.error('[Gemini] Error BD:', dbErr)
      } finally {
        client.release()
      }
    }

    return res.json(analysis)

  } catch (err: any) {
    console.error('[Gemini] Error:', err)
    return res.status(500).json({ error: err.message ?? 'Error al analizar con Gemini' })
  }
})

/* ── POST /api/gemini/generar-ideario ──────────────────────────
   Genera Misión, Visión y Política de Calidad ISO 9001:2015
   a partir de los datos del formulario organizacional.            */
router.post('/generar-ideario', async (req: AuthRequest, res: Response) => {
  const { datosEmpresa } = req.body as { datosEmpresa: DatosEmpresa }

  if (!datosEmpresa?.nombreEmpresa) {
    return res.status(400).json({ error: 'Se requiere al menos el nombre de la empresa' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })

  const prompt = `Eres un consultor experto en ISO 9001:2015 y estrategia organizacional.
Con base en la siguiente información de la empresa, genera textos profesionales, específicos y alineados con la norma ISO 9001:2015.

DATOS DE LA EMPRESA:
- Nombre: ${datosEmpresa.nombreEmpresa}
- Sector: ${datosEmpresa.sector ?? 'No especificado'}
- Tipo de empresa: ${datosEmpresa.tipoEmpresa ?? 'No especificado'}
- Tamaño: ${datosEmpresa.tamano ?? 'No especificado'}
- Ubicación: ${datosEmpresa.ubicacion ?? 'No especificada'}
- Año de fundación: ${datosEmpresa.anoFundacion ?? 'No especificado'}
- Empleados: ${datosEmpresa.cantidadEmpleados ?? 'No especificado'}
- Certificaciones actuales: ${datosEmpresa.certificaciones ?? 'Ninguna'}
- Productos y/o Servicios: ${datosEmpresa.productosServicios ?? 'No especificado'}
- Mercado objetivo: ${datosEmpresa.mercadoObjetivo ?? 'No especificado'}
- Partes interesadas: ${datosEmpresa.parteInteresadas ?? 'No especificado'}
- Alcance del SGC: ${datosEmpresa.alcanceSGC ?? 'No especificado'}

Genera exactamente el siguiente JSON (sin backticks, sin markdown, solo el objeto JSON):
{
  "mision": "2-3 oraciones: qué hace la empresa, para quién, cómo y con qué propósito",
  "vision": "1-2 oraciones: qué quiere ser en 5-10 años, ambiciosa pero realista",
  "politicaCalidad": "3-4 oraciones ISO 9001:2015: compromiso con el cliente, mejora continua, cumplimiento de requisitos y objetivos medibles"
}

Requisitos:
- Usa el nombre real de la empresa en los textos
- Sé específico al sector y tipo de empresa
- Tono formal y profesional
- Evita frases genéricas o clichés
- La política de calidad debe ser apta para documentación ISO`

  const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']

  for (const model of MODELS) {
    try {
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }
      // Los modelos 2.5 usan tokens de "thinking" por defecto, que pueden
      // consumir todo el maxOutputTokens y truncar el JSON de salida.
      if (model.startsWith('gemini-2.5')) {
        body.generationConfig.thinkingConfig = { thinkingBudget: 0 }
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body:    JSON.stringify(body),
        }
      )
      if (!response.ok) {
        console.error(`[Ideario] ${model} respondió ${response.status}`)
        continue
      }

      const data         = await response.json()
      const finishReason = data?.candidates?.[0]?.finishReason
      const rawText      = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

      if (!rawText) {
        console.error(`[Ideario] ${model} devolvió texto vacío (finishReason: ${finishReason})`)
        continue
      }

      const parsed = parsearIdearioJSON(rawText)

      if (parsed?.mision && parsed?.vision && parsed?.politicaCalidad) {
        return res.json({
          mision:          parsed.mision,
          vision:          parsed.vision,
          politicaCalidad: parsed.politicaCalidad,
        })
      }

      console.error(`[Ideario] ${model} devolvió JSON incompleto/no parseable (finishReason: ${finishReason})`)
    } catch (err) {
      console.error(`[Ideario] Error ${model}:`, err)
    }
  }

  return res.status(500).json({ error: 'No se pudo generar el ideario con ningún modelo disponible' })
})

/* ── Parser tolerante para la respuesta JSON del ideario ──────
   Limpia markdown, recorta al primer/último brace y, si el JSON
   viene truncado (string sin cerrar), intenta repararlo cerrando
   comillas/llaves pendientes antes de hacer JSON.parse.           */
function parsearIdearioJSON(rawText: string): { mision?: string; vision?: string; politicaCalidad?: string } | null {
  let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  const start = cleaned.indexOf('{')
  const end   = cleaned.lastIndexOf('}')
  if (start === -1) return null
  if (end > start) cleaned = cleaned.slice(start, end + 1)
  else cleaned = cleaned.slice(start)

  try {
    return JSON.parse(cleaned)
  } catch {
    // Intento de reparación: si quedó una cadena sin cerrar (truncado),
    // cerramos la comilla y las llaves pendientes.
    let repaired = cleaned

    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length
    if (quoteCount % 2 !== 0) repaired += '"'

    const openBraces  = (repaired.match(/{/g) || []).length
    const closeBraces = (repaired.match(/}/g) || []).length
    repaired += '}'.repeat(Math.max(0, openBraces - closeBraces))

    try {
      return JSON.parse(repaired)
    } catch {
      return null
    }
  }
}

/* POST /api/gemini/extraer-procesos-imagen */
router.post('/extraer-procesos-imagen', async (req: AuthRequest, res: Response) => {
  const { base64, mimeType } = req.body as { base64:string; mimeType:string; fileName:string }
  if (!base64 || !mimeType) return res.status(400).json({ error: 'Se requiere base64 y mimeType' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })

  const prompt = `Analiza este organigrama o documento organizacional e identifica todos los procesos, áreas o departamentos.
Clasifícalos en:
- estrategicos: Gerencia, Dirección, Calidad, Estrategia, Planificación, Mejora
- misionales: Producción, Operaciones, Ventas, Comercial, Servicio al Cliente, Diseño
- apoyo: RRHH, Talento Humano, Finanzas, TI, Compras, Logística, Legal, Mantenimiento

Responde ÚNICAMENTE con JSON válido:
{
  "cliente":      "Requisitos del Cliente y Contexto",
  "satisfaccion": "Satisfacción del Cliente",
  "estrategicos": [{ "nombre":"..." }],
  "misionales":   [{ "nombre":"..." }],
  "apoyo":        [{ "nombre":"..." }]
}`

  const body = {
    contents: [{ parts: [{ inline_data:{ mime_type:mimeType, data:base64 } }, { text:prompt }] }],
    generationConfig: { temperature:0.2, maxOutputTokens:1024, responseMimeType:'application/json' },
  }

  const MODELS = ['gemini-2.5-flash','gemini-2.0-flash','gemini-flash-latest']
  for (const model of MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { method:'POST', headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey }, body:JSON.stringify(body) }
      )
      if (!response.ok) continue
      const data    = await response.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const cleaned = rawText.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim()
      const parsed  = JSON.parse(cleaned)
      if (parsed.estrategicos || parsed.misionales || parsed.apoyo) {
        return res.json({
          cliente:      parsed.cliente      || 'Requisitos del Cliente y Contexto',
          satisfaccion: parsed.satisfaccion || 'Satisfacción del Cliente',
          estrategicos: Array.isArray(parsed.estrategicos) ? parsed.estrategicos : [],
          misionales:   Array.isArray(parsed.misionales)   ? parsed.misionales   : [],
          apoyo:        Array.isArray(parsed.apoyo)         ? parsed.apoyo        : [],
        })
      }
    } catch (err) { console.error(`[Vision] Error ${model}:`, err) }
  }

  return res.json({
    cliente: 'Requisitos del Cliente y Contexto', satisfaccion: 'Satisfacción del Cliente',
    estrategicos: [{ nombre:'Gerencia General' },{ nombre:'Gestión de Calidad' },{ nombre:'Planeación Estratégica' }],
    misionales:   [{ nombre:'Producción / Operaciones' },{ nombre:'Ventas y Atención al Cliente' }],
    apoyo:        [{ nombre:'Talento Humano' },{ nombre:'Finanzas y Contabilidad' },{ nombre:'TI e Infraestructura' }],
  })
})

export default router

// ── Agregar este bloque al final de src/routes/gemini.ts ──────────────────────
// Ubicación: justo antes de `export default router`
// ─────────────────────────────────────────────────────────────────────────────

/* ── POST /api/gemini/analizar-rev-direccion ───────────────────────────────────
   Recibe el paquete consolidado de insumos 9.3.2 (datos de DB + datos del
   contexto IA) y devuelve las tres salidas del requisito: oportunidades de
   mejora, necesidades de cambio en el SGC y necesidades de recursos.
   No persiste nada: el frontend muestra y edita los resultados, y el usuario
   los vuelca al acta existente de REV_DIRECCION cuando cierra la revisión.     */
router.post('/analizar-rev-direccion', async (req: AuthRequest, res: Response) => {
  const {
    riesgos,
    indicadores,
    noConformidades,
    accionesCorrectivas,
    auditorias,
    hallazgos,
    proveedores,
    objetivosCalidad,
    pestel,
    dofa,
    matrizRecursos,
    contextoNarrativo,
    datosEmpresa,
  } = req.body

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })

  // ── Resúmenes compactos para no exceder el contexto de Gemini ──────────────
  const resRiesgos = (riesgos ?? []).map((r: any) => ({
    codigo: r.codigo, tipo: r.tipo, estado: r.estado,
    nivel: r.nivel, descripcion: r.descripcion?.slice(0, 120),
  }))

  const resIndicadores = (indicadores ?? []).map((i: any) => ({
    codigo: i.codigo, titulo: i.titulo, proceso: i.proceso_nombre,
    meta: i.meta, ultima: i.ultima_medicion
      ? `${i.ultima_medicion.valor} (${i.ultima_medicion.estado})`
      : 'Sin medición',
  }))

  const resNCs = (noConformidades ?? []).map((n: any) => ({
    codigo: n.codigo, gravedad: n.gravedad, estado: n.estado,
    origen: n.origen, proceso: n.proceso_nombre,
  }))

  const resACs = (accionesCorrectivas ?? []).map((a: any) => ({
    codigo: a.codigo, estado: a.estado, eficacia: a.eficacia,
    responsable: a.responsable,
  }))

  const resAuditorias = (auditorias ?? []).map((a: any) => ({
    codigo: a.codigo, proceso: a.proceso_nombre,
    estado: a.estado, hallazgos: a.hallazgos,
  }))

  const resHallazgos = (hallazgos ?? []).map((h: any) => ({
    tipo: h.tipo, estado: h.estado, clausula: h.clausula,
    descripcion: h.descripcion?.slice(0, 100),
  }))

  const resProveedores = (proveedores ?? []).map((p: any) => ({
    razon: p.razon, estado: p.estado,
    ultima_eval: p.ultima_evaluacion
      ? `${p.ultima_evaluacion.total}/100`
      : 'Sin evaluar',
  }))

  const resObjetivos = (objetivosCalidad ?? []).map((o: any) => ({
    codigo: o.codigo, estado: o.estado, meta: o.meta,
    ultima_medicion: o.mediciones?.[0]
      ? `${o.mediciones[0].valor} – ${o.mediciones[0].estado}`
      : 'Sin medición',
  }))

  const resPestel = (pestel ?? []).slice(0, 12).map((p: any) => ({
    factor: p.factor, categoria: p.categoria,
    impacto: p.impacto, oportunidad: p.oportunidad,
    descripcion: p.descripcion?.slice(0, 100),
  }))

  const resDofa = (dofa ?? []).map((d: any) => ({
    tipo: d.tipo, descripcion: d.descripcion?.slice(0, 100),
  }))

  const resRecursos = (matrizRecursos ?? []).map((m: any) => ({
    proceso: m.proceso, nivelRiesgoAzul: m.nivelRiesgoAzul,
    riesgo: m.riesgo?.slice(0, 80), oportunidad: m.oportunidad?.slice(0, 80),
  }))

  const empresaInfo = datosEmpresa
    ? `Empresa: ${datosEmpresa.nombreEmpresa} | Sector: ${datosEmpresa.sector} | Tamaño: ${datosEmpresa.tamano}`
    : 'Empresa no especificada'

  const prompt = `Eres un consultor senior certificado en ISO 9001:2015. Debes actuar como facilitador de la Revisión por la Dirección (cláusula 9.3) y generar un análisis ejecutivo basado en los datos reales del Sistema de Gestión de Calidad.

${empresaInfo}

CONTEXTO ORGANIZACIONAL (4.1):
${contextoNarrativo ? contextoNarrativo.slice(0, 600) : 'No disponible'}

═══════ INSUMOS 9.3.2 ═══════

a) RIESGOS Y OPORTUNIDADES (6.1 — derivados de 4.1 y 7.1):
${JSON.stringify(resRiesgos, null, 0).slice(0, 2000)}

b) ANÁLISIS DE CONTEXTO — PESTEL (4.1):
${JSON.stringify(resPestel, null, 0).slice(0, 1000)}

c) ANÁLISIS DE CONTEXTO — DOFA (4.1):
${JSON.stringify(resDofa, null, 0).slice(0, 800)}

d) RECURSOS — Hallazgos y Riesgos por Proceso (7.1):
${JSON.stringify(resRecursos, null, 0).slice(0, 800)}

e) OBJETIVOS DE CALIDAD — Estado y Mediciones (6.2):
${JSON.stringify(resObjetivos, null, 0).slice(0, 800)}

f) INDICADORES DE PROCESO — Última Medición (9.1):
${JSON.stringify(resIndicadores, null, 0).slice(0, 1000)}

g) NO CONFORMIDADES (10.2):
${JSON.stringify(resNCs, null, 0).slice(0, 600)}

h) ACCIONES CORRECTIVAS — Eficacia (10.2):
${JSON.stringify(resACs, null, 0).slice(0, 600)}

i) AUDITORÍAS — Hallazgos (9.2):
${JSON.stringify(resAuditorias, null, 0).slice(0, 600)}
${JSON.stringify(resHallazgos, null, 0).slice(0, 600)}

j) DESEMPEÑO DE PROVEEDORES EXTERNOS (8.4):
${JSON.stringify(resProveedores, null, 0).slice(0, 600)}

═══════════════════════════════

Con base en TODOS los datos anteriores, genera el análisis de Revisión por la Dirección. Cada conclusión DEBE estar justificada con datos concretos de los insumos (menciona códigos, cantidades, porcentajes o nombres específicos cuando existan).

Responde ÚNICAMENTE con JSON válido, sin texto adicional, con esta estructura exacta:
{
  "resumenEjecutivo": "Párrafo de 120-180 palabras con el estado general del SGC, los logros clave del período, los principales riesgos activos y una valoración honesta de la madurez del sistema. Usa datos concretos.",
  "oportunidadesMejora": [
    {
      "titulo": "Título corto de la oportunidad",
      "justificacion": "Explicación de 2-3 oraciones basada en datos específicos de los insumos",
      "prioridad": "Alta",
      "requisitoFuente": "9.3.2 f)"
    }
  ],
  "necesidadesCambioSGC": [
    {
      "titulo": "Cambio requerido en el SGC",
      "justificacion": "Explicación de 2-3 oraciones con evidencia de los insumos",
      "prioridad": "Alta",
      "requisitoFuente": "9.3.2 b)"
    }
  ],
  "necesidadesRecursos": [
    {
      "titulo": "Recurso o capacidad requerida",
      "justificacion": "Explicación de 2-3 oraciones con evidencia de los insumos",
      "prioridad": "Media",
      "requisitoFuente": "9.3.2 d)"
    }
  ],
  "conclusionGeneral": "Párrafo de 60-80 palabras con la decisión estratégica y el enfoque recomendado para el próximo período del SGC."
}

REGLAS:
- oportunidadesMejora: entre 3 y 6 items
- necesidadesCambioSGC: entre 2 y 5 items
- necesidadesRecursos: entre 2 y 4 items
- prioridad: solo "Alta", "Media" o "Baja"
- Si no hay datos suficientes para un insumo, indícalo honestamente en la justificación
- Conecta explícitamente los datos de un insumo con las salidas (ej: "Los 3 hallazgos abiertos en auditoría AU-001 indican...")
- JSON completo y válido, sin truncar`

  const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-flash-latest']

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[RevDireccion] ${model} | intento ${attempt}`)
        const body: any = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            topP: 0.9,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }
        if (model.startsWith('gemini-2.5')) {
          body.generationConfig.thinkingConfig = { thinkingBudget: 0 }
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(body),
          }
        )

        if (response.status === 503) {
          await new Promise(r => setTimeout(r, attempt * 2000))
          continue
        }
        if (!response.ok) {
          console.error(`[RevDireccion] ${model} respondió ${response.status}`)
          break
        }

        const data = await response.json()
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        if (!rawText) { console.warn(`[RevDireccion] ${model} devolvió texto vacío`); continue }

        const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
        const parsed = JSON.parse(cleaned)

        if (!parsed.resumenEjecutivo || !Array.isArray(parsed.oportunidadesMejora)) {
          console.warn(`[RevDireccion] ${model} JSON incompleto, reintentando...`)
          continue
        }

        return res.json({
          resumenEjecutivo:      parsed.resumenEjecutivo      ?? '',
          oportunidadesMejora:   Array.isArray(parsed.oportunidadesMejora)   ? parsed.oportunidadesMejora   : [],
          necesidadesCambioSGC:  Array.isArray(parsed.necesidadesCambioSGC)  ? parsed.necesidadesCambioSGC  : [],
          necesidadesRecursos:   Array.isArray(parsed.necesidadesRecursos)   ? parsed.necesidadesRecursos   : [],
          conclusionGeneral:     parsed.conclusionGeneral     ?? '',
        })
      } catch (err) {
        console.error(`[RevDireccion] Error ${model} intento ${attempt}:`, err)
      }
    }
  }

  return res.status(500).json({ error: 'No se pudo generar el análisis con ningún modelo disponible' })
})