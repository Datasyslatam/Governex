import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

// ── NO CONFORMIDADES ───────────────────────────────────────

// GET /api/nc-ac/no-conformidades
router.get('/no-conformidades', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT nc.*, p.nombre AS proceso_nombre
       FROM no_conformidades nc
       LEFT JOIN procesos p ON p.id = nc.proceso_id
       ORDER BY nc.creado_en DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener no conformidades' })
  }
})

// POST /api/nc-ac/no-conformidades
router.post('/no-conformidades', async (req: AuthRequest, res: Response) => {
  const { codigo, fecha, origen, proceso_id, descripcion, gravedad, estado, hallazgo_id } = req.body
  if (!codigo || !origen || !descripcion || !gravedad) {
    return res.status(400).json({ error: 'codigo, origen, descripcion y gravedad son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO no_conformidades (codigo, fecha, origen, proceso_id, descripcion, gravedad, estado, hallazgo_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [codigo, fecha || new Date().toISOString().slice(0, 10),
       origen, proceso_id || null, descripcion, gravedad,
       estado || 'Abierta', hallazgo_id || null]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de NC ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear no conformidad' })
  }
})

// PUT /api/nc-ac/no-conformidades/:id
router.put('/no-conformidades/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { origen, proceso_id, descripcion, gravedad, estado } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE no_conformidades SET origen=$1, proceso_id=$2, descripcion=$3,
       gravedad=$4, estado=$5 WHERE id=$6 RETURNING *`,
      [origen, proceso_id || null, descripcion, gravedad, estado, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'NC no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar NC' })
  }
})

// ── ACCIONES CORRECTIVAS ───────────────────────────────────

// GET /api/nc-ac/acciones-correctivas
router.get('/acciones-correctivas', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT ac.*, nc.codigo AS nc_codigo
       FROM acciones_correctivas ac
       JOIN no_conformidades nc ON nc.id = ac.nc_id
       ORDER BY ac.creado_en DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener acciones correctivas' })
  }
})

// POST /api/nc-ac/acciones-correctivas
router.post('/acciones-correctivas', async (req: AuthRequest, res: Response) => {
  const { codigo, nc_id, metodo_analisis, accion, responsable, fecha_fin, estado, eficacia } = req.body
  if (!codigo || !nc_id || !accion) {
    return res.status(400).json({ error: 'codigo, nc_id y accion son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO acciones_correctivas (codigo, nc_id, metodo_analisis, accion, responsable, fecha_fin, estado, eficacia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [codigo, nc_id, metodo_analisis || null, accion,
       responsable || null, fecha_fin || null,
       estado || 'En Implementación', eficacia || '-']
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de AC ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear acción correctiva' })
  }
})

// PUT /api/nc-ac/acciones-correctivas/:id
router.put('/acciones-correctivas/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { metodo_analisis, accion, responsable, fecha_fin, estado, eficacia } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE acciones_correctivas SET metodo_analisis=$1, accion=$2, responsable=$3,
       fecha_fin=$4, estado=$5, eficacia=$6 WHERE id=$7 RETURNING *`,
      [metodo_analisis || null, accion, responsable || null,
       fecha_fin || null, estado, eficacia || '-', id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'AC no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar AC' })
  }
})

export default router
