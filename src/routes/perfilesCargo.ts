import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const router = Router()
router.use(authMiddleware)

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT pc.*, p.nombre AS proceso_nombre
       FROM perfiles_cargo pc
       LEFT JOIN procesos p ON p.id = pc.proceso_id
       WHERE pc.tenant_id = $1
       ORDER BY pc.cargo`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener perfiles de cargo' })
  }
})

router.post('/', requirePermission('competencias', 'crear'), async (req: AuthRequest, res: Response) => {
  const { cargo, proceso_id, archivo_key, archivo_nombre } = req.body
  if (!cargo) return res.status(400).json({ error: 'cargo es requerido' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO perfiles_cargo (cargo, proceso_id, archivo_key, archivo_nombre, tenant_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [cargo, proceso_id || null, archivo_key || null, archivo_nombre || null, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear perfil de cargo' })
  }
})

router.put('/:id', requirePermission('competencias', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const {
    educacion, formacion, experiencia,
    checklist_desempeno, checklist_conocimiento, necesidades_adicionales
  } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE perfiles_cargo 
       SET educacion=$1, formacion=$2, experiencia=$3,
           checklist_desempeno=$4, checklist_conocimiento=$5, necesidades_adicionales=$6,
           actualizado_en=NOW()
       WHERE id=$7 AND tenant_id=$8 RETURNING *`,
      [
        educacion, formacion, experiencia,
        JSON.stringify(checklist_desempeno || []), JSON.stringify(checklist_conocimiento || []), JSON.stringify(necesidades_adicionales || []),
        id, req.user!.tenantId
      ]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Perfil no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar perfil de cargo' })
  }
})

router.post('/:id/necesidades', requirePermission('competencias', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { texto } = req.body
  if (!texto) return res.status(400).json({ error: 'texto es requerido' })
  try {
    const selectRes = await pool.query(
      'SELECT necesidades_adicionales FROM perfiles_cargo WHERE id=$1 AND tenant_id=$2',
      [id, req.user!.tenantId]
    )
    if (!selectRes.rows[0]) return res.status(404).json({ error: 'Perfil no encontrado' })
    
    let necesidades = selectRes.rows[0].necesidades_adicionales || []
    if (typeof necesidades === 'string') {
      try { necesidades = JSON.parse(necesidades) } catch { necesidades = [] }
    }
    
    necesidades.push(texto)

    const { rows } = await pool.query(
      `UPDATE perfiles_cargo 
       SET necesidades_adicionales=$1, actualizado_en=NOW()
       WHERE id=$2 AND tenant_id=$3 RETURNING *`,
      [JSON.stringify(necesidades), id, req.user!.tenantId]
    )
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al agregar necesidad' })
  }
})

router.delete('/:id', requirePermission('competencias', 'eliminar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM perfiles_cargo WHERE id=$1 AND tenant_id=$2',
      [id, req.user!.tenantId]
    )
    if (rowCount === 0) return res.status(404).json({ error: 'Perfil no encontrado' })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar perfil de cargo' })
  }
})

export default router
