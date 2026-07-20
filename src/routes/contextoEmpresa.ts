import { Router, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { resolveFileUrl, deleteObject } from '../services/storageService'

const router = Router()
router.use(authMiddleware)

/* ══════════════════════════════════════════════════════════════
   DATOS DE LA EMPRESA (§4.1) — registro único, siempre el más reciente
   ══════════════════════════════════════════════════════════════ */

// GET /api/contexto-empresa/datos
router.get('/datos', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    const { rows } = await pool.query(
      `SELECT * FROM datos_empresa WHERE tenant_id = $1 ORDER BY actualizado_en DESC LIMIT 1`,
      [tenantId]
    )
    const row = rows[0]
    if (!row) return res.json(null)
    row.pdf_formulario_url = await resolveFileUrl(row.pdf_formulario_url, tenantId)
    row.organigrama_url = await resolveFileUrl(row.organigrama_url, tenantId)
    res.json(row)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener datos de la empresa' })
  }
})

function cleanKey(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('/api/uploads/view/')) {
    return url.slice('/api/uploads/view/'.length)
  }
  return url
}

// PUT /api/contexto-empresa/datos  (upsert simple: siempre inserta una nueva versión)
router.put('/datos', requirePermission('contexto_empresa', 'editar'), async (req: AuthRequest, res: Response) => {
  const {
    nombreEmpresa, sector, tipoEmpresa, tamano, ubicacion, anoFundacion,
    mision, vision, politicaCalidad, productosServicios, mercadoObjetivo,
    cantidadEmpleados, alcanceSGC, certificaciones, parteInteresadas, contextoNarrativo,
    pdfFormularioUrl, pdfFormularioNombre, organigramaUrl, organigramaNombre,   // ← nuevo
  } = req.body

  if (!nombreEmpresa) {
    return res.status(400).json({ error: 'nombreEmpresa es requerido' })
  }

  try {
    const tenantId = req.user!.tenantId

    // Borrar de R2 los archivos anteriores si han sido reemplazados
    const { rows: prevRows } = await pool.query(
      `SELECT pdf_formulario_url, organigrama_url FROM datos_empresa WHERE tenant_id = $1 ORDER BY actualizado_en DESC LIMIT 1`,
      [tenantId]
    )
    const prevRow = prevRows[0]
    if (prevRow) {
      const oldPdfKey = cleanKey(prevRow.pdf_formulario_url)
      const newPdfKey = cleanKey(pdfFormularioUrl)
      if (oldPdfKey && oldPdfKey !== newPdfKey) {
        await deleteObject(oldPdfKey)
      }

      const oldOrgKey = cleanKey(prevRow.organigrama_url)
      const newOrgKey = cleanKey(organigramaUrl)
      if (oldOrgKey && oldOrgKey !== newOrgKey) {
        await deleteObject(oldOrgKey)
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO datos_empresa
         (nombre_empresa, sector, tipo_empresa, tamano, ubicacion, ano_fundacion,
          mision, vision, politica_calidad, productos_servicios, mercado_objetivo,
          cantidad_empleados, alcance_sgc, certificaciones, parte_interesadas, contexto_narrativo,
          pdf_formulario_url, pdf_formulario_nombre, organigrama_url, organigrama_nombre, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [
        nombreEmpresa, sector || null, tipoEmpresa || null, tamano || null,
        ubicacion || null, anoFundacion || null, mision || null, vision || null,
        politicaCalidad || null, productosServicios || null, mercadoObjetivo || null,
        cantidadEmpleados || null, alcanceSGC || null, certificaciones || null,
        parteInteresadas || null, contextoNarrativo || null,
        pdfFormularioUrl || null, pdfFormularioNombre || null,
        organigramaUrl || null, organigramaNombre || null, tenantId,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al guardar datos de la empresa' })
  }
})

// DELETE /api/contexto-empresa/datos  (limpia todo el contexto, usado en "Re-analizar")
// BUG CORREGIDO: antes borraba datos_empresa de TODOS los tenants sin filtro.
router.delete('/datos', requirePermission('contexto_empresa', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId

    // Eliminar de R2 todos los archivos asociados al tenant
    const { rows: prevRows } = await pool.query(
      `SELECT pdf_formulario_url, organigrama_url FROM datos_empresa WHERE tenant_id = $1`,
      [tenantId]
    )
    for (const row of prevRows) {
      const pdfKey = cleanKey(row.pdf_formulario_url)
      if (pdfKey) await deleteObject(pdfKey)
      const orgKey = cleanKey(row.organigrama_url)
      if (orgKey) await deleteObject(orgKey)
    }

    await pool.query('DELETE FROM datos_empresa WHERE tenant_id = $1', [tenantId])
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar datos de la empresa' })
  }
})

/* ══════════════════════════════════════════════════════════════
   MATRIZ DE ROLES (§5.3)
   ══════════════════════════════════════════════════════════════ */

// GET /api/contexto-empresa/matriz-roles
router.get('/matriz-roles', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM matriz_roles WHERE tenant_id = $1 ORDER BY id', [req.user!.tenantId])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener matriz de roles' })
  }
})

