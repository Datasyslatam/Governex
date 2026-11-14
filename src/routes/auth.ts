import { Router, Request, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, AuthRequest, olvidarEstadoUsuario } from '../middleware/auth'
import { registrarActividadDirecto } from '../middleware/activityLogger'
import { loginRateLimit } from '../middleware/rateLimit'
import { validarPassword } from '../middleware/passwordPolicy'
import { olvidarPermisos } from '../middleware/rbac'
import { auditar, Categoria, Resultado } from '../security/audit'
import { hashPassword, verifyPassword } from '../security/passwords'
import { estaBloqueada, registrarFallo, desbloquear } from '../security/lockout'
import { mfaObligatorioParaRol } from '../security/mfa'
import {
  obtenerSesion, revocarSesion, revocarSesionesUsuario, limpiarCookies, csrfValido,
} from '../security/sessions'
import {
  abrirSesionTrasPassword, sesionPrevia, activarSesion, verificarCodigo, prepararEnrolamiento,
  confirmarEnrolamiento, regenerarCodigos, desactivarMfa, codigosRestantes, Principal,
} from '../security/authFlow'

const router = Router()

// 10 intentos fallidos por IP+email cada 15 minutos (los logins exitosos no cuentan).
const loginLimiter = loginRateLimit({ windowMs: 15 * 60_000, maxFailures: 10 })
// Límite de intentos de código MFA por IP (además del bloqueo por cuenta).
const mfaLimiter = loginRateLimit({ windowMs: 15 * 60_000, maxFailures: 10 })

// Mismo mensaje para TODO fallo de credenciales: usuario inexistente,
// contraseña errada, código MFA errado o cuenta bloqueada (V13 / CWE-204).
const CREDENCIALES = 'Credenciales incorrectas o cuenta bloqueada temporalmente'

