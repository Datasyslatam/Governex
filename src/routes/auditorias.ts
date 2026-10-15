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
      `SELECT h.*, a.codigo AS auditoria_codigo, a.proceso_id, p.nombre AS proceso_nombre,
              nc.id AS nc_id, nc.codigo AS nc_codigo,
              mc.id AS mejora_id, mc.codigo AS mejora_codigo
       FROM hallazgos h
       JOIN auditorias a ON a.id = h.auditoria_id
       LEFT JOIN procesos p ON p.id = a.proceso_id
       LEFT JOIN no_conformidades nc ON nc.hallazgo_id = h.id AND nc.tenant_id = h.tenant_id
       LEFT JOIN mejoras_continuas mc ON mc.hallazgo_id = h.id AND mc.tenant_id = h.tenant_id
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

// POST /api/auditorias/hallazgos/:id/convertir-nc
// Pasa el hallazgo de auditoría al módulo de No Conformidades (§10.2)
router.post('/hallazgos/:id/convertir-nc', requirePermission('no_conformidades', 'crear'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const tenantId = req.user!.tenantId
  try {
    // 1. Obtener el hallazgo
    const halRes = await pool.query(
      `SELECT h.*, a.proceso_id
       FROM hallazgos h
       JOIN auditorias a ON a.id = h.auditoria_id
       WHERE h.id = $1 AND h.tenant_id = $2`,
      [id, tenantId]
    )
    if (!halRes.rows[0]) return res.status(404).json({ error: 'Hallazgo no encontrado' })
    const h = halRes.rows[0]

    // 2. Verificar si ya fue transferido
    const yaExiste = await pool.query(
      'SELECT id, codigo FROM no_conformidades WHERE hallazgo_id = $1 AND tenant_id = $2',
      [id, tenantId]
    )
    if (yaExiste.rows[0]) {
      return res.status(400).json({ error: `Este hallazgo ya está registrado como No Conformidad (${yaExiste.rows[0].codigo})` })
    }

    // 3. Generar código único para la NC
    const year = new Date().getFullYear().toString().slice(2)
    const countRes = await pool.query('SELECT COUNT(*) FROM no_conformidades WHERE tenant_id = $1', [tenantId])
    let seq = parseInt(countRes.rows[0].count, 10) + 1
    let ncCodigo = `NC-${year}-${String(seq).padStart(3, '0')}`

    // Verificar colisión de código
    let collision = await pool.query('SELECT 1 FROM no_conformidades WHERE codigo = $1 AND tenant_id = $2', [ncCodigo, tenantId])
    while (collision.rowCount && collision.rowCount > 0) {
      seq++
      ncCodigo = `NC-${year}-${String(seq).padStart(3, '0')}`
      collision = await pool.query('SELECT 1 FROM no_conformidades WHERE codigo = $1 AND tenant_id = $2', [ncCodigo, tenantId])
    }

    // 4. Determinar gravedad inicial
    const gravedad = h.tipo.includes('Mayor') ? 'Mayor' : h.tipo.includes('Crítica') ? 'Crítica' : 'Menor'

    // 5. Insertar No Conformidad
    const ncRes = await pool.query(
      `INSERT INTO no_conformidades (codigo, fecha, origen, proceso_id, descripcion, gravedad, estado, hallazgo_id, tenant_id)
       VALUES ($1, CURRENT_DATE, 'Auditoría Interna', $2, $3, $4, 'Abierta', $5, $6)
       RETURNING *`,
      [ncCodigo, h.proceso_id || null, h.descripcion, gravedad, h.id, tenantId]
    )

    res.status(201).json(ncRes.rows[0])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Error al convertir hallazgo en No Conformidad' })
  }
})

// POST /api/auditorias/hallazgos/:id/convertir-mejora
// Pasa el hallazgo de Oportunidad de Mejora al módulo de Mejora Continua (§10.1 / §10.3)
router.post('/hallazgos/:id/convertir-mejora', requirePermission('mejoras_continuas', 'crear'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const tenantId = req.user!.tenantId
  try {
    const halRes = await pool.query(
      `SELECT h.*, a.proceso_id, p.nombre AS proceso_nombre
       FROM hallazgos h
       JOIN auditorias a ON a.id = h.auditoria_id
       LEFT JOIN procesos p ON p.id = a.proceso_id
       WHERE h.id = $1 AND h.tenant_id = $2`,
      [id, tenantId]
    )
    if (!halRes.rows[0]) return res.status(404).json({ error: 'Hallazgo no encontrado' })
    const h = halRes.rows[0]

    // Verificar si ya fue transferido
    const yaExiste = await pool.query(
      'SELECT id, codigo FROM mejoras_continuas WHERE hallazgo_id = $1 AND tenant_id = $2',
      [id, tenantId]
    )
    if (yaExiste.rows[0]) {
      return res.status(400).json({ error: `Este hallazgo ya está registrado como Iniciativa de Mejora (${yaExiste.rows[0].codigo})` })
    }

    // Generar código de mejora
    const fullYear = new Date().getFullYear()
    const countRes = await pool.query('SELECT COUNT(*) FROM mejoras_continuas WHERE tenant_id = $1', [tenantId])
    let seq = parseInt(countRes.rows[0].count, 10) + 1
    let mcCodigo = `MC-${fullYear}-${String(seq).padStart(3, '0')}`

    let collision = await pool.query('SELECT 1 FROM mejoras_continuas WHERE codigo = $1 AND tenant_id = $2', [mcCodigo, tenantId])
    while (collision.rowCount && collision.rowCount > 0) {
      seq++
      mcCodigo = `MC-${fullYear}-${String(seq).padStart(3, '0')}`
      collision = await pool.query('SELECT 1 FROM mejoras_continuas WHERE codigo = $1 AND tenant_id = $2', [mcCodigo, tenantId])
    }

    const titulo = h.descripcion.length > 80 ? h.descripcion.slice(0, 77) + '...' : h.descripcion

    const mcRes = await pool.query(
      `INSERT INTO mejoras_continuas (codigo, titulo, origen, proceso, proceso_id, descripcion, beneficio_esperado, responsable, fecha_inicio, avance_pct, estado, hallazgo_id, tenant_id)
       VALUES ($1, $2, 'Auditoría', $3, $4, $5, 'Optimización derivada del hallazgo de auditoría', 'Líder del Proceso', CURRENT_DATE, 0, 'Propuesta', $6, $7)
       RETURNING *`,
      [mcCodigo, titulo, h.proceso_nombre || 'General', h.proceso_id || null, h.descripcion, h.id, tenantId]
    )

    res.status(201).json(mcRes.rows[0])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Error al convertir hallazgo en Iniciativa de Mejora' })
  }
})

export default router
