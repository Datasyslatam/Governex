import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

// GET /api/planificacion-cambios
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM planificacion_cambios WHERE tenant_id = $1 ORDER BY creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener cambios planificados' })
  }
})

// POST /api/planificacion-cambios
router.post('/', requirePermission('planificacion_cambios', 'crear'), async (req: AuthRequest, res: Response) => {
  const {
    codigo, categoria, descripcion, justificacion, responsable, recursos,
    implicaciones, acciones, fecha_inicio, fecha_fin, impacto, estado,
    procesos_afectados, documentos_afectados, aprobado_por, observaciones,
  } = req.body

  if (!descripcion || !justificacion || !responsable) {
    return res.status(400).json({
      error: 'descripcion, justificacion y responsable son requeridos',
    })
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO planificacion_cambios
         (codigo, categoria, descripcion, justificacion, responsable, recursos,
          implicaciones, acciones, fecha_inicio, fecha_fin, impacto, estado,
          procesos_afectados, documentos_afectados, aprobado_por, observaciones, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        codigo          || null,
        categoria       || 'Otro',
        descripcion,
        justificacion,
        responsable,
        recursos        || null,
        implicaciones   || null,
        acciones        || null,
        fecha_inicio    || null,
        fecha_fin       || null,
        impacto         || 'Medio',
        estado          || 'Planificado',
        procesos_afectados    || null,
        documentos_afectados  || null,
        aprobado_por    || null,
        observaciones   || null,
        req.user!.tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'El código de cambio ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear cambio planificado' })
  }
})

// PUT /api/planificacion-cambios/:id
router.put('/:id', requirePermission('planificacion_cambios', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const {
    categoria, descripcion, justificacion, responsable, recursos,
    implicaciones, acciones, fecha_inicio, fecha_fin, impacto, estado,
    procesos_afectados, documentos_afectados, aprobado_por, observaciones,
  } = req.body

  try {
    const { rows } = await pool.query(
      `UPDATE planificacion_cambios SET
         categoria=$1, descripcion=$2, justificacion=$3, responsable=$4,
         recursos=$5, implicaciones=$6, acciones=$7, fecha_inicio=$8,
         fecha_fin=$9, impacto=$10, estado=$11, procesos_afectados=$12,
         documentos_afectados=$13, aprobado_por=$14, observaciones=$15
       WHERE id=$16 AND tenant_id=$17 RETURNING *`,
      [
        categoria       || 'Otro',
        descripcion,
        justificacion,
        responsable,
        recursos        || null,
        implicaciones   || null,
        acciones        || null,
        fecha_inicio    || null,
        fecha_fin       || null,
        impacto         || 'Medio',
        estado          || 'Planificado',
        procesos_afectados    || null,
        documentos_afectados  || null,
        aprobado_por    || null,
        observaciones   || null,
        id,
        req.user!.tenantId,
      ]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Cambio no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar cambio' })
  }
})

// DELETE /api/planificacion-cambios/:id
router.delete('/:id', requirePermission('planificacion_cambios', 'eliminar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const { rowCount } = await pool.query('DELETE FROM planificacion_cambios WHERE id=$1 AND tenant_id=$2', [id, req.user!.tenantId])
    if (!rowCount) return res.status(404).json({ error: 'Cambio no encontrado' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar cambio' })
  }
})

export default router