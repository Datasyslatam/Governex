import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

// GET /api/riesgos
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, p.nombre AS proceso_nombre
       FROM riesgos r
       LEFT JOIN procesos p ON p.id = r.proceso_id
       WHERE r.tenant_id = $1
       ORDER BY r.nivel DESC, r.codigo`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener riesgos' })
  }
})

// POST /api/riesgos
router.post('/', requirePermission('riesgos', 'crear'), async (req: AuthRequest, res: Response) => {
  const { codigo, descripcion, proceso_id, probabilidad, impacto, estado, responsable, tipo } = req.body
  if (!codigo || !descripcion || !probabilidad || !impacto) {
    return res.status(400).json({ error: 'codigo, descripcion, probabilidad e impacto son requeridos' })
  }
  try {
    // Si viene proceso_id, debe pertenecer al mismo tenant del usuario:
    // sin esta validación, un id de otro tenant permitiría enlazar un
    // riesgo propio a un proceso ajeno (IDOR vía llave foránea).
    if (proceso_id) {
      const { rowCount } = await pool.query(
        'SELECT 1 FROM procesos WHERE id = $1 AND tenant_id = $2',
        [proceso_id, req.user!.tenantId]
      )
      if (!rowCount) return res.status(400).json({ error: 'proceso_id no pertenece a tu organización' })
    }
    const { rows } = await pool.query(
      `INSERT INTO riesgos (codigo, descripcion, proceso_id, probabilidad, impacto, estado, responsable, tipo, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [codigo, descripcion, proceso_id || null, probabilidad, impacto,
       estado || 'MONITOREO', responsable || null, tipo || 'Riesgo', req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de riesgo ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear riesgo' })
  }
})


// POST /api/riesgos/upsert
// Usado por la Matriz de Riesgos y Oportunidades (§6.1) para persistir
// (crear o actualizar) un riesgo/oportunidad derivado del análisis IA,
// identificado por su `codigo` (no por `id`, que el frontend no conoce
// hasta que existe la fila en BD).
router.post('/upsert', requirePermission('riesgos', 'crear'), async (req: AuthRequest, res: Response) => {
  const {
    codigo, descripcion, probabilidad, impacto, estado, responsable, tipo,
    fuente, categoria, actividad_id, tratamiento,
  } = req.body

  if (!codigo || !descripcion || !probabilidad || !impacto) {
    return res.status(400).json({ error: 'codigo, descripcion, probabilidad e impacto son requeridos' })
  }
  try {
    // ON CONFLICT usa el UNIQUE compuesto (tenant_id, codigo) creado en la
    // migración multi-tenant — así el upsert nunca puede "chocar" (ni
    // sobreescribir) el código de un riesgo de otro tenant.
    const { rows } = await pool.query(
      `INSERT INTO riesgos
         (codigo, descripcion, probabilidad, impacto, estado, responsable, tipo,
          fuente, categoria, actividad_id, tratamiento, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (tenant_id, codigo) DO UPDATE SET
         descripcion  = EXCLUDED.descripcion,
         probabilidad = EXCLUDED.probabilidad,
         impacto      = EXCLUDED.impacto,
         estado       = EXCLUDED.estado,
         responsable  = EXCLUDED.responsable,
         tipo         = EXCLUDED.tipo,
         fuente       = EXCLUDED.fuente,
         categoria    = EXCLUDED.categoria,
         actividad_id = EXCLUDED.actividad_id,
         tratamiento  = EXCLUDED.tratamiento
       RETURNING *`,
      [codigo, descripcion, probabilidad, impacto, estado || 'MONITOREO',
       responsable || null, tipo || 'Riesgo', fuente || null, categoria || null,
       actividad_id || null, tratamiento || null, req.user!.tenantId]
    )
    res.status(200).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al guardar el riesgo/oportunidad' })
  }
})

// PUT /api/riesgos/:id
router.put('/:id', requirePermission('riesgos', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { descripcion, proceso_id, probabilidad, impacto, estado, responsable, tipo } = req.body
  try {
    // El WHERE incluye tenant_id: si el :id existe pero pertenece a otro
    // tenant, la query no actualiza nada y cae en el 404 de abajo — nunca
    // se confía en que un id "exista" para autorizar la operación.
    const { rows } = await pool.query(
      `UPDATE riesgos SET descripcion=$1, proceso_id=$2, probabilidad=$3, impacto=$4,
       estado=$5, responsable=$6, tipo=$7
       WHERE id=$8 AND tenant_id=$9 RETURNING *`,
      [descripcion, proceso_id || null, probabilidad, impacto, estado, responsable || null, tipo, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Riesgo no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar riesgo' })
  }
})

// DELETE /api/riesgos/:id
router.delete('/:id', requirePermission('riesgos', 'eliminar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM riesgos WHERE id=$1 AND tenant_id=$2',
      [id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Riesgo no encontrado' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar riesgo' })
  }
})

export default router