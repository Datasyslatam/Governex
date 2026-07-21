import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { analyzeWithGemini, generateResourcesOnly, MapaData, DatosEmpresa, FilaMatrizCargos } from '../services/geminiService'
import { requirePermission } from '../middleware/rbac'

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
router.post('/analizar-organigrama', requirePermission('contexto_empresa', 'crear'), async (req: AuthRequest, res: Response) => {
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
      const tenantId = req.user!.tenantId
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // BUG CORREGIDO: los 4 DELETE/UPDATE de este bloque no filtraban por
        // tenant_id — un usuario de CUALQUIER tenant que corriera este
        // análisis borraba/sobreescribía el PESTEL, DOFA, indicadores y
        // política de calidad de TODOS los tenants de Governex.
        await client.query('DELETE FROM pestel WHERE tenant_id = $1', [tenantId])
        await client.query('DELETE FROM dofa WHERE tenant_id = $1', [tenantId])

        for (const row of analysis.pestel) {
          const factorChar = mapPestelFactor(row.factor)
          await client.query(
            `INSERT INTO pestel (factor, categoria, descripcion, impacto, oportunidad, tenant_id) VALUES ($1,$2,$3,$4,$5,$6)`,
            [factorChar, row.categoria, row.descripcion, row.impacto, row.oportunidad, tenantId]
          )
        }

        for (const row of analysis.dofa) {
          await client.query(`INSERT INTO dofa (tipo, descripcion, tenant_id) VALUES ($1,$2,$3)`, [row.tipo, row.descripcion, tenantId])
        }

        // tipos_proceso también es por-tenant desde la migración; se filtra
        // el catálogo para no mapear contra los tipos de otra empresa.
        const { rows: tipos } = await client.query('SELECT id, nombre FROM tipos_proceso WHERE tenant_id = $1', [tenantId])
        const tipoMap: Record<string, number> = {}
        for (const t of tipos) tipoMap[t.nombre.toLowerCase()] = t.id

        const procesoIdMap: Record<string, number> = {}

        for (const row of analysis.caracterizacion) {
          let tipo_id: number
          if      (row.codigo.startsWith('PE')) tipo_id = tipoMap['estratégico'] ?? tipoMap['estrategico'] ?? 1
          else if (row.codigo.startsWith('PO')) tipo_id = tipoMap['misional']    ?? tipoMap['operacional']  ?? 2
          else                                  tipo_id = tipoMap['apoyo']       ?? tipoMap['soporte']      ?? 3

          const procRes = await client.query(
            `INSERT INTO procesos (codigo, nombre, objetivo, entradas, salidas, indicador_kpi, responsable, tipo_id, estado, tenant_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             ON CONFLICT (tenant_id, codigo) DO UPDATE SET
               nombre=EXCLUDED.nombre, objetivo=EXCLUDED.objetivo, entradas=EXCLUDED.entradas,
               salidas=EXCLUDED.salidas, indicador_kpi=EXCLUDED.indicador_kpi,
               responsable=EXCLUDED.responsable, tipo_id=EXCLUDED.tipo_id, estado=EXCLUDED.estado
             RETURNING id`,
            [row.codigo, row.proceso, row.objetivo, row.entradas, row.salidas,
             row.indicador, row.responsable, tipo_id, row.estado ?? 'Activo', tenantId]
          )
          procesoIdMap[row.proceso.toLowerCase()] = procRes.rows[0].id
        }

        if (analysis.indicadores && analysis.indicadores.length > 0) {
          // Eliminar los indicadores anteriores de ESTE tenant antes de generar los nuevos
          await client.query('DELETE FROM indicador_mediciones WHERE tenant_id = $1', [tenantId]);
          await client.query('DELETE FROM indicadores WHERE tenant_id = $1', [tenantId]);

          for (const ind of analysis.indicadores) {
            const procId = procesoIdMap[(ind.proceso || '').toLowerCase()] || null
            const validFreqs = ['Diaria','Semanal','Mensual','Trimestral','Semestral','Anual']
            let freq = ind.frecuencia;
            if (!validFreqs.includes(freq)) {
              freq = 'Mensual'; // Fallback
            }

            await client.query(
              `INSERT INTO indicadores (codigo, titulo, proceso_id, frecuencia, meta, activo, tenant_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [ind.codigo, ind.titulo, procId, freq, ind.meta, true, tenantId]
            )
          }
        }

        // Auto-publicar Política de Calidad si está presente en datosEmpresa
        if (datosEmpresa && datosEmpresa.politicaCalidad) {
          await client.query(`UPDATE politica_calidad SET estado='Obsoleto' WHERE estado='Vigente' AND tenant_id=$1`, [tenantId]);
          await client.query(
            `INSERT INTO politica_calidad (version, contenido, estado, fecha_vigencia, aprobado_por, tenant_id)
             VALUES ($1, $2, $3, CURRENT_DATE, NULL, $4)`,
            ['v1.0', datosEmpresa.politicaCalidad, 'Vigente', tenantId]
          );
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
    return res.status(500).json({ error: err.message ?? 'Error al analizar con Governex IA' })
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
  "politicaCalidad": "Redacta una política de calidad larga, robusta y detallada (al menos 2 o 3 párrafos, 6-8 oraciones). Debe incluir explícitamente el compromiso con la satisfacción del cliente, el cumplimiento de requisitos legales y aplicables, la mejora continua del Sistema de Gestión de la Calidad, y debe proporcionar el marco de referencia para los objetivos de calidad. Hazla extensa y muy específica a la naturaleza de la organización."
}

Requisitos:
- Usa el nombre real de la empresa en los textos
- Sé específico al sector y tipo de empresa
- Tono formal y profesional
- Evita frases genéricas o clichés
- La política de calidad debe ser detallada, extensa y apta para publicarse oficialmente como la Política Institucional ISO 9001.
- IMPORTANTE: Estás generando un JSON estricto. NO USES saltos de línea reales (Enter) en los textos. Si necesitas separar párrafos, usa explícitamente el separador || (dos barras verticales). Todo el texto debe ser continuo.`

  const MODELS = ['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.0-flash','gemini-flash-latest']

  for (const model of MODELS) {
    try {
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
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
          mision:          parsed.mision.replace(/\|\|/g, '\n\n'),
          vision:          parsed.vision.replace(/\|\|/g, '\n\n'),
          politicaCalidad: parsed.politicaCalidad.replace(/\|\|/g, '\n\n'),
        })
      }

      console.error(`[Ideario] ${model} devolvió JSON incompleto/no parseable (finishReason: ${finishReason})`)
    } catch (err) {
      console.error(`[Ideario] Error ${model}:`, err)
    }
  }

  return res.status(500).json({ error: 'No se pudo generar el ideario con ningún modelo disponible' })
})

