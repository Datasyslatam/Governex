import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

// GET /api/indicadores
router.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*,
              p.nombre AS proceso_nombre,
              (SELECT row_to_json(m) FROM (
                SELECT valor, tendencia, estado, fecha
                FROM indicador_mediciones
                WHERE indicador_id = i.id
                ORDER BY fecha DESC LIMIT 1
              ) m) AS ultima_medicion
       FROM indicadores i
       LEFT JOIN procesos p ON p.id = i.proceso_id
       WHERE i.activo = true
       ORDER BY i.codigo`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener indicadores' })
  }
})

// POST /api/indicadores
router.post('/', async (req: AuthRequest, res: Response) => {
  const { codigo, titulo, proceso_id, frecuencia, meta } = req.body
  if (!codigo || !titulo || !frecuencia || !meta) {
    return res.status(400).json({ error: 'codigo, titulo, frecuencia y meta son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO indicadores (codigo, titulo, proceso_id, frecuencia, meta)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [codigo, titulo, proceso_id || null, frecuencia, meta]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de indicador ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear indicador' })
  }
})

// PUT /api/indicadores/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { titulo, proceso_id, frecuencia, meta, activo } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE indicadores SET titulo=$1, proceso_id=$2, frecuencia=$3, meta=$4, activo=$5
       WHERE id=$6 RETURNING *`,
      [titulo, proceso_id || null, frecuencia, meta, activo ?? true, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Indicador no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar indicador' })
  }
})

// DELETE /api/indicadores/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    // Delete mediciones first due to foreign key constraints
    await pool.query('DELETE FROM indicador_mediciones WHERE indicador_id = $1', [req.params.id]);
    const { rowCount } = await pool.query('DELETE FROM indicadores WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Indicador no encontrado' });
    res.status(204).send();
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar indicador' })
  }
})

// DELETE /api/indicadores
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    // Delete all mediciones and indicadores
    await pool.query('DELETE FROM indicador_mediciones');
    await pool.query('DELETE FROM indicadores');
    res.status(204).send();
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar todos los indicadores' })
  }
})

// POST /api/indicadores/:id/mediciones
router.post('/:id/mediciones', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { valor, tendencia, estado, fecha } = req.body
  if (!valor || !estado) return res.status(400).json({ error: 'valor y estado son requeridos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO indicador_mediciones (indicador_id, valor, tendencia, estado, fecha, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, valor, tendencia || 'stable', estado,
       fecha || new Date().toISOString().slice(0, 10), req.user?.id || null]
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
      `SELECT * FROM indicador_mediciones WHERE indicador_id=$1 ORDER BY fecha DESC LIMIT 24`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener mediciones' })
  }
})

export default router
