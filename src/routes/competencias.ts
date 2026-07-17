import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

// ── PERSONAL ───────────────────────────────────────────────

router.get('/personal', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT ps.*, p.nombre AS proceso_nombre,
              (SELECT row_to_json(e) FROM (
                SELECT brecha_pct, estado, fecha
                FROM evaluaciones_competencia
                WHERE personal_id = ps.id AND tenant_id = ps.tenant_id
                ORDER BY fecha DESC LIMIT 1
              ) e) AS ultima_evaluacion
       FROM personal ps
       LEFT JOIN procesos p ON p.id = ps.proceso_id
       WHERE ps.activo = true AND ps.tenant_id = $1
       ORDER BY ps.nombre`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener personal' })
  }
})

router.post('/personal', requirePermission('competencias', 'crear'), async (req: AuthRequest, res: Response) => {
  const { nombre, cargo, proceso_id } = req.body
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO personal (nombre, cargo, proceso_id, tenant_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [nombre, cargo || null, proceso_id || null, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear personal' })
  }
})

// POST /api/competencias/evaluaciones
router.post('/evaluaciones', requirePermission('competencias', 'crear'), async (req: AuthRequest, res: Response) => {
  const { personal_id, brecha_pct, estado, fecha } = req.body
  if (!personal_id || brecha_pct == null || !estado) {
    return res.status(400).json({ error: 'personal_id, brecha_pct y estado son requeridos' })
  }
  try {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM personal WHERE id = $1 AND tenant_id = $2',
      [personal_id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(400).json({ error: 'personal_id no pertenece a tu organización' })

    const { rows } = await pool.query(
      `INSERT INTO evaluaciones_competencia (personal_id, brecha_pct, estado, evaluado_por, fecha, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [personal_id, brecha_pct, estado, req.user?.id || null,
       fecha || new Date().toISOString().slice(0, 10), req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar evaluación' })
  }
})

// ── PLAN DE FORMACIÓN ──────────────────────────────────────

router.get('/plan-formacion', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT pf.*,
              array_agg(ps.nombre ORDER BY ps.nombre) AS asistentes_nombres
       FROM plan_formacion pf
       LEFT JOIN formacion_asistentes fa ON fa.plan_id = pf.id AND fa.tenant_id = pf.tenant_id
       LEFT JOIN personal ps ON ps.id = fa.personal_id
       WHERE pf.tenant_id = $1
       GROUP BY pf.id
       ORDER BY pf.fecha DESC NULLS LAST`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener plan de formación' })
  }
})

router.post('/plan-formacion', requirePermission('competencias', 'crear'), async (req: AuthRequest, res: Response) => {
  const { tema, fecha, estado, asistentes_ids } = req.body
  if (!tema) return res.status(400).json({ error: 'tema es requerido' })
  const tenantId = req.user!.tenantId
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO plan_formacion (tema, fecha, estado, tenant_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [tema, fecha || null, estado || 'Planificado', tenantId]
    )
    const planId = rows[0].id
    if (Array.isArray(asistentes_ids) && asistentes_ids.length > 0) {
      // Cada personal_id debe pertenecer al mismo tenant que el plan que
      // se está creando; si no, se descarta silenciosamente ese asistente
      // en vez de fallar toda la transacción por un id ajeno.
      const { rows: validos } = await client.query(
        'SELECT id FROM personal WHERE id = ANY($1::int[]) AND tenant_id = $2',
        [asistentes_ids, tenantId]
      )
      for (const v of validos) {
        await client.query(
          `INSERT INTO formacion_asistentes (plan_id, personal_id, tenant_id) VALUES ($1,$2,$3)`,
          [planId, v.id, tenantId]
        )
      }
    }
    await client.query('COMMIT')
    res.status(201).json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Error al crear plan de formación' })
  } finally {
    client.release()
  }
})

router.put('/plan-formacion/:id', requirePermission('competencias', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { tema, fecha, estado } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE plan_formacion SET tema=$1, fecha=$2, estado=$3
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [tema, fecha || null, estado, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Plan no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar plan' })
  }
})

export default router