/* ── POST /api/gemini/generar-control-diseno ──────────────────
   Genera el control y verificación de diseño a partir de la
   actividad (Cláusula 8.3).                                     */
router.post('/generar-control-diseno', async (req: AuthRequest, res: Response) => {
  const { nombre, proceso, entradas, salidas } = req.body

  if (!nombre || !entradas || !salidas) {
    return res.status(400).json({ error: 'Se requiere nombre, entradas y salidas de la actividad.' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })

  const prompt = `Eres un consultor experto en ISO 9001:2015, especializado en la Cláusula 8.3 (Diseño y desarrollo de los productos y servicios).

Se ha identificado la siguiente actividad que requiere diseño/desarrollo:
- Actividad: ${nombre}
- Proceso asociado: ${proceso || 'No especificado'}
- Entradas del diseño: ${entradas}
- Salidas esperadas: ${salidas}

Genera los "Controles de Diseño" (verificación y validación) adecuados para asegurar que las salidas cumplan con los requisitos de entrada. 
El texto debe ser un solo párrafo técnico, concreto, accionable, y sin viñetas ni saltos de línea. (Ej: "Revisión de prototipos contra especificaciones iniciales, pruebas de estrés en laboratorio, y validación final con el cliente antes del lanzamiento.")

Responde ÚNICAMENTE con JSON válido:
{
  "control": "El texto del control aquí"
}`

  const MODELS = ['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.0-flash','gemini-flash-latest']

  for (const model of MODELS) {
    try {
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024, responseMimeType: 'application/json' },
      }
      if (model.startsWith('gemini-2.5')) body.generationConfig.thinkingConfig = { thinkingBudget: 0 }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body) }
      )
      if (!response.ok) { console.error(`[ControlDiseno] ${model} → ${response.status}`); continue }

      const data    = await response.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!rawText) continue

      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
      if (s !== -1 && e > s) cleaned = cleaned.slice(s, e + 1)

      const parsed = JSON.parse(cleaned)
      if (!parsed.control) continue

      return res.json({ control: parsed.control })
    } catch (err) {
      console.error(`[ControlDiseno] Error ${model}:`, err)
    }
  }

  return res.status(500).json({ error: 'No se pudo generar el control con ningún modelo' })
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

/* ── POST /api/gemini/generar-encuestas-satisfaccion ─────────────
   Genera DOS encuestas distintas (5.1.2 Enfoque al Cliente):
   - Clientes:    sobre el producto/servicio entregado
   - Proveedores: sobre la relación y cumplimiento contractual    */
