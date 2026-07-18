import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db'
import { platformAdminMiddleware, PlatformAdminRequest } from '../middleware/platformAdminAuth'
import { getUserPermissions } from './auth'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { s3 } from '../services/storageService'

const router = Router()

// ── Rate limiting simple en memoria para el login ──────────────────
// Un token de platform_admin puede crear/suspender tenants completos:
// vale la pena un freno básico contra fuerza bruta a nivel de aplicación,
// además de lo que se configure a nivel de infraestructura (recomendado:
// restringir /api/platform-admin por IP en Railway/Cloudflare).
const LOGIN_ATTEMPT_LIMIT = 5
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string): boolean {
  const entry = loginAttempts.get(key)
  const now = Date.now()
  if (!entry || entry.resetAt < now) return false
  return entry.count >= LOGIN_ATTEMPT_LIMIT
}

function registerFailedAttempt(key: string) {
  const now = Date.now()
  const entry = loginAttempts.get(key)
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_ATTEMPT_WINDOW_MS })
  } else {
    entry.count += 1
  }
}

function clearAttempts(key: string) {
  loginAttempts.delete(key)
}

// ── Auditoría ────────────────────────────────────────────────────
// Nunca debe tumbar la operación principal: si el insert del log falla,
// se registra en consola pero la acción que originó el log ya se hizo.
async function registrarAuditoria(
  actor: { id: number; email: string },
  accion: string,
  entidadTipo: 'tenant' | 'platform_admin',
  entidadId: string | number | null,
  detalle: Record<string, any> = {}
) {
  try {
    await pool.query(
      `INSERT INTO platform_admin_audit_log (actor_admin_id, actor_email, accion, entidad_tipo, entidad_id, detalle)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actor.id, actor.email, accion, entidadTipo, entidadId != null ? String(entidadId) : null, JSON.stringify(detalle)]
    )
  } catch (err) {
    console.error('[auditoria] No se pudo registrar:', err)
  }
}

// POST /api/platform-admin/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' })
  }

  const rateLimitKey = `${email}:${req.ip}`
  if (isRateLimited(rateLimitKey)) {
    return res.status(429).json({ error: 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.' })
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, email, password_hash FROM platform_admins WHERE email = $1 AND activo = true',
      [email]
    )
    const admin = rows[0]
    if (!admin) {
      registerFailedAttempt(rateLimitKey)
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    const valid = await bcrypt.compare(password, admin.password_hash)
    if (!valid) {
      registerFailedAttempt(rateLimitKey)
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    clearAttempts(rateLimitKey)

    // Secret DISTINTA a la de los tokens de tenant (JWT_SECRET). Si algún
    // día una de las dos secrets se filtra, la otra credencial (tenant o
    // plataforma) sigue intacta — no comparten superficie de ataque.
    const token = jwt.sign(
      { id: admin.id, email: admin.email, type: 'platform_admin' },
      process.env.PLATFORM_ADMIN_JWT_SECRET!,
      { expiresIn: '4h' } // más corto que el de tenants (8h): credencial más sensible
    )

    res.json({ token, admin: { id: admin.id, nombre: admin.nombre, email: admin.email } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.use(platformAdminMiddleware)

// GET /api/platform-admin/tenants
// Única query autorizada en todo Governex que lista TODOS los tenants sin
// filtrar por ninguno — es intencional, es lo que hace este rol por diseño,
// y por eso está detrás de platformAdminMiddleware (nunca authMiddleware).
router.get('/tenants', async (_req: PlatformAdminRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, COUNT(u.id) AS usuarios_count
       FROM tenants t
       LEFT JOIN usuarios u ON u.tenant_id = t.id
       GROUP BY t.id
       ORDER BY t.fecha_creacion DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar tenants' })
  }
})

// POST /api/platform-admin/tenants
// Crea el tenant + su primer usuario (rol "Superusuario") + el catálogo
// mínimo que ese tenant necesita para que el módulo de Procesos funcione
// (TIPOS_PROCESO ya es una tabla por-tenant desde la migración multi-tenant).
router.post('/tenants', async (req: PlatformAdminRequest, res: Response) => {
  const { nombreEmpresa, nit, plan, adminNombre, adminEmail, adminPassword } = req.body

  if (!nombreEmpresa || !nit || !adminNombre || !adminEmail || !adminPassword) {
    return res.status(400).json({
      error: 'nombreEmpresa, nit, adminNombre, adminEmail y adminPassword son requeridos',
    })
  }
  if (adminPassword.length < 8) {
    return res.status(400).json({ error: 'adminPassword debe tener al menos 8 caracteres' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: tenantRows } = await client.query(
      `INSERT INTO tenants (nombre, nit, estado, plan) VALUES ($1, $2, 'Activo', $3) RETURNING *`,
      [nombreEmpresa, nit, plan || 'Standard']
    )
    const tenant = tenantRows[0]

    // Catálogo mínimo de arranque: sin esto, PROCESOS no tiene ningún
    // tipo_id válido y el módulo nace roto para el tenant nuevo.
    await client.query(
      `INSERT INTO tipos_proceso (nombre, tenant_id) VALUES ('Estratégico', $1), ('Misional', $1), ('Apoyo', $1)`,
      [tenant.id]
    )

    const { rows: rolRows } = await client.query(`SELECT id FROM roles WHERE nombre = 'Superusuario'`)
    if (!rolRows[0]) throw new Error('Rol "Superusuario" no existe en el catálogo global de roles')

    const passwordHash = await bcrypt.hash(adminPassword, 10)
    const { rows: userRows } = await client.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id, tenant_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, email`,
      [adminNombre, adminEmail, passwordHash, rolRows[0].id, tenant.id]
    )

    await client.query('COMMIT')
    await registrarAuditoria(req.platformAdmin!, 'crear_tenant', 'tenant', tenant.id, {
      nombre: tenant.nombre, nit: tenant.nit, plan: tenant.plan, adminEmail: userRows[0].email,
    })
    res.status(201).json({ tenant, adminUser: userRows[0] })
  } catch (err: any) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      // Puede ser el UNIQUE de tenants.nit o el de usuarios.email (global) —
      // se distingue por el nombre de constraint para dar un mensaje útil.
      if (err.constraint?.includes('email')) {
        return res.status(409).json({ error: 'El email del administrador ya está en uso en la plataforma' })
      }
      return res.status(409).json({ error: 'Ya existe un tenant con ese NIT' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al crear el tenant' })
  } finally {
    client.release()
  }
})

