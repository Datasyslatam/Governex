import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

// ── PROGRAMAS ──────────────────────────────────────────────

// GET /api/auditorias/programas
router.get('/programas', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM programas_auditoria WHERE tenant_id = $1 ORDER BY anio DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener programas' })
  }
})

// POST /api/auditorias/programas
router.post('/programas', requirePermission('auditorias', 'crear'), async (req: AuthRequest, res: Response) => {
  const { anio, objetivo, duracion, estado, avance_pct } = req.body
  if (!anio || !objetivo) return res.status(400).json({ error: 'anio y objetivo requeridos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO programas_auditoria (anio, objetivo, duracion, estado, avance_pct, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [anio, objetivo, duracion || null, estado || 'Planificado', avance_pct ?? 0, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un programa para ese año' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear programa' })
  }
})

// PUT /api/auditorias/programas/:id
router.put('/programas/:id', requirePermission('auditorias', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { objetivo, duracion, estado, avance_pct } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE programas_auditoria SET objetivo=$1, duracion=$2, estado=$3, avance_pct=$4
       WHERE id=$5 AND tenant_id=$6 RETURNING *`,
      [objetivo, duracion || null, estado, avance_pct, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Programa no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar programa' })
  }
})

// ── AUDITORÍAS ─────────────────────────────────────────────

// GET /api/auditorias
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, p.nombre AS proceso_nombre,
              (SELECT COUNT(*) FROM hallazgos h WHERE h.auditoria_id = a.id AND h.tenant_id = a.tenant_id) AS hallazgos
       FROM auditorias a
       LEFT JOIN procesos p ON p.id = a.proceso_id
       WHERE a.tenant_id = $1
       ORDER BY a.fecha_inicio DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener auditorías' })
  }
})

// POST /api/auditorias
router.post('/', requirePermission('auditorias', 'crear'), async (req: AuthRequest, res: Response) => {
  const { codigo, programa_id, proceso_id, fecha_inicio, duracion_dias, auditor_lider, estado } = req.body
  if (!codigo || !fecha_inicio) return res.status(400).json({ error: 'codigo y fecha_inicio requeridos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO auditorias (codigo, programa_id, proceso_id, fecha_inicio, duracion_dias, auditor_lider, estado, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [codigo, programa_id || null, proceso_id || null, fecha_inicio,
       duracion_dias || 1, auditor_lider || null, estado || 'Planificada', req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de auditoría ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear auditoría' })
  }
})

// PUT /api/auditorias/:id
router.put('/:id', requirePermission('auditorias', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { proceso_id, fecha_inicio, duracion_dias, auditor_lider, estado } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE auditorias SET proceso_id=$1, fecha_inicio=$2, duracion_dias=$3,
       auditor_lider=$4, estado=$5 WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [proceso_id || null, fecha_inicio, duracion_dias, auditor_lider || null, estado, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Auditoría no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar auditoría' })
  }
})

// ── HALLAZGOS ──────────────────────────────────────────────

// GET /api/auditorias/hallazgos
router.get('/hallazgos', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT h.*, a.codigo AS auditoria_codigo
       FROM hallazgos h
       JOIN auditorias a ON a.id = h.auditoria_id
       WHERE h.tenant_id = $1
       ORDER BY h.creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener hallazgos' })
  }
})

// POST /api/auditorias/hallazgos
router.post('/hallazgos', requirePermission('auditorias', 'crear'), async (req: AuthRequest, res: Response) => {
  const { codigo, auditoria_id, tipo, descripcion, clausula, estado } = req.body
  if (!codigo || !auditoria_id || !tipo || !descripcion) {
    return res.status(400).json({ error: 'codigo, auditoria_id, tipo y descripcion requeridos' })
  }
  try {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM auditorias WHERE id = $1 AND tenant_id = $2',
      [auditoria_id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(400).json({ error: 'auditoria_id no pertenece a tu organización' })

    const { rows } = await pool.query(
      `INSERT INTO hallazgos (codigo, auditoria_id, tipo, descripcion, clausula, estado, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [codigo, auditoria_id, tipo, descripcion, clausula || null, estado || 'Abierto', req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de hallazgo ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear hallazgo' })
  }
})

// PUT /api/auditorias/hallazgos/:id
router.put('/hallazgos/:id', requirePermission('auditorias', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { tipo, descripcion, clausula, estado } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE hallazgos SET tipo=$1, descripcion=$2, clausula=$3, estado=$4
       WHERE id=$5 AND tenant_id=$6 RETURNING *`,
      [tipo, descripcion, clausula || null, estado, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Hallazgo no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar hallazgo' })
  }
})

export default router
