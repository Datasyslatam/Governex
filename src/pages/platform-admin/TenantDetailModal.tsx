import React, { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { IMPERSONATION_KEY } from '../../context/AuthContext'
import { usePlatformAdminAuth } from '../../context/PlatformAdminAuthContext'
import { platformAdminApi, TenantDetail, TenantSummary } from '../../services/platformAdminApi'
import './TenantDetailModal.css'

interface Props {
  tenantId: number
  onClose: () => void
  onUpdated: () => void   // refresca la tabla de tenants en el dashboard
}

const TenantDetailModal: React.FC<Props> = ({ tenantId, onClose, onUpdated }) => {
  const { login: loginAsTenantUser } = useAuth()
  const { admin } = usePlatformAdminAuth()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [nombre, setNombre] = useState('')
  const [nit, setNit] = useState('')
  const [plan, setPlan] = useState<TenantSummary['plan']>('Standard')

  const load = async () => {
    setLoading(true)
    try {
      const data = await platformAdminApi.getTenantDetail(tenantId)
      setDetail(data)
      setNombre(data.tenant.nombre)
      setNit(data.tenant.nit)
      setPlan(data.tenant.plan)
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tenantId])

  const handleSave = async () => {
    setSaving(true)
    try {
      await platformAdminApi.updateTenant(tenantId, { nombre, nit, plan })
      Swal.fire({ icon: 'success', title: 'Tenant actualizado', timer: 1500, showConfirmButton: false })
      onUpdated()
      load()
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async (usuarioId: number, usuarioEmail: string) => {
    const { value: password } = await Swal.fire({
      icon: 'question',
      title: `Resetear contraseña`,
      text: `Nueva contraseña temporal para ${usuarioEmail}`,
      input: 'password',
      inputAttributes: { minlength: '8', autocomplete: 'new-password' },
      showCancelButton: true,
      confirmButtonText: 'Resetear',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value || value.length < 8) return 'Debe tener al menos 8 caracteres'
        return undefined
      },
    })
    if (!password) return

    try {
      await platformAdminApi.resetUserPassword(tenantId, usuarioId, password)
      Swal.fire({ icon: 'success', title: 'Contraseña actualizada', timer: 1500, showConfirmButton: false })
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const handleImpersonate = async (usuarioId: number, usuarioNombre: string, usuarioEmail: string) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: `¿Entrar como ${usuarioNombre}?`,
      html: `Verás la plataforma exactamente como <b>${usuarioEmail}</b> la ve. La sesión dura 30 minutos y queda registrada en la bitácora de auditoría.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, entrar',
      cancelButtonText: 'Cancelar',
    })
    if (!confirm.isConfirmed) return

    try {
      const { token, user, tenant } = await platformAdminApi.impersonateUser(tenantId, usuarioId)

      // Guarda el JWT del tenant en la misma clave que usa un login normal
      // (services/api.ts) — así todas las llamadas de la app funcionan sin
      // ningún cambio. El token del propio super-admin (governex_platform_
      // admin_token) NUNCA se toca, vive en otra clave por completo.
      localStorage.setItem('governex_token', token)
      localStorage.setItem(
        IMPERSONATION_KEY,
        JSON.stringify({ adminEmail: admin?.email, tenantNombre: tenant.nombre, usuarioEmail: user.email })
      )

      loginAsTenantUser({ name: user.nombre, role: user.rol as any, tenant })
      navigate('/dashboard')
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'No se pudo iniciar la impersonación', text: err.message })
    }
  }

  return (
    <div className="tdm-overlay" onClick={onClose}>
      <div className="tdm-modal" onClick={e => e.stopPropagation()}>
        <button className="tdm-close" onClick={onClose} aria-label="Cerrar">×</button>

        {loading || !detail ? (
          <p>Cargando...</p>
        ) : (
          <>
            <h2>{detail.tenant.nombre}</h2>
            <p className="tdm-subtitle">Tenant #{detail.tenant.id} · Creado el {new Date(detail.tenant.fecha_creacion).toLocaleDateString()}</p>

            <section className="tdm-section">
              <h3>Datos generales</h3>
              <div className="tdm-form-grid">
                <label>
                  Nombre de la empresa
                  <input value={nombre} onChange={e => setNombre(e.target.value)} />
                </label>
                <label>
                  NIT
                  <input value={nit} onChange={e => setNit(e.target.value)} />
                </label>
                <label>
                  Plan
                  <select value={plan} onChange={e => setPlan(e.target.value as TenantSummary['plan'])}>
                    <option value="Standard">Standard</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </label>
              </div>
              <button className="tdm-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </section>

            <section className="tdm-section">
              <h3>Usuarios ({detail.usuarios.length})</h3>
              <table className="tdm-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {detail.usuarios.map(u => (
                    <tr key={u.id}>
                      <td>{u.nombre}</td>
                      <td>{u.email}</td>
                      <td>{u.rol_nombre}</td>
                      <td>
                        <span className={`tdm-badge tdm-badge--${u.activo ? 'activo' : 'inactivo'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="tdm-actions-cell">
                          <button
                            className="tdm-btn-link"
                            onClick={() => handleImpersonate(u.id, u.nombre, u.email)}
                            disabled={!u.activo}
                            title={!u.activo ? 'Usuario inactivo' : undefined}
                          >
                            Ver como este usuario
                          </button>
                          <button className="tdm-btn-link" onClick={() => handleResetPassword(u.id, u.email)}>
                            Resetear contraseña
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {detail.usuarios.length === 0 && (
                    <tr><td colSpan={5}>Este tenant todavía no tiene usuarios.</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default TenantDetailModal