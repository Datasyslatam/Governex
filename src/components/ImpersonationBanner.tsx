import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { IMPERSONATION_KEY } from '../context/AuthContext'

interface ImpersonationInfo {
  adminEmail?: string
  tenantNombre: string
  usuarioEmail: string
}

const ImpersonationBanner: React.FC = () => {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [info, setInfo] = useState<ImpersonationInfo | null>(null)

  useEffect(() => {
    if (!isAuthenticated) { setInfo(null); return }
    try {
      const raw = localStorage.getItem(IMPERSONATION_KEY)
      setInfo(raw ? JSON.parse(raw) : null)
    } catch {
      setInfo(null)
    }
  }, [isAuthenticated])

  if (!info) return null

  const handleExit = () => {
    logout()
    navigate('/platform-admin')
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000,
      background: '#7c2d12', color: '#fff',
      padding: '0.5rem 1rem',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '1rem', fontSize: '0.85rem',
    }}>
      <span>
        Viendo Governex como <b>{info.usuarioEmail}</b> ({info.tenantNombre}) — sesión de administrador: {info.adminEmail}
      </span>
      <button
        onClick={handleExit}
        style={{
          background: '#fff', color: '#7c2d12', border: 'none',
          borderRadius: '0.35rem', padding: '0.25rem 0.75rem',
          fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem',
        }}
      >
        Salir y volver al panel admin
      </button>
    </div>
  )
}

export default ImpersonationBanner