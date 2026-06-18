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

  const MODELS = ['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.0-flash','gemini-flash-latest']

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

  const MODELS = ['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.0-flash','gemini-flash-latest']
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

/* ── POST /api/gemini/generar-revisiones-requisitos ─────────────────
   A partir del contexto §4.1 genera la matriz completa de revisiones
   de requisitos (productos/servicios × clientes) con sus campos ISO. */
router.post('/generar-revisiones-requisitos', async (req: AuthRequest, res: Response) => {
  const { datosEmpresa } = req.body as { datosEmpresa: DatosEmpresa }

  if (!datosEmpresa?.nombreEmpresa) {
    return res.status(400).json({ error: 'Se requieren los datos de la empresa del módulo 4.1' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })

  const esEducativa = ['Educación', 'educacion', 'educativ', 'colegio', 'escuel', 'universid', 'instituc']
    .some(k => (datosEmpresa.sector ?? '').toLowerCase().includes(k))

  const prompt = `Eres un consultor ISO 9001:2015 experto en la cláusula 8.2 (Requisitos para productos y servicios).

CONTEXTO DE LA ORGANIZACIÓN (módulo 4.1):
- Nombre: ${datosEmpresa.nombreEmpresa}
- Sector: ${datosEmpresa.sector}
- Tipo: ${datosEmpresa.tipoEmpresa}
- Tamaño: ${datosEmpresa.tamano}
- Ubicación: ${datosEmpresa.ubicacion}
- Misión: ${datosEmpresa.mision}
- Visión: ${datosEmpresa.vision}
- Política de calidad: ${datosEmpresa.politicaCalidad}
- Productos / Servicios: ${datosEmpresa.productosServicios}
- Mercado objetivo / Clientes: ${datosEmpresa.mercadoObjetivo}
- Alcance SGC: ${datosEmpresa.alcanceSGC}
- Partes interesadas: ${datosEmpresa.parteInteresadas}
${datosEmpresa.contextoNarrativo ? `- Contexto adicional: ${datosEmpresa.contextoNarrativo}` : ''}

INSTRUCCIÓN:
Analiza los productos y servicios de esta organización y genera la MATRIZ DE REVISIÓN DE REQUISITOS ISO 9001:2015 §8.2.
Crea UNA FILA por cada producto o servicio identificado en el contexto (mínimo 3, máximo 8).
${esEducativa ? 'Para instituciones educativas, cada área o asignatura es un "producto/servicio". Usa los clientes reales: estudiantes, padres de familia, MEN, etc.' : ''}

Para cada fila determina:
- El cliente o segmento de mercado más relevante para ese producto/servicio
- Los requisitos específicos que ese cliente espera
- Los requisitos legales y reglamentarios aplicables en Colombia para ese producto/servicio
- Los requisitos internos de la organización (plazos, estándares, garantías)
- El cargo responsable de la revisión (según el tamaño y tipo de empresa)
- La fecha de revisión (usa el año actual 2025, distribúyelas en los meses del año)
- El estado inicial apropiado (la mayoría Pendiente, algunos Aprobado si son servicios consolidados)

Responde ÚNICAMENTE con JSON válido, sin backticks ni markdown:
{
  "revisiones": [
    {
      "cliente": "Nombre del cliente o segmento",
      "productoServicio": "Nombre exacto del producto o servicio",
      "requisitosCliente": "Requisitos específicos que el cliente espera de este producto/servicio",
      "requisitosLegales": "Normas legales, reglamentarias o técnicas aplicables en Colombia",
      "requisitosOrg": "Requisitos internos: plazos, estándares de calidad, condiciones de entrega",
      "revisadoPor": "Cargo del responsable",
      "fechaRevision": "2025-MM-DD",
      "estado": "Pendiente | Aprobado | Rechazado"
    }
  ]
}`

  const MODELS = ['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.0-flash','gemini-flash-latest']
  for (const model of MODELS) {
    try {
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 3000,
          responseMimeType: 'application/json',
        },
      }
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body) }
      )
      if (!response.ok) { console.error(`[Revisiones] ${model} → ${response.status}`); continue }

      const data    = await response.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!rawText) continue

      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
      if (s !== -1 && e > s) cleaned = cleaned.slice(s, e + 1)

      const parsed = JSON.parse(cleaned)
      if (!Array.isArray(parsed.revisiones) || parsed.revisiones.length === 0) continue

      return res.json({ revisiones: parsed.revisiones })
    } catch (err) {
      console.error(`[Revisiones] Error ${model}:`, err)
    }
  }
  return res.status(500).json({ error: 'No se pudo generar la matriz con ningún modelo disponible' })
})

