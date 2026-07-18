import React, { useState } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { useAuth } from '../../hooks/useAuth'
  import { usePlatformAdminAuth } from '../../context/PlatformAdminAuthContext'
  import { authService } from '../../services'
  import './LoginPage.css'
  import logoGovernex from '../../assets/logo-governex.png'

  const LoginPage: React.FC = () => {
    const { login }   = useAuth()
    const { login: loginPlatformAdmin } = usePlatformAdminAuth()
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
        const { user, tenant } = await authService.login(email, password)
        // Adaptar al formato que espera el AuthContext existente.
        // tenant solo se guarda para mostrarlo en UI (ej. nombre de la
        // empresa en el header); nunca se usa para filtrar datos ni se
        // reenvía al backend — eso siempre lo decide el JWT server-side.
        login({ name: user.nombre, role: user.rol as any, tenant, permissions: user.permissions })
        navigate('/dashboard')
      } catch (tenantErr: any) {
        // Las credenciales no son válidas como usuario de tenant. Antes de
        // mostrar el error, probamos silenciosamente si son válidas como
        // super-admin de Governex — así el mismo formulario sirve para
        // ambos accesos, sin exponer ningún enlace visible al panel.
        try {
          await loginPlatformAdmin(email, password)
          navigate('/platform-admin')
          return
        } catch {
          setError(tenantErr.message || 'Credenciales incorrectas')
        }
      } finally {
        setLoading(false)
      }
    }

    return (
      <div className="login">
        <div className="login__left">
          <div className="login__brand">
            <div className="login__brand-icon" aria-hidden="true">
              <div className="login__brand-icon" aria-hidden="true">
                <img src={logoGovernex}/>
              </div>
            </div>
            <p>Impulsamos la Gobernanza Digital</p>
            <div className="login__divider" />
            <ul>
              <li>Gestiona procesos bajo estándares ISO con seguimiento inteligente de indicadores</li>
              <li>Automatiza tareas con IA para optimizar tiempos y reducir errores</li>
              <li>Impulsa la transformación digital con análisis de datos y mejora contínua</li>
            </ul>
            <div className="login__brand-footer">© 2026 Governex · Barranquilla, Colombia</div>
          </div>
        </div>

        <div className="login__right">
          <div className="login__powered-by">Powered by Datasys · Latam Group</div>
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