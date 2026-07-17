import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { resolveFileUrl } from '../services/storageService'

const router = Router()
router.use(authMiddleware)

// GET /api/compras
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT oc.*,
              pv.razon AS proveedor_razon,
              u.nombre AS creado_por_nombre
       FROM ordenes_compra oc
       LEFT JOIN proveedores pv ON pv.id = oc.proveedor_id
       LEFT JOIN usuarios u    ON u.id  = oc.creado_por
       WHERE oc.tenant_id = $1
       ORDER BY oc.creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener órdenes de compra' })
  }
})

// GET /api/compras/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT oc.*, pv.razon AS proveedor_razon
       FROM ordenes_compra oc
       LEFT JOIN proveedores pv ON pv.id = oc.proveedor_id
       WHERE oc.id=$1 AND oc.tenant_id=$2`,
      [req.params.id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener orden' })
  }
})

// POST /api/compras
router.post('/', requirePermission('compras', 'crear'), async (req: AuthRequest, res: Response) => {
  const { proveedor_id, proveedor, producto, cantidad, unidad,
          precio_unit, total, fecha_emision, fecha_entrega,
          requisitos, responsable, estado, observaciones } = req.body
  if (!proveedor || !producto) {
    return res.status(400).json({ error: 'proveedor y producto son requeridos' })
  }
  try {
    const tenantId = req.user!.tenantId
    if (proveedor_id) {
      const { rowCount } = await pool.query(
        'SELECT 1 FROM proveedores WHERE id = $1 AND tenant_id = $2', [proveedor_id, tenantId]
      )
      if (!rowCount) return res.status(400).json({ error: 'proveedor_id no pertenece a tu organización' })
    }
    const { rows } = await pool.query(
      `INSERT INTO ordenes_compra
         (proveedor_id, proveedor, producto, cantidad, unidad, precio_unit, total,
          fecha_emision, fecha_entrega, requisitos, responsable, estado, observaciones, creado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        proveedor_id   || null,
        proveedor,
        producto,
        cantidad       || null,
        unidad         || null,
        precio_unit    || null,
        total          || null,
        fecha_emision  || null,
        fecha_entrega  || null,
        requisitos     || null,
        responsable    || null,
        estado         || 'Pendiente',
        observaciones  || null,
        req.user?.id   || null,
        tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear orden de compra' })
  }
})

// PUT /api/compras/:id
router.put('/:id', requirePermission('compras', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { proveedor_id, proveedor, producto, cantidad, unidad,
          precio_unit, total, fecha_emision, fecha_entrega,
          requisitos, responsable, estado, observaciones } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE ordenes_compra
       SET proveedor_id=$1, proveedor=$2, producto=$3, cantidad=$4, unidad=$5,
           precio_unit=$6, total=$7, fecha_emision=$8, fecha_entrega=$9,
           requisitos=$10, responsable=$11, estado=$12, observaciones=$13
       WHERE id=$14 AND tenant_id=$15 RETURNING *`,
      [proveedor_id || null, proveedor, producto, cantidad || null, unidad || null,
       precio_unit || null, total || null, fecha_emision || null, fecha_entrega || null,
       requisitos || null, responsable || null, estado, observaciones || null, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar orden' })
  }
})

// DELETE /api/compras/:id
router.delete('/:id', requirePermission('compras', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM ordenes_compra WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Orden no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar orden' })
  }
})

/* ══════════════════════════════════════════════════════════════
   FICHAS TÉCNICAS DE COMPRA
   ══════════════════════════════════════════════════════════════ */

// GET /api/compras/fichas-tecnicas
router.get('/fichas-tecnicas', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    const { rows } = await pool.query(
      `SELECT ft.*, u.nombre AS creado_por_nombre
       FROM fichas_tecnicas_compra ft
       LEFT JOIN usuarios u ON u.id = ft.creado_por
       WHERE ft.tenant_id = $1
       ORDER BY ft.creado_en DESC`,
      [tenantId]
    )
    // documentos_requeridos es un array JSON [{ nombre, url }] donde `url`
    // en realidad guarda la KEY de R2 (mismo criterio que archivo_url en
    // otras tablas). Se firma cada entrada del array antes de responder.
    const withSignedUrls = await Promise.all(
      rows.map(async (ft) => {
        const docs = Array.isArray(ft.documentos_requeridos) ? ft.documentos_requeridos : []
        const signedDocs = await Promise.all(
          docs.map(async (d: { nombre: string; url: string }) => ({
            nombre: d.nombre,
            url: await resolveFileUrl(d.url, tenantId),
          }))
        )
        return { ...ft, documentos_requeridos: signedDocs }
      })
    )
    res.json(withSignedUrls)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener fichas técnicas' })
  }
})

// POST /api/compras/fichas-tecnicas
router.post('/fichas-tecnicas', requirePermission('compras', 'crear'), async (req: AuthRequest, res: Response) => {
  const { nombre, descripcion, especificaciones, unidadMedida, cantidadMinima,
          documentosRequeridos, responsable, fechaCreacion } = req.body
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO fichas_tecnicas_compra
         (nombre, descripcion, especificaciones, unidad_medida, cantidad_minima,
          documentos_requeridos, responsable, fecha_creacion, creado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        nombre, descripcion || null, especificaciones || null,
        unidadMedida || null, cantidadMinima || null,
        JSON.stringify(documentosRequeridos || []),
        responsable || null, fechaCreacion || new Date().toISOString().slice(0, 10),
        req.user?.id || null, req.user!.tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear ficha técnica' })
  }
})

// PUT /api/compras/fichas-tecnicas/:id
router.put('/fichas-tecnicas/:id', requirePermission('compras', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { nombre, descripcion, especificaciones, unidadMedida, cantidadMinima,
          documentosRequeridos, responsable } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE fichas_tecnicas_compra
       SET nombre=$1, descripcion=$2, especificaciones=$3, unidad_medida=$4,
           cantidad_minima=$5, documentos_requeridos=$6, responsable=$7
       WHERE id=$8 AND tenant_id=$9 RETURNING *`,
      [nombre, descripcion || null, especificaciones || null, unidadMedida || null,
       cantidadMinima || null, JSON.stringify(documentosRequeridos || []), responsable || null, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Ficha no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar ficha técnica' })
  }
})

