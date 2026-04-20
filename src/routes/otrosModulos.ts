import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

// ── POLÍTICA DE CALIDAD ────────────────────────────────────
export const politicaRouter = Router()
politicaRouter.use(authMiddleware)

politicaRouter.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.nombre AS aprobado_por_nombre
       FROM politica_calidad p
       LEFT JOIN usuarios u ON u.id = p.aprobado_por
       ORDER BY p.creado_en DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener política' })
  }
})

politicaRouter.post('/', async (req: AuthRequest, res: Response) => {
  const { version, contenido, estado, fecha_vigencia } = req.body
  if (!version || !contenido) {
    return res.status(400).json({ error: 'version y contenido son requeridos' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Marcar versiones anteriores como obsoletas
    await client.query(`UPDATE politica_calidad SET estado='Obsoleto' WHERE estado='Vigente'`)
    const { rows } = await client.query(
      `INSERT INTO politica_calidad (version, contenido, estado, aprobado_por, fecha_vigencia)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [version, contenido, estado || 'Vigente', req.user?.id || null, fecha_vigencia || null]
    )
    await client.query('COMMIT')
    res.status(201).json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Error al crear política' })
  } finally {
    client.release()
  }
})

politicaRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { version, contenido, estado, fecha_vigencia } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE politica_calidad SET version=$1, contenido=$2, estado=$3,
       fecha_vigencia=$4 WHERE id=$5 RETURNING *`,
      [version, contenido, estado, fecha_vigencia || null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Política no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar política' })
  }
})

// GET /api/politica/lecturas
politicaRouter.get('/lecturas', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM politica_lecturas ORDER BY creado_en DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener lecturas' })
  }
})

// POST /api/politica/lecturas
politicaRouter.post('/lecturas', async (req: AuthRequest, res: Response) => {
  const { politica_id, nombre_persona, area, fecha_lectura, estado } = req.body
  if (!politica_id || !nombre_persona) {
    return res.status(400).json({ error: 'politica_id y nombre_persona son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO politica_lecturas (politica_id, nombre_persona, area, fecha_lectura, estado)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [politica_id, nombre_persona, area || null,
       fecha_lectura || null, estado || 'Pendiente']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar lectura' })
  }
})

// ── REVISIÓN POR LA DIRECCIÓN ──────────────────────────────
export const revDireccionRouter = Router()
revDireccionRouter.use(authMiddleware)

revDireccionRouter.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM rev_direccion ORDER BY fecha DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener revisiones' })
  }
})

revDireccionRouter.post('/', async (req: AuthRequest, res: Response) => {
  const { fecha, asistentes, temas, conclusiones, decisiones, proxima_rev } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO rev_direccion (fecha, asistentes, temas, conclusiones, decisiones, proxima_rev)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [fecha || new Date().toISOString().slice(0, 10),
       asistentes || null, temas || null,
       conclusiones || null, decisiones || null, proxima_rev || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear revisión' })
  }
})

revDireccionRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { asistentes, temas, conclusiones, decisiones, proxima_rev } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE rev_direccion SET asistentes=$1, temas=$2, conclusiones=$3,
       decisiones=$4, proxima_rev=$5 WHERE id=$6 RETURNING *`,
      [asistentes || null, temas || null, conclusiones || null,
       decisiones || null, proxima_rev || null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Revisión no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar revisión' })
  }
})
