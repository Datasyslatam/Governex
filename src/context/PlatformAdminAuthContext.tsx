import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  platformAdminApi,
  PlatformAdminInfo,
  RespuestaLoginPlataforma,
  PLATFORM_SESSION_INVALID_EVENT,
} from '../services/platformAdminApi'

interface PlatformAdminAuthValue {
  admin: PlatformAdminInfo | null
  isAuthenticated: boolean
  /** Primer paso del login. Si devuelve 'mfa' / 'enrolar_mfa', falta el código. */
  login: (email: string, password: string) => Promise<RespuestaLoginPlataforma>
  /** Marca la sesión como iniciada tras completar el MFA. */
  completarLogin: (admin: PlatformAdminInfo) => void
  logout: () => void
  refresh: () => Promise<void>
}

// Solo datos de presentación: la credencial es la cookie HttpOnly gx_psession.
const ADMIN_KEY = 'governex_platform_admin_info'

const PlatformAdminAuthContext = createContext<PlatformAdminAuthValue | undefined>(undefined)

export const PlatformAdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<PlatformAdminInfo | null>(() => {
    try {
      const stored = localStorage.getItem(ADMIN_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const guardar = (a: PlatformAdminInfo | null) => {
    setAdmin(a)
    try {
      if (a) localStorage.setItem(ADMIN_KEY, JSON.stringify(a))
      else localStorage.removeItem(ADMIN_KEY)
    } catch { /* sin storage */ }
  }

  const login = (email: string, password: string) => platformAdminApi.login(email, password)
  const completarLogin = (a: PlatformAdminInfo) => guardar(a)

  const logout = () => {
    guardar(null)
    platformAdminApi.logout().catch(() => {})
  }

  const refresh = async () => {
    const { admin: a } = await platformAdminApi.me()
    guardar(a)
  }

  // Valida la sesión guardada contra el servidor al cargar.
  useEffect(() => {
    if (admin) refresh().catch(() => guardar(null))
    const invalidar = () => guardar(null)
    window.addEventListener(PLATFORM_SESSION_INVALID_EVENT, invalidar)
    return () => window.removeEventListener(PLATFORM_SESSION_INVALID_EVENT, invalidar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <PlatformAdminAuthContext.Provider value={{ admin, isAuthenticated: !!admin, login, completarLogin, logout, refresh }}>
      {children}
    </PlatformAdminAuthContext.Provider>
  )
}

export const usePlatformAdminAuth = (): PlatformAdminAuthValue => {
  const ctx = useContext(PlatformAdminAuthContext)
  if (!ctx) throw new Error('usePlatformAdminAuth debe usarse dentro de PlatformAdminAuthProvider')
  return ctx
}
