import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

// GET /api/comunicacion
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.nombre AS creado_por_nombre
       FROM comunicaciones c
       LEFT JOIN usuarios u ON u.id = c.creado_por
       WHERE c.tenant_id = $1
       ORDER BY c.tipo, c.creado_en ASC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener comunicaciones' })
  }
})

// GET /api/comunicacion/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM comunicaciones WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Comunicación no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener comunicación' })
  }
})

// POST /api/comunicacion
router.post('/', requirePermission('comunicaciones', 'crear'), async (req: AuthRequest, res: Response) => {
  const { que, cuando, quien, a_quien, como, tipo, estado } = req.body
  if (!que || !quien) {
    return res.status(400).json({ error: 'que y quien son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO comunicaciones
         (que, cuando, quien, a_quien, como, tipo, estado, creado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        que,
        cuando   || null,
        quien,
        a_quien  || null,
        como     || null,
        tipo     || 'Interna',
        estado   || 'Activo',
        req.user?.id || null,
        req.user!.tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear comunicación' })
  }
})

// PUT /api/comunicacion/:id
router.put('/:id', requirePermission('comunicaciones', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { que, cuando, quien, a_quien, como, tipo, estado } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE comunicaciones
       SET que=$1, cuando=$2, quien=$3, a_quien=$4, como=$5, tipo=$6, estado=$7
       WHERE id=$8 AND tenant_id=$9 RETURNING *`,
      [que, cuando || null, quien, a_quien || null, como || null, tipo, estado, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Comunicación no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar comunicación' })
  }
})

// DELETE /api/comunicacion/:id
router.delete('/:id', requirePermission('comunicaciones', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM comunicaciones WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Comunicación no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar comunicación' })
  }
})

export default router