router.post('/generar-encuestas-satisfaccion', async (req: AuthRequest, res: Response) => {
  const { datosEmpresa } = req.body as { datosEmpresa: DatosEmpresa }

  if (!datosEmpresa?.nombreEmpresa) {
    return res.status(400).json({ error: 'Se requieren los datos de la empresa (módulo 4.1)' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })

  const prompt = `Eres un consultor experto en ISO 9001:2015, cláusula 5.1.2 (Enfoque al cliente) y diseño de encuestas de satisfacción.

DATOS DE LA EMPRESA:
- Nombre: ${datosEmpresa.nombreEmpresa}
- Sector: ${datosEmpresa.sector ?? 'No especificado'}
- Tipo de empresa: ${datosEmpresa.tipoEmpresa ?? 'No especificado'}
- Productos / Servicios: ${datosEmpresa.productosServicios ?? 'No especificado'}
- Mercado objetivo / Clientes: ${datosEmpresa.mercadoObjetivo ?? 'No especificado'}
- Partes interesadas: ${datosEmpresa.parteInteresadas ?? 'No especificado'}
- Política de Calidad: ${datosEmpresa.politicaCalidad ?? 'No definida'}
- Alcance SGC: ${datosEmpresa.alcanceSGC ?? 'No definido'}

INSTRUCCIÓN:
Genera DOS encuestas de satisfacción DIFERENTES y específicas para esta empresa:

1. "clientes": Encuesta dirigida a CLIENTES, enfocada en el PRODUCTO Y/O SERVICIO recibido.
   Debe tener EXACTAMENTE estas 6 categorías, en este orden:
   - "Oportunidad" (tiempos de respuesta y entrega)
   - "Calidad" (del producto/servicio)
   - "Capacidad de Entrega" (cantidad, disponibilidad, cumplimiento de volumen solicitado)
   - "Cumplimiento" (de lo pactado/ofrecido)
   - "Precios" (percepción de precio-valor)
   - "Aspectos a Mejorar" (preguntas abiertas)

2. "proveedores": Encuesta dirigida a PROVEEDORES, enfocada en la RELACIÓN COMERCIAL y el
   CUMPLIMIENTO DE LA EMPRESA frente a su responsabilidad contractual con ellos (no sobre el
   producto que el proveedor entrega, sino sobre cómo la empresa cumple como cliente del proveedor:
   pagos, comunicación, condiciones pactadas, planificación de pedidos, trato).
   Debe tener EXACTAMENTE estas 6 categorías, en este orden:
   - "Relación Comercial"
   - "Cumplimiento Contractual" (pagos, plazos, condiciones pactadas)
   - "Comunicación y Coordinación"
   - "Planificación de Pedidos y Requerimientos"
   - "Trato y Profesionalismo"
   - "Aspectos a Mejorar" (preguntas abiertas)

Cada categoría debe tener entre 2 y 4 preguntas. Las preguntas de tipo "escala" se responden en escala
1-5 (deben tener una redacción que permita calificar, ej: "¿Cómo califica...?"). La categoría
"Aspectos a Mejorar" debe ser de tipo "abierta" exclusivamente.

Responde ÚNICAMENTE con JSON válido, sin backticks ni markdown, con esta estructura exacta:
{
  "clientes": {
    "titulo": "Encuesta de Satisfacción del Cliente — ${datosEmpresa.nombreEmpresa}",
    "introduccion": "1-2 oraciones explicando el propósito de la encuesta al cliente",
    "categorias": [
      { "categoria":"Oportunidad", "preguntas":[ { "id":"c1","texto":"...", "tipo":"escala" } ] }
    ]
  },
  "proveedores": {
    "titulo": "Encuesta de Evaluación de Relación Comercial — ${datosEmpresa.nombreEmpresa}",
    "introduccion": "1-2 oraciones explicando el propósito de la encuesta al proveedor",
    "categorias": [
      { "categoria":"Relación Comercial", "preguntas":[ { "id":"p1","texto":"...", "tipo":"escala" } ] }
    ]
  }
}

REGLAS:
- Los "id" de preguntas deben ser únicos dentro de cada encuesta (c1, c2... para clientes; p1, p2... para proveedores).
- Las preguntas deben ser específicas al sector/productos/servicios de la empresa, no genéricas.
- JSON completo y válido, sin truncar.`

  const MODELS = ['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.0-flash','gemini-flash-latest']

  for (const model of MODELS) {
    try {
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096, responseMimeType: 'application/json' },
      }
      if (model.startsWith('gemini-2.5')) body.generationConfig.thinkingConfig = { thinkingBudget: 0 }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body) }
      )
      if (!response.ok) { console.error(`[Encuestas] ${model} → ${response.status}`); continue }

      const data    = await response.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!rawText) continue

      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
      if (s !== -1 && e > s) cleaned = cleaned.slice(s, e + 1)

      const parsed = JSON.parse(cleaned)
      if (!parsed.clientes?.categorias?.length || !parsed.proveedores?.categorias?.length) {
        console.warn(`[Encuestas] ${model} JSON incompleto, reintentando con siguiente modelo...`)
        continue
      }

      return res.json({ clientes: parsed.clientes, proveedores: parsed.proveedores })
    } catch (err) {
      console.error(`[Encuestas] Error ${model}:`, err)
    }
  }

  return res.status(500).json({ error: 'No se pudieron generar las encuestas con ningún modelo disponible' })
})

/* ── POST /api/gemini/analizar-encuestas-cliente ──────────────────
   Analiza las respuestas agregadas de las encuestas (clientes y/o
   proveedores) junto con los registros de PQRS, y genera un DOFA
   específico basado en evidencia real (§5.1.2, §9.1.2, §6.1).      */
