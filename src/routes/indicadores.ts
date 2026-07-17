import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

// GET /api/indicadores
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*,
              p.nombre AS proceso_nombre,
              (SELECT row_to_json(m) FROM (
                SELECT valor, tendencia, estado, fecha
                FROM indicador_mediciones
                WHERE indicador_id = i.id AND tenant_id = i.tenant_id
                ORDER BY fecha DESC LIMIT 1
              ) m) AS ultima_medicion
       FROM indicadores i
       LEFT JOIN procesos p ON p.id = i.proceso_id
       WHERE i.activo = true AND i.tenant_id = $1
       ORDER BY i.codigo`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener indicadores' })
  }
})

// POST /api/indicadores
router.post('/', requirePermission('indicadores', 'crear'), async (req: AuthRequest, res: Response) => {
  const { codigo, titulo, proceso_id, frecuencia, meta } = req.body
  if (!codigo || !titulo || !frecuencia || !meta) {
    return res.status(400).json({ error: 'codigo, titulo, frecuencia y meta son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO indicadores (codigo, titulo, proceso_id, frecuencia, meta, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [codigo, titulo, proceso_id || null, frecuencia, meta, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de indicador ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear indicador' })
  }
})

// PUT /api/indicadores/:id
router.put('/:id', requirePermission('indicadores', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { titulo, proceso_id, frecuencia, meta, activo } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE indicadores SET titulo=$1, proceso_id=$2, frecuencia=$3, meta=$4, activo=$5
       WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [titulo, proceso_id || null, frecuencia, meta, activo ?? true, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Indicador no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar indicador' })
  }
})

// DELETE /api/indicadores/:id
router.delete('/:id', requirePermission('indicadores', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    // Borra mediciones primero por la FK, ambas acotadas al tenant.
    await pool.query('DELETE FROM indicador_mediciones WHERE indicador_id = $1 AND tenant_id = $2', [req.params.id, tenantId]);
    const { rowCount } = await pool.query('DELETE FROM indicadores WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId]);
    if (rowCount === 0) return res.status(404).json({ error: 'Indicador no encontrado' });
    res.status(204).send();
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar indicador' })
  }
})

// DELETE /api/indicadores
// BUG CORREGIDO: antes borraba TODOS los indicadores de TODOS los tenants sin
// ningún filtro. Ahora, además de acotar por tenant_id, se exige el rol de
// administración — borrar en bloque todos los indicadores de la empresa es
// una operación destructiva que no debería estar a un clic de cualquier usuario.
router.delete('/', requirePermission('indicadores', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    await pool.query('DELETE FROM indicador_mediciones WHERE tenant_id = $1', [tenantId]);
    await pool.query('DELETE FROM indicadores WHERE tenant_id = $1', [tenantId]);
    res.status(204).send();
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar todos los indicadores' })
  }
})

// POST /api/indicadores/:id/mediciones
router.post('/:id/mediciones', requirePermission('indicadores', 'crear'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { valor, tendencia, estado, fecha } = req.body
  if (!valor || !estado) return res.status(400).json({ error: 'valor y estado son requeridos' })
  try {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM indicadores WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Indicador no encontrado' })

    const { rows } = await pool.query(
      `INSERT INTO indicador_mediciones (indicador_id, valor, tendencia, estado, fecha, registrado_por, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, valor, tendencia || 'stable', estado,
       fecha || new Date().toISOString().slice(0, 10), req.user?.id || null, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar medición' })
  }
})

// GET /api/indicadores/:id/mediciones
router.get('/:id/mediciones', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM indicador_mediciones WHERE indicador_id=$1 AND tenant_id=$2 ORDER BY fecha DESC LIMIT 24`,
      [req.params.id, req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener mediciones' })
  }
})

export default router
