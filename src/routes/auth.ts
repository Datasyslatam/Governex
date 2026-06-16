import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db'

const router = Router()

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' })
  }
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.password_hash, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.email = $1 AND u.activo = true`,
      [email]
    )
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, rol: user.rol },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' }
    )

    // Limpiar indicadores al iniciar sesión (igual que los demás módulos que usan sessionStorage)
    try {
      await pool.query('DELETE FROM indicador_mediciones')
      await pool.query('DELETE FROM indicadores')
    } catch (cleanErr) {
      console.error('[Auth] Error al limpiar indicadores:', cleanErr)
    }

    res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/register  (solo para setup inicial)
router.post('/register', async (req: Request, res: Response) => {
  const { nombre, email, password, rol_id } = req.body
  if (!nombre || !email || !password || !rol_id) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' })
  }
  try {
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id)
       VALUES ($1, $2, $3, $4) RETURNING id, nombre, email`,
      [nombre, email, hash, rol_id]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email ya registrado' })
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

export default router