router.post('/analizar-encuestas-cliente', async (req: AuthRequest, res: Response) => {
  const { datosEmpresa, resumenClientes, resumenProveedores, pqrs, documentos } = req.body as {
    datosEmpresa?: DatosEmpresa
    resumenClientes?: any
    resumenProveedores?: any
    pqrs?: { tipo: string; descripcion: string; estado: string }[]
    documentos?: string[]
  }

  const sinDatos =
    (!resumenClientes || resumenClientes.totalEncuestas === 0) &&
    (!resumenProveedores || resumenProveedores.totalEncuestas === 0) &&
    (!pqrs || pqrs.length === 0)

  if (sinDatos) {
    return res.status(400).json({ error: 'No hay encuestas respondidas ni PQRS registradas para analizar' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })

  const prompt = `Eres un consultor ISO 9001:2015 experto en análisis de la voz del cliente y análisis DOFA (cláusulas 5.1.2, 9.1.2 y 6.1).

EMPRESA: ${datosEmpresa?.nombreEmpresa ?? 'No especificada'} — Sector: ${datosEmpresa?.sector ?? 'No especificado'}

DOCUMENTOS Y FUENTES DE INFORMACIÓN SUMINISTRADAS (Archivos de encuestas subidos y PQRS registradas):
${documentos && documentos.length ? documentos.map(d => `- ${d}`).join('\n') : 'Ninguno especificado'}

RESULTADOS DE ENCUESTAS A CLIENTES (sobre el producto/servicio entregado):
${resumenClientes ? JSON.stringify(resumenClientes, null, 2) : 'Sin datos disponibles'}

RESULTADOS DE ENCUESTAS A PROVEEDORES (sobre la relación comercial y cumplimiento contractual de la empresa hacia ellos):
${resumenProveedores ? JSON.stringify(resumenProveedores, null, 2) : 'Sin datos disponibles'}

PQRS REGISTRADAS POR LA ORGANIZACIÓN:
${pqrs && pqrs.length ? JSON.stringify(pqrs, null, 2) : 'Sin registros'}

INSTRUCCIÓN:
Analiza TODA esta información (promedios por categoría, respuestas abiertas y PQRS) y genera un análisis DOFA específico, basado ÚNICAMENTE en la evidencia entregada (no genérico ni inventado). En tu "resumenEjecutivo", menciona de forma explícita qué documentos/fuentes de información de la lista anterior tuviste disponibles y procesaste para este análisis (menciónalos con sus nombres de archivo y/o fuentes reales).

Responde ÚNICAMENTE con JSON válido, sin backticks ni markdown:
{
  "resumenEjecutivo": "200-300 palabras resumiendo los hallazgos principales de las encuestas y PQRS, mencionando de forma explícita qué fuentes de información (archivos y registros PQRS) tuviste disponibles y procesaste",
  "dofa": [
    { "tipo":"Fortaleza",   "descripcion":"basada en evidencia concreta, ej: alta calificación promedio en X categoría" },
    { "tipo":"Oportunidad", "descripcion":"..." },
    { "tipo":"Debilidad",   "descripcion":"basada en baja calificación o quejas/PQRS recurrentes" },
    { "tipo":"Amenaza",     "descripcion":"..." }
  ]
}

REGLAS:
- Genera entre 3 y 6 elementos por cada tipo (Fortaleza, Oportunidad, Debilidad, Amenaza), priorizando los más respaldados por los datos.
- Si falta información de alguna fuente (ej. no hay encuestas a proveedores), básate en lo disponible y acláralo en el resumen ejecutivo.
- Sé específico: cita categorías, calificaciones promedio o quejas concretas cuando sea posible.
- JSON completo y válido, sin truncar.`

  const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-flash-latest']

  for (const model of MODELS) {
    try {
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 3000, responseMimeType: 'application/json' },
      }
      if (model.startsWith('gemini-2.5')) body.generationConfig.thinkingConfig = { thinkingBudget: 0 }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body) }
      )
      if (!response.ok) { console.error(`[AnalisisEncuestas] ${model} → ${response.status}`); continue }

      const data    = await response.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!rawText) continue

      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
      if (s !== -1 && e > s) cleaned = cleaned.slice(s, e + 1)

      const parsed = JSON.parse(cleaned)
      if (!Array.isArray(parsed.dofa) || parsed.dofa.length === 0) continue

      return res.json({ resumenEjecutivo: parsed.resumenEjecutivo ?? '', dofa: parsed.dofa })
    } catch (err) {
      console.error(`[AnalisisEncuestas] Error ${model}:`, err)
    }
  }

  return res.status(500).json({ error: 'No se pudo generar el análisis con ningún modelo disponible' })
})

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
Genera la MATRIZ DE REVISIÓN DE REQUISITOS (ISO 9001:2015 §8.2) Y LA FICHA TÉCNICA DETALLADA PARA CADA UNO.
Crea UNA FILA por cada producto o servicio principal identificado en el contexto (mínimo 3, máximo 8).
${esEducativa ? 'Para instituciones educativas, cada área o asignatura principal es un "producto/servicio".' : ''}

Para CADA fila, debes proveer dos bloques de datos:
1. Datos de la revisión: Cliente, requisitos, estado, etc.
2. Ficha Técnica completa correspondiente a ese producto/servicio.

