import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatformAdminAuth } from '../../context/PlatformAdminAuthContext'
import './PlatformAdminLoginPage.css'

// Pantalla de acceso SOLO para staff de Governex (super-admins de
// plataforma). Deliberadamente separada de /login: usa su propio
// contexto, su propio storage de token y su propio backend
// (POST /api/platform-admin/login), sin ningún punto de contacto con la
// sesión de un usuario de tenant.
const PlatformAdminLoginPage: React.FC = () => {
  const { login } = usePlatformAdminAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Completa el correo y la contraseña'); return }
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/platform-admin')
    } catch (err: any) {
      setError(err.message || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pa-login">
      <form className="pa-login__card" onSubmit={handleSubmit}>
        <h2>Governex · Administración de plataforma</h2>
        <p className="pa-login__subtitle">Acceso restringido a staff de Governex</p>

        {error && <div className="pa-login__error">{error}</div>}

        <label>
          Correo
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

export default PlatformAdminLoginPage
