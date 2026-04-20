import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

// GET /api/requerimientos-ps
router.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT rp.*, u.nombre AS creado_por_nombre
       FROM requerimientos_ps rp
       LEFT JOIN usuarios u ON u.id = rp.creado_por
       ORDER BY rp.creado_en DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener requerimientos' })
  }
})

// GET /api/requerimientos-ps/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM requerimientos_ps WHERE id=$1`, [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Requerimiento no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener requerimiento' })
  }
})

// POST /api/requerimientos-ps
router.post('/', async (req: AuthRequest, res: Response) => {
  const { cliente, producto_servicio, requisitos_cliente, requisitos_legales,
          requisitos_org, fecha_revision, revisado_por, estado } = req.body
  if (!cliente || !producto_servicio) {
    return res.status(400).json({ error: 'cliente y producto_servicio son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO requerimientos_ps
         (cliente, producto_servicio, requisitos_cliente, requisitos_legales,
          requisitos_org, fecha_revision, revisado_por, estado, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        cliente, producto_servicio,
        requisitos_cliente  || null,
        requisitos_legales  || null,
        requisitos_org      || null,
        fecha_revision      || null,
        revisado_por        || null,
        estado              || 'Pendiente',
        req.user?.id        || null,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear requerimiento' })
  }
})

// PUT /api/requerimientos-ps/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { cliente, producto_servicio, requisitos_cliente, requisitos_legales,
          requisitos_org, fecha_revision, revisado_por, estado } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE requerimientos_ps
       SET cliente=$1, producto_servicio=$2, requisitos_cliente=$3,
           requisitos_legales=$4, requisitos_org=$5, fecha_revision=$6,
           revisado_por=$7, estado=$8
       WHERE id=$9 RETURNING *`,
      [cliente, producto_servicio, requisitos_cliente || null,
       requisitos_legales || null, requisitos_org || null,
       fecha_revision || null, revisado_por || null, estado, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Requerimiento no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar requerimiento' })
  }
})

// DELETE /api/requerimientos-ps/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM requerimientos_ps WHERE id=$1`, [req.params.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'Requerimiento no encontrado' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar requerimiento' })
  }
})

export default router