Responde ÚNICAMENTE con JSON válido, sin backticks ni markdown, con esta estructura exacta:
{
  "revisiones": [
    {
      "cliente": "Nombre del cliente o segmento",
      "productoServicio": "Nombre exacto del producto o servicio",
      "requisitosCliente": "Requisitos específicos que el cliente espera",
      "requisitosLegales": "Normas legales, reglamentarias o técnicas aplicables",
      "requisitosOrg": "Requisitos internos: plazos, estándares de calidad",
      "revisadoPor": "Cargo del responsable",
      "fechaRevision": "2025-MM-DD",
      "estado": "Pendiente | Aprobado",
      "fichaTecnica": {
        ${esEducativa ? `
        "elaboradoPor": "Cargo (ej. Coordinador Académico)",
        "aprobadoPor": "Cargo (ej. Rector)",
        "areaAsignatura": "Nombre del área/asignatura",
        "objetivoGeneral": "Objetivo general de formación",
        "competencias": "Competencias a desarrollar",
        "observaciones": "Comentarios adicionales",
        "unidadesCurriculares": [
          {
            "gradoAnio": "Ej. 6to Grado",
            "nivelCurso": "Primaria | Secundaria | Pregrado | Posgrado | Otro",
            "periodo": "Ej. Primer Semestre",
            "nombre": "Nombre de la unidad",
            "intensidadHoraria": "Número (ej. 4)",
            "docente": "Perfil sugerido del docente",
            "contenidoProgramatico": "Temas principales",
            "metodologia": "Metodología sugerida",
            "criteriosEvaluacion": "Forma de evaluación",
            "logros": "Logros esperados"
          }
        ]
        ` : `
        "elaboradoPor": "Cargo (ej. Jefe de Producción)",
        "aprobadoPor": "Cargo (ej. Gerente General)",
        "descripcion": "Descripción detallada del producto/servicio",
        "especificacionesTecnicas": "Especificaciones técnicas detalladas (materiales, dimensiones, características técnicas)",
        "normasAplicables": "Normas técnicas, ISO, reglamentos (INVIMA, ICA, RETIE, etc.)",
        "condicionesUso": "Instrucciones de uso, almacenamiento, garantías, vida útil",
        "observaciones": "Comentarios adicionales"
        `}
      }
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
          maxOutputTokens: 8192,
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
  let rateLimitHit = false

  for (let attempt = 1; attempt <= 3; attempt++) {
    rateLimitHit = false
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
          if (response.status === 429) rateLimitHit = true
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
    
    if (rateLimitHit && attempt < 3) {
      console.log(`[FichaTecnica] 429 Límite alcanzado, esperando 15s antes del reintento ${attempt}/3...`)
      await new Promise(r => setTimeout(r, 15000))
    } else if (!rateLimitHit) {
      break
    }
  }

  if (rateLimitHit) {
    return res.status(429).json({ error: 'Has alcanzado el límite de uso gratuito de la IA. Por favor, espera un minuto antes de volver a intentarlo.' })
  }
  return res.status(500).json({ error: 'No se pudo generar la ficha técnica con ningún modelo disponible' })
})

/* ── POST /api/gemini/analizar-rev-direccion ──────────────────────
   Consolida todos los insumos del SGC y genera las salidas de la
   Revisión por la Dirección según ISO 9001:2015 §9.3.3            */
router.post('/analizar-rev-direccion', async (req: AuthRequest, res: Response) => {
  const {
    riesgos, indicadores, noConformidades, accionesCorrectivas,
    auditorias, hallazgos, proveedores, objetivosCalidad,
    pestel, dofa, matrizRecursos, contextoNarrativo, datosEmpresa,
  } = req.body

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })

  const prompt = `Eres un consultor experto en ISO 9001:2015, especialista en la cláusula 9.3 (Revisión por la Dirección).
Analiza los siguientes datos reales del Sistema de Gestión de Calidad y genera las SALIDAS de la revisión según §9.3.3.

EMPRESA: ${datosEmpresa?.nombreEmpresa ?? 'No especificada'} — Sector: ${datosEmpresa?.sector ?? 'No especificado'}

CONTEXTO EXTERNO E INTERNO (§4.1):
- Factores PESTEL: ${JSON.stringify(pestel ?? [])}
- Análisis DOFA: ${JSON.stringify(dofa ?? [])}
- Matriz de Recursos: ${JSON.stringify(matrizRecursos ?? [])}
- Contexto narrativo: ${contextoNarrativo ?? 'No disponible'}

RIESGOS Y OPORTUNIDADES (§6.1):
${JSON.stringify(riesgos ?? [])}

OBJETIVOS DE CALIDAD (§6.2):
${JSON.stringify(objetivosCalidad ?? [])}

INDICADORES DE DESEMPEÑO (§9.1):
${JSON.stringify(indicadores ?? [])}

NO CONFORMIDADES (§10.2):
${JSON.stringify(noConformidades ?? [])}

ACCIONES CORRECTIVAS (§10.2):
${JSON.stringify(accionesCorrectivas ?? [])}

AUDITORÍAS INTERNAS (§9.2):
${JSON.stringify(auditorias ?? [])}

HALLAZGOS DE AUDITORÍA:
${JSON.stringify(hallazgos ?? [])}

PROVEEDORES EXTERNOS (§8.4):
${JSON.stringify(proveedores ?? [])}

INSTRUCCIÓN:
Con base en TODA la información anterior, genera las tres salidas obligatorias de §9.3.3 de forma específica y basada en evidencia real.
No inventes datos: si un campo está vacío, indícalo en la justificación.

Responde ÚNICAMENTE con JSON válido, sin backticks ni markdown:
{
  "resumenEjecutivo": "200-300 palabras resumiendo el estado general del SGC, los hallazgos más críticos y la tendencia de desempeño",
  "oportunidadesMejora": [
    {
      "titulo": "Título corto de la oportunidad",
      "justificacion": "Justificación basada en los datos entregados (qué dato específico la sustenta)",
      "prioridad": "Alta | Media | Baja",
      "requisitoFuente": "§X.X ISO 9001:2015"
    }
  ],
  "necesidadesCambioSGC": [
    {
      "titulo": "Cambio necesario en el SGC",
      "justificacion": "Justificación basada en evidencia",
      "prioridad": "Alta | Media | Baja",
      "requisitoFuente": "§X.X ISO 9001:2015"
    }
  ],
  "necesidadesRecursos": [
    {
      "titulo": "Recurso necesario (humano, tecnológico, infraestructura, etc.)",
      "justificacion": "Justificación basada en evidencia",
      "prioridad": "Alta | Media | Baja",
      "requisitoFuente": "§X.X ISO 9001:2015"
    }
  ],
  "conclusionGeneral": "2-3 oraciones con la conclusión estratégica y el enfoque de la próxima revisión"
}

REGLAS:
- Genera entre 3 y 6 items por cada sección.
- Prioridad "Alta" solo para hallazgos críticos con evidencia directa.
- Sé específico: menciona datos concretos (porcentajes, cantidades, nombres de indicadores).
- JSON completo y válido, sin truncar.`

  const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-flash-latest']

  for (const model of MODELS) {
    try {
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }
      if (model.startsWith('gemini-2.5')) body.generationConfig.thinkingConfig = { thinkingBudget: 0 }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body:    JSON.stringify(body),
        }
      )
      if (!response.ok) { console.error(`[RevDireccion] ${model} → ${response.status}`); continue }

      const data    = await response.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!rawText) { console.error(`[RevDireccion] ${model} devolvió texto vacío`); continue }

      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
      if (s !== -1 && e > s) cleaned = cleaned.slice(s, e + 1)

      const parsed = JSON.parse(cleaned)

      if (
        !Array.isArray(parsed.oportunidadesMejora)    || !parsed.oportunidadesMejora.length ||
        !Array.isArray(parsed.necesidadesCambioSGC)   || !parsed.necesidadesCambioSGC.length ||
        !Array.isArray(parsed.necesidadesRecursos)    || !parsed.necesidadesRecursos.length
      ) {
        console.warn(`[RevDireccion] ${model} JSON incompleto, probando siguiente modelo...`)
        continue
      }

      return res.json({
        resumenEjecutivo:      parsed.resumenEjecutivo      ?? '',
        oportunidadesMejora:   parsed.oportunidadesMejora,
        necesidadesCambioSGC:  parsed.necesidadesCambioSGC,
        necesidadesRecursos:   parsed.necesidadesRecursos,
        conclusionGeneral:     parsed.conclusionGeneral     ?? '',
      })
    } catch (err) {
      console.error(`[RevDireccion] Error ${model}:`, err)
    }
  }

  return res.status(500).json({ error: 'No se pudo generar el análisis con ningún modelo disponible' })
})

