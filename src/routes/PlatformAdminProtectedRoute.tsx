import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { usePlatformAdminAuth } from '../context/PlatformAdminAuthContext'
import { platformAdminApi } from '../services/platformAdminApi'
import '../pages/platform-admin/PlatformAdminLoginPage.css'

/**
 * Contraseña temporal de un platform_admin (creado por otro admin): debe
 * cambiarla antes de usar el panel. El backend lo exige igualmente
 * (403 PASSWORD_CHANGE_REQUIRED en todo lo demás).
 */
const CambioPasswordPlataforma: React.FC = () => {
  const { refresh, logout } = usePlatformAdminAuth()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (nueva !== confirmar) { setError('La confirmación no coincide'); return }
    setCargando(true)
    setError('')
    try {
      await platformAdminApi.cambiarPassword(actual, nueva)
      await refresh()
    } catch (err: any) {
      setError(err.message || 'No se pudo cambiar la contraseña')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="pa-login">
      <form className="pa-login__card" onSubmit={enviar}>
        <h2>Define tu contraseña</h2>
        <p className="pa-login__subtitle">
          Tu cuenta tiene una contraseña temporal. Mínimo 12 caracteres y 3 de 4 tipos (minúsculas, mayúsculas, números, símbolos).
        </p>
        {error && <div className="pa-login__error" role="alert">{error}</div>}
        <label>Contraseña temporal
          <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required />
        </label>
        <label>Nueva contraseña
          <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required minLength={12} />
        </label>
        <label>Confirmar
          <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" required />
        </label>
        <button type="submit" disabled={cargando}>{cargando ? 'Guardando…' : 'Guardar y continuar'}</button>
        <button type="button" onClick={logout} style={{ marginTop: '0.5rem', background: 'transparent', color: 'inherit' }}>Cerrar sesión</button>
      </form>
    </div>
  )
}

// Guard independiente del ProtectedRoute de tenants: revisa
// isAuthenticated de PlatformAdminAuthContext, nunca el de AuthContext.
// Un usuario de tenant autenticado NO tiene acceso a esto, y viceversa.
export const PlatformAdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, admin } = usePlatformAdminAuth()
  if (!isAuthenticated) return <Navigate to="/platform-admin/login" replace />
  if (admin?.debeCambiarPassword) return <CambioPasswordPlataforma />
  return <>{children}</>
}
