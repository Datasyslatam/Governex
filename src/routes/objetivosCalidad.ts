import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

// GET /api/objetivos-calidad
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT oc.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id',         m.id,
                    'periodo',    m.periodo,
                    'valor',      m.valor,
                    'estado',     m.estado,
                    'comentario', m.comentario,
                    'fecha',      m.fecha
                  ) ORDER BY m.fecha DESC
                ) FILTER (WHERE m.id IS NOT NULL),
                '[]'
              ) AS mediciones
       FROM objetivos_calidad oc
       LEFT JOIN objetivos_calidad_mediciones m ON m.objetivo_id = oc.id
       GROUP BY oc.id
       ORDER BY oc.codigo`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener objetivos de calidad' })
  }
})

// POST /api/objetivos-calidad
router.post('/', async (req: AuthRequest, res: Response) => {
  const {
    codigo, objetivo, proceso_relacionado, fuente_riesgo_oportunidad,
    tipo_fuente, accion, responsable, recursos, frecuencia_medicion,
    meta, indicador, fecha_inicio, fecha_fin, estado,
    _riesgo_codigo, _riesgo_nivel,
  } = req.body

  if (!codigo || !objetivo || !accion || !responsable || !frecuencia_medicion || !meta || !indicador) {
    return res.status(400).json({
      error: 'codigo, objetivo, accion, responsable, frecuencia_medicion, meta e indicador son requeridos'
    })
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO objetivos_calidad
         (codigo, objetivo, proceso_relacionado, fuente_riesgo_oportunidad,
          tipo_fuente, accion, responsable, recursos, frecuencia_medicion,
          meta, indicador, fecha_inicio, fecha_fin, estado,
          _riesgo_codigo, _riesgo_nivel)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        codigo, objetivo, proceso_relacionado || null, fuente_riesgo_oportunidad || null,
        tipo_fuente || 'Riesgo', accion, responsable, recursos || null, frecuencia_medicion,
        meta, indicador, fecha_inicio || null, fecha_fin || null, estado || 'Pendiente',
        _riesgo_codigo || null, _riesgo_nivel || null,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'El código de objetivo ya existe' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear objetivo de calidad' })
  }
})

// PUT /api/objetivos-calidad/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const {
    objetivo, proceso_relacionado, fuente_riesgo_oportunidad,
    tipo_fuente, accion, responsable, recursos, frecuencia_medicion,
    meta, indicador, fecha_inicio, fecha_fin, estado,
    _riesgo_codigo, _riesgo_nivel,
  } = req.body

  try {
    const { rows } = await pool.query(
      `UPDATE objetivos_calidad SET
         objetivo=$1, proceso_relacionado=$2, fuente_riesgo_oportunidad=$3,
         tipo_fuente=$4, accion=$5, responsable=$6, recursos=$7,
         frecuencia_medicion=$8, meta=$9, indicador=$10,
         fecha_inicio=$11, fecha_fin=$12, estado=$13,
         _riesgo_codigo=$14, _riesgo_nivel=$15
       WHERE id=$16 RETURNING *`,
      [
        objetivo, proceso_relacionado || null, fuente_riesgo_oportunidad || null,
        tipo_fuente || 'Riesgo', accion, responsable, recursos || null,
        frecuencia_medicion, meta, indicador,
        fecha_inicio || null, fecha_fin || null, estado,
        _riesgo_codigo || null, _riesgo_nivel || null,
        id,
      ]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Objetivo no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar objetivo' })
  }
})

// DELETE /api/objetivos-calidad/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    await pool.query('DELETE FROM objetivos_calidad WHERE id=$1', [id])
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar objetivo' })
  }
})

// POST /api/objetivos-calidad/:id/mediciones
router.post('/:id/mediciones', async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { periodo, valor, estado, comentario, fecha } = req.body
  if (!periodo || valor === undefined || !estado) {
    return res.status(400).json({ error: 'periodo, valor y estado son requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO objetivos_calidad_mediciones
         (objetivo_id, periodo, valor, estado, comentario, fecha, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, periodo, valor, estado, comentario || null,
       fecha || new Date().toISOString().slice(0, 10), req.user?.id || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar medición' })
  }
})

// GET /api/objetivos-calidad/:id/mediciones
router.get('/:id/mediciones', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM objetivos_calidad_mediciones
       WHERE objetivo_id=$1 ORDER BY fecha DESC`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener mediciones' })
  }
})

export default router