import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { authService } from '../../services'
import './LoginPage.css'

const LoginPage: React.FC = () => {
  const { login }   = useAuth()
  const navigate    = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Completa el correo y la contraseña'); return }
    setLoading(true)
    setError('')
    try {
      const user = await authService.login(email, password)
      // Adaptar al formato que espera el AuthContext existente
      login({ name: user.nombre, role: user.rol as any })
      navigate('/dashboard')
    } catch (e: any) {
      setError(e.message || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login">
      <div className="login__left">
        <div className="login__brand">
          <div className="login__brand-icon" aria-hidden="true">
            <svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 16H46L54 32L46 48H18L10 32L18 16Z"
                stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
            </svg>
          </div>
          <h1>Governex</h1>
          <p>Sistema de Gestión de Calidad</p>
          <div className="login__divider" />
          <ul>
            <li>Trazabilidad total del SGC</li>
            <li>Control documental versionado</li>
            <li>Auditoría interna integrada</li>
            <li>Dashboard ejecutivo en tiempo real</li>
          </ul>
          <div className="login__brand-footer">© 2026 Governex · Barranquilla, Colombia</div>
        </div>
      </div>

      <div className="login__right">
        <form className="login__card" onSubmit={handleSubmit}>
          <h2>Iniciar Sesión</h2>

          {error && (
            <div style={{
              background: 'var(--color-background-danger)',
              color: 'var(--color-text-danger)',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}>{error}</div>
          )}

          <label>
            Correo electrónico
            <input type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              disabled={loading} />
          </label>

          <label>
            Contraseña
            <input type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading} />
          </label>

          <button type="submit" className="login__submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'INGRESAR A GOVERNEX'}
          </button>

          <p className="login__helper">
            Autenticación segura con JWT · Sesión de 8 horas
          </p>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