// Helper to fetch user active permissions
export async function getUserPermissions(userId: number): Promise<string[]> {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT p.recurso, p.accion
       FROM usuarios u
       LEFT JOIN rol_permisos rp ON rp.rol_id = u.rol_id AND u.tiene_permisos_personalizados = false
       LEFT JOIN usuario_permisos up ON up.usuario_id = u.id AND u.tiene_permisos_personalizados = true
       JOIN permisos p ON p.id = COALESCE(up.permiso_id, rp.permiso_id)
       WHERE u.id = $1`,
      [userId]
    )
    return rows.map((r: any) => `${r.recurso}:${r.accion}`)
  } catch (err) {
    console.error('Error fetching user permissions:', err)
    return []
  }
}

const SELECT_USUARIO = `
  SELECT u.id, u.nombre, u.email, u.password_hash, u.tenant_id, u.activo,
         u.mfa_habilitado, u.mfa_secreto_cifrado, u.mfa_ultimo_paso, u.bloqueado_hasta,
         u.debe_cambiar_password, r.nombre AS rol, t.estado AS tenant_estado, t.nombre AS tenant_nombre
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
  JOIN tenants t ON t.id = u.tenant_id`

async function cargarUsuario(id: number) {
  const { rows } = await pool.query(`${SELECT_USUARIO} WHERE u.id = $1`, [id])
  return rows[0]
}

/** Datos que el frontend necesita tras iniciar sesión (o en GET /me). */
async function perfil(u: any, extra: Record<string, unknown> = {}) {
  return {
    user: {
      id: u.id, nombre: u.nombre, email: u.email, rol: u.rol,
      permissions: await getUserPermissions(u.id),
      mfaHabilitado: u.mfa_habilitado,
      mfaObligatorio: mfaObligatorioParaRol(u.rol),
      debeCambiarPassword: u.debe_cambiar_password,
    },
    tenant: { id: u.tenant_id, nombre: u.tenant_nombre },
    ...extra,
  }
}

function log(u: any, accion: string, detalle: string, req?: Request) {
  return registrarActividadDirecto(u.tenant_id, u.id, u.nombre, u.email, u.rol, accion, 'auth', detalle, req)
}

/** Entrada en la bitácora de actividad de la empresa a nombre del usuario de la sesión. */
async function logActor(req: AuthRequest, accion: string, detalle: string) {
  const actor = await cargarUsuario(req.user!.id)
  if (actor) await log(actor, accion, detalle, req)
}

/** Evento en la bitácora de seguridad inmutable con el usuario `u` como actor. */
function aud(req: Request, u: any, categoria: Categoria, accion: string, resultado: Resultado, detalle: Record<string, unknown> = {}) {
  return auditar(req, {
    categoria, accion, resultado,
    tenantId: u?.tenant_id ?? null,
    actor: u ? { tipo: 'usuario', id: u.id, email: u.email } : { tipo: 'anonimo' },
    detalle,
  })
}

// POST /api/auth/login
// Respuesta: { estado: 'activa', user, tenant } | { estado: 'mfa' } | { estado: 'enrolar_mfa' }
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' })
  }

  try {
    const { rows } = await pool.query(`${SELECT_USUARIO} WHERE u.email = $1 AND u.activo = true`, [email.trim()])
    const user = rows[0]

    // La contraseña se verifica SIEMPRE (hash ficticio si no existe el usuario)
    // antes de revelar nada: ni existencia, ni bloqueo, ni estado de la empresa.
    const { ok, needsRehash } = await verifyPassword(password, user?.password_hash)
    if (!user) {
      // El correo intentado se registra para detectar enumeración / credential stuffing.
      await aud(req, null, 'autenticacion', 'login', 'fallo', { motivo: 'usuario_inexistente', email_intentado: email.trim().slice(0, 150) })
      return res.status(401).json({ error: CREDENCIALES })
    }
    if (estaBloqueada(user.bloqueado_hasta)) {
      await aud(req, user, 'autenticacion', 'login', 'denegado', { motivo: 'cuenta_bloqueada' })
      return res.status(401).json({ error: CREDENCIALES })
    }
    if (!ok) {
      const bloqueada = await registrarFallo('usuarios', user.id)
      await aud(req, user, 'autenticacion', 'login', 'fallo', { motivo: 'password_incorrecta' })
      if (bloqueada) {
        await log(user, 'Cuenta bloqueada', 'Cuenta bloqueada temporalmente por intentos fallidos de inicio de sesión.', req)
        await aud(req, user, 'seguridad', 'cuenta_bloqueada', 'exito', { motivo: 'intentos_fallidos' })
      }
      return res.status(401).json({ error: CREDENCIALES })
    }

    if (user.tenant_estado !== 'Activo') {
      await aud(req, user, 'autenticacion', 'login', 'denegado', { motivo: 'empresa_inactiva', estado: user.tenant_estado })
      return res.status(403).json({ error: 'La cuenta de tu empresa no está activa. Contacta a soporte de Governex.' })
    }

    // Migración transparente bcrypt → Argon2id.
    if (needsRehash) {
      await pool.query('UPDATE usuarios SET password_hash = $2 WHERE id = $1', [user.id, await hashPassword(password)])
    }

    const { etapa } = await abrirSesionTrasPassword(req, res, 'tenant', user as Principal, mfaObligatorioParaRol(user.rol))
    if (needsRehash) await aud(req, user, 'seguridad', 'hash_actualizado_argon2id', 'exito')
    if (etapa !== 'activa') {
      await aud(req, user, 'autenticacion', 'login_password_correcta', 'exito', { siguiente_paso: etapa })
      return res.json({ estado: etapa })
    }

    await log(user, 'Inicio de sesión', `El usuario ${user.nombre} inició sesión con éxito.`, req)
    await aud(req, user, 'autenticacion', 'login', 'exito', { mfa: false })
    res.json({ estado: 'activa', ...(await perfil(user)) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/mfa/verificar  { codigo }  (sesión previa en etapa "mfa")
router.post('/mfa/verificar', mfaLimiter, async (req: Request, res: Response) => {
  try {
    const previa = await sesionPrevia(req, 'tenant', ['mfa'])
    if (!previa) return res.status(401).json({ error: 'La verificación expiró. Inicia sesión de nuevo.', code: 'NO_SESSION' })
    const user = await cargarUsuario(previa.usuario_id!)
    if (!user || !user.activo || estaBloqueada(user.bloqueado_hasta)) {
      await revocarSesion(previa.id, 'mfa_rechazado')
      await aud(req, user, 'autenticacion', 'mfa_verificacion', 'denegado', { motivo: !user?.activo ? 'usuario_inactivo' : 'cuenta_bloqueada' })
      return res.status(401).json({ error: CREDENCIALES })
    }
    const tipo = await verificarCodigo('tenant', user, req.body?.codigo)
    if (!tipo) {
      await aud(req, user, 'autenticacion', 'mfa_verificacion', 'fallo')
      return res.status(401).json({ error: 'Código incorrecto' })
    }

    await activarSesion(req, res, 'tenant', previa)
    await log(user, 'Inicio de sesión', `El usuario ${user.nombre} inició sesión con MFA${tipo === 'recuperacion' ? ' (código de recuperación)' : ''}.`, req)
    await aud(req, user, 'autenticacion', 'login', 'exito', { mfa: true, tipo_codigo: tipo })
    res.json({ estado: 'activa', ...(await perfil(user, { codigosRestantes: await codigosRestantes('tenant', user.id) })) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

/**
 * Sesión que puede administrar su propio MFA: una sesión activa (desde
 * "Seguridad de la cuenta") o una previa en etapa "enrolar_mfa" (primer
 * ingreso de un rol con MFA obligatorio).
 */
async function sesionParaEnrolar(req: Request) {
  const s = await obtenerSesion(req, 'tenant')
  if (!s || !['activa', 'enrolar_mfa'].includes(s.etapa)) return null
  if (s.etapa === 'activa' && !csrfValido(req, s)) return null
  return s
}

// POST /api/auth/mfa/configurar  → { qr, secreto, otpauth }
router.post('/mfa/configurar', async (req: Request, res: Response) => {
  try {
    const s = await sesionParaEnrolar(req)
    if (!s) return res.status(401).json({ error: 'Sesión no válida', code: 'NO_SESSION' })
    const user = await cargarUsuario(s.usuario_id!)
    if (user.mfa_habilitado) return res.status(409).json({ error: 'El MFA ya está activo en esta cuenta' })
    res.json(await prepararEnrolamiento('tenant', user))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/mfa/activar  { codigo }  → { codigosRecuperacion }
router.post('/mfa/activar', mfaLimiter, async (req: Request, res: Response) => {
  try {
    const s = await sesionParaEnrolar(req)
    if (!s) return res.status(401).json({ error: 'Sesión no válida', code: 'NO_SESSION' })
    const user = await cargarUsuario(s.usuario_id!)
    const codigos = await confirmarEnrolamiento('tenant', user, req.body?.codigo)
    if (!codigos) {
      await aud(req, user, 'autenticacion', 'mfa_activacion', 'fallo')
      return res.status(400).json({ error: 'Código incorrecto. Verifica la hora de tu teléfono e intenta de nuevo.' })
    }

    await log(user, 'MFA activado', `El usuario ${user.nombre} activó la verificación en dos pasos.`, req)
    await aud(req, user, 'autenticacion', 'mfa_activado', 'exito', { primer_ingreso: s.etapa === 'enrolar_mfa' })
    const extra: Record<string, unknown> = { codigosRecuperacion: codigos }
    if (s.etapa === 'enrolar_mfa') {
      await activarSesion(req, res, 'tenant', s)
      await log(user, 'Inicio de sesión', `El usuario ${user.nombre} inició sesión (primer enrolamiento MFA).`, req)
      await aud(req, user, 'autenticacion', 'login', 'exito', { mfa: true, tipo_codigo: 'enrolamiento' })
      return res.json({ estado: 'activa', ...(await perfil({ ...user, mfa_habilitado: true }, extra)) })
    }
    res.json(extra)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/mfa/desactivar  { password, codigo }
router.post('/mfa/desactivar', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await cargarUsuario(req.user!.id)
    if (mfaObligatorioParaRol(user.rol)) {
      await aud(req, user, 'seguridad', 'mfa_desactivacion', 'denegado', { motivo: 'obligatorio_para_rol' })
      return res.status(403).json({ error: 'Tu rol exige verificación en dos pasos; no se puede desactivar.' })
    }
    const { ok } = await verifyPassword(String(req.body?.password ?? ''), user.password_hash)
    if (!ok || !(await verificarCodigo('tenant', user, req.body?.codigo))) {
      await aud(req, user, 'seguridad', 'mfa_desactivacion', 'fallo')
      return res.status(401).json({ error: 'Contraseña o código incorrectos' })
    }
    await desactivarMfa('tenant', user.id)
    await log(user, 'MFA desactivado', `El usuario ${user.nombre} desactivó la verificación en dos pasos.`, req)
    await aud(req, user, 'seguridad', 'mfa_desactivado', 'exito')
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/mfa/codigos-recuperacion  { codigo }  → regenera los 10 códigos
router.post('/mfa/codigos-recuperacion', authMiddleware, mfaLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const user = await cargarUsuario(req.user!.id)
    if (!user.mfa_habilitado || !(await verificarCodigo('tenant', user, req.body?.codigo))) {
      await aud(req, user, 'seguridad', 'mfa_codigos_regenerados', 'fallo')
      return res.status(401).json({ error: 'Código incorrecto' })
    }
    const codigos = await regenerarCodigos('tenant', user.id)
    await log(user, 'MFA códigos regenerados', `El usuario ${user.nombre} regeneró sus códigos de recuperación.`, req)
    await aud(req, user, 'seguridad', 'mfa_codigos_regenerados', 'exito')
    res.json({ codigosRecuperacion: codigos })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/auth/me  → valida la sesión y devuelve el perfil (el frontend ya
// no confía en lo guardado en localStorage).
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await cargarUsuario(req.user!.id)
    res.json(await perfil(user, {
      suplantacion: !!req.user!.suplantadoPor,
      codigosRestantes: user.mfa_habilitado ? await codigosRestantes('tenant', user.id) : null,
    }))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/password  { actual, nueva }  → cambia la propia contraseña
router.post('/password', authMiddleware, loginLimiter, async (req: AuthRequest, res: Response) => {
  const { actual, nueva } = req.body ?? {}
  try {
    const user = await cargarUsuario(req.user!.id)
    const { ok } = await verifyPassword(String(actual ?? ''), user.password_hash)
    if (!ok) {
      await registrarFallo('usuarios', user.id)
      await aud(req, user, 'autenticacion', 'cambio_password', 'fallo', { motivo: 'password_actual_incorrecta' })
      return res.status(401).json({ error: 'La contraseña actual no es correcta' })
    }
    const pwError = validarPassword(nueva, { email: user.email, nombre: user.nombre })
    if (pwError) return res.status(400).json({ error: pwError, code: 'WEAK_PASSWORD' })
    if ((await verifyPassword(nueva, user.password_hash)).ok) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual', code: 'WEAK_PASSWORD' })
    }
    await pool.query(
      `UPDATE usuarios SET password_hash = $2, debe_cambiar_password = false, password_cambiado_en = NOW() WHERE id = $1`,
      [user.id, await hashPassword(nueva)]
    )
    // Cierra todas las demás sesiones (si alguien más tenía la contraseña, queda fuera).
    await revocarSesionesUsuario(user.id, 'cambio_password', req.user!.sesionId)
    olvidarEstadoUsuario(user.id)
    await log(user, 'Cambio de contraseña', `El usuario ${user.nombre} cambió su contraseña; se cerraron sus otras sesiones.`, req)
    await aud(req, user, 'autenticacion', 'cambio_password', 'exito', { era_temporal: !!user.debe_cambiar_password })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/auth/sesiones  → sesiones activas del propio usuario
router.get('/sesiones', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, ip, user_agent, creada_en, ultimo_uso_en, expira_en, (suplantado_por_admin IS NOT NULL) AS suplantacion
       FROM sesiones
       WHERE usuario_id = $1 AND tipo = 'tenant' AND etapa = 'activa' AND revocada_en IS NULL AND expira_en > NOW()
       ORDER BY ultimo_uso_en DESC`,
      [req.user!.id]
    )
    res.json(rows.map((r: any) => ({ ...r, actual: r.id === req.user!.sesionId })))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// DELETE /api/auth/sesiones/:id  → cierra una sesión propia