// POST /api/contexto-empresa/matriz-roles  (reemplaza todo el set, usado tras análisis IA)
// BUG CORREGIDO: el DELETE previo no filtraba por tenant y borraba la matriz
// de roles de TODAS las empresas cada vez que cualquier tenant reanalizaba la suya.
router.post('/matriz-roles', requirePermission('contexto_empresa', 'crear'), async (req: AuthRequest, res: Response) => {
  const { filas } = req.body as { filas: any[] }
  if (!Array.isArray(filas)) return res.status(400).json({ error: 'Se requiere un array "filas"' })

  const tenantId = req.user!.tenantId
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM matriz_roles WHERE tenant_id = $1', [tenantId])
    for (const f of filas) {
      await client.query(
        `INSERT INTO matriz_roles (proceso, tipo, responsable, autoridad, funciones, recursos, rendicion, clausula, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [f.proceso, f.tipo, f.responsable || null, f.autoridad || null,
         f.funciones || null, f.recursos || null, f.rendicion || null, f.clausula || null, tenantId]
      )
    }
    await client.query('COMMIT')
    const { rows } = await pool.query('SELECT * FROM matriz_roles WHERE tenant_id = $1 ORDER BY id', [tenantId])
    res.status(201).json(rows)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Error al guardar matriz de roles' })
  } finally {
    client.release()
  }
})

// POST /api/contexto-empresa/matriz-roles/nueva  (agregar una fila manual, simétrico a matriz-cargos)
router.post('/matriz-roles/nueva', requirePermission('contexto_empresa', 'crear'), async (req: AuthRequest, res: Response) => {
  const { proceso, tipo, responsable, autoridad, funciones, recursos, rendicion, clausula } = req.body
  if (!proceso) return res.status(400).json({ error: 'proceso es requerido' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO matriz_roles (proceso, tipo, responsable, autoridad, funciones, recursos, rendicion, clausula, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [proceso, tipo || 'misional', responsable || null, autoridad || null,
       funciones || null, recursos || null, rendicion || null, clausula || null, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear fila de matriz de roles' })
  }
})

// PUT /api/contexto-empresa/matriz-roles/:id  (edición de una celda)
router.put('/matriz-roles/:id', requirePermission('contexto_empresa', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { proceso, tipo, responsable, autoridad, funciones, recursos, rendicion, clausula } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE matriz_roles SET proceso=$1, tipo=$2, responsable=$3, autoridad=$4,
       funciones=$5, recursos=$6, rendicion=$7, clausula=$8 WHERE id=$9 AND tenant_id=$10 RETURNING *`,
      [proceso, tipo, responsable || null, autoridad || null, funciones || null,
       recursos || null, rendicion || null, clausula || null, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Fila no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar fila de matriz de roles' })
  }
})

// DELETE /api/contexto-empresa/matriz-roles/:id
router.delete('/matriz-roles/:id', requirePermission('contexto_empresa', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM matriz_roles WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId])
    if (!rowCount) return res.status(404).json({ error: 'Fila no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar fila de matriz de roles' })
  }
})

/* ══════════════════════════════════════════════════════════════
   MATRIZ DE CARGOS (RF-004)
   ══════════════════════════════════════════════════════════════ */

// GET /api/contexto-empresa/matriz-cargos
router.get('/matriz-cargos', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM matriz_cargos WHERE tenant_id = $1 ORDER BY id', [req.user!.tenantId])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener matriz de cargos' })
  }
})

