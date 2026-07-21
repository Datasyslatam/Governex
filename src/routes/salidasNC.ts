import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

// GET /api/salidas-nc
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT snc.*,
              nc.codigo  AS nc_codigo,
              u.nombre   AS creado_por_nombre
       FROM salidas_nc snc
       LEFT JOIN no_conformidades nc ON nc.id = snc.nc_id
       LEFT JOIN usuarios u          ON u.id  = snc.creado_por
       WHERE snc.tenant_id = $1
       ORDER BY snc.fecha DESC, snc.creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener salidas no conformes' })
  }
})

// GET /api/salidas-nc/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM salidas_nc WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Salida NC no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener salida NC' })
  }
})

// POST /api/salidas-nc
router.post('/', requirePermission('salidas_nc', 'crear'), async (req: AuthRequest, res: Response) => {
  const { codigo, descripcion, proceso, detectado_en, disposicion,
          responsable, fecha, accion_tomada, verificado_por, estado, nc_id,
          cliente_informado, fecha_notificacion_cliente,
          concesion_otorgada, concesion_autorizada_por, fecha_concesion,
          observaciones_concesion } = req.body
  if (!codigo || !descripcion || !detectado_en || !disposicion) {
    return res.status(400).json({
      error: 'codigo, descripcion, detectado_en y disposicion son requeridos'
    })
  }
  if (concesion_otorgada && !concesion_autorizada_por) {
    return res.status(400).json({
      error: 'concesion_autorizada_por es requerido cuando se otorga una concesión'
    })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO salidas_nc
         (codigo, descripcion, proceso, detectado_en, disposicion,
          responsable, fecha, accion_tomada, verificado_por, estado, nc_id, creado_por, tenant_id,
          cliente_informado, fecha_notificacion_cliente,
          concesion_otorgada, concesion_autorizada_por, fecha_concesion, observaciones_concesion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [
        codigo,
        descripcion,
        proceso         || null,
        detectado_en,
        disposicion,
        responsable     || null,
        fecha           || new Date().toISOString().slice(0, 10),
        accion_tomada   || null,
        verificado_por  || null,
        estado          || 'Abierta',
        nc_id           || null,
        req.user?.id    || null,
        req.user!.tenantId,
        !!cliente_informado,
        fecha_notificacion_cliente || null,
        !!concesion_otorgada,
        concesion_autorizada_por   || null,
        fecha_concesion            || null,
        observaciones_concesion    || null,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear salida NC' })
  }
})

// PUT /api/salidas-nc/:id
router.put('/:id', requirePermission('salidas_nc', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { descripcion, proceso, detectado_en, disposicion,
          responsable, fecha, accion_tomada, verificado_por, estado, nc_id,
          cliente_informado, fecha_notificacion_cliente,
          concesion_otorgada, concesion_autorizada_por, fecha_concesion,
          observaciones_concesion } = req.body
  if (concesion_otorgada && !concesion_autorizada_por) {
    return res.status(400).json({
      error: 'concesion_autorizada_por es requerido cuando se otorga una concesión'
    })
  }
  try {
    const { rows } = await pool.query(
      `UPDATE salidas_nc
       SET descripcion=$1, proceso=$2, detectado_en=$3, disposicion=$4,
           responsable=$5, fecha=$6, accion_tomada=$7, verificado_por=$8,
           estado=$9, nc_id=$10,
           cliente_informado=$11, fecha_notificacion_cliente=$12,
           concesion_otorgada=$13, concesion_autorizada_por=$14,
           fecha_concesion=$15, observaciones_concesion=$16
       WHERE id=$17 AND tenant_id=$18 RETURNING *`,
      [descripcion, proceso || null, detectado_en, disposicion,
       responsable || null, fecha, accion_tomada || null,
       verificado_por || null, estado, nc_id || null,
       !!cliente_informado, fecha_notificacion_cliente || null,
       !!concesion_otorgada, concesion_autorizada_por || null,
       fecha_concesion || null, observaciones_concesion || null,
       id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Salida NC no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar salida NC' })
  }
})

// DELETE /api/salidas-nc/:id
router.delete('/:id', requirePermission('salidas_nc', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM salidas_nc WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Salida NC no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar salida NC' })
  }
})

export default router
