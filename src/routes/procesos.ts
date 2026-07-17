import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

// GET /api/procesos
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, t.nombre AS tipo_nombre
       FROM procesos p
       JOIN tipos_proceso t ON t.id = p.tipo_id
       WHERE p.tenant_id = $1
       ORDER BY t.id, p.codigo`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener procesos' })
  }
})

// POST /api/procesos
router.post('/', requirePermission('procesos', 'crear'), async (req: AuthRequest, res: Response) => {
  const { codigo, nombre, objetivo, entradas, salidas, indicador_kpi, responsable, tipo_id, estado } = req.body
  if (!codigo || !nombre || !tipo_id) {
    return res.status(400).json({ error: 'codigo, nombre y tipo_id son requeridos' })
  }
  try {
    // tipo_id (TIPOS_PROCESO) también es una tabla por-tenant desde la
    // migración; se valida que el tipo elegido pertenezca al tenant.
    const { rowCount } = await pool.query(
      'SELECT 1 FROM tipos_proceso WHERE id = $1 AND tenant_id = $2',
      [tipo_id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(400).json({ error: 'tipo_id no pertenece a tu organización' })

    const { rows } = await pool.query(
      `INSERT INTO procesos (codigo, nombre, objetivo, entradas, salidas, indicador_kpi, responsable, tipo_id, estado, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [codigo, nombre, objetivo || null, entradas || null, salidas || null,
       indicador_kpi || null, responsable || null, tipo_id, estado || 'Activo', req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de proceso ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear proceso' })
  }
})

// PUT /api/procesos/:id
router.put('/:id', requirePermission('procesos', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { nombre, objetivo, entradas, salidas, indicador_kpi, responsable, tipo_id, estado } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE procesos SET nombre=$1, objetivo=$2, entradas=$3, salidas=$4,
       indicador_kpi=$5, responsable=$6, tipo_id=$7, estado=$8
       WHERE id=$9 AND tenant_id=$10 RETURNING *`,
      [nombre, objetivo || null, entradas || null, salidas || null,
       indicador_kpi || null, responsable || null, tipo_id, estado, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Proceso no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar proceso' })
  }
})

// GET /api/procesos/pestel
router.get('/pestel', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM pestel WHERE tenant_id = $1 ORDER BY factor, id`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener PESTEL' })
  }
})

// POST /api/procesos/pestel
router.post('/pestel', requirePermission('procesos', 'crear'), async (req: AuthRequest, res: Response) => {
  const { factor, categoria, descripcion, impacto, oportunidad } = req.body
  if (!factor || !descripcion || !impacto) {
    return res.status(400).json({ error: 'factor, descripcion e impacto son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO pestel (factor, categoria, descripcion, impacto, oportunidad, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [factor, categoria || '', descripcion, impacto, oportunidad ?? false, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear entrada PESTEL' })
  }
})

// GET /api/procesos/dofa
router.get('/dofa', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM dofa WHERE tenant_id = $1 ORDER BY tipo, id`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener DOFA' })
  }
})

// POST /api/procesos/dofa
router.post('/dofa', requirePermission('procesos', 'crear'), async (req: AuthRequest, res: Response) => {
  const { tipo, descripcion } = req.body
  if (!tipo || !descripcion) return res.status(400).json({ error: 'tipo y descripcion requeridos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO dofa (tipo, descripcion, tenant_id) VALUES ($1,$2,$3) RETURNING *`,
      [tipo, descripcion, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear entrada DOFA' })
  }
})

export default router
