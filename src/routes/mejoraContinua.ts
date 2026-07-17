import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

// GET /api/mejora-continua
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT mc.*,
              p.nombre AS proceso_nombre,
              u.nombre AS creado_por_nombre
       FROM mejoras_continuas mc
       LEFT JOIN procesos  p ON p.id = mc.proceso_id
       LEFT JOIN usuarios  u ON u.id = mc.creado_por
       WHERE mc.tenant_id = $1
       ORDER BY mc.creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener iniciativas de mejora' })
  }
})

// GET /api/mejora-continua/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM mejoras_continuas WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Iniciativa no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener iniciativa' })
  }
})

// POST /api/mejora-continua
router.post('/', requirePermission('mejoras_continuas', 'crear'), async (req: AuthRequest, res: Response) => {
  const { codigo, titulo, origen, proceso, descripcion, beneficio_esperado,
          responsable, fecha_inicio, fecha_cierre, avance_pct, estado, proceso_id } = req.body
  if (!codigo || !titulo || !origen) {
    return res.status(400).json({ error: 'codigo, titulo y origen son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO mejoras_continuas
         (codigo, titulo, origen, proceso, descripcion, beneficio_esperado,
          responsable, fecha_inicio, fecha_cierre, avance_pct, estado, proceso_id, creado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        codigo,
        titulo,
        origen,
        proceso            || null,
        descripcion        || null,
        beneficio_esperado || null,
        responsable        || null,
        fecha_inicio       || null,
        fecha_cierre       || null,
        avance_pct         ?? 0,
        estado             || 'Propuesta',
        proceso_id         || null,
        req.user?.id       || null,
        req.user!.tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de iniciativa ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear iniciativa de mejora' })
  }
})

// PUT /api/mejora-continua/:id
router.put('/:id', requirePermission('mejoras_continuas', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { titulo, origen, proceso, descripcion, beneficio_esperado,
          responsable, fecha_inicio, fecha_cierre, avance_pct, estado, proceso_id } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE mejoras_continuas
       SET titulo=$1, origen=$2, proceso=$3, descripcion=$4,
           beneficio_esperado=$5, responsable=$6, fecha_inicio=$7,
           fecha_cierre=$8, avance_pct=$9, estado=$10, proceso_id=$11
       WHERE id=$12 AND tenant_id=$13 RETURNING *`,
      [titulo, origen, proceso || null, descripcion || null,
       beneficio_esperado || null, responsable || null,
       fecha_inicio || null, fecha_cierre || null,
       avance_pct ?? 0, estado, proceso_id || null, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Iniciativa no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar iniciativa' })
  }
})

// DELETE /api/mejora-continua/:id
router.delete('/:id', requirePermission('mejoras_continuas', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM mejoras_continuas WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Iniciativa no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar iniciativa' })
  }
})

export default router
