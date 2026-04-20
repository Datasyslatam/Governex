import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

// ── PERSONAL ───────────────────────────────────────────────

router.get('/personal', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT ps.*, p.nombre AS proceso_nombre,
              (SELECT row_to_json(e) FROM (
                SELECT brecha_pct, estado, fecha
                FROM evaluaciones_competencia
                WHERE personal_id = ps.id
                ORDER BY fecha DESC LIMIT 1
              ) e) AS ultima_evaluacion
       FROM personal ps
       LEFT JOIN procesos p ON p.id = ps.proceso_id
       WHERE ps.activo = true
       ORDER BY ps.nombre`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener personal' })
  }
})

router.post('/personal', async (req: AuthRequest, res: Response) => {
  const { nombre, cargo, proceso_id } = req.body
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO personal (nombre, cargo, proceso_id)
       VALUES ($1,$2,$3) RETURNING *`,
      [nombre, cargo || null, proceso_id || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear personal' })
  }
})

// POST /api/competencias/evaluaciones
router.post('/evaluaciones', async (req: AuthRequest, res: Response) => {
  const { personal_id, brecha_pct, estado, fecha } = req.body
  if (!personal_id || brecha_pct == null || !estado) {
    return res.status(400).json({ error: 'personal_id, brecha_pct y estado son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO evaluaciones_competencia (personal_id, brecha_pct, estado, evaluado_por, fecha)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [personal_id, brecha_pct, estado, req.user?.id || null,
       fecha || new Date().toISOString().slice(0, 10)]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar evaluación' })
  }
})

// ── PLAN DE FORMACIÓN ──────────────────────────────────────

router.get('/plan-formacion', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT pf.*,
              array_agg(ps.nombre ORDER BY ps.nombre) AS asistentes_nombres
       FROM plan_formacion pf
       LEFT JOIN formacion_asistentes fa ON fa.plan_id = pf.id
       LEFT JOIN personal ps ON ps.id = fa.personal_id
       GROUP BY pf.id
       ORDER BY pf.fecha DESC NULLS LAST`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener plan de formación' })
  }
})

router.post('/plan-formacion', async (req: AuthRequest, res: Response) => {
  const { tema, fecha, estado, asistentes_ids } = req.body
  if (!tema) return res.status(400).json({ error: 'tema es requerido' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO plan_formacion (tema, fecha, estado)
       VALUES ($1,$2,$3) RETURNING *`,
      [tema, fecha || null, estado || 'Planificado']
    )
    const planId = rows[0].id
    if (Array.isArray(asistentes_ids) && asistentes_ids.length > 0) {
      for (const pid of asistentes_ids) {
        await client.query(
          `INSERT INTO formacion_asistentes (plan_id, personal_id) VALUES ($1,$2)`,
          [planId, pid]
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

router.put('/plan-formacion/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { tema, fecha, estado } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE plan_formacion SET tema=$1, fecha=$2, estado=$3
       WHERE id=$4 RETURNING *`,
      [tema, fecha || null, estado, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Plan no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar plan' })
  }
})

export default router