// POST /api/contexto-empresa/matriz-cargos  (reemplaza todo el set)
// BUG CORREGIDO: mismo caso que matriz-roles — el DELETE ahora está acotado al tenant.
router.post('/matriz-cargos', requirePermission('contexto_empresa', 'crear'), async (req: AuthRequest, res: Response) => {
  const { filas } = req.body as { filas: any[] }
  if (!Array.isArray(filas)) return res.status(400).json({ error: 'Se requiere un array "filas"' })

  const tenantId = req.user!.tenantId
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM matriz_cargos WHERE tenant_id = $1', [tenantId])
    for (const f of filas) {
      await client.query(
        `INSERT INTO matriz_cargos (proceso, tipo, actividades, responsable, funciones, clausula, clausula_detalle, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [f.proceso, f.tipo, JSON.stringify(f.actividades || []), f.responsable || null,
         f.funciones || null, f.clausula || null, f.clausulaDetalle || null, tenantId]
      )
    }
    await client.query('COMMIT')
    const { rows } = await pool.query('SELECT * FROM matriz_cargos WHERE tenant_id = $1 ORDER BY id', [tenantId])
    res.status(201).json(rows)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Error al guardar matriz de cargos' })
  } finally {
    client.release()
  }
})

// PUT /api/contexto-empresa/matriz-cargos/:id
router.put('/matriz-cargos/:id', requirePermission('contexto_empresa', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { proceso, tipo, actividades, responsable, funciones, clausula, clausulaDetalle } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE matriz_cargos SET proceso=$1, tipo=$2, actividades=$3, responsable=$4,
       funciones=$5, clausula=$6, clausula_detalle=$7 WHERE id=$8 AND tenant_id=$9 RETURNING *`,
      [proceso, tipo, JSON.stringify(actividades || []), responsable || null,
       funciones || null, clausula || null, clausulaDetalle || null, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Fila no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar fila de matriz de cargos' })
  }
})

// POST /api/contexto-empresa/matriz-cargos/nueva  (agregar una fila manual)
router.post('/matriz-cargos/nueva', requirePermission('contexto_empresa', 'crear'), async (req: AuthRequest, res: Response) => {
  const { proceso, tipo, actividades, responsable, funciones, clausula, clausulaDetalle } = req.body
  if (!proceso) return res.status(400).json({ error: 'proceso es requerido' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO matriz_cargos (proceso, tipo, actividades, responsable, funciones, clausula, clausula_detalle, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [proceso, tipo || 'misional', JSON.stringify(actividades || []), responsable || null,
       funciones || null, clausula || null, clausulaDetalle || null, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear fila de matriz de cargos' })
  }
})

// DELETE /api/contexto-empresa/matriz-cargos/:id
router.delete('/matriz-cargos/:id', requirePermission('contexto_empresa', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM matriz_cargos WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId])
    if (!rowCount) return res.status(404).json({ error: 'Fila no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar fila de matriz de cargos' })
  }
})

/* ══════════════════════════════════════════════════════════════
   MATRIZ DE RECURSOS Y AMBIENTE (§7.1)
   ══════════════════════════════════════════════════════════════ */

// GET /api/contexto-empresa/matriz-recursos
router.get('/matriz-recursos', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM matriz_recursos WHERE tenant_id = $1 ORDER BY id', [req.user!.tenantId])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener matriz de recursos' })
  }
})

// POST /api/contexto-empresa/matriz-recursos  (reemplaza todo el set, usado tras análisis IA)
// BUG CORREGIDO: mismo caso — el DELETE ahora está acotado al tenant.
router.post('/matriz-recursos', requirePermission('contexto_empresa', 'crear'), async (req: AuthRequest, res: Response) => {
  const { filas } = req.body as { filas: any[] }
  if (!Array.isArray(filas)) return res.status(400).json({ error: 'Se requiere un array "filas"' })

  const tenantId = req.user!.tenantId
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM matriz_recursos WHERE tenant_id = $1', [tenantId])
    for (const f of filas) {
      await client.query(
        `INSERT INTO matriz_recursos
           (proceso, n_personas, infraestructura, hardware_software, transporte,
            ambiente_social, ambiente_psicologico, ambiente_fisico,
            var_social, var_psicologica, var_fisica, calificacion_promedio,
            nivel_riesgo_verde, accion_requerida,
            recurso_evaluado, hallazgo, riesgo, impacto, probabilidad,
            nivel_riesgo_azul, oportunidad, accion, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [
          f.proceso, f.nPersonas || null, f.infraestructura || null, f.hardwareSoftware || null, f.transporte || null,
          f.ambienteSocial || null, f.ambientePsicologico || null, f.ambienteFisico || null,
          f.varSocial ?? null, f.varPsicologica ?? null, f.varFisica ?? null, f.calificacionPromedio ?? null,
          f.nivelRiesgoVerde || null, f.accionRequerida || null,
          f.recursoEvaluado || null, f.hallazgo || null, f.riesgo || null, f.impacto || null, f.probabilidad || null,
          f.nivelRiesgoAzul || null, f.oportunidad || null, f.accion || null, tenantId,
        ]
      )
    }
    await client.query('COMMIT')
    const { rows } = await pool.query('SELECT * FROM matriz_recursos WHERE tenant_id = $1 ORDER BY id', [tenantId])
    res.status(201).json(rows)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Error al guardar matriz de recursos' })
  } finally {
    client.release()
  }
})

// PUT /api/contexto-empresa/matriz-recursos/:id
router.put('/matriz-recursos/:id', requirePermission('contexto_empresa', 'editar'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const f = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE matriz_recursos SET
         proceso=$1, n_personas=$2, infraestructura=$3, hardware_software=$4, transporte=$5,
         ambiente_social=$6, ambiente_psicologico=$7, ambiente_fisico=$8
       WHERE id=$9 AND tenant_id=$10 RETURNING *`,
      [f.proceso, f.nPersonas || null, f.infraestructura || null, f.hardwareSoftware || null,
       f.transporte || null, f.ambienteSocial || null, f.ambientePsicologico || null,
       f.ambienteFisico || null, id, req.user!.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Fila no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar fila de matriz de recursos' })
  }
})

/* ══════════════════════════════════════════════════════════════
   ACTIVIDADES DE LA EMPRESA (§4.1 / §8.1)
   ══════════════════════════════════════════════════════════════ */

// GET /api/contexto-empresa/actividades
router.get('/actividades', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM actividades_empresa WHERE tenant_id = $1 ORDER BY creada_en DESC', [req.user!.tenantId])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener actividades' })
  }
})