router.delete('/sesiones/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM sesiones WHERE id::text = $1 AND usuario_id = $2 AND revocada_en IS NULL`,
      [req.params.id, req.user!.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'Sesión no encontrada' })
    await revocarSesion(req.params.id, 'cerrada_por_usuario')
    await auditar(req, { categoria: 'autenticacion', accion: 'sesion_cerrada_remota', resultado: 'exito', recurso: 'sesiones', recursoId: req.params.id })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/sesiones/cerrar-otras
router.post('/sesiones/cerrar-otras', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await revocarSesionesUsuario(req.user!.id, 'cerrada_por_usuario', req.user!.sesionId)
    await auditar(req, { categoria: 'autenticacion', accion: 'sesiones_otras_cerradas', resultado: 'exito', recurso: 'sesiones' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/register
router.post('/register', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rolSolicitante = req.user!.rol
  if (rolSolicitante !== 'Superusuario') {
    return res.status(403).json({ error: 'No tienes permisos para crear usuarios' })
  }

  const { nombre, email, password, rol_id } = req.body
  if (!nombre || !email || !password || !rol_id) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' })
  }
  const pwError = validarPassword(password, { email, nombre })
  if (pwError) return res.status(400).json({ error: pwError, code: 'WEAK_PASSWORD' })

  try {
    const hash = await hashPassword(password)
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id, tenant_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, email`,
      [nombre, email, hash, rol_id, req.user!.tenantId]
    )
    await auditar(req, { categoria: 'usuarios', accion: 'usuario_creado', resultado: 'exito', recurso: 'usuarios',
      recursoId: rows[0].id, detalle: { usuario: rows[0].email, rol_id: Number(rol_id) } })
    await logActor(req, 'Crear usuario', `Creó el usuario ${rows[0].email}.`)
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email ya registrado' })
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// ── CRUD USUARIOS POR SUPERUSUARIO ──────────────────────────────────────────

// GET /api/auth/roles - Obtener roles
router.get('/roles', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.rol !== 'Superusuario') {
    return res.status(403).json({ error: 'No autorizado' })
  }
  try {
    const { rows } = await pool.query('SELECT id, nombre FROM roles ORDER BY id ASC')
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener roles' })
  }
})

// GET /api/auth/permisos - Obtener lista global de permisos
router.get('/permisos', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.rol !== 'Superusuario') {
    return res.status(403).json({ error: 'No autorizado' })
  }
  try {
    const { rows } = await pool.query('SELECT id, recurso, accion FROM permisos ORDER BY recurso, accion ASC')
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener permisos' })
  }
})

// GET /api/auth/users - Listar usuarios del tenant con sus permisos asignados
router.get('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.rol !== 'Superusuario') {
    return res.status(403).json({ error: 'No autorizado' })
  }
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.rol_id, r.nombre AS rol, u.activo, u.tiene_permisos_personalizados,
              COALESCE(
                (SELECT json_agg(up.permiso_id) 
                 FROM usuario_permisos up 
                 WHERE up.usuario_id = u.id), 
                '[]'::json
              ) AS permisos_ids
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.tenant_id = $1
       ORDER BY u.id ASC`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar usuarios' })
  }
})

// POST /api/auth/users - Crear nuevo usuario con permisos opcionales
router.post('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.rol !== 'Superusuario') {
    return res.status(403).json({ error: 'No tienes permisos para crear usuarios' })
  }

  const { nombre, email, password, rol_id, tiene_permisos_personalizados, permisos_ids } = req.body
  if (!nombre || !email || !password || !rol_id) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' })
  }
  const pwError = validarPassword(password, { email, nombre })
  if (pwError) return res.status(400).json({ error: pwError, code: 'WEAK_PASSWORD' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const hash = await hashPassword(password)
    
    const { rows } = await client.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id, tenant_id, tiene_permisos_personalizados)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, email`,
      [nombre, email, hash, rol_id, req.user!.tenantId, tiene_permisos_personalizados || false]
    )
    const newUser = rows[0]

    if (tiene_permisos_personalizados && Array.isArray(permisos_ids) && permisos_ids.length > 0) {
      for (const pId of permisos_ids) {
        await client.query(
          `INSERT INTO usuario_permisos (usuario_id, permiso_id) VALUES ($1, $2)`,
          [newUser.id, pId]
        )
      }
    }

    await client.query('COMMIT')
    await auditar(req, { categoria: 'usuarios', accion: 'usuario_creado', resultado: 'exito', recurso: 'usuarios',
      recursoId: newUser.id, detalle: {
        usuario: newUser.email, rol_id: Number(rol_id),
        permisos_personalizados: !!tiene_permisos_personalizados,
        permisos_ids: tiene_permisos_personalizados && Array.isArray(permisos_ids) ? permisos_ids.map(Number) : [],
      } })
    await logActor(req, 'Crear usuario', `Creó el usuario ${newUser.email}.`)
    res.status(201).json(newUser)
  } catch (err: any) {
    await client.query('ROLLBACK')
    if (err.code === '23505') return res.status(409).json({ error: 'Email ya registrado' })
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  } finally {
    client.release()
  }
})

// PUT /api/auth/users/:id - Actualizar usuario y sus permisos
router.put('/users/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.rol !== 'Superusuario') {
    return res.status(403).json({ error: 'No tienes permisos para editar usuarios' })
  }

  const { id } = req.params
  const { nombre, email, password, rol_id, activo, tiene_permisos_personalizados, permisos_ids } = req.body

  if (!nombre || !email || !rol_id) {
    return res.status(400).json({ error: 'Nombre, email y rol son requeridos' })
  }
  // La contraseña es opcional al editar; si se envía, debe cumplir la política.
  if (typeof password === 'string' && password.trim() !== '') {
    const pwError = validarPassword(password, { email, nombre })
    if (pwError) return res.status(400).json({ error: pwError, code: 'WEAK_PASSWORD' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Verificar tenant
    const { rows: check } = await client.query(
      `SELECT u.id, u.rol_id, u.activo, u.email, u.nombre, u.tiene_permisos_personalizados,
              COALESCE((SELECT array_agg(up.permiso_id ORDER BY up.permiso_id) FROM usuario_permisos up WHERE up.usuario_id = u.id), '{}') AS permisos
       FROM usuarios u WHERE u.id = $1 AND u.tenant_id = $2`,
      [id, req.user!.tenantId]
    )
    if (check.length === 0) {
      // ROLLBACK antes de responder: sin él, la conexión volvía al pool con
      // la transacción abierta y la siguiente petición que la tomara corría
      // dentro de ella.
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }
    const anterior = check[0]
    const nuevoActivo = activo !== undefined ? !!activo : true
    const esUnReset = !!(password && password.trim() !== '')
    const esOtroUsuario = Number(id) !== req.user!.id

    let query = `UPDATE usuarios SET nombre = $1, email = $2, rol_id = $3, activo = $4, tiene_permisos_personalizados = $5`
    const params = [nombre, email, rol_id, nuevoActivo, tiene_permisos_personalizados || false, id]

    if (esUnReset) {
      const hash = await hashPassword(password)
      // params[5] ($6) es el id y params[6] ($7) es el hash. Antes estaban
      // invertidos (password_hash = id, WHERE id = hash) y cambiar la
      // contraseña desde la edición de usuario siempre fallaba con error 500.
      // Una contraseña puesta por un administrador es temporal: el usuario
      // debe cambiarla en su siguiente ingreso (debe_cambiar_password).
      query += `, password_hash = $7, password_cambiado_en = NOW(), debe_cambiar_password = $8,
                  intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $6`
      params.push(hash, esOtroUsuario)
    } else {
      query += ` WHERE id = $6`
    }

    await client.query(query, params)

    // Actualizar permisos
    await client.query(`DELETE FROM usuario_permisos WHERE usuario_id = $1`, [id])

    if (tiene_permisos_personalizados && Array.isArray(permisos_ids) && permisos_ids.length > 0) {
      for (const pId of permisos_ids) {
        await client.query(
          `INSERT INTO usuario_permisos (usuario_id, permiso_id) VALUES ($1, $2)`,
          [id, pId]
        )
      }
    }

    await client.query('COMMIT')

    // Los cambios de rol, permisos o estado se aplican al instante.
    const uid = Number(id)
    olvidarEstadoUsuario(uid)
    olvidarPermisos(uid)
    // Contraseña restablecida, usuario desactivado o rol cambiado: se cierran
    // sus sesiones abiertas (debe volver a entrar con la nueva situación).
    const motivo = esUnReset ? 'password_restablecido' : !nuevoActivo && anterior.activo ? 'usuario_desactivado'
      : Number(rol_id) !== anterior.rol_id ? 'rol_cambiado' : null
    if (motivo) await revocarSesionesUsuario(uid, motivo, esOtroUsuario ? undefined : req.user!.sesionId)

    // Trazabilidad de cambios en usuarios, roles y permisos (V10): qué cambió, antes → después.
    const permisosNuevos = tiene_permisos_personalizados && Array.isArray(permisos_ids)
      ? [...new Set(permisos_ids.map(Number))].sort((a, b) => a - b) : []
    const cambios: Record<string, unknown> = {}
    if (anterior.email !== email) cambios.email = { antes: anterior.email, despues: email }
    if (anterior.nombre !== nombre) cambios.nombre = { antes: anterior.nombre, despues: nombre }
    if (anterior.rol_id !== Number(rol_id)) cambios.rol_id = { antes: anterior.rol_id, despues: Number(rol_id) }
    if (anterior.activo !== nuevoActivo) cambios.activo = { antes: anterior.activo, despues: nuevoActivo }
    if (anterior.tiene_permisos_personalizados !== !!tiene_permisos_personalizados) {
      cambios.permisos_personalizados = { antes: anterior.tiene_permisos_personalizados, despues: !!tiene_permisos_personalizados }
    }
    const permisosAntes = (anterior.permisos || []).map(Number)
    if (JSON.stringify(permisosAntes) !== JSON.stringify(permisosNuevos)) {
      cambios.permisos = {
        agregados: permisosNuevos.filter((x) => !permisosAntes.includes(x)),
        quitados: permisosAntes.filter((x: number) => !permisosNuevos.includes(x)),
      }
    }
    if (esUnReset) cambios.password = 'restablecida (temporal)'
    await auditar(req, { categoria: 'usuarios', accion: 'usuario_modificado', resultado: 'exito', recurso: 'usuarios',
      recursoId: uid, detalle: { usuario: email, cambios, sesiones_cerradas: motivo } })
    const resumen = Object.keys(cambios).join(', ') || 'sin cambios'
    await logActor(req, 'Modificar usuario', `Modificó el usuario ${email} (${resumen}).`)

    res.json({ success: true })
  } catch (err: any) {
    await client.query('ROLLBACK')
    if (err.code === '23505') return res.status(409).json({ error: 'Email ya registrado' })
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  } finally {
    client.release()
  }
})

// POST /api/auth/users/:id/restablecer-mfa
// Para un usuario que perdió su teléfono y sus códigos de recuperación. Solo
// un Superusuario de la MISMA empresa; queda en la bitácora. Si el rol del
// usuario exige MFA, deberá enrolarse de nuevo en su próximo ingreso.
router.post('/users/:id/restablecer-mfa', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.rol !== 'Superusuario') return res.status(403).json({ error: 'No autorizado', code: 'FORBIDDEN' })
  try {
    const { rows } = await pool.query(`${SELECT_USUARIO} WHERE u.id = $1 AND u.tenant_id = $2`, [req.params.id, req.user!.tenantId])
    const objetivo = rows[0]
    if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' })
    await desactivarMfa('tenant', objetivo.id)
    await desbloquear('usuarios', objetivo.id)
    await revocarSesionesUsuario(objetivo.id, 'mfa_restablecido')
    const actor = await cargarUsuario(req.user!.id)
    await log(actor, 'MFA restablecido', `${actor.nombre} restableció la verificación en dos pasos de ${objetivo.email}.`, req)
    await auditar(req, { categoria: 'usuarios', accion: 'mfa_restablecido', resultado: 'exito', recurso: 'usuarios', recursoId: objetivo.id, detalle: { usuario: objetivo.email } })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// DELETE /api/auth/users/:id - Eliminar usuario
router.delete('/users/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.rol !== 'Superusuario') {
    return res.status(403).json({ error: 'No tienes permisos para eliminar usuarios' })
  }

  const { id } = req.params

  // Evitar auto-eliminación
  if (Number(id) === req.user!.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' })
  }

  try {
    // Verificar tenant
    const { rows: check } = await pool.query(
      `SELECT id FROM usuarios WHERE id = $1 AND tenant_id = $2`,
      [id, req.user!.tenantId]
    )
    if (check.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    // Se cierran sus sesiones antes de eliminarlo o desactivarlo.
    await revocarSesionesUsuario(Number(id), 'usuario_eliminado')
    olvidarEstadoUsuario(Number(id))
    try {
      await pool.query(`DELETE FROM usuarios WHERE id = $1`, [id])
      await auditar(req, { categoria: 'usuarios', accion: 'usuario_eliminado', resultado: 'exito', recurso: 'usuarios', recursoId: Number(id) })
      await logActor(req, 'Eliminar usuario', `Eliminó el usuario #${id}.`)
      res.json({ success: true, message: 'Usuario eliminado' })
    } catch (dbErr) {
      // Si tiene dependencias lo deactivamos
      await pool.query(`UPDATE usuarios SET activo = false WHERE id = $1`, [id])
      await auditar(req, { categoria: 'usuarios', accion: 'usuario_desactivado', resultado: 'exito', recurso: 'usuarios',
        recursoId: Number(id), detalle: { motivo: 'tiene_registros_asociados' } })
      await logActor(req, 'Desactivar usuario', `Desactivó el usuario #${id} (tiene registros asociados).`)
      res.json({ success: true, message: 'El usuario tiene registros asociados en el sistema, por lo que fue desactivado en su lugar.' })
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/logout
// Cierre de sesión REAL: la sesión se revoca en el servidor (antes solo se
// borraba el token del navegador y seguía siendo válido hasta 8 h).
// No exige authMiddleware: debe poder limpiar cookies de una sesión expirada.
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const s = await obtenerSesion(req, 'tenant')
    if (s && (s.etapa !== 'activa' || csrfValido(req, s))) {
      await revocarSesion(s.id, 'logout')
      if (s.etapa === 'activa' && s.usuario_id) {
        const user = await cargarUsuario(s.usuario_id)
        if (user) {
          await log(user, 'Cierre de sesión', `El usuario ${user.nombre} cerró su sesión.`, req)
          await auditar(req, { categoria: 'autenticacion', accion: 'logout', resultado: 'exito', tenantId: user.tenant_id,
            actor: { tipo: 'usuario', id: user.id, email: user.email }, suplantadoPor: s.suplantado_por_admin })
        }
      }
    }
    limpiarCookies(res, 'tenant')
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/auth/eventos-seguridad?categoria=&resultado=
// Bitácora de seguridad inmutable de la PROPIA empresa (Superusuario): inicios
// de sesión, fallos, bloqueos, MFA, cambios de usuarios y permisos, accesos
// denegados y accesos de soporte de Governex.
router.get('/eventos-seguridad', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.rol !== 'Superusuario') return res.status(403).json({ error: 'No autorizado', code: 'FORBIDDEN' })
  const categoria = typeof req.query.categoria === 'string' ? req.query.categoria : null
  const resultado = typeof req.query.resultado === 'string' ? req.query.resultado : null
  try {
    const { rows } = await pool.query(
      `SELECT id, fecha, correlation_id, tenant_id, actor_tipo, actor_id, actor_email, suplantado_por_admin, categoria, accion, resultado, recurso, recurso_id, ip, detalle
       FROM auditoria_eventos
       WHERE tenant_id = $1 AND ($2::text IS NULL OR categoria = $2) AND ($3::text IS NULL OR resultado = $3)
       ORDER BY id DESC
       LIMIT 500`,
      [req.user!.tenantId, categoria, resultado]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener los eventos de seguridad' })
  }
})

// GET /api/auth/activity-logs
router.get('/activity-logs', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.rol !== 'Superusuario') {
    return res.status(403).json({ error: 'No autorizado' })
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, usuario_nombre, usuario_email, usuario_rol, accion, recurso, detalle, fecha_hora,
              ip, correlation_id, (suplantado_por_admin IS NOT NULL) AS via_soporte
       FROM logs_actividad
       WHERE tenant_id = $1
       ORDER BY fecha_hora DESC
       LIMIT 1000`,
      [req.user!.tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener bitácora de actividades' })
  }
})

export default router
