import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { registrarActividadDirecto } from '../middleware/activityLogger'

const router = Router()

interface JwtPayload {
  id: number
  tenantId: number
  rol: string
}

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

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' })
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.password_hash, u.tenant_id,
              r.nombre AS rol,
              t.estado AS tenant_estado, t.nombre AS tenant_nombre
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1 AND u.activo = true`,
      [email]
    )
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' })

    if (user.tenant_estado !== 'Activo') {
      return res.status(403).json({ error: 'La cuenta de tu empresa no está activa. Contacta a soporte de Governex.' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const payload: JwtPayload = { id: user.id, tenantId: user.tenant_id, rol: user.rol }
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '8h' })

    const permissions = await getUserPermissions(user.id)

    await registrarActividadDirecto(
      user.tenant_id,
      user.id,
      user.nombre,
      user.email,
      user.rol,
      'Inicio de sesión',
      'auth',
      `El usuario ${user.nombre} inició sesión con éxito.`
    )

    res.json({
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, permissions },
      tenant: { id: user.tenant_id, nombre: user.tenant_nombre },
    })
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

  try {
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id, tenant_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, email`,
      [nombre, email, hash, rol_id, req.user!.tenantId]
    )
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

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const hash = await bcrypt.hash(password, 10)
    
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

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Verificar tenant
    const { rows: check } = await client.query(
      `SELECT id FROM usuarios WHERE id = $1 AND tenant_id = $2`,
      [id, req.user!.tenantId]
    )
    if (check.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    let query = `UPDATE usuarios SET nombre = $1, email = $2, rol_id = $3, activo = $4, tiene_permisos_personalizados = $5`
    const params = [nombre, email, rol_id, activo !== undefined ? activo : true, tiene_permisos_personalizados || false, id]

    if (password && password.trim() !== '') {
      const hash = await bcrypt.hash(password, 10)
      query += `, password_hash = $6 WHERE id = $7`
      params.push(hash)
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

    try {
      await pool.query(`DELETE FROM usuarios WHERE id = $1`, [id])
      res.json({ success: true, message: 'Usuario eliminado' })
    } catch (dbErr) {
      // Si tiene dependencias lo deactivamos
      await pool.query(`UPDATE usuarios SET activo = false WHERE id = $1`, [id])
      res.json({ success: true, message: 'El usuario tiene registros asociados en el sistema, por lo que fue desactivado en su lugar.' })
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.user!.id
    const userRole = req.user!.rol

    const { rows } = await pool.query('SELECT nombre, email FROM usuarios WHERE id = $1', [userId])
    const userName = rows[0]?.nombre || 'Usuario Desconocido'
    const userEmail = rows[0]?.email || ''

    await registrarActividadDirecto(
      tenantId,
      userId,
      userName,
      userEmail,
      userRole,
      'Cierre de sesión',
      'auth',
      `El usuario ${userName} cerró su sesión.`
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/auth/activity-logs
router.get('/activity-logs', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.rol !== 'Superusuario') {
    return res.status(403).json({ error: 'No autorizado' })
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, usuario_nombre, usuario_email, usuario_rol, accion, recurso, detalle, fecha_hora
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