/* ── POST /api/gemini/generar-objetivo-indicador ─────────────────
   Genera Objetivo e Indicador de una actividad empresarial (§4.1/§8.1)
   Sustituye la llamada directa a Anthropic que hacía ActividadModal.tsx  */
router.post('/generar-objetivo-indicador', async (req: AuthRequest, res: Response) => {
  const { nombre, proceso, responsable, entradas, salidas } = req.body as {
    nombre:      string
    proceso?:    string
    responsable: string
    entradas:    string[]
    salidas:     string[]
  }

  if (!nombre?.trim())      return res.status(400).json({ error: 'Se requiere el nombre de la actividad' })
  if (!responsable?.trim()) return res.status(400).json({ error: 'Se requiere el responsable' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })

  const prompt = `Eres un experto en ISO 9001:2015. Dado el siguiente registro de actividad empresarial, genera:
1. Un OBJETIVO claro y medible para la actividad (máximo 2 oraciones).
2. Un INDICADOR de desempeño concreto con fórmula o criterio de medición (máximo 1 oración).

Actividad: "${nombre}"
Proceso asociado: "${proceso || 'No especificado'}"
Responsable: "${responsable}"
Entradas: ${entradas.length > 0 ? entradas.map(e => `"${e}"`).join(', ') : 'No especificadas'}
Salidas:  ${salidas.length  > 0 ? salidas.map(s  => `"${s}"`).join(', ') : 'No especificadas'}

Responde ÚNICAMENTE con JSON válido, sin backticks ni markdown:
{"objetivo":"...","indicador":"..."}`

  const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-flash-latest']

  for (const model of MODELS) {
    try {
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:      0.35,
          maxOutputTokens:  512,
          responseMimeType: 'application/json',
        },
      }
      if (model.startsWith('gemini-2.5')) body.generationConfig.thinkingConfig = { thinkingBudget: 0 }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body:    JSON.stringify(body),
        }
      )
      if (!response.ok) { console.error(`[ObjetivoIndicador] ${model} → ${response.status}`); continue }

      const data    = await response.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!rawText) { console.error(`[ObjetivoIndicador] ${model} devolvió texto vacío`); continue }

      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
      if (s !== -1 && e > s) cleaned = cleaned.slice(s, e + 1)

      const parsed = JSON.parse(cleaned)
      if (!parsed.objetivo || !parsed.indicador) {
        console.warn(`[ObjetivoIndicador] ${model} JSON incompleto`)
        continue
      }

      return res.json({ objetivo: parsed.objetivo, indicador: parsed.indicador })
    } catch (err) {
      console.error(`[ObjetivoIndicador] Error ${model}:`, err)
    }
  }

  return res.status(500).json({ error: 'No se pudo generar el objetivo e indicador con ningún modelo disponible' })
})

