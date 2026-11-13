import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatformAdminAuth } from '../../context/PlatformAdminAuthContext'
import { platformAdminApi, RespuestaLoginPlataforma } from '../../services/platformAdminApi'
import MfaPaso from '../../components/auth/MfaPaso'
import '../auth/LoginPage.css'
import './PlatformAdminLoginPage.css'

// Pantalla de acceso SOLO para staff de Governex (super-admins de
// plataforma). Deliberadamente separada de /login: usa su propio
// contexto, su propia cookie de sesión y su propio backend
// (POST /api/platform-admin/login), sin ningún punto de contacto con la
// sesión de un usuario de tenant. MFA siempre obligatorio.
const PlatformAdminLoginPage: React.FC = () => {
  const { login, completarLogin } = usePlatformAdminAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paso, setPaso] = useState<'credenciales' | 'mfa' | 'enrolar_mfa'>('credenciales')

  const terminar = (r: RespuestaLoginPlataforma) => {
    if (r.estado !== 'activa') return
    completarLogin(r.admin)
    navigate('/platform-admin')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Completa el correo y la contraseña'); return }
    setLoading(true)
    setError('')
    try {
      const r = await login(email, password)
      if (r.estado === 'activa') terminar(r)
      else { setPaso(r.estado); setPassword('') }
    } catch (err: any) {
      setError(err.message || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  if (paso !== 'credenciales') {
    return (
      <div className="pa-login">
        <div className="pa-login__card">
          <MfaPaso<RespuestaLoginPlataforma>
            modo={paso}
            api={{ verificar: platformAdminApi.verificarMfa, configurar: platformAdminApi.configurarMfa, activar: platformAdminApi.activarMfa }}
            onListo={terminar}
            onCancelar={() => { setPaso('credenciales'); platformAdminApi.logout().catch(() => {}) }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pa-login"> <form className="pa-login__card" onSubmit={handleSubmit}> <h2>Governex · Administración de plataforma</h2> <p className="pa-login__subtitle">Acceso restringido a staff de Governex</p>

        {error && <div className="pa-login__error">{error}</div>}

        <label>
          Correo
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} autoComplete="username" /> </label> <label>
          Contraseña
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} autoComplete="current-password" /> </label> <button type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button> </form> </div>
  )
}

export default PlatformAdminLoginPage
