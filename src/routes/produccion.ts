import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

// GET /api/produccion
router.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT op.*, u.nombre AS creado_por_nombre
       FROM ordenes_produccion op
       LEFT JOIN usuarios u ON u.id = op.creado_por
       ORDER BY op.creado_en DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener órdenes de producción' })
  }
})

// GET /api/produccion/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ordenes_produccion WHERE id=$1`, [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener orden' })
  }
})

// POST /api/produccion
router.post('/', async (req: AuthRequest, res: Response) => {
  const { codigo, producto_servicio, cliente, cantidad, instruccion_trabajo,
          equipos, responsable, fecha_inicio, fecha_entrega, etapa, conformidad } = req.body
  if (!codigo || !producto_servicio) {
    return res.status(400).json({ error: 'codigo y producto_servicio son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO ordenes_produccion
         (codigo, producto_servicio, cliente, cantidad, instruccion_trabajo,
          equipos, responsable, fecha_inicio, fecha_entrega, etapa, conformidad, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        codigo,
        producto_servicio,
        cliente              || null,
        cantidad             || null,
        instruccion_trabajo  || null,
        equipos              || null,
        responsable          || null,
        fecha_inicio         || null,
        fecha_entrega        || null,
        etapa                || 'Programado',
        conformidad          || 'Pendiente inspección',
        req.user?.id         || null,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de orden ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear orden de producción' })
  }
})

// PUT /api/produccion/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { producto_servicio, cliente, cantidad, instruccion_trabajo,
          equipos, responsable, fecha_inicio, fecha_entrega, etapa, conformidad } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE ordenes_produccion
       SET producto_servicio=$1, cliente=$2, cantidad=$3, instruccion_trabajo=$4,
           equipos=$5, responsable=$6, fecha_inicio=$7, fecha_entrega=$8,
           etapa=$9, conformidad=$10
       WHERE id=$11 RETURNING *`,
      [producto_servicio, cliente || null, cantidad || null,
       instruccion_trabajo || null, equipos || null, responsable || null,
       fecha_inicio || null, fecha_entrega || null, etapa, conformidad, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar orden' })
  }
})

// DELETE /api/produccion/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM ordenes_produccion WHERE id=$1`, [req.params.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'Orden no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar orden' })
  }
})

export default router
