import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

// GET /api/toma-consciencia
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT tc.*,
              ps.nombre  AS personal_nombre,
              u.nombre   AS creado_por_nombre
       FROM toma_consciencia tc
       LEFT JOIN personal  ps ON ps.id = tc.personal_id
       LEFT JOIN usuarios  u  ON u.id  = tc.creado_por
       WHERE tc.tenant_id = $1
       ORDER BY tc.fecha DESC NULLS LAST, tc.creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener registros de toma de consciencia' })
  }
})

// GET /api/toma-consciencia/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM toma_consciencia WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Registro no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener registro' })
  }
})

// POST /api/toma-consciencia
router.post('/', requirePermission('toma_consciencia', 'crear'), async (req: AuthRequest, res: Response) => {
  const { colaborador, cargo, proceso, tema, fecha,
          modalidad, evidencia, estado, personal_id } = req.body
  if (!colaborador || !tema || !modalidad) {
    return res.status(400).json({ error: 'colaborador, tema y modalidad son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO toma_consciencia
         (colaborador, cargo, proceso, tema, fecha, modalidad, evidencia, estado, personal_id, creado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        colaborador,
        cargo       || null,
        proceso     || null,
        tema,
        fecha       || null,
        modalidad,
        evidencia   || null,
        estado      || 'Pendiente',
        personal_id || null,
        req.user?.id || null,
        req.user!.tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear registro' })
  }
})

// PUT /api/toma-consciencia/:id
router.put('/:id', requirePermission('toma_consciencia', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { colaborador, cargo, proceso, tema, fecha,
          modalidad, evidencia, estado, personal_id } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE toma_consciencia
       SET colaborador=$1, cargo=$2, proceso=$3, tema=$4, fecha=$5,
           modalidad=$6, evidencia=$7, estado=$8, personal_id=$9
       WHERE id=$10 AND tenant_id=$11 RETURNING *`,
      [colaborador, cargo || null, proceso || null, tema,
       fecha || null, modalidad, evidencia || null, estado, personal_id || null, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Registro no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar registro' })
  }
})

// DELETE /api/toma-consciencia/:id
router.delete('/:id', requirePermission('toma_consciencia', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM toma_consciencia WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Registro no encontrado' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar registro' })
  }
})

export default router