// POST /api/contexto-empresa/actividades
router.post('/actividades', requirePermission('contexto_empresa', 'crear'), async (req: AuthRequest, res: Response) => {
  const { id, nombre, proceso, responsable, objetivo, indicador, entradas, salidas, creadaEn } = req.body
  if (!id || !nombre) return res.status(400).json({ error: 'id y nombre son requeridos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO actividades_empresa (id, nombre, proceso, responsable, objetivo, indicador, entradas, salidas, creada_en, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, nombre, proceso || null, responsable || null, objetivo || null, indicador || null,
       JSON.stringify(entradas || []), JSON.stringify(salidas || []), creadaEn || new Date().toISOString(), req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una actividad con ese id' })
    console.error(err)
    res.status(500).json({ error: 'Error al crear actividad' })
  }
})

// DELETE /api/contexto-empresa/actividades/:id
router.delete('/actividades/:id', requirePermission('contexto_empresa', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM actividades_empresa WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId])
    if (!rowCount) return res.status(404).json({ error: 'Actividad no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar actividad' })
  }
})

/* ══════════════════════════════════════════════════════════════
   MAPA DE PROCEDIMIENTO (§4.4 / §8.1)
   ══════════════════════════════════════════════════════════════ */

// GET /api/contexto-empresa/mapa-procedimiento
router.get('/mapa-procedimiento', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM mapa_procedimiento WHERE tenant_id = $1 ORDER BY id',
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener mapa de procedimiento' })
  }
})

