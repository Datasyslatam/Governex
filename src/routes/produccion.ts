import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

/* ══════════════════════════════════════════════════════════════
   ÓRDENES DE PRODUCCIÓN / SERVICIO — §8.5
   ══════════════════════════════════════════════════════════════ */

// GET /api/produccion
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    const { rows } = await pool.query(
      `SELECT op.*,
              u.nombre AS creado_por_nombre,
              ft.producto_servicio AS ficha_tecnica_producto,
              ft.version           AS ficha_tecnica_version,
              ft.estado            AS ficha_tecnica_estado,
              doc.codigo           AS documento_instructivo_codigo,
              doc.titulo           AS documento_instructivo_titulo,
              doc.version          AS documento_instructivo_version,
              doc.estado           AS documento_instructivo_estado,
              lib.decision         AS liberacion_decision,
              lib.fecha            AS liberacion_fecha,
              COALESCE(pc.total, 0)        AS puntos_control_total,
              COALESCE(pc.no_conformes, 0) AS puntos_control_no_conformes,
              COALESCE(pc.pendientes, 0)   AS puntos_control_pendientes
       FROM ordenes_produccion op
       LEFT JOIN usuarios u          ON u.id = op.creado_por
       LEFT JOIN fichas_tecnicas_ps ft ON ft.id = op.ficha_tecnica_id AND ft.tenant_id = op.tenant_id
       LEFT JOIN documentos doc       ON doc.id = op.documento_instructivo_id AND doc.tenant_id = op.tenant_id
       LEFT JOIN LATERAL (
         SELECT decision, fecha FROM liberaciones_ps l
         WHERE l.codigo_op = op.codigo AND l.tenant_id = op.tenant_id
         ORDER BY l.creado_en DESC LIMIT 1
       ) lib ON true
       LEFT JOIN (
         SELECT orden_produccion_id,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE resultado = 'No conforme')::int AS no_conformes,
                COUNT(*) FILTER (WHERE resultado = 'Pendiente')::int   AS pendientes
         FROM puntos_control_produccion
         WHERE tenant_id = $1
         GROUP BY orden_produccion_id
       ) pc ON pc.orden_produccion_id = op.id
       WHERE op.tenant_id = $1
       ORDER BY op.creado_en DESC`,
      [tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener órdenes de producción' })
  }
})

// GET /api/produccion/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ordenes_produccion WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener orden' })
  }
})

