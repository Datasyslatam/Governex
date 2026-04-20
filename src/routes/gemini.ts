/**
 * gemini.ts
 * Ruta: src/routes/gemini.ts
 *
 * POST /api/gemini/analizar-organigrama
 * Recibe el mapa de procesos y devuelve PESTEL, DOFA y Caracterización
 * generados por Gemini, y los persiste en la BD.
 */

import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { analyzeWithGemini, MapaData } from '../services/geminiService'

const router = Router()
router.use(authMiddleware)

/**
 * POST /api/gemini/analizar-organigrama
 * Body: { mapa: MapaData, nombreEmpresa?: string, sector?: string, guardarEnBD?: boolean }
 *
 * Responde con { pestel, dofa, caracterizacion }
 * Si guardarEnBD === true, limpia las tablas y persiste los resultados.
 */
router.post('/analizar-organigrama', async (req: AuthRequest, res: Response) => {
  const { mapa, nombreEmpresa, sector, guardarEnBD = true } = req.body as {
    mapa: MapaData
    nombreEmpresa?: string
    sector?: string
    guardarEnBD?: boolean
  }

  // Validación mínima
  if (
    !mapa ||
    !Array.isArray(mapa.estrategicos) ||
    !Array.isArray(mapa.misionales) ||
    !Array.isArray(mapa.apoyo)
  ) {
    return res.status(400).json({ error: 'El cuerpo debe contener un objeto mapa con estrategicos, misionales y apoyo' })
  }

  const mapaConInfo: MapaData = { ...mapa, nombreEmpresa, sector }

  try {
    const analysis = await analyzeWithGemini(mapaConInfo)

    // ── Persistir en BD si se solicita ─────────────────────────
    if (guardarEnBD) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Limpiar registros anteriores generados por IA
        await client.query('DELETE FROM pestel')
        await client.query('DELETE FROM dofa')

        // Insertar PESTEL
        for (const row of analysis.pestel) {
          await client.query(
            `INSERT INTO pestel (factor, categoria, descripcion, impacto, oportunidad)
             VALUES ($1, $2, $3, $4, $5)`,
            [row.factor, row.categoria, row.descripcion, row.impacto, row.oportunidad]
          )
        }

        // Insertar DOFA
        for (const row of analysis.dofa) {
          await client.query(
            `INSERT INTO dofa (tipo, descripcion) VALUES ($1, $2)`,
            [row.tipo, row.descripcion]
          )
        }

        // Insertar/actualizar Caracterización de Procesos
        // Obtener tipos_proceso para mapear códigos
        const { rows: tipos } = await client.query('SELECT id, nombre FROM tipos_proceso')
        const tipoMap: Record<string, number> = {}
        for (const t of tipos) {
          tipoMap[t.nombre.toLowerCase()] = t.id
        }

        for (const row of analysis.caracterizacion) {
          // Determinar tipo_id por prefijo de código
          let tipo_id: number
          if (row.codigo.startsWith('PE')) {
            tipo_id = tipoMap['estratégico'] ?? tipoMap['estrategico'] ?? 1
          } else if (row.codigo.startsWith('PO')) {
            tipo_id = tipoMap['misional'] ?? tipoMap['operacional'] ?? 2
          } else {
            tipo_id = tipoMap['apoyo'] ?? tipoMap['soporte'] ?? 3
          }

          // Upsert por código
          await client.query(
            `INSERT INTO procesos (codigo, nombre, objetivo, entradas, salidas, indicador_kpi, responsable, tipo_id, estado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (codigo) DO UPDATE SET
               nombre       = EXCLUDED.nombre,
               objetivo     = EXCLUDED.objetivo,
               entradas     = EXCLUDED.entradas,
               salidas      = EXCLUDED.salidas,
               indicador_kpi = EXCLUDED.indicador_kpi,
               responsable  = EXCLUDED.responsable,
               tipo_id      = EXCLUDED.tipo_id,
               estado       = EXCLUDED.estado`,
            [
              row.codigo, row.proceso, row.objetivo, row.entradas,
              row.salidas, row.indicador, row.responsable, tipo_id, row.estado ?? 'Activo',
            ]
          )
        }

        await client.query('COMMIT')
      } catch (dbErr) {
        await client.query('ROLLBACK')
        console.error('Error al persistir análisis Gemini en BD:', dbErr)
        // Devolvemos el análisis igual aunque falle la BD
      } finally {
        client.release()
      }
    }

    return res.json(analysis)
  } catch (err: any) {
    console.error('Error en /api/gemini/analizar-organigrama:', err)
    return res.status(500).json({ error: err.message ?? 'Error al analizar con Gemini' })
  }
})


/**
 * POST /api/gemini/extraer-procesos-imagen
 * Recibe una imagen en base64, la envía a Gemini Vision y extrae
 * los procesos organizacionales para construir el MapaData.
 */
router.post('/extraer-procesos-imagen', async (req: AuthRequest, res: Response) => {
  const { base64, mimeType, fileName } = req.body as {
    base64:   string
    mimeType: string
    fileName: string
  }

  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'Se requiere base64 y mimeType' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })
  }

  const prompt = `Analiza este organigrama o documento organizacional.
Identifica todos los procesos, áreas, departamentos o roles visibles.
Clasifícalos en:
- estrategicos: Gerencia, Dirección, Calidad, Estrategia, Planificación, Mejora Continua
- misionales: Producción, Operaciones, Ventas, Comercial, Servicio al Cliente, Proyectos, Diseño
- apoyo: RRHH, Talento Humano, Finanzas, Contabilidad, TI, Tecnología, Compras, Logística, Legal, Mantenimiento

Responde ÚNICAMENTE con JSON válido sin ningún texto adicional:
{
  "cliente": "Requisitos del Cliente y Contexto",
  "satisfaccion": "Satisfacción del Cliente",
  "estrategicos": [{ "nombre": "..." }],
  "misionales":   [{ "nombre": "..." }],
  "apoyo":        [{ "nombre": "..." }]
}

Si no puedes leer claramente el organigrama, devuelve procesos base razonables para una empresa genérica.`

  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: prompt }
      ]
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    }
  }

  const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']

  for (const model of MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body)
        }
      )
      if (!response.ok) continue
      const data = await response.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(cleaned)
      if (parsed.estrategicos || parsed.misionales || parsed.apoyo) {
        return res.json({
          cliente:      parsed.cliente      || 'Requisitos del Cliente y Contexto',
          satisfaccion: parsed.satisfaccion || 'Satisfacción del Cliente',
          estrategicos: Array.isArray(parsed.estrategicos) ? parsed.estrategicos : [],
          misionales:   Array.isArray(parsed.misionales)   ? parsed.misionales   : [],
          apoyo:        Array.isArray(parsed.apoyo)         ? parsed.apoyo        : [],
        })
      }
    } catch (err) {
      console.error(`[Vision] Error con ${model}:`, err)
    }
  }

  // Fallback si todos los modelos fallan
  return res.json({
    cliente:      'Requisitos del Cliente y Contexto',
    satisfaccion: 'Satisfacción del Cliente',
    estrategicos: [{ nombre: 'Gerencia General' }, { nombre: 'Gestión de Calidad' }, { nombre: 'Planeación Estratégica' }],
    misionales:   [{ nombre: 'Producción / Operaciones' }, { nombre: 'Ventas y Atención al Cliente' }],
    apoyo:        [{ nombre: 'Talento Humano' }, { nombre: 'Finanzas y Contabilidad' }, { nombre: 'TI e Infraestructura' }],
  })
})

export default router
