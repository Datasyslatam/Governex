import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

// ── POLÍTICA DE CALIDAD ────────────────────────────────────
export const politicaRouter = Router()
politicaRouter.use(authMiddleware)

politicaRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.nombre AS aprobado_por_nombre
       FROM politica_calidad p
       LEFT JOIN usuarios u ON u.id = p.aprobado_por
       WHERE p.tenant_id = $1
       ORDER BY p.creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener política' })
  }
})

politicaRouter.post('/', requirePermission('politica_calidad', 'crear'), async (req: AuthRequest, res: Response) => {
  const { version, contenido, estado, fecha_vigencia } = req.body
  if (!version || !contenido) {
    return res.status(400).json({ error: 'version y contenido son requeridos' })
  }
  const tenantId = req.user!.tenantId
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Marcar versiones anteriores como obsoletas — acotado al tenant, si no
    // esto obsoletaría la política vigente de TODAS las empresas.
    await client.query(`UPDATE politica_calidad SET estado='Obsoleto' WHERE estado='Vigente' AND tenant_id=$1`, [tenantId])
    const { rows } = await client.query(
      `INSERT INTO politica_calidad (version, contenido, estado, aprobado_por, fecha_vigencia, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [version, contenido, estado || 'Vigente', req.user?.id || null, fecha_vigencia || null, tenantId]
    )
    await client.query('COMMIT')
    res.status(201).json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Error al crear política' })
  } finally {
    client.release()
  }
})

politicaRouter.put('/:id', requirePermission('politica_calidad', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { version, contenido, estado, fecha_vigencia } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE politica_calidad SET version=$1, contenido=$2, estado=$3,
       fecha_vigencia=$4 WHERE id=$5 AND tenant_id=$6 RETURNING *`,
      [version, contenido, estado, fecha_vigencia || null, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Política no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar política' })
  }
})

// GET /api/politica/lecturas
politicaRouter.get('/lecturas', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM politica_lecturas WHERE tenant_id = $1 ORDER BY creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener lecturas' })
  }
})

// POST /api/politica/lecturas
politicaRouter.post('/lecturas', requirePermission('politica_calidad', 'crear'), async (req: AuthRequest, res: Response) => {
  const { politica_id, nombre_persona, area, fecha_lectura, estado } = req.body
  if (!politica_id || !nombre_persona) {
    return res.status(400).json({ error: 'politica_id y nombre_persona son requeridos' })
  }
  try {
    const tenantId = req.user!.tenantId
    const { rowCount } = await pool.query(
      'SELECT 1 FROM politica_calidad WHERE id = $1 AND tenant_id = $2', [politica_id, tenantId]
    )
    if (!rowCount) return res.status(400).json({ error: 'politica_id no pertenece a tu organización' })

    const { rows } = await pool.query(
      `INSERT INTO politica_lecturas (politica_id, nombre_persona, area, fecha_lectura, estado, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [politica_id, nombre_persona, area || null,
       fecha_lectura || null, estado || 'Pendiente', tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar lectura' })
  }
})

// ── REVISIÓN POR LA DIRECCIÓN ──────────────────────────────
export const revDireccionRouter = Router()
revDireccionRouter.use(authMiddleware)

revDireccionRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM rev_direccion WHERE tenant_id = $1 ORDER BY fecha DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener revisiones' })
  }
})

revDireccionRouter.post('/', requirePermission('rev_direccion', 'crear'), async (req: AuthRequest, res: Response) => {
  const { fecha, asistentes, temas, conclusiones, decisiones, proxima_rev } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO rev_direccion (fecha, asistentes, temas, conclusiones, decisiones, proxima_rev, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [fecha || new Date().toISOString().slice(0, 10),
       asistentes || null, temas || null,
       conclusiones || null, decisiones || null, proxima_rev || null, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear revisión' })
  }
})

revDireccionRouter.put('/:id', requirePermission('rev_direccion', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { asistentes, temas, conclusiones, decisiones, proxima_rev } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE rev_direccion SET asistentes=$1, temas=$2, conclusiones=$3,
       decisiones=$4, proxima_rev=$5 WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [asistentes || null, temas || null, conclusiones || null,
       decisiones || null, proxima_rev || null, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Revisión no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar revisión' })
  }
})