// POST /api/produccion
router.post('/', requirePermission('produccion', 'crear'), async (req: AuthRequest, res: Response) => {
  const { codigo, producto_servicio, cliente, cantidad, instruccion_trabajo,
          equipos, responsable, fecha_inicio, fecha_entrega, etapa, conformidad,
          ficha_tecnica_id, documento_instructivo_id, infraestructura_ambiente,
          personal_asignado, seguimiento_postventa, fecha_postventa } = req.body
  if (!codigo || !producto_servicio) {
    return res.status(400).json({ error: 'codigo y producto_servicio son requeridos' })
  }
  try {
    const tenantId = req.user!.tenantId

    if (ficha_tecnica_id) {
      const { rowCount } = await pool.query(
        'SELECT 1 FROM fichas_tecnicas_ps WHERE id=$1 AND tenant_id=$2', [ficha_tecnica_id, tenantId]
      )
      if (!rowCount) return res.status(400).json({ error: 'ficha_tecnica_id no pertenece a tu organización' })
    }
    if (documento_instructivo_id) {
      const { rowCount } = await pool.query(
        'SELECT 1 FROM documentos WHERE id=$1 AND tenant_id=$2', [documento_instructivo_id, tenantId]
      )
      if (!rowCount) return res.status(400).json({ error: 'documento_instructivo_id no pertenece a tu organización' })
    }

    const { rows } = await pool.query(
      `INSERT INTO ordenes_produccion
         (codigo, producto_servicio, cliente, cantidad, instruccion_trabajo,
          equipos, responsable, fecha_inicio, fecha_entrega, etapa, conformidad,
          ficha_tecnica_id, documento_instructivo_id, infraestructura_ambiente,
          personal_asignado, seguimiento_postventa, fecha_postventa,
          creado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [
        codigo,
        producto_servicio,
        cliente              || null,
        cantidad             || null,
        instruccion_trabajo  || null,
        equipos              || null,
        responsable          || null,
        fecha_inicio         || null,
        fecha_entrega        || null,
        etapa                || 'Programado',
        conformidad          || 'Pendiente inspección',
        ficha_tecnica_id            || null,
        documento_instructivo_id    || null,
        infraestructura_ambiente    || null,
        JSON.stringify(personal_asignado || []),
        seguimiento_postventa       || null,
        fecha_postventa             || null,
        req.user?.id         || null,
        tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de orden ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear orden de producción' })
  }
})

// PUT /api/produccion/:id
router.put('/:id', requirePermission('produccion', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { producto_servicio, cliente, cantidad, instruccion_trabajo,
          equipos, responsable, fecha_inicio, fecha_entrega, etapa, conformidad,
          ficha_tecnica_id, documento_instructivo_id, infraestructura_ambiente,
          personal_asignado, seguimiento_postventa, fecha_postventa } = req.body
  try {
    const tenantId = req.user!.tenantId

    if (ficha_tecnica_id) {
      const { rowCount } = await pool.query(
        'SELECT 1 FROM fichas_tecnicas_ps WHERE id=$1 AND tenant_id=$2', [ficha_tecnica_id, tenantId]
      )
      if (!rowCount) return res.status(400).json({ error: 'ficha_tecnica_id no pertenece a tu organización' })
    }
    if (documento_instructivo_id) {
      const { rowCount } = await pool.query(
        'SELECT 1 FROM documentos WHERE id=$1 AND tenant_id=$2', [documento_instructivo_id, tenantId]
      )
      if (!rowCount) return res.status(400).json({ error: 'documento_instructivo_id no pertenece a tu organización' })
    }

    const { rows } = await pool.query(
      `UPDATE ordenes_produccion
       SET producto_servicio=$1, cliente=$2, cantidad=$3, instruccion_trabajo=$4,
           equipos=$5, responsable=$6, fecha_inicio=$7, fecha_entrega=$8,
           etapa=$9, conformidad=$10, ficha_tecnica_id=$11, documento_instructivo_id=$12,
           infraestructura_ambiente=$13, personal_asignado=$14, seguimiento_postventa=$15,
           fecha_postventa=$16
       WHERE id=$17 AND tenant_id=$18 RETURNING *`,
      [producto_servicio, cliente || null, cantidad || null,
       instruccion_trabajo || null, equipos || null, responsable || null,
       fecha_inicio || null, fecha_entrega || null, etapa, conformidad,
       ficha_tecnica_id || null, documento_instructivo_id || null,
       infraestructura_ambiente || null, JSON.stringify(personal_asignado || []),
       seguimiento_postventa || null, fecha_postventa || null,
       id, tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar orden' })
  }
})

// DELETE /api/produccion/:id
router.delete('/:id', requirePermission('produccion', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM ordenes_produccion WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Orden no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar orden' })
  }
})

/* ══════════════════════════════════════════════════════════════
   PUNTOS DE CONTROL — Seguimiento y medición durante el proceso
   (§8.5.1 b). Interfaz para ingresar la data de los controles.
   ══════════════════════════════════════════════════════════════ */

// GET /api/produccion/:id/puntos-control
router.get('/:id/puntos-control', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    const { rowCount } = await pool.query(
      'SELECT 1 FROM ordenes_produccion WHERE id=$1 AND tenant_id=$2', [req.params.id, tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Orden no encontrada' })

    const { rows } = await pool.query(
      `SELECT pc.*, u.nombre AS registrado_por_nombre
       FROM puntos_control_produccion pc
       LEFT JOIN usuarios u ON u.id = pc.registrado_por
       WHERE pc.orden_produccion_id=$1 AND pc.tenant_id=$2
       ORDER BY pc.fecha DESC, pc.id DESC`,
      [req.params.id, tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener puntos de control' })
  }
})

// POST /api/produccion/:id/puntos-control
router.post('/:id/puntos-control', requirePermission('produccion', 'crear'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { punto_control, parametro, criterio_aceptacion, valor_medido, unidad,
          instrumento_medicion, resultado, responsable, fecha, observaciones } = req.body
  if (!punto_control) return res.status(400).json({ error: 'punto_control es requerido' })
  try {
    const tenantId = req.user!.tenantId
    const { rowCount } = await pool.query(
      'SELECT 1 FROM ordenes_produccion WHERE id=$1 AND tenant_id=$2', [id, tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Orden no encontrada' })

    const { rows } = await pool.query(
      `INSERT INTO puntos_control_produccion
         (orden_produccion_id, punto_control, parametro, criterio_aceptacion,
          valor_medido, unidad, instrumento_medicion, resultado, responsable,
          fecha, observaciones, registrado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        id, punto_control, parametro || null, criterio_aceptacion || null,
        valor_medido || null, unidad || null, instrumento_medicion || null,
        resultado || 'Pendiente', responsable || null,
        fecha || new Date().toISOString(), observaciones || null,
        req.user?.id || null, tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar el punto de control' })
  }
})

// DELETE /api/produccion/puntos-control/:pcId
router.delete('/puntos-control/:pcId', requirePermission('produccion', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM puntos_control_produccion WHERE id=$1 AND tenant_id=$2',
      [req.params.pcId, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Punto de control no encontrado' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar el punto de control' })
  }
})

export default router
