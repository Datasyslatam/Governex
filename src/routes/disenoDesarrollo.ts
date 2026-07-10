import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

// GET /api/diseno-desarrollo
router.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT pd.*, u.nombre AS creado_por_nombre
       FROM proyectos_diseno pd
       LEFT JOIN usuarios u ON u.id = pd.creado_por
       ORDER BY pd.creado_en DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener proyectos de diseño' })
  }
})

// GET /api/diseno-desarrollo/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM proyectos_diseno WHERE id=$1`, [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Proyecto no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener proyecto' })
  }
})

// POST /api/diseno-desarrollo
router.post('/', async (req: AuthRequest, res: Response) => {
  const { nombre, cliente, entradas, salidas, responsable,
          fecha_inicio, fecha_entrega, etapa, estado, control, actividad_id } = req.body
  if (!nombre) {
    return res.status(400).json({ error: 'nombre es requerido' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO proyectos_diseno
         (nombre, cliente, entradas, salidas, responsable,
          fecha_inicio, fecha_entrega, etapa, estado, control, actividad_id, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        nombre,
        cliente        || null,
        entradas       || null,
        salidas        || null,
        responsable    || null,
        fecha_inicio   || null,
        fecha_entrega  || null,
        etapa          || 'Planificación',
        estado         || 'En tiempo',
        control        || null,
        actividad_id   || null,
        req.user?.id   || null,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear proyecto de diseño' })
  }
})

// PUT /api/diseno-desarrollo/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { nombre, cliente, entradas, salidas, responsable,
          fecha_inicio, fecha_entrega, etapa, estado, control, actividad_id } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE proyectos_diseno
       SET nombre=$1, cliente=$2, entradas=$3, salidas=$4, responsable=$5,
           fecha_inicio=$6, fecha_entrega=$7, etapa=$8, estado=$9, control=$10, actividad_id=$11
       WHERE id=$12 RETURNING *`,
      [nombre, cliente || null, entradas || null, salidas || null,
       responsable || null, fecha_inicio || null, fecha_entrega || null,
       etapa, estado, control || null, actividad_id || null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Proyecto no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar proyecto' })
  }
})

// DELETE /api/diseno-desarrollo/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM proyectos_diseno WHERE id=$1`, [req.params.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'Proyecto no encontrado' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar proyecto' })
  }
})

export default router
