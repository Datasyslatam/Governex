import React, { createContext, useContext, useState } from 'react'
import {
  platformAdminApi,
  savePlatformAdminToken,
  getPlatformAdminToken,
  clearPlatformAdminToken,
  PlatformAdminInfo,
} from '../services/platformAdminApi'

interface PlatformAdminAuthValue {
  admin: PlatformAdminInfo | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const ADMIN_KEY = 'governex_platform_admin_info'

const PlatformAdminAuthContext = createContext<PlatformAdminAuthValue | undefined>(undefined)

export const PlatformAdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<PlatformAdminInfo | null>(() => {
    // Si no hay token, no restauramos el admin — evita mostrar la UI como
    // "autenticada" con un token que ya no existe (ej. lo limpió otra pestaña).
    if (!getPlatformAdminToken()) return null
    try {
      const stored = localStorage.getItem(ADMIN_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const login = async (email: string, password: string) => {
    const { token, admin: adminInfo } = await platformAdminApi.login(email, password)
    savePlatformAdminToken(token)
    localStorage.setItem(ADMIN_KEY, JSON.stringify(adminInfo))
    setAdmin(adminInfo)
  }

  const logout = () => {
    clearPlatformAdminToken()
    localStorage.removeItem(ADMIN_KEY)
    setAdmin(null)
  }

  return (
    <PlatformAdminAuthContext.Provider value={{ admin, isAuthenticated: !!admin, login, logout }}>
      {children}
    </PlatformAdminAuthContext.Provider>
  )
}

export const usePlatformAdminAuth = (): PlatformAdminAuthValue => {
  const ctx = useContext(PlatformAdminAuthContext)
  if (!ctx) throw new Error('usePlatformAdminAuth debe usarse dentro de PlatformAdminAuthProvider')
  return ctx
}
