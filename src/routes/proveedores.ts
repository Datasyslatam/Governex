import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

// GET /api/proveedores
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT pv.*,
              (SELECT row_to_json(e) FROM (
                SELECT total, fecha, calidad, entrega, precio, servicio, debilidades FROM proveedor_evaluaciones
                WHERE proveedor_id = pv.id AND tenant_id = pv.tenant_id
                ORDER BY fecha DESC, id DESC LIMIT 1
              ) e) AS ultima_evaluacion
       FROM proveedores pv
       WHERE pv.tenant_id = $1
       ORDER BY pv.razon`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener proveedores' })
  }
})

// POST /api/proveedores
router.post('/', requirePermission('proveedores', 'crear'), async (req: AuthRequest, res: Response) => {
  const { nit, razon, tipo, estado, prox_eval, periodicidad_evaluacion, email } = req.body
  if (!nit || !razon) return res.status(400).json({ error: 'nit y razon son requeridos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO proveedores (nit, razon, tipo, estado, prox_eval, periodicidad_evaluacion, email, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [nit, razon, tipo || null, estado || 'Aprobado', prox_eval || null, periodicidad_evaluacion || 'Anual', email || null, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'NIT ya registrado' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear proveedor' })
  }
})

// PUT /api/proveedores/:id
router.put('/:id', requirePermission('proveedores', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { razon, tipo, estado, prox_eval, periodicidad_evaluacion, email } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE proveedores SET razon=$1, tipo=$2, estado=$3, prox_eval=$4, periodicidad_evaluacion=$5, email=$6
       WHERE id=$7 AND tenant_id=$8 RETURNING *`,
      [razon, tipo || null, estado, prox_eval || null, periodicidad_evaluacion || 'Anual', email || null, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar proveedor' })
  }
})

// POST /api/proveedores/:id/evaluaciones
router.post('/:id/evaluaciones', requirePermission('proveedores', 'crear'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { evaluador, calidad, entrega, precio, servicio, fecha, precio_mercado, precio_proveedor, debilidades, generada_con_ia } = req.body
  if (calidad == null || entrega == null || precio == null || servicio == null) {
    return res.status(400).json({ error: 'calidad, entrega, precio y servicio son requeridos' })
  }
  try {
    const tenantId = req.user!.tenantId
    const { rowCount } = await pool.query(
      'SELECT 1 FROM proveedores WHERE id = $1 AND tenant_id = $2', [id, tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Proveedor no encontrado' })

    // Insertar evaluación
    const { rows } = await pool.query(
      `INSERT INTO proveedor_evaluaciones (proveedor_id, evaluador, calidad, entrega, precio, servicio, fecha, precio_mercado, precio_proveedor, debilidades, generada_con_ia, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [id, evaluador || null, calidad, entrega, precio, servicio,
       fecha || new Date().toISOString().slice(0, 10), precio_mercado || null, precio_proveedor || null, debilidades || null, generada_con_ia || false, tenantId]
    )
    // Actualizar estado del proveedor según puntaje total
    const dbTotal = rows[0].total
    const nuevoEstado = dbTotal >= 80 ? 'Aprobado' : dbTotal >= 60 ? 'Condicional' : 'Suspendido'
    await pool.query(
      `UPDATE proveedores SET estado=$1 WHERE id=$2 AND tenant_id=$3`,
      [nuevoEstado, id, tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar evaluación' })
  }
})

// GET /api/proveedores/:id/evaluaciones
router.get('/:id/evaluaciones', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM proveedor_evaluaciones WHERE proveedor_id=$1 AND tenant_id=$2 ORDER BY fecha DESC`,
      [req.params.id, req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener evaluaciones' })
  }
})

// DELETE /api/proveedores/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    await pool.query(`DELETE FROM proveedor_evaluaciones WHERE proveedor_id=$1 AND tenant_id=$2`, [id, req.user!.tenantId])
    const { rowCount } = await pool.query(`DELETE FROM proveedores WHERE id=$1 AND tenant_id=$2`, [id, req.user!.tenantId])
    if (rowCount === 0) return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.json({ message: 'Proveedor eliminado' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar proveedor' })
  }
})

export default router