// DELETE /api/compras/fichas-tecnicas/:id
router.delete('/fichas-tecnicas/:id', requirePermission('compras', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM fichas_tecnicas_compra WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId])
    if (!rowCount) return res.status(404).json({ error: 'Ficha no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar ficha técnica' })
  }
})

/* ══════════════════════════════════════════════════════════════
   EVALUACIONES DE PROVEEDOR POR ORDEN DE COMPRA
   ══════════════════════════════════════════════════════════════ */

// GET /api/compras/evaluaciones
router.get('/evaluaciones', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, oc.producto AS orden_producto
       FROM evaluaciones_orden_compra e
       LEFT JOIN ordenes_compra oc ON oc.id = e.orden_id
       WHERE e.tenant_id = $1
       ORDER BY e.fecha_evaluacion DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener evaluaciones' })
  }
})

// POST /api/compras/evaluaciones
router.post('/evaluaciones', requirePermission('compras', 'crear'), async (req: AuthRequest, res: Response) => {
  const { ordenId, proveedor, producto, calidad, tiempoEntrega, diasRetraso,
          precio, capacidadRespuesta, puntajeGlobal, observaciones } = req.body
  if (!ordenId || !proveedor || !producto) {
    return res.status(400).json({ error: 'ordenId, proveedor y producto son requeridos' })
  }
  try {
    const tenantId = req.user!.tenantId
    const { rowCount } = await pool.query(
      'SELECT 1 FROM ordenes_compra WHERE id = $1 AND tenant_id = $2', [ordenId, tenantId]
    )
    if (!rowCount) return res.status(400).json({ error: 'ordenId no pertenece a tu organización' })

    const { rows } = await pool.query(
      `INSERT INTO evaluaciones_orden_compra
         (orden_id, proveedor, producto, calidad, tiempo_entrega, dias_retraso,
          precio, capacidad_respuesta, puntaje_global, observaciones, creado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        ordenId, proveedor, producto, calidad, tiempoEntrega, diasRetraso || 0,
        precio, capacidadRespuesta, puntajeGlobal, observaciones || null, req.user?.id || null, tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear evaluación' })
  }
})

// DELETE /api/compras/evaluaciones/:id
router.delete('/evaluaciones/:id', requirePermission('compras', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM evaluaciones_orden_compra WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId])
    if (!rowCount) return res.status(404).json({ error: 'Evaluación no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar evaluación' })
  }
})

export default router
