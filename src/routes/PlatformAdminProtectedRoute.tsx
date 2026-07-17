import React from 'react'
import { Navigate } from 'react-router-dom'
import { usePlatformAdminAuth } from '../context/PlatformAdminAuthContext'

// Guard independiente del ProtectedRoute de tenants: revisa
// isAuthenticated de PlatformAdminAuthContext, nunca el de AuthContext.
// Un usuario de tenant autenticado NO tiene acceso a esto, y viceversa.
export const PlatformAdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = usePlatformAdminAuth()
  if (!isAuthenticated) return <Navigate to="/platform-admin/login" replace />
  return <>{children}</>
}
