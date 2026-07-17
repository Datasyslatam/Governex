import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { resolveFileUrl } from '../services/storageService'

const router = Router()
router.use(authMiddleware)

/* ══════════════════════════════════════════════════════════════
   EVIDENCIAS (metadata; el archivo binario vive en el bucket externo,
   aquí solo se guarda la KEY devuelta por /api/uploads)
   ══════════════════════════════════════════════════════════════ */

// GET /api/riesgo-evidencias/:codigo
router.get('/:codigo', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    const { rows } = await pool.query(
      `SELECT * FROM riesgo_evidencias WHERE riesgo_codigo=$1 AND tenant_id=$2 ORDER BY subido_en DESC`,
      [req.params.codigo, tenantId]
    )
    const withSignedUrls = await Promise.all(
      rows.map(async (r) => ({ ...r, url: await resolveFileUrl(r.url, tenantId) }))
    )
    res.json(withSignedUrls)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener evidencias' })
  }
})

// POST /api/riesgo-evidencias
router.post('/', requirePermission('riesgos', 'crear'), async (req: AuthRequest, res: Response) => {
  const { riesgoCodigo, nombreArchivo, url, tipoMime, tamanoBytes } = req.body
  if (!riesgoCodigo || !nombreArchivo || !url) {
    return res.status(400).json({ error: 'riesgoCodigo, nombreArchivo y url son requeridos' })
  }
  try {
    const tenantId = req.user!.tenantId
    const { rowCount } = await pool.query(
      'SELECT 1 FROM riesgos WHERE codigo = $1 AND tenant_id = $2', [riesgoCodigo, tenantId]
    )
    if (!rowCount) return res.status(400).json({ error: 'riesgoCodigo no pertenece a tu organización' })

    const { rows } = await pool.query(
      `INSERT INTO riesgo_evidencias (riesgo_codigo, nombre_archivo, url, tipo_mime, tamano_bytes, subido_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [riesgoCodigo, nombreArchivo, url, tipoMime || null, tamanoBytes || null, req.user?.id || null, tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar evidencia' })
  }
})

// DELETE /api/riesgo-evidencias/:id
router.delete('/:id', requirePermission('riesgos', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM riesgo_evidencias WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId])
    if (!rowCount) return res.status(404).json({ error: 'Evidencia no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar evidencia' })
  }
})

/* ══════════════════════════════════════════════════════════════
   OVERRIDES DE EFICACIA / RESPONSABLE / ESTADO
   (riesgos derivados dinámicamente en el frontend, no existen
   como filas en la tabla `riesgos`)
   ══════════════════════════════════════════════════════════════ */

// GET /api/riesgo-evidencias/eficacia/todos
router.get('/eficacia/todos', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM riesgo_eficacia WHERE tenant_id = $1`, [req.user!.tenantId])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener overrides de eficacia' })
  }
})

// PUT /api/riesgo-evidencias/eficacia/:codigo  (upsert)
router.put('/eficacia/:codigo', requirePermission('riesgos', 'editar'), async (req: AuthRequest, res: Response) => {
  const { codigo } = req.params
  const { eficaciaPct, responsableOverride, estadoOverride } = req.body
  try {
    const tenantId = req.user!.tenantId
    // ON CONFLICT usa la PK compuesta (tenant_id, riesgo_codigo) creada en la
    // migración multi-tenant, para que el upsert de un tenant nunca pueda
    // pisar el override de eficacia de otro tenant con el mismo código de riesgo.
    const { rows } = await pool.query(
      `INSERT INTO riesgo_eficacia (tenant_id, riesgo_codigo, eficacia_pct, responsable_override, estado_override)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tenant_id, riesgo_codigo) DO UPDATE SET
         eficacia_pct = COALESCE(EXCLUDED.eficacia_pct, riesgo_eficacia.eficacia_pct),
         responsable_override = COALESCE(EXCLUDED.responsable_override, riesgo_eficacia.responsable_override),
         estado_override = COALESCE(EXCLUDED.estado_override, riesgo_eficacia.estado_override),
         actualizado_en = NOW()
       RETURNING *`,
      [tenantId, codigo, eficaciaPct ?? 0, responsableOverride || null, estadoOverride || null]
    )
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar override de riesgo' })
  }
})

export default router