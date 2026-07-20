import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { resolveFileUrl } from '../services/storageService'

const router = Router()
router.use(authMiddleware)

/* ══════════════════════════════════════════════════════════════
   PQRS
   ══════════════════════════════════════════════════════════════ */

// GET /api/enfoque-cliente/pqrs
router.get('/pqrs', requirePermission('enfoque_cliente', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM pqrs_enfoque_cliente WHERE tenant_id = $1 ORDER BY creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener PQRS' })
  }
})

// POST /api/enfoque-cliente/pqrs
router.post('/pqrs', requirePermission('enfoque_cliente', 'crear'), async (req: AuthRequest, res: Response) => {
  const { tipo, origen, fecha, descripcion, estado } = req.body
  if (!tipo || !origen || !descripcion) {
    return res.status(400).json({ error: 'tipo, origen y descripcion son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO pqrs_enfoque_cliente (tipo, origen, fecha, descripcion, estado, creado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tipo, origen, fecha || new Date().toISOString().slice(0, 10),
       descripcion, estado || 'Abierta', req.user?.id || null, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear PQRS' })
  }
})

// PUT /api/enfoque-cliente/pqrs/:id  (usado para cambiar estado)
router.put('/pqrs/:id', requirePermission('enfoque_cliente', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { tipo, origen, fecha, descripcion, estado } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE pqrs_enfoque_cliente
       SET tipo=$1, origen=$2, fecha=$3, descripcion=$4, estado=$5
       WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [tipo, origen, fecha, descripcion, estado, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'PQRS no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar PQRS' })
  }
})

// DELETE /api/enfoque-cliente/pqrs/:id
router.delete('/pqrs/:id', requirePermission('enfoque_cliente', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM pqrs_enfoque_cliente WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId])
    if (!rowCount) return res.status(404).json({ error: 'PQRS no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar PQRS' })
  }
})

/* ══════════════════════════════════════════════════════════════
   ARCHIVOS SUBIDOS (encuestas respondidas / PQRS en PDF)
   ══════════════════════════════════════════════════════════════ */

// GET /api/enfoque-cliente/archivos
router.get('/archivos', requirePermission('enfoque_cliente', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    const { rows } = await pool.query(
      `SELECT * FROM archivos_enfoque_cliente WHERE tenant_id = $1 ORDER BY subido_en DESC`,
      [tenantId]
    )
    const withSignedUrls = await Promise.all(
      rows.map(async (a) => ({ ...a, url: await resolveFileUrl(a.url, tenantId) }))
    )
    res.json(withSignedUrls)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener archivos' })
  }
})

// POST /api/enfoque-cliente/archivos
router.post('/archivos', requirePermission('enfoque_cliente', 'crear'), async (req: AuthRequest, res: Response) => {
  const { nombre, tipo, url, tipoMime, tamanoBytes } = req.body
  if (!nombre || !tipo || !url) {
    return res.status(400).json({ error: 'nombre, tipo y url son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO archivos_enfoque_cliente (nombre, tipo, url, tipo_mime, tamano_bytes, subido_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nombre, tipo, url, tipoMime || null, tamanoBytes || null, req.user?.id || null, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar archivo' })
  }
})

// DELETE /api/enfoque-cliente/archivos/:id  (borra también sus respuestas asociadas)
router.delete('/archivos/:id', requirePermission('enfoque_cliente', 'eliminar'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenantId
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM respuestas_encuesta_satisfaccion WHERE archivo_id=$1 AND tenant_id=$2', [req.params.id, tenantId])
    const { rowCount } = await client.query('DELETE FROM archivos_enfoque_cliente WHERE id=$1 AND tenant_id=$2', [req.params.id, tenantId])
    await client.query('COMMIT')
    if (!rowCount) return res.status(404).json({ error: 'Archivo no encontrado' })
    res.status(204).send()
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar archivo' })
  } finally {
    client.release()
  }
})

/* ══════════════════════════════════════════════════════════════
   RESPUESTAS DE ENCUESTA (extraídas del PDF diligenciado)
   ══════════════════════════════════════════════════════════════ */

// GET /api/enfoque-cliente/respuestas
router.get('/respuestas', requirePermission('enfoque_cliente', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM respuestas_encuesta_satisfaccion WHERE tenant_id = $1 ORDER BY creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener respuestas' })
  }
})

// POST /api/enfoque-cliente/respuestas
router.post('/respuestas', requirePermission('enfoque_cliente', 'crear'), async (req: AuthRequest, res: Response) => {
  const { archivoId, archivoNombre, tipo, campos, nombreEncuestado, fecha } = req.body
  if (!archivoNombre || !tipo || !campos) {
    return res.status(400).json({ error: 'archivoNombre, tipo y campos son requeridos' })
  }
  try {
    const tenantId = req.user!.tenantId
    if (archivoId) {
      const { rowCount } = await pool.query(
        'SELECT 1 FROM archivos_enfoque_cliente WHERE id = $1 AND tenant_id = $2', [archivoId, tenantId]
      )
      if (!rowCount) return res.status(400).json({ error: 'archivoId no pertenece a tu organización' })
    }
    const { rows } = await pool.query(
      `INSERT INTO respuestas_encuesta_satisfaccion
         (archivo_id, archivo_nombre, tipo, campos, nombre_encuestado, fecha, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [archivoId || null, archivoNombre, tipo, JSON.stringify(campos),
       nombreEncuestado || null, fecha || null, tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar respuesta de encuesta' })
  }
})

/* ── Análisis DOFA Persistente ───────────────────────────────── */

// GET /api/enfoque-cliente/analisis
router.get('/analisis', requirePermission('enfoque_cliente', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT resumen_ejecutivo, dofa, documentos_analizados, creado_en 
       FROM analisis_enfoque_cliente 
       WHERE tenant_id = $1 
       ORDER BY creado_en DESC LIMIT 1`,
      [req.user!.tenantId]
    )
    if (rows.length === 0) {
      return res.json(null)
    }
    res.json({
      resumenEjecutivo: rows[0].resumen_ejecutivo,
      dofa: rows[0].dofa,
      documentos: rows[0].documentos_analizados,
      creadoEn: rows[0].creado_en
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener el análisis de enfoque al cliente' })
  }
})

// POST /api/enfoque-cliente/analisis
router.post('/analisis', requirePermission('enfoque_cliente', 'crear'), async (req: AuthRequest, res: Response) => {
  const { resumenEjecutivo, dofa, documentos } = req.body
  if (!resumenEjecutivo || !Array.isArray(dofa)) {
    return res.status(400).json({ error: 'resumenEjecutivo y dofa son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO analisis_enfoque_cliente (tenant_id, resumen_ejecutivo, dofa, documentos_analizados, creado_por)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        req.user!.tenantId,
        resumenEjecutivo,
        JSON.stringify(dofa),
        JSON.stringify(documentos || []),
        req.user?.id || null
      ]
    )
    res.status(201).json({
      resumenEjecutivo: rows[0].resumen_ejecutivo,
      dofa: rows[0].dofa,
      documentos: rows[0].documentos_analizados,
      creadoEn: rows[0].creado_en
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al guardar el análisis de enfoque al cliente' })
  }
})

export default router