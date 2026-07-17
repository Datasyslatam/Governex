import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

// GET /api/diseno-desarrollo
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT pd.*, u.nombre AS creado_por_nombre
       FROM proyectos_diseno pd
       LEFT JOIN usuarios u ON u.id = pd.creado_por
       WHERE pd.tenant_id = $1
       ORDER BY pd.creado_en DESC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener proyectos de diseño' })
  }
})

// GET /api/diseno-desarrollo/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM proyectos_diseno WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Proyecto no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener proyecto' })
  }
})

// POST /api/diseno-desarrollo
router.post('/', requirePermission('diseno_desarrollo', 'crear'), async (req: AuthRequest, res: Response) => {
  const { nombre, cliente, entradas, salidas, responsable,
          fecha_inicio, fecha_entrega, etapa, estado, control, actividad_id } = req.body
  if (!nombre) {
    return res.status(400).json({ error: 'nombre es requerido' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO proyectos_diseno
         (nombre, cliente, entradas, salidas, responsable,
          fecha_inicio, fecha_entrega, etapa, estado, control, actividad_id, creado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        nombre,
        cliente        || null,
        entradas       || null,
        salidas        || null,
        responsable    || null,
        fecha_inicio   || null,
        fecha_entrega  || null,
        etapa          || 'Planificación',
        estado         || 'En tiempo',
        control        || null,
        actividad_id   || null,
        req.user?.id   || null,
        req.user!.tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear proyecto de diseño' })
  }
})

// PUT /api/diseno-desarrollo/:id
router.put('/:id', requirePermission('diseno_desarrollo', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { nombre, cliente, entradas, salidas, responsable,
          fecha_inicio, fecha_entrega, etapa, estado, control, actividad_id } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE proyectos_diseno
       SET nombre=$1, cliente=$2, entradas=$3, salidas=$4, responsable=$5,
           fecha_inicio=$6, fecha_entrega=$7, etapa=$8, estado=$9, control=$10, actividad_id=$11
       WHERE id=$12 AND tenant_id=$13 RETURNING *`,
      [nombre, cliente || null, entradas || null, salidas || null,
       responsable || null, fecha_inicio || null, fecha_entrega || null,
       etapa, estado, control || null, actividad_id || null, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Proyecto no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar proyecto' })
  }
})

// DELETE /api/diseno-desarrollo/:id
router.delete('/:id', requirePermission('diseno_desarrollo', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM proyectos_diseno WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Proyecto no encontrado' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar proyecto' })
  }
})

export default router