// PUT /api/platform-admin/tenants/:id/estado
// Dispara el mecanismo de suspensión ya construido en authMiddleware
// (corte de acceso en ≤60s por la caché de estado de tenant).
router.put('/tenants/:id/estado', async (req: PlatformAdminRequest, res: Response) => {
  const { id } = req.params
  const { estado } = req.body
  const validos = ['Activo', 'Suspendido', 'Cancelado']
  if (!validos.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${validos.join(', ')}` })
  }
  try {
    const { rows } = await pool.query(
      `UPDATE tenants SET estado = $1 WHERE id = $2 RETURNING *`,
      [estado, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Tenant no encontrado' })
    await registrarAuditoria(req.platformAdmin!, 'cambiar_estado_tenant', 'tenant', id, {
      nombre: rows[0].nombre, nuevoEstado: estado,
    })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar estado del tenant' })
  }
})

// POST /api/platform-admin/tenants/:id/impersonate
// Emite un JWT de tenant válido para el usuario indicado, SIN conocer su
// contraseña. Vida corta (30 min, contra las 8h de un login normal) porque
// es una credencial elevada emitida por un tercero (el super-admin), no
// por el propio usuario.
router.post('/tenants/:id/impersonate', async (req: PlatformAdminRequest, res: Response) => {
  const { id } = req.params
  const { usuarioId } = req.body
  if (!usuarioId) return res.status(400).json({ error: 'usuarioId es requerido' })

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.activo, r.nombre AS rol,
              t.id AS tenant_id, t.nombre AS tenant_nombre, t.estado AS tenant_estado
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1 AND u.tenant_id = $2`,
      [usuarioId, id]
    )
    const usuario = rows[0]
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado en este tenant' })
    if (!usuario.activo) return res.status(400).json({ error: 'Este usuario está inactivo' })
    if (usuario.tenant_estado !== 'Activo') {
      return res.status(400).json({ error: 'No puedes impersonar usuarios de un tenant que no está activo' })
    }

    // Mismo shape que el JWT de login normal (id, tenantId, rol) para que
    // authMiddleware lo acepte sin ningún cambio. Los campos extra
    // (impersonatedBy*) viajan solo para trazabilidad si se decodifica el
    // token en logs; authMiddleware los ignora.
    const token = jwt.sign(
      {
        id: usuario.id,
        tenantId: usuario.tenant_id,
        rol: usuario.rol,
        impersonatedByAdminId: req.platformAdmin!.id,
        impersonatedByAdminEmail: req.platformAdmin!.email,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '30m' }
    )

    await registrarAuditoria(req.platformAdmin!, 'impersonar_usuario', 'tenant', id, {
      usuarioEmail: usuario.email, tenantNombre: usuario.tenant_nombre,
    })

    const permissions = await getUserPermissions(usuario.id)

    res.json({
      token,
      user: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, permissions },
      tenant: { id: usuario.tenant_id, nombre: usuario.tenant_nombre },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al iniciar la impersonación' })
  }
})

