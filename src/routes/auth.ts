import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

interface JwtPayload {
  id: number
  tenantId: number
  rol: string
}

// POST /api/auth/login
// Solo pide email + password. Nunca se solicita seleccionar empresa:
// el tenant se deriva del usuario encontrado por email (email es
// único a nivel plataforma, ver migrations/003_fix_email_unique_global.sql).
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

    // Un tenant suspendido o cancelado no puede iniciar sesión, sin importar
    // que el password sea correcto. Se valida antes del bcrypt.compare para
    // no gastar el costo de hashing en un tenant que ya sabemos que está bloqueado.
    if (user.tenant_estado !== 'Activo') {
      return res.status(403).json({ error: 'La cuenta de tu empresa no está activa. Contacta a soporte de Governex.' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' })

    // JWT minimalista: solo lo indispensable para autorizar requests.
    // El nombre del usuario NUNCA viaja en el token; se obtiene del backend
    // cuando se necesite (ej. en la respuesta de este mismo login, o vía
    // un futuro GET /api/auth/me).
    const payload: JwtPayload = { id: user.id, tenantId: user.tenant_id, rol: user.rol }
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '8h' })

    res.json({
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      tenant: { id: user.tenant_id, nombre: user.tenant_nombre },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/register
// CORRECCIÓN DE SEGURIDAD: antes era un endpoint público sin authMiddleware
// y sin tenant_id — cualquiera sin autenticarse podía crear usuarios, y en
// multi-tenant no había forma de saber a qué tenant asignarlos. Ahora:
//   1) Requiere sesión válida (authMiddleware).
//   2) Solo roles con privilegio de administración pueden crear usuarios.
//   3) tenant_id sale SIEMPRE de req.user.tenantId, nunca del body.
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

export default router
