import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { resolveFileUrl } from '../services/storageService'

const router = Router()
router.use(authMiddleware)

// GET /api/documentos
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    const { rows } = await pool.query(
      `SELECT d.*, p.nombre AS proceso_nombre
       FROM documentos d
       LEFT JOIN procesos p ON p.id = d.proceso_id
       WHERE d.tenant_id = $1
       ORDER BY d.codigo`,
      [tenantId]
    )
    // archivo_url en BD guarda la KEY de R2, no una URL pública; se firma
    // una URL de descarga temporal solo para los documentos de este tenant.
    const withSignedUrls = await Promise.all(
      rows.map(async (d) => ({ ...d, archivo_url: await resolveFileUrl(d.archivo_url, tenantId) }))
    )
    res.json(withSignedUrls)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener documentos' })
  }
})

// GET /api/documentos/:id/versiones
router.get('/:id/versiones', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    const { rows } = await pool.query(
      `SELECT dv.*, u.nombre AS autor_nombre
       FROM documento_versiones dv
       LEFT JOIN usuarios u ON u.id = dv.autor_id
       WHERE dv.documento_id = $1 AND dv.tenant_id = $2
       ORDER BY dv.fecha DESC`,
      [req.params.id, tenantId]
    )
    const withSignedUrls = await Promise.all(
      rows.map(async (v) => ({ ...v, archivo_url: await resolveFileUrl(v.archivo_url, tenantId) }))
    )
    res.json(withSignedUrls)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener versiones' })
  }
})

// POST /api/documentos
router.post('/', requirePermission('documentos', 'crear'), async (req: AuthRequest, res: Response) => {
  const { codigo, titulo, tipo, proceso_id, version, estado, archivo_url, hash_sha256 } = req.body
  if (!codigo || !titulo || !tipo || !version) {
    return res.status(400).json({ error: 'codigo, titulo, tipo y version son requeridos' })
  }
  try {
    if (proceso_id) {
      const { rowCount } = await pool.query(
        'SELECT 1 FROM procesos WHERE id = $1 AND tenant_id = $2',
        [proceso_id, req.user!.tenantId]
      )
      if (!rowCount) return res.status(400).json({ error: 'proceso_id no pertenece a tu organización' })
    }
    const { rows } = await pool.query(
      `INSERT INTO documentos (codigo, titulo, tipo, proceso_id, version, estado, archivo_url, hash_sha256, creado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [codigo, titulo, tipo, proceso_id || null, version,
       estado || 'Borrador', archivo_url || null, hash_sha256 || null, req.user?.id || null, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de documento ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear documento' })
  }
})

// PUT /api/documentos/:id
router.put('/:id', requirePermission('documentos', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { titulo, tipo, proceso_id, version, estado, archivo_url, hash_sha256 } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE documentos SET titulo=$1, tipo=$2, proceso_id=$3, version=$4,
       estado=$5, archivo_url=$6, hash_sha256=$7 WHERE id=$8 AND tenant_id=$9 RETURNING *`,
      [titulo, tipo, proceso_id || null, version, estado,
       archivo_url || null, hash_sha256 || null, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Documento no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar documento' })
  }
})

export default router
