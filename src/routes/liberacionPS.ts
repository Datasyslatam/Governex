import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

// GET /api/liberacion-ps
router.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT lp.*,
              op.codigo  AS orden_codigo,
              u.nombre   AS creado_por_nombre
       FROM liberaciones_ps lp
       LEFT JOIN ordenes_produccion op ON op.id = lp.orden_produccion_id
       LEFT JOIN usuarios u            ON u.id  = lp.creado_por
       ORDER BY lp.fecha DESC, lp.creado_en DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener liberaciones' })
  }
})

// GET /api/liberacion-ps/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM liberaciones_ps WHERE id=$1`, [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Liberación no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener liberación' })
  }
})

// POST /api/liberacion-ps
router.post('/', async (req: AuthRequest, res: Response) => {
  const { codigo_op, orden_produccion_id, producto_servicio, cliente,
          criterios_aceptacion, inspeccion_realizada, resultados,
          autorizado_por, fecha, decision, observaciones } = req.body
  if (!producto_servicio || !decision) {
    return res.status(400).json({ error: 'producto_servicio y decision son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO liberaciones_ps
         (codigo_op, orden_produccion_id, producto_servicio, cliente,
          criterios_aceptacion, inspeccion_realizada, resultados,
          autorizado_por, fecha, decision, observaciones, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        codigo_op            || null,
        orden_produccion_id  || null,
        producto_servicio,
        cliente              || null,
        criterios_aceptacion || null,
        inspeccion_realizada || null,
        resultados           || null,
        autorizado_por       || null,
        fecha                || new Date().toISOString().slice(0, 10),
        decision,
        observaciones        || null,
        req.user?.id         || null,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear liberación' })
  }
})

// PUT /api/liberacion-ps/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { codigo_op, orden_produccion_id, producto_servicio, cliente,
          criterios_aceptacion, inspeccion_realizada, resultados,
          autorizado_por, fecha, decision, observaciones } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE liberaciones_ps
       SET codigo_op=$1, orden_produccion_id=$2, producto_servicio=$3, cliente=$4,
           criterios_aceptacion=$5, inspeccion_realizada=$6, resultados=$7,
           autorizado_por=$8, fecha=$9, decision=$10, observaciones=$11
       WHERE id=$12 RETURNING *`,
      [codigo_op || null, orden_produccion_id || null, producto_servicio, cliente || null,
       criterios_aceptacion || null, inspeccion_realizada || null, resultados || null,
       autorizado_por || null, fecha, decision, observaciones || null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Liberación no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar liberación' })
  }
})

// DELETE /api/liberacion-ps/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM liberaciones_ps WHERE id=$1`, [req.params.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'Liberación no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar liberación' })
  }
})

export default router
