import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)



/* ══════════════════════════════════════════════════════════════
   FICHAS TÉCNICAS (generales o educativas)
   ══════════════════════════════════════════════════════════════ */

// GET /api/requerimientos-ps/fichas-tecnicas
router.get('/fichas-tecnicas', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM fichas_tecnicas_ps WHERE tenant_id = $1 ORDER BY creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener fichas técnicas' })
  }
})

// POST /api/requerimientos-ps/fichas-tecnicas
router.post('/fichas-tecnicas', requirePermission('requerimientos_ps', 'crear'), async (req: AuthRequest, res: Response) => {
  const {
    id, tipo, generadaConIA, cliente, productoServicio, version, fechaElaboracion,
    elaboradoPor, aprobadoPor, estado, descripcion, especificacionesTecnicas,
    normasAplicables, condicionesUso, areaAsignatura, objetivoGeneral, competencias,
    unidadesCurriculares, totalHorasSemana, observaciones,
  } = req.body

  if (!id || !tipo) return res.status(400).json({ error: 'id y tipo son requeridos' })

  try {
    // El id lo genera el frontend (string libre); el UNIQUE ahora es
    // compuesto (tenant_id, id), así que dos tenants sí pueden coincidir
    // en el mismo id sin chocar entre sí.
    const { rows } = await pool.query(
      `INSERT INTO fichas_tecnicas_ps
         (id, tipo, generada_con_ia, cliente, producto_servicio, version, fecha_elaboracion,
          elaborado_por, aprobado_por, estado, descripcion, especificaciones_tecnicas,
          normas_aplicables, condiciones_uso, area_asignatura, objetivo_general, competencias,
          unidades_curriculares, total_horas_semana, observaciones, creado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        id, tipo, generadaConIA ?? true, cliente || null, productoServicio || null,
        version || '1.0', fechaElaboracion || null, elaboradoPor || null, aprobadoPor || null,
        estado || 'En revisión', descripcion || null, especificacionesTecnicas || null,
        normasAplicables || null, condicionesUso || null, areaAsignatura || null,
        objetivoGeneral || null, competencias || null,
        JSON.stringify(unidadesCurriculares || []), totalHorasSemana || 0,
        observaciones || null, req.user?.id || null, req.user!.tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una ficha con ese id' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear ficha técnica' })
  }
})

// PUT /api/requerimientos-ps/fichas-tecnicas/:id
router.put('/fichas-tecnicas/:id', requirePermission('requerimientos_ps', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const {
    tipo, cliente, productoServicio, version, fechaElaboracion, elaboradoPor, aprobadoPor,
    estado, descripcion, especificacionesTecnicas, normasAplicables, condicionesUso,
    areaAsignatura, objetivoGeneral, competencias, unidadesCurriculares, totalHorasSemana,
    observaciones,
  } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE fichas_tecnicas_ps SET
         tipo=$1, cliente=$2, producto_servicio=$3, version=$4, fecha_elaboracion=$5,
         elaborado_por=$6, aprobado_por=$7, estado=$8, descripcion=$9, especificaciones_tecnicas=$10,
         normas_aplicables=$11, condiciones_uso=$12, area_asignatura=$13, objetivo_general=$14,
         competencias=$15, unidades_curriculares=$16, total_horas_semana=$17, observaciones=$18
       WHERE id=$19 AND tenant_id=$20 RETURNING *`,
      [
        tipo, cliente || null, productoServicio || null, version || '1.0',
        fechaElaboracion || null, elaboradoPor || null, aprobadoPor || null, estado,
        descripcion || null, especificacionesTecnicas || null, normasAplicables || null,
        condicionesUso || null, areaAsignatura || null, objetivoGeneral || null,
        competencias || null, JSON.stringify(unidadesCurriculares || []),
        totalHorasSemana || 0, observaciones || null, id, req.user!.tenantId,
      ]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Ficha no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar ficha técnica' })
  }
})

// DELETE /api/requerimientos-ps/fichas-tecnicas/:id
router.delete('/fichas-tecnicas/:id', requirePermission('requerimientos_ps', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM fichas_tecnicas_ps WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId])
    if (!rowCount) return res.status(404).json({ error: 'Ficha no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar ficha técnica' })
  }
})

// GET /api/requerimientos-ps
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT rp.*, u.nombre AS creado_por_nombre
       FROM requerimientos_ps rp
       LEFT JOIN usuarios u ON u.id = rp.creado_por
       WHERE rp.tenant_id = $1
       ORDER BY rp.creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener requerimientos' })
  }
})

// GET /api/requerimientos-ps/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM requerimientos_ps WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Requerimiento no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener requerimiento' })
  }
})

// POST /api/requerimientos-ps
router.post('/', requirePermission('requerimientos_ps', 'crear'), async (req: AuthRequest, res: Response) => {
  const { cliente, producto_servicio, requisitos_cliente, requisitos_legales,
          requisitos_org, fecha_revision, revisado_por, estado,
          ficha_tecnica_id, generado_con_ia } = req.body   // ← agregado
  if (!cliente || !producto_servicio) {
    return res.status(400).json({ error: 'cliente y producto_servicio son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO requerimientos_ps
         (cliente, producto_servicio, requisitos_cliente, requisitos_legales,
          requisitos_org, fecha_revision, revisado_por, estado, ficha_tecnica_id, generado_con_ia, creado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        cliente, producto_servicio,
        requisitos_cliente  || null,
        requisitos_legales  || null,
        requisitos_org      || null,
        fecha_revision      || null,
        revisado_por        || null,
        estado              || 'Pendiente',
        ficha_tecnica_id    || null,
        generado_con_ia     ?? false,
        req.user?.id        || null,
        req.user!.tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear requerimiento' })
  }
})

// PUT /api/requerimientos-ps/:id
router.put('/:id', requirePermission('requerimientos_ps', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { cliente, producto_servicio, requisitos_cliente, requisitos_legales,
          requisitos_org, fecha_revision, revisado_por, estado, ficha_tecnica_id } = req.body   // ← agregado
  try {
    const { rows } = await pool.query(
      `UPDATE requerimientos_ps
       SET cliente=$1, producto_servicio=$2, requisitos_cliente=$3,
           requisitos_legales=$4, requisitos_org=$5, fecha_revision=$6,
           revisado_por=$7, estado=$8, ficha_tecnica_id=$9
       WHERE id=$10 AND tenant_id=$11 RETURNING *`,
      [cliente, producto_servicio, requisitos_cliente || null,
       requisitos_legales || null, requisitos_org || null,
       fecha_revision || null, revisado_por || null, estado, ficha_tecnica_id || null, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Requerimiento no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar requerimiento' })
  }
})

// DELETE /api/requerimientos-ps/:id
router.delete('/:id', requirePermission('requerimientos_ps', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM requerimientos_ps WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Requerimiento no encontrado' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar requerimiento' })
  }
})

export default router
