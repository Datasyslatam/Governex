import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

// GET /api/planes-operacion
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT po.*, u.nombre AS creado_por_nombre
       FROM planes_operacion po
       LEFT JOIN usuarios u ON u.id = po.creado_por
       WHERE po.tenant_id = $1
       ORDER BY po.creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener planes de operación' })
  }
})

// GET /api/planes-operacion/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM planes_operacion WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Plan no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener plan' })
  }
})

// POST /api/planes-operacion
router.post('/', requirePermission('planes_operacion', 'crear'), async (req: AuthRequest, res: Response) => {
  const { proceso, objetivo, criterios, recursos, controles, responsable, fecha_revision, estado } = req.body
  if (!proceso || !objetivo) {
    return res.status(400).json({ error: 'proceso y objetivo son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO planes_operacion
         (proceso, objetivo, criterios, recursos, controles, responsable, fecha_revision, estado, creado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        proceso, objetivo,
        criterios    || null,
        recursos     || null,
        controles    || null,
        responsable  || null,
        fecha_revision || null,
        estado       || 'Vigente',
        req.user?.id || null,
        req.user!.tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear plan de operación' })
  }
})

// PUT /api/planes-operacion/:id
router.put('/:id', requirePermission('planes_operacion', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { proceso, objetivo, criterios, recursos, controles, responsable, fecha_revision, estado } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE planes_operacion
       SET proceso=$1, objetivo=$2, criterios=$3, recursos=$4,
           controles=$5, responsable=$6, fecha_revision=$7, estado=$8
       WHERE id=$9 AND tenant_id=$10 RETURNING *`,
      [proceso, objetivo, criterios || null, recursos || null,
       controles || null, responsable || null, fecha_revision || null, estado, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Plan no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar plan' })
  }
})

// DELETE /api/planes-operacion/:id
router.delete('/:id', requirePermission('planes_operacion', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM planes_operacion WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Plan no encontrado' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar plan' })
  }
})

export default router