// ── Gestión de otros platform_admins ────────────────────────────

// GET /api/platform-admin/platform-admins
router.get('/platform-admins', async (_req: PlatformAdminRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, email, activo, creado_en FROM platform_admins ORDER BY creado_en ASC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar administradores' })
  }
})

// POST /api/platform-admin/platform-admins
router.post('/platform-admins', async (req: PlatformAdminRequest, res: Response) => {
  const { nombre, email, password } = req.body
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'nombre, email y password son requeridos' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password debe tener al menos 8 caracteres' })
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      `INSERT INTO platform_admins (nombre, email, password_hash) VALUES ($1, $2, $3)
       RETURNING id, nombre, email, activo, creado_en`,
      [nombre, email, passwordHash]
    )
    const nuevoAdmin = rows[0]
    await registrarAuditoria(req.platformAdmin!, 'crear_admin', 'platform_admin', nuevoAdmin.id, { nombre, email })
    res.status(201).json(nuevoAdmin)
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un administrador con ese email' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al crear el administrador' })
  }
})

// PUT /api/platform-admin/platform-admins/:id/estado
router.put('/platform-admins/:id/estado', async (req: PlatformAdminRequest, res: Response) => {
  const { id } = req.params
  const { activo } = req.body
  if (typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'activo debe ser true o false' })
  }

  // Un admin nunca puede desactivarse a sí mismo — evitaría quedar
  // bloqueado sin nadie con sesión activa para revertirlo.
  if (Number(id) === req.platformAdmin!.id && !activo) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' })
  }

  try {
    if (!activo) {
      // No dejar la plataforma sin ningún admin activo.
      const { rows: activos } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM platform_admins WHERE activo = true AND id != $1`,
        [id]
      )
      if (activos[0].total === 0) {
        return res.status(400).json({ error: 'No puedes desactivar al único administrador activo de la plataforma' })
      }
    }

    const { rows } = await pool.query(
      `UPDATE platform_admins SET activo = $1 WHERE id = $2
       RETURNING id, nombre, email, activo, creado_en`,
      [activo, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Administrador no encontrado' })

    await registrarAuditoria(req.platformAdmin!, 'cambiar_estado_admin', 'platform_admin', id, {
      email: rows[0].email, nuevoEstado: activo,
    })

    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar estado del administrador' })
  }
})

// GET /api/platform-admin/audit-log
router.get('/audit-log', async (_req: PlatformAdminRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, actor_admin_id, actor_email, accion, entidad_tipo, entidad_id, detalle, creado_en
       FROM platform_admin_audit_log
       ORDER BY creado_en DESC
       LIMIT 200`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar la bitácora de auditoría' })
  }
})

// ── Detalle y edición de un tenant individual ───────────────────

