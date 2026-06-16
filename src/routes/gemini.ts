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