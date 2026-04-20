import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

// GET /api/procesos
router.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, t.nombre AS tipo_nombre
       FROM procesos p
       JOIN tipos_proceso t ON t.id = p.tipo_id
       ORDER BY t.id, p.codigo`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener procesos' })
  }
})

// POST /api/procesos
router.post('/', async (req: AuthRequest, res: Response) => {
  const { codigo, nombre, objetivo, entradas, salidas, indicador_kpi, responsable, tipo_id, estado } = req.body
  if (!codigo || !nombre || !tipo_id) {
    return res.status(400).json({ error: 'codigo, nombre y tipo_id son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO procesos (codigo, nombre, objetivo, entradas, salidas, indicador_kpi, responsable, tipo_id, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [codigo, nombre, objetivo || null, entradas || null, salidas || null,
       indicador_kpi || null, responsable || null, tipo_id, estado || 'Activo']
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de proceso ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear proceso' })
  }
})

// PUT /api/procesos/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { nombre, objetivo, entradas, salidas, indicador_kpi, responsable, tipo_id, estado } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE procesos SET nombre=$1, objetivo=$2, entradas=$3, salidas=$4,
       indicador_kpi=$5, responsable=$6, tipo_id=$7, estado=$8
       WHERE id=$9 RETURNING *`,
      [nombre, objetivo || null, entradas || null, salidas || null,
       indicador_kpi || null, responsable || null, tipo_id, estado, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Proceso no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar proceso' })
  }
})

// GET /api/procesos/pestel
router.get('/pestel', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM pestel ORDER BY factor, id`)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener PESTEL' })
  }
})

// POST /api/procesos/pestel
router.post('/pestel', async (req: AuthRequest, res: Response) => {
  const { factor, categoria, descripcion, impacto, oportunidad } = req.body
  if (!factor || !descripcion || !impacto) {
    return res.status(400).json({ error: 'factor, descripcion e impacto son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO pestel (factor, categoria, descripcion, impacto, oportunidad)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [factor, categoria || '', descripcion, impacto, oportunidad ?? false]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear entrada PESTEL' })
  }
})

// GET /api/procesos/dofa
router.get('/dofa', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM dofa ORDER BY tipo, id`)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener DOFA' })
  }
})

// POST /api/procesos/dofa
router.post('/dofa', async (req: AuthRequest, res: Response) => {
  const { tipo, descripcion } = req.body
  if (!tipo || !descripcion) return res.status(400).json({ error: 'tipo y descripcion requeridos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO dofa (tipo, descripcion) VALUES ($1,$2) RETURNING *`,
      [tipo, descripcion]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear entrada DOFA' })
  }
})

export default router