// GET /api/platform-admin/tenants/:id
router.get('/tenants/:id', async (req: PlatformAdminRequest, res: Response) => {
  const { id } = req.params
  try {
    const { rows: tenantRows } = await pool.query(
      `SELECT t.*, COUNT(u.id) AS usuarios_count
       FROM tenants t
       LEFT JOIN usuarios u ON u.tenant_id = t.id
       WHERE t.id = $1
       GROUP BY t.id`,
      [id]
    )
    if (!tenantRows[0]) return res.status(404).json({ error: 'Tenant no encontrado' })

    const { rows: usuarios } = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.activo, u.creado_en, r.nombre AS rol_nombre
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.tenant_id = $1
       ORDER BY u.creado_en ASC`,
      [id]
    )

    res.json({ tenant: tenantRows[0], usuarios })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener el detalle del tenant' })
  }
})

// PUT /api/platform-admin/tenants/:id
router.put('/tenants/:id', async (req: PlatformAdminRequest, res: Response) => {
  const { id } = req.params
  const { nombre, nit, plan } = req.body
  const planesValidos = ['Standard', 'Pro', 'Enterprise']

  if (!nombre || !nit) {
    return res.status(400).json({ error: 'nombre y nit son requeridos' })
  }
  if (plan && !planesValidos.includes(plan)) {
    return res.status(400).json({ error: `plan debe ser uno de: ${planesValidos.join(', ')}` })
  }

  try {
    const { rows } = await pool.query(
      `UPDATE tenants SET nombre = $1, nit = $2, plan = COALESCE($3, plan) WHERE id = $4 RETURNING *`,
      [nombre, nit, plan, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Tenant no encontrado' })

    await registrarAuditoria(req.platformAdmin!, 'editar_tenant', 'tenant', id, { nombre, nit, plan })
    res.json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un tenant con ese NIT' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar el tenant' })
  }
})

// POST /api/platform-admin/tenants/:id/usuarios/:usuarioId/reset-password
router.post('/tenants/:id/usuarios/:usuarioId/reset-password', async (req: PlatformAdminRequest, res: Response) => {
  const { id, usuarioId } = req.params
  const { password } = req.body

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'password debe tener al menos 8 caracteres' })
  }

  try {
    // Verificar que el usuario pertenece efectivamente a este tenant —
    // evita que un id de usuario de OTRO tenant se resetee por error/malicia
    // usando el id de tenant equivocado en la URL.
    const { rows: usuarioRows } = await pool.query(
      `SELECT id, email FROM usuarios WHERE id = $1 AND tenant_id = $2`,
      [usuarioId, id]
    )
    if (!usuarioRows[0]) return res.status(404).json({ error: 'Usuario no encontrado en este tenant' })

    const passwordHash = await bcrypt.hash(password, 10)
    await pool.query(`UPDATE usuarios SET password_hash = $1 WHERE id = $2`, [passwordHash, usuarioId])

    await registrarAuditoria(req.platformAdmin!, 'resetear_password_usuario', 'tenant', id, {
      usuarioEmail: usuarioRows[0].email,
    })

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al resetear la contraseña' })
  }
})

// GET /api/platform-admin/global-stats
router.get('/global-stats', async (req: PlatformAdminRequest, res: Response) => {
  try {
    const [
      usuariosRes,
      procesosRes,
      riesgosRes,
      auditoriasRes,
      documentosRes,
      ncRes,
      mejorasRes,
      tenantsRes
    ] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM usuarios'),
      pool.query('SELECT COUNT(*)::int AS total FROM procesos'),
      pool.query('SELECT COUNT(*)::int AS total FROM riesgos'),
      pool.query('SELECT COUNT(*)::int AS total FROM auditorias'),
      pool.query('SELECT COUNT(*)::int AS total FROM documentos'),
      pool.query('SELECT COUNT(*)::int AS total FROM no_conformidades'),
      pool.query('SELECT COUNT(*)::int AS total FROM mejoras_continuas'),
      pool.query("SELECT plan, estado FROM tenants")
    ])

    // Calculate MRR based on active tenants
    let mrr = 0
    tenantsRes.rows.forEach(t => {
      if (t.estado === 'Activo') {
        if (t.plan === 'Standard') mrr += 49
        else if (t.plan === 'Pro') mrr += 99
        else if (t.plan === 'Enterprise') mrr += 249
      }
    })

    // R2 Bucket stats
    let totalFiles = 0
    let totalStorageBytes = 0

    try {
      const response = await s3.send(new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET,
      }))
      if (response.Contents) {
        totalFiles = response.Contents.length
        totalStorageBytes = response.Contents.reduce((sum, item) => sum + (item.Size || 0), 0)
      }
    } catch (s3Err) {
      console.error('Error fetching R2 stats:', s3Err)
    }

    res.json({
      mrr,
      totalFiles,
      totalStorageBytes,
      totalUsuarios: usuariosRes.rows[0]?.total || 0,
      totalProcesos: procesosRes.rows[0]?.total || 0,
      totalRiesgos: riesgosRes.rows[0]?.total || 0,
      totalAuditorias: auditoriasRes.rows[0]?.total || 0,
      totalDocumentos: documentosRes.rows[0]?.total || 0,
      totalNoConformidades: ncRes.rows[0]?.total || 0,
      totalMejoras: mejorasRes.rows[0]?.total || 0,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener estadísticas globales' })
  }
})

export default router
