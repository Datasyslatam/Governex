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
  const { codigo, nombre, objetivo, entradas, salidas, indicador_kpi, responsable, tipo_id, estado, actividades, indicadorEntrada, indicadorActividad, indicadorSalida, riesgoEntrada, opEntrada, riesgoActividad, opActividad, riesgoSalida, opSalida } = req.body
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
      `INSERT INTO procesos (
        codigo, nombre, objetivo, entradas, salidas, indicador_kpi, responsable, tipo_id, estado, tenant_id,
        actividades, indicador_entrada, indicador_actividad, indicador_salida, riesgo_entrada, op_entrada,
        riesgo_actividad, op_actividad, riesgo_salida, op_salida
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [
        codigo, nombre, objetivo || null, entradas || null, salidas || null,
        indicador_kpi || null, responsable || null, tipo_id, estado || 'Activo', req.user!.tenantId,
        actividades || null, indicadorEntrada || null, indicadorActividad || null, indicadorSalida || null,
        riesgoEntrada || null, opEntrada || null, riesgoActividad || null, opActividad || null,
        riesgoSalida || null, opSalida || null
      ]
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
  const { nombre, objetivo, entradas, salidas, indicador_kpi, responsable, tipo_id, estado, actividades, indicadorEntrada, indicadorActividad, indicadorSalida, riesgoEntrada, opEntrada, riesgoActividad, opActividad, riesgoSalida, opSalida } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE procesos SET 
         nombre=$1, objetivo=$2, entradas=$3, salidas=$4,
         indicador_kpi=$5, responsable=$6, tipo_id=$7, estado=$8,
         actividades=$11, indicador_entrada=$12, indicador_actividad=$13, indicador_salida=$14,
         riesgo_entrada=$15, op_entrada=$16, riesgo_actividad=$17, op_actividad=$18,
         riesgo_salida=$19, op_salida=$20
       WHERE id=$9 AND tenant_id=$10 RETURNING *`,
      [
        nombre, objetivo || null, entradas || null, salidas || null,
        indicador_kpi || null, responsable || null, tipo_id, estado, id, req.user!.tenantId,
        actividades || null, indicadorEntrada || null, indicadorActividad || null, indicadorSalida || null,
        riesgoEntrada || null, opEntrada || null, riesgoActividad || null, opActividad || null,
        riesgoSalida || null, opSalida || null
      ]
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
// POST /api/procesos/batch (Upsert de multiples procesos / Caracterización)
router.post('/batch', requirePermission('procesos', 'crear'), async (req: AuthRequest, res: Response) => {
  const { rows } = req.body;
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'Se requiere un array de filas' });

  const tenantId = req.user!.tenantId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Obtener los tipos de proceso para el mapeo
    const { rows: tipos } = await client.query('SELECT id, nombre FROM tipos_proceso WHERE tenant_id = $1', [tenantId]);
    const tipoMap: Record<string, number> = {};
    for (const t of tipos) tipoMap[t.nombre.toLowerCase()] = t.id;

    const upserted = [];

    for (const row of rows) {
      if (!row.codigo || !row.proceso) continue;

      let tipo_id: number;
      if      (row.codigo.startsWith('PE')) tipo_id = tipoMap['estratégico'] ?? tipoMap['estrategico'] ?? 1;
      else if (row.codigo.startsWith('PO')) tipo_id = tipoMap['misional']    ?? tipoMap['operacional']  ?? 2;
      else                                  tipo_id = tipoMap['apoyo']       ?? tipoMap['soporte']      ?? 3;

      const procRes = await client.query(
        `INSERT INTO procesos (
          codigo, nombre, objetivo, entradas, salidas, indicador_kpi, responsable, tipo_id, estado, tenant_id,
          actividades, indicador_entrada, indicador_actividad, indicador_salida, riesgo_entrada, op_entrada,
          riesgo_actividad, op_actividad, riesgo_salida, op_salida
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (tenant_id, codigo) DO UPDATE SET
           nombre=EXCLUDED.nombre, objetivo=EXCLUDED.objetivo, entradas=EXCLUDED.entradas,
           salidas=EXCLUDED.salidas, indicador_kpi=EXCLUDED.indicador_kpi,
           responsable=EXCLUDED.responsable, tipo_id=EXCLUDED.tipo_id, estado=EXCLUDED.estado,
           actividades=EXCLUDED.actividades, indicador_entrada=EXCLUDED.indicador_entrada,
           indicador_actividad=EXCLUDED.indicador_actividad, indicador_salida=EXCLUDED.indicador_salida,
           riesgo_entrada=EXCLUDED.riesgo_entrada, op_entrada=EXCLUDED.op_entrada,
           riesgo_actividad=EXCLUDED.riesgo_actividad, op_actividad=EXCLUDED.op_actividad,
           riesgo_salida=EXCLUDED.riesgo_salida, op_salida=EXCLUDED.op_salida
         RETURNING *`,
        [
          row.codigo, row.proceso, row.objetivo, row.entradas, row.salidas,
          row.indicador, row.responsable, tipo_id, row.estado ?? 'Activo', tenantId,
          row.actividades ?? '', row.indicadorEntrada ?? '', row.indicadorActividad ?? '', row.indicadorSalida ?? '',
          row.riesgoEntrada ?? '', row.opEntrada ?? '', row.riesgoActividad ?? '', row.opActividad ?? '',
          row.riesgoSalida ?? '', row.opSalida ?? ''
        ]
      );
      upserted.push(procRes.rows[0]);
    }

    await client.query('COMMIT');
    res.status(200).json(upserted);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al realizar el guardado masivo de procesos' });
  } finally {
    client.release();
  }
});

router.delete('/:codigo', requirePermission('procesos', 'eliminar'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM procesos WHERE codigo= AND tenant_id=', [req.params.codigo, req.user.tenantId]);
    if (rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

export default router
