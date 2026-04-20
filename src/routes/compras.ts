import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

// GET /api/compras
router.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT oc.*,
              pv.razon AS proveedor_razon,
              u.nombre AS creado_por_nombre
       FROM ordenes_compra oc
       LEFT JOIN proveedores pv ON pv.id = oc.proveedor_id
       LEFT JOIN usuarios u    ON u.id  = oc.creado_por
       ORDER BY oc.creado_en DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener órdenes de compra' })
  }
})

// GET /api/compras/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT oc.*, pv.razon AS proveedor_razon
       FROM ordenes_compra oc
       LEFT JOIN proveedores pv ON pv.id = oc.proveedor_id
       WHERE oc.id=$1`,
      [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener orden' })
  }
})

// POST /api/compras
router.post('/', async (req: AuthRequest, res: Response) => {
  const { proveedor_id, proveedor, producto, cantidad, unidad,
          precio_unit, total, fecha_emision, fecha_entrega,
          requisitos, responsable, estado, observaciones } = req.body
  if (!proveedor || !producto) {
    return res.status(400).json({ error: 'proveedor y producto son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO ordenes_compra
         (proveedor_id, proveedor, producto, cantidad, unidad, precio_unit, total,
          fecha_emision, fecha_entrega, requisitos, responsable, estado, observaciones, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        proveedor_id   || null,
        proveedor,
        producto,
        cantidad       || null,
        unidad         || null,
        precio_unit    || null,
        total          || null,
        fecha_emision  || null,
        fecha_entrega  || null,
        requisitos     || null,
        responsable    || null,
        estado         || 'Pendiente',
        observaciones  || null,
        req.user?.id   || null,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear orden de compra' })
  }
})

// PUT /api/compras/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { proveedor_id, proveedor, producto, cantidad, unidad,
          precio_unit, total, fecha_emision, fecha_entrega,
          requisitos, responsable, estado, observaciones } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE ordenes_compra
       SET proveedor_id=$1, proveedor=$2, producto=$3, cantidad=$4, unidad=$5,
           precio_unit=$6, total=$7, fecha_emision=$8, fecha_entrega=$9,
           requisitos=$10, responsable=$11, estado=$12, observaciones=$13
       WHERE id=$14 RETURNING *`,
      [proveedor_id || null, proveedor, producto, cantidad || null, unidad || null,
       precio_unit || null, total || null, fecha_emision || null, fecha_entrega || null,
       requisitos || null, responsable || null, estado, observaciones || null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar orden' })
  }
})

// DELETE /api/compras/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM ordenes_compra WHERE id=$1`, [req.params.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'Orden no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar orden' })
  }
})

export default router