/* ── POST /api/gemini/generar-evaluacion-proveedor ─────────────────
   Genera evaluación de proveedor basada en 3 variables críticas
   (adaptado a 4: calidad, entrega, precio, servicio) comparando
   precios y resultados obtenidos anteriormente. */
router.post('/generar-evaluacion-proveedor', async (req: AuthRequest, res: Response) => {
  const { proveedor, tipoSuministro, historial, precioMercado, precioProveedor, puntajesPrevios } = req.body

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })

  const prompt = `Eres un auditor experto en cadena de suministro y en ISO 9001:2015.
Necesito que evalúes al siguiente proveedor basándote en la información histórica, los precios del mercado y en una puntuación preliminar ingresada por el evaluador interno.

PROVEEDOR: ${proveedor}
TIPO DE SUMINISTRO: ${tipoSuministro || 'No especificado'}
PRECIO DEL MERCADO: ${precioMercado ? '$' + precioMercado : 'No especificado'}
PRECIO DEL PROVEEDOR: ${precioProveedor ? '$' + precioProveedor : 'No especificado'}
PUNTUACIÓN PRELIMINAR DEL EVALUADOR: ${puntajesPrevios ? JSON.stringify(puntajesPrevios) : 'No especificada'}
HISTORIAL DE EVALUACIONES ANTERIORES: ${historial && historial.length > 0 ? JSON.stringify(historial) : 'Sin historial'}

INSTRUCCIÓN:
Con base en esta información, realiza una evaluación final del proveedor asignando una puntuación de 0 a 100 para las siguientes 4 variables. Debes tomar en cuenta fuertemente la "PUNTUACIÓN PRELIMINAR DEL EVALUADOR" como base y ajustarla:
1. Calidad
2. Entrega
3. Precio (Penaliza la puntuación de Precio del evaluador si el precio del proveedor es mucho mayor al del mercado, o benefíciala si es competitivo).
4. Servicio

Genera también una lista de "debilidades a corregir" (plan de acción para el proveedor) justificando los puntajes finales (por ejemplo, si el evaluador le puso baja calidad, menciónalo).

Responde ÚNICAMENTE con JSON válido, sin markdown ni backticks:
{
  "calidad": 90,
  "entrega": 85,
  "precio": 80,
  "servicio": 90,
  "debilidades": "Texto detallado con las debilidades y el plan de acción sugerido para el proveedor. Usa un tono formal corporativo."
}`

  const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-flash-latest']

  for (const model of MODELS) {
    try {
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }
      if (model.startsWith('gemini-2.5')) body.generationConfig.thinkingConfig = { thinkingBudget: 0 }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body:    JSON.stringify(body),
        }
      )
      if (!response.ok) { console.error(`[EvalProveedor] ${model} → ${response.status}`); continue }

      const data    = await response.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!rawText) continue

      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
      if (s !== -1 && e > s) cleaned = cleaned.slice(s, e + 1)

      const parsed = JSON.parse(cleaned)
      if (typeof parsed.calidad !== 'number') continue

      return res.json(parsed)
    } catch (err) {
      console.error(`[EvalProveedor] Error ${model}:`, err)
    }
  }

  return res.status(500).json({ error: 'No se pudo generar la evaluación con la IA' })
})
/* ── POST /api/gemini/generar-matriz-legal-ps ──────────────────────
   Genera la matriz legal, normas y permisos para RF-018. */