// POST /api/contexto-empresa/mapa-procedimiento (reemplaza todo el set — usado tras análisis IA)
router.post('/mapa-procedimiento', requirePermission('planes_operacion', 'crear'), async (req: AuthRequest, res: Response) => {
  const { filas } = req.body as { filas: any[] }
  if (!Array.isArray(filas)) return res.status(400).json({ error: 'Se requiere un array "filas"' })

  const tenantId = req.user!.tenantId
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM mapa_procedimiento WHERE tenant_id = $1', [tenantId])
    for (const f of filas) {
      await client.query(
        `INSERT INTO mapa_procedimiento (proceso, tipo, responsable, clausula, funciones, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [f.proceso, f.tipo || 'misional', f.responsable || null,
         f.clausula || null, f.funciones || null, tenantId]
      )
    }
    await client.query('COMMIT')
    const { rows } = await pool.query(
      'SELECT * FROM mapa_procedimiento WHERE tenant_id = $1 ORDER BY id', [tenantId]
    )
    res.status(201).json(rows)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Error al guardar mapa de procedimiento' })
  } finally {
    client.release()
  }
})

// POST /api/contexto-empresa/mapa-procedimiento/nueva (agrega una fila individual)
router.post('/mapa-procedimiento/nueva', requirePermission('planes_operacion', 'crear'), async (req: AuthRequest, res: Response) => {
  const { proceso, tipo, responsable, clausula, funciones } = req.body
  if (!proceso) return res.status(400).json({ error: 'proceso es requerido' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO mapa_procedimiento (proceso, tipo, responsable, clausula, funciones, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [proceso, tipo || 'misional', responsable || null,
       clausula || null, funciones || null, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear fila de mapa de procedimiento' })
  }
})

// PUT /api/contexto-empresa/mapa-procedimiento/:id
router.put('/mapa-procedimiento/:id', requirePermission('planes_operacion', 'editar'), async (req: AuthRequest, res: Response) => {
  const { proceso, tipo, responsable, clausula, funciones } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE mapa_procedimiento
       SET proceso=$1, tipo=$2, responsable=$3, clausula=$4, funciones=$5, actualizado_en=NOW()
       WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [proceso, tipo || 'misional', responsable || null,
       clausula || null, funciones || null, req.params.id, req.user!.tenantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Fila no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar fila de mapa de procedimiento' })
  }
})

// DELETE /api/contexto-empresa/mapa-procedimiento/:id
router.delete('/mapa-procedimiento/:id', requirePermission('planes_operacion', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM mapa_procedimiento WHERE id=$1 AND tenant_id=$2',
      [req.params.id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Fila no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar fila de mapa de procedimiento' })
  }
})

/* ══════════════════════════════════════════════════════════════
   MANUAL DE PROCEDIMIENTO (§8.1 / §4.4.2)
   ══════════════════════════════════════════════════════════════ */

// GET /api/contexto-empresa/manual-procedimiento
router.get('/manual-procedimiento', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM manual_procedimiento WHERE tenant_id = $1 ORDER BY id',
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener manual de procedimiento' })
  }
})

// POST /api/contexto-empresa/manual-procedimiento (reemplaza todo el set — usado tras análisis IA)
router.post('/manual-procedimiento', requirePermission('planes_operacion', 'crear'), async (req: AuthRequest, res: Response) => {
  const { filas } = req.body as { filas: any[] }
  if (!Array.isArray(filas)) return res.status(400).json({ error: 'Se requiere un array "filas"' })

  const tenantId = req.user!.tenantId
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM manual_procedimiento WHERE tenant_id = $1', [tenantId])
    for (const f of filas) {
      await client.query(
        `INSERT INTO manual_procedimiento
           (codigo, proceso, objetivo, entradas, salidas, indicador, responsable, estado, clausula, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [f.codigo || '', f.proceso, f.objetivo || null, f.entradas || null,
         f.salidas || null, f.indicador || null, f.responsable || null,
         f.estado || 'Activo', f.clausula || null, tenantId]
      )
    }
    await client.query('COMMIT')
    const { rows } = await pool.query(
      'SELECT * FROM manual_procedimiento WHERE tenant_id = $1 ORDER BY id', [tenantId]
    )
    res.status(201).json(rows)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Error al guardar manual de procedimiento' })
  } finally {
    client.release()
  }
})

// POST /api/contexto-empresa/manual-procedimiento/nueva (agrega una fila individual)
router.post('/manual-procedimiento/nueva', requirePermission('planes_operacion', 'crear'), async (req: AuthRequest, res: Response) => {
  const { codigo, proceso, objetivo, entradas, salidas, indicador, responsable, estado, clausula } = req.body
  if (!proceso) return res.status(400).json({ error: 'proceso es requerido' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO manual_procedimiento
         (codigo, proceso, objetivo, entradas, salidas, indicador, responsable, estado, clausula, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [codigo || '', proceso, objetivo || null, entradas || null,
       salidas || null, indicador || null, responsable || null,
       estado || 'Activo', clausula || null, req.user!.tenantId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear fila de manual de procedimiento' })
  }
})

// PUT /api/contexto-empresa/manual-procedimiento/:id
router.put('/manual-procedimiento/:id', requirePermission('planes_operacion', 'editar'), async (req: AuthRequest, res: Response) => {
  const { codigo, proceso, objetivo, entradas, salidas, indicador, responsable, estado, clausula } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE manual_procedimiento
       SET codigo=$1, proceso=$2, objetivo=$3, entradas=$4, salidas=$5,
           indicador=$6, responsable=$7, estado=$8, clausula=$9, actualizado_en=NOW()
       WHERE id=$10 AND tenant_id=$11 RETURNING *`,
      [codigo || '', proceso, objetivo || null, entradas || null,
       salidas || null, indicador || null, responsable || null,
       estado || 'Activo', clausula || null, req.params.id, req.user!.tenantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Fila no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar fila de manual de procedimiento' })
  }
})

// DELETE /api/contexto-empresa/manual-procedimiento/:id
router.delete('/manual-procedimiento/:id', requirePermission('planes_operacion', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM manual_procedimiento WHERE id=$1 AND tenant_id=$2',
      [req.params.id, req.user!.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Fila no encontrada' })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar fila de manual de procedimiento' })
  }
})

export default router