/* ── POST /api/gemini/generar-ficha-tecnica ──────────────────────
   Genera una ficha técnica de producto/servicio o una ficha educativa
   (área/asignatura con cursos, contenido programático e intensidad
   horaria) a partir de los datos del contexto organizacional (§4.1). */
router.post('/generar-ficha-tecnica', async (req: AuthRequest, res: Response) => {
  const { datosEmpresa, cliente, productoServicio, tipo } = req.body as {
    datosEmpresa: DatosEmpresa
    cliente: string
    productoServicio: string
    tipo: 'educativa' | 'general'
  }

  if (!datosEmpresa?.nombreEmpresa) {
    return res.status(400).json({ error: 'Se requieren los datos de la empresa' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })

  const esEducativa = tipo === 'educativa'

  const promptGeneral = `Eres un consultor ISO 9001:2015 experto en elaboración de fichas técnicas de productos y servicios.

DATOS DE LA ORGANIZACIÓN:
- Nombre: ${datosEmpresa.nombreEmpresa}
- Sector: ${datosEmpresa.sector ?? 'No especificado'}
- Tipo: ${datosEmpresa.tipoEmpresa ?? 'No especificado'}
- Tamaño: ${datosEmpresa.tamano ?? 'No especificado'}
- Productos/Servicios: ${datosEmpresa.productosServicios ?? 'No especificado'}
- Mercado objetivo: ${datosEmpresa.mercadoObjetivo ?? 'No especificado'}
- Política de Calidad: ${datosEmpresa.politicaCalidad ?? 'No definida'}
- Alcance SGC: ${datosEmpresa.alcanceSGC ?? 'No definido'}

FICHA A GENERAR:
- Cliente/Destinatario: ${cliente}
- Producto o Servicio: ${productoServicio}

Genera una ficha técnica profesional ISO 9001:2015 (§8.2) para este producto/servicio.
Responde ÚNICAMENTE con JSON válido (sin backticks, sin markdown):
{
  "descripcion": "Descripción clara y técnica del producto/servicio (2-3 oraciones)",
  "especificacionesTecnicas": "Especificaciones técnicas detalladas: materiales, capacidades, dimensiones, parámetros clave, rendimiento esperado. Sé específico al sector.",
  "normasAplicables": "Normas ISO, NTC u otras regulaciones aplicables según el sector",
  "condicionesUso": "Condiciones de uso, almacenamiento, transporte o entrega relevantes",
  "elaboradoPor": "Cargo sugerido del responsable de elaborar la ficha",
  "aprobadoPor": "Cargo sugerido del responsable de aprobar la ficha",
  "observaciones": "Observaciones adicionales relevantes para el SGC"
}`

  const promptEducativo = `Eres un consultor ISO 9001:2015 especializado en instituciones educativas y diseño curricular.

DATOS DE LA INSTITUCIÓN:
- Nombre: ${datosEmpresa.nombreEmpresa}
- Sector: ${datosEmpresa.sector ?? 'Educativo'}
- Tipo: ${datosEmpresa.tipoEmpresa ?? 'No especificado'}
- Tamaño: ${datosEmpresa.tamano ?? 'No especificado'}
- Servicios educativos: ${datosEmpresa.productosServicios ?? 'No especificado'}
- Mercado / Población: ${datosEmpresa.mercadoObjetivo ?? 'No especificado'}
- Política de Calidad: ${datosEmpresa.politicaCalidad ?? 'No definida'}
- Alcance SGC: ${datosEmpresa.alcanceSGC ?? 'No definido'}

FICHA A GENERAR:
- Institución/Cliente: ${cliente}
- Área o Asignatura: ${productoServicio}

Genera una ficha técnica educativa ISO 9001:2015 (§8.2) para esta área o asignatura.
La ficha debe incluir los grados/cursos que reciben esta asignatura con su contenido programático e intensidad horaria.
Infiere el nivel educativo (Primaria/Secundaria/Media) a partir del contexto de la institución.

Responde ÚNICAMENTE con JSON válido (sin backticks, sin markdown):
{
  "areaAsignatura": "Nombre formal del área o asignatura",
  "objetivoGeneral": "Objetivo general del área para toda la institución (2-3 oraciones)",
  "competencias": "Competencias a desarrollar: interpretativa, argumentativa, propositiva y otras específicas del área",
  "unidadesCurriculares": [
    {
      "nombre": "Nombre de la unidad temática o módulo",
      "nivelCurso": "Primaria|Secundaria|Media",
      "gradoAnio": "1° Primaria, 2° Primaria, ... 6° Primaria, 6° Secundaria, 10° Grado, 11° Grado, etc.",
      "intensidadHoraria": 4,
      "periodo": "Año lectivo 2025",
      "docente": "Docente del área",
      "contenidoProgramatico": "Tema 1: ...\\nTema 2: ...\\nTema 3: ...\\nTema 4: ...",
      "metodologia": "Metodología de enseñanza específica para este grado",
      "recursosMateriales": "Recursos físicos, digitales o de laboratorio necesarios",
      "criteriosEvaluacion": "Criterios de evaluación con porcentajes",
      "logros": "Logros esperados al finalizar el periodo para este grado"
    }
  ],
  "elaboradoPor": "Coordinador Académico",
  "aprobadoPor": "Rector / Director Académico",
  "observaciones": "Observaciones generales sobre el área en el contexto del SGC"
}

IMPORTANTE:
- Genera entre 3 y 6 cursos/grados apropiados para el nivel educativo de la institución
- Si la institución es de primaria, genera los 5-6 grados de primaria
- Si es de bachillerato/secundaria, genera los grados 6°-11°
- Si es mixta, incluye ambos niveles
- Adapta el contenido programático al grado: el de primaria debe ser más básico que el de secundaria
- La intensidadHoraria debe ser un número entero (horas por semana), típicamente 2-5h/semana según la asignatura
- El contenidoProgramatico debe ser específico y detallado para cada grado`

  const prompt = esEducativa ? promptEducativo : promptGeneral
  const MODELS = ['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.0-flash','gemini-flash-latest']

  for (const model of MODELS) {
    try {
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: esEducativa ? 4096 : 2048,
          responseMimeType: 'application/json',
        },
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
        console.error(`[FichaTecnica] ${model} respondió ${response.status}`)
        continue
      }

      const data     = await response.json()
      const rawText  = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!rawText) { console.error(`[FichaTecnica] ${model} devolvió vacío`); continue }

      // Limpiar y parsear
      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const start = cleaned.indexOf('{')
      const end   = cleaned.lastIndexOf('}')
      if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1)

      const parsed = JSON.parse(cleaned)

      if (esEducativa) {
        if (!parsed.areaAsignatura || !Array.isArray(parsed.unidadesCurriculares)) {
          console.error(`[FichaTecnica] ${model} JSON educativo incompleto`)
          continue
        }
        // Calcular totalHorasSemana
        const totalHoras = parsed.unidadesCurriculares.reduce(
          (acc: number, u: any) => acc + (Number(u.intensidadHoraria) || 0), 0
        )
        return res.json({ ...parsed, totalHorasSemana: totalHoras })
      } else {
        if (!parsed.descripcion) {
          console.error(`[FichaTecnica] ${model} JSON general incompleto`)
          continue
        }
        return res.json(parsed)
      }
    } catch (err) {
      console.error(`[FichaTecnica] Error ${model}:`, err)
    }
  }

  return res.status(500).json({ error: 'No se pudo generar la ficha técnica con ningún modelo disponible' })
})

export default router