router.post('/generar-matriz-legal-ps', async (req: AuthRequest, res: Response) => {
  const { datosEmpresa, productoServicio, fileUrl } = req.body

  if (!datosEmpresa?.nombreEmpresa || !productoServicio) {
    return res.status(400).json({ error: 'Se requieren los datos de la empresa y el producto/servicio' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })

  let extraContext = ''
  let inlineData: any = null

  if (fileUrl) {
    try {
      const fRes = await fetch(fileUrl)
      if (fRes.ok) {
        const buffer = await fRes.arrayBuffer()
        if (fileUrl.toLowerCase().endsWith('.docx')) {
          const mammoth = require('mammoth')
          const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
          extraContext = `\n\nCONTENIDO DEL DOCUMENTO ADJUNTO (CONTRATO/ORDEN):\n${result.value}`
        } else if (fileUrl.toLowerCase().endsWith('.pdf')) {
          inlineData = {
            mimeType: 'application/pdf',
            data: Buffer.from(buffer).toString('base64')
          }
        } else {
          extraContext = `\n\n(El usuario adjuntó un archivo pero no es PDF ni DOCX, es: ${fileUrl})`
        }
      }
    } catch (e) {
      console.error('[MatrizLegal] Error al procesar archivo:', e)
    }
  }

  const prompt = `Eres un consultor experto en ISO 9001:2015, cumplimiento legal y regulatorio comercial en Colombia.

DATOS DE LA EMPRESA:
- Nombre: ${datosEmpresa.nombreEmpresa}
- Sector: ${datosEmpresa.sector ?? 'No especificado'}
- Tipo: ${datosEmpresa.tipoEmpresa ?? 'No especificado'}

PRODUCTO / SERVICIO A EVALUAR:
- ${productoServicio}
${extraContext}

INSTRUCCIÓN:
Genera la "Matriz Legal y Regulatoria" requerida para controlar la venta de este producto o servicio. Identifica la legislación colombiana, los permisos/licencias necesarias, normas técnicas (ej. NTC, ISO), y los registros regulatorios exigidos (ej. INVIMA, ICA, RETIE, etc.) específicos para este producto. Si hay un documento adjunto, úsalo para ser más preciso.

Responde ÚNICAMENTE con JSON válido, sin backticks ni markdown:
{
  "matrizLegal": "Texto detallado (2-3 párrafos) mencionando las leyes, normas, resoluciones y permisos exactos requeridos para comercializar este producto en Colombia."
}`

  const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-pro']
  let rateLimitHit = false

  for (let attempt = 1; attempt <= 3; attempt++) {
    rateLimitHit = false
    for (const model of MODELS) {
      try {
        const parts: any[] = [{ text: prompt }]
        if (inlineData) parts.push({ inlineData })

        const body: any = {
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.3,
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
          console.error(`[MatrizLegal] ${model} → ${response.status}`)
          if (response.status === 429) rateLimitHit = true
          continue 
        }

        const data    = await response.json()
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        if (!rawText) continue

        let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
        const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
        if (s !== -1 && e > s) cleaned = cleaned.slice(s, e + 1)

        const parsed = JSON.parse(cleaned)
        if (!parsed.matrizLegal) continue

        return res.json({ matrizLegal: parsed.matrizLegal })
      } catch (err) {
        console.error(`[MatrizLegal] Error ${model}:`, err)
      }
    }
    
    if (rateLimitHit && attempt < 3) {
      console.log(`[MatrizLegal] 429 Límite alcanzado, esperando 15s antes del reintento ${attempt}/3...`)
      await new Promise(r => setTimeout(r, 15000))
    } else if (!rateLimitHit) {
      break
    }
  }

  if (rateLimitHit) {
    return res.status(429).json({ error: 'Has alcanzado el límite de uso gratuito de la IA. Por favor, espera un minuto antes de volver a intentarlo.' })
  }
  return res.status(500).json({ error: 'No se pudo generar la matriz legal con la IA' })
})

// POST /api/gemini/extraer-cotizacion-ps
router.post('/extraer-cotizacion-ps', async (req: AuthRequest, res: Response) => {
  const { datosEmpresa, productoServicio, fileUrl } = req.body
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Falta GEMINI_API_KEY' })

  try {
    let inlineData = null
    if (fileUrl) {
      try {
        const fileRes = await fetch(fileUrl)
        if (fileRes.ok) {
          const buffer = await fileRes.arrayBuffer()
          const mimeType = fileRes.headers.get('content-type') || 'application/pdf'
          inlineData = { data: Buffer.from(buffer).toString('base64'), mimeType }
        }
      } catch (err) {
        console.error('Error fetching file for cotizacion extraction:', err)
      }
    }

    const prompt = `Eres un asistente de inteligencia artificial para un sistema de gestión ISO 9001:2015.
    
EMPRESA: ${datosEmpresa?.nombreEmpresa || 'No especificada'}
PRODUCTO/SERVICIO: ${productoServicio}

INSTRUCCIÓN:
Extrae la información relevante de la oferta comercial o cotización adjunta. Identifica el número de cotización (si lo hay), las especificaciones solicitadas, las cantidades, los precios y cualquier otra condición comercial importante para el control de la venta.
Escribe un resumen conciso y directo para llenar un campo de texto que solicita: "Nº de cotización, especificaciones solicitadas, cantidades, precios...".

Responde ÚNICAMENTE con JSON válido, sin backticks ni markdown:
{
  "cotizacion": "Texto extraído y resumido (1-2 párrafos)."
}`

    const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-pro']
    let rateLimitHit = false

    for (let attempt = 1; attempt <= 3; attempt++) {
      rateLimitHit = false
      for (const model of MODELS) {
        try {
          const parts: any[] = [{ text: prompt }]
          if (inlineData) parts.push({ inlineData })

          const body: any = {
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.3,
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
            if (response.status === 429) rateLimitHit = true
            continue 
          }

          const data    = await response.json()
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
          if (!rawText) continue

          let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
          const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
          if (s !== -1 && e > s) cleaned = cleaned.slice(s, e + 1)

          const parsed = JSON.parse(cleaned)
          if (!parsed.cotizacion) continue

          return res.json({ cotizacion: parsed.cotizacion })
        } catch (err) {
          console.error(`[ExtraerCotizacion] Error ${model}:`, err)
        }
      }
      
      if (rateLimitHit && attempt < 3) {
        await new Promise(r => setTimeout(r, 15000))
      } else if (!rateLimitHit) {
        break
      }
    }

    if (rateLimitHit) {
      return res.status(429).json({ error: 'Has alcanzado el límite de uso gratuito de la IA.' })
    }

    return res.status(500).json({ error: 'No se pudo generar la extracción.' })
  } catch (error: any) {
    console.error('Error en extraer-cotizacion-ps:', error)
    return res.status(500).json({ error: 'Ocurrió un error al procesar la cotización.' })
  }
})

export default router