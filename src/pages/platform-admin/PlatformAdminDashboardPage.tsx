import React, { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { useNavigate } from 'react-router-dom'
import { usePlatformAdminAuth } from '../../context/PlatformAdminAuthContext'
import TenantDetailModal from './TenantDetailModal'
import {
  platformAdminApi,
  TenantSummary,
  CreateTenantPayload,
  PlatformAdminSummary,
  AuditLogEntry,
} from '../../services/platformAdminApi'
import './PlatformAdminDashboardPage.css'

const emptyTenantForm: CreateTenantPayload = {
  nombreEmpresa: '',
  nit: '',
  plan: 'Standard',
  adminNombre: '',
  adminEmail: '',
  adminPassword: '',
}

const emptyAdminForm = { nombre: '', email: '', password: '' }

type Tab = 'dashboard' | 'tenants' | 'admins' | 'auditoria'

// ── Etiquetas legibles para las acciones de la bitácora ─────────
const ACCION_LABELS: Record<string, string> = {
  crear_tenant: 'Creó el tenant',
  cambiar_estado_tenant: 'Cambió el estado del tenant',
  crear_admin: 'Creó al administrador',
  cambiar_estado_admin: 'Cambió el estado del administrador',
}

const PlatformAdminDashboardPage: React.FC = () => {
  const { admin, logout } = usePlatformAdminAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('dashboard')

  /* ── Tenants ──────────────────────────────────────────────── */
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [loadingTenants, setLoadingTenants] = useState(true)
  const [showTenantForm, setShowTenantForm] = useState(false)
  const [tenantForm, setTenantForm] = useState<CreateTenantPayload>(emptyTenantForm)
  const [creatingTenant, setCreatingTenant] = useState(false)
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null)
  const [tenantSearch, setTenantSearch] = useState('')
  const [tenantEstadoFilter, setTenantEstadoFilter] = useState<'Todos' | TenantSummary['estado']>('Todos')
  const [tenantPlanFilter, setTenantPlanFilter] = useState<'Todos' | TenantSummary['plan']>('Todos')

  /* ── Administradores ──────────────────────────────────────── */
  const [admins, setAdmins] = useState<PlatformAdminSummary[]>([])
  const [loadingAdmins, setLoadingAdmins] = useState(true)
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [adminForm, setAdminForm] = useState(emptyAdminForm)
  const [creatingAdmin, setCreatingAdmin] = useState(false)

  /* ── Auditoría ────────────────────────────────────────────── */
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [loadingAudit, setLoadingAudit] = useState(true)

  const handleLogout = () => {
    logout()
    // Al salir del panel de admin, el usuario vuelve al login general de
    // Governex, no al login de admin — evita reexponer esa pantalla tras
    // cerrar sesión.
    navigate('/login')
  }

  /* ── Carga de datos ───────────────────────────────────────── */
  const loadTenants = async () => {
    setLoadingTenants(true)
    try {
      const data = await platformAdminApi.listTenants()
      setTenants(data)
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    } finally {
      setLoadingTenants(false)
    }
  }

  const loadAdmins = async () => {
    setLoadingAdmins(true)
    try {
      const data = await platformAdminApi.listAdmins()
      setAdmins(data)
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    } finally {
      setLoadingAdmins(false)
    }
  }

  const loadAuditLog = async () => {
    setLoadingAudit(true)
    try {
      const data = await platformAdminApi.getAuditLog()
      setAuditLog(data)
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    } finally {
      setLoadingAudit(false)
    }
  }

  useEffect(() => { loadTenants() }, [])

  // Carga perezosa: administradores y auditoría solo se piden la primera
  // vez que el usuario entra a esa pestaña, no de entrada.
  useEffect(() => {
    if (tab === 'admins' && admins.length === 0) loadAdmins()
    if (tab === 'auditoria' && auditLog.length === 0) loadAuditLog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  /* ── Tenants: handlers ────────────────────────────────────── */
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (tenantForm.adminPassword.length < 8) {
      Swal.fire({ icon: 'warning', title: 'Contraseña muy corta', text: 'Debe tener al menos 8 caracteres' })
      return
    }
    setCreatingTenant(true)
    try {
      const { tenant, adminUser } = await platformAdminApi.createTenant(tenantForm)
      Swal.fire({
        icon: 'success',
        title: 'Tenant creado',
        html: `<b>${tenant.nombre}</b> (id ${tenant.id})<br/>Admin: ${adminUser.email}`,
      })
      setTenantForm(emptyTenantForm)
      setShowTenantForm(false)
      loadTenants()
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'No se pudo crear el tenant', text: err.message })
    } finally {
      setCreatingTenant(false)
    }
  }

  const handleTenantEstadoChange = async (tenant: TenantSummary, nuevoEstado: TenantSummary['estado']) => {
    if (nuevoEstado === tenant.estado) return
    const confirm = await Swal.fire({
      icon: 'warning',
      title: `¿Cambiar estado de "${tenant.nombre}"?`,
      text: `De "${tenant.estado}" a "${nuevoEstado}". Los usuarios de este tenant perderán/recuperarán acceso en menos de 60 segundos.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar',
    })
    if (!confirm.isConfirmed) return

    try {
      await platformAdminApi.updateTenantEstado(tenant.id, nuevoEstado)
      loadTenants()
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const filteredTenants = tenants.filter(t => {
    const matchesSearch =
      tenantSearch.trim() === '' ||
      t.nombre.toLowerCase().includes(tenantSearch.trim().toLowerCase()) ||
      t.nit.toLowerCase().includes(tenantSearch.trim().toLowerCase())
    const matchesEstado = tenantEstadoFilter === 'Todos' || t.estado === tenantEstadoFilter
    const matchesPlan = tenantPlanFilter === 'Todos' || t.plan === tenantPlanFilter
    return matchesSearch && matchesEstado && matchesPlan
  })

  const stats = {
    total: tenants.length,
    activos: tenants.filter(t => t.estado === 'Activo').length,
    suspendidos: tenants.filter(t => t.estado === 'Suspendido').length,
    cancelados: tenants.filter(t => t.estado === 'Cancelado').length,
    porPlan: {
      Standard: tenants.filter(t => t.plan === 'Standard').length,
      Pro: tenants.filter(t => t.plan === 'Pro').length,
      Enterprise: tenants.filter(t => t.plan === 'Enterprise').length,
    },
  }

  // Crecimiento: cuántos tenants se crearon en cada uno de los últimos 6 meses.
  const crecimientoMensual = (() => {
    const meses: { label: string; count: number }[] = []
    const ahora = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
      const label = d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
      const count = tenants.filter(t => {
        const fc = new Date(t.fecha_creacion)
        return fc.getFullYear() === d.getFullYear() && fc.getMonth() === d.getMonth()
      }).length
      meses.push({ label, count })
    }
    return meses
  })()
  const maxCrecimiento = Math.max(1, ...crecimientoMensual.map(m => m.count))

  /* ── Administradores: handlers ────────────────────────────── */
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (adminForm.password.length < 8) {
      Swal.fire({ icon: 'warning', title: 'Contraseña muy corta', text: 'Debe tener al menos 8 caracteres' })
      return
    }
    setCreatingAdmin(true)
    try {
      const nuevo = await platformAdminApi.createAdmin(adminForm)
      Swal.fire({ icon: 'success', title: 'Administrador creado', text: nuevo.email })
      setAdminForm(emptyAdminForm)
      setShowAdminForm(false)
      loadAdmins()
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'No se pudo crear el administrador', text: err.message })
    } finally {
      setCreatingAdmin(false)
    }
  }

  const handleAdminEstadoChange = async (target: PlatformAdminSummary) => {
    const esYoMismo = target.id === admin?.id
    if (esYoMismo && target.activo) {
      Swal.fire({ icon: 'warning', title: 'No permitido', text: 'No puedes desactivar tu propia cuenta.' })
      return
    }

    const nuevoEstado = !target.activo
    const confirm = await Swal.fire({
      icon: 'warning',
      title: `¿${nuevoEstado ? 'Activar' : 'Desactivar'} a "${target.nombre}"?`,
      text: nuevoEstado
        ? 'Podrá volver a iniciar sesión en el panel de administración.'
        : 'Perderá acceso inmediato al panel de administración.',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar',
    })
    if (!confirm.isConfirmed) return

    try {
      await platformAdminApi.updateAdminEstado(target.id, nuevoEstado)
      loadAdmins()
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="pa-dashboard">
      <header className="pa-dashboard__header">
        <div>
          <h1>Administración de plataforma</h1>
          <p className="pa-dashboard__subtitle">Conectado como {admin?.nombre} ({admin?.email})</p>
        </div>
        <div className="pa-dashboard__header-actions">
          <button className="pa-dashboard__btn-secondary" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </header>

      <nav className="pa-dashboard__tabs">
        <button
          className={`pa-dashboard__tab ${tab === 'dashboard' ? 'pa-dashboard__tab--active' : ''}`}
          onClick={() => setTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`pa-dashboard__tab ${tab === 'tenants' ? 'pa-dashboard__tab--active' : ''}`}
          onClick={() => setTab('tenants')}
        >
          Tenants
        </button>
        <button
          className={`pa-dashboard__tab ${tab === 'admins' ? 'pa-dashboard__tab--active' : ''}`}
          onClick={() => setTab('admins')}
        >
          Administradores
        </button>
        <button
          className={`pa-dashboard__tab ${tab === 'auditoria' ? 'pa-dashboard__tab--active' : ''}`}
          onClick={() => setTab('auditoria')}
        >
          Auditoría
        </button>
      </nav>

      {/* ── TAB: DASHBOARD ────────────────────────────────────── */}
      {tab === 'dashboard' && (
        loadingTenants ? <p>Cargando...</p> : (
          <>
            <div className="pa-dashboard__stat-cards">
              <div className="pa-dashboard__stat-card">
                <span className="pa-dashboard__stat-value">{stats.total}</span>
                <span className="pa-dashboard__stat-label">Tenants totales</span>
              </div>
              <div className="pa-dashboard__stat-card pa-dashboard__stat-card--activo">
                <span className="pa-dashboard__stat-value">{stats.activos}</span>
                <span className="pa-dashboard__stat-label">Activos</span>
              </div>
              <div className="pa-dashboard__stat-card pa-dashboard__stat-card--suspendido">
                <span className="pa-dashboard__stat-value">{stats.suspendidos}</span>
                <span className="pa-dashboard__stat-label">Suspendidos</span>
              </div>
              <div className="pa-dashboard__stat-card pa-dashboard__stat-card--cancelado">
                <span className="pa-dashboard__stat-value">{stats.cancelados}</span>
                <span className="pa-dashboard__stat-label">Cancelados</span>
              </div>
            </div>

            <div className="pa-dashboard__panels">
              <section className="pa-dashboard__panel">
                <h2>Distribución por plan</h2>
                {(['Standard', 'Pro', 'Enterprise'] as const).map(plan => {
                  const count = stats.porPlan[plan]
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                  return (
                    <div key={plan} className="pa-dashboard__bar-row">
                      <span className="pa-dashboard__bar-label">{plan}</span>
                      <div className="pa-dashboard__bar-track">
                        <div className="pa-dashboard__bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="pa-dashboard__bar-count">{count}</span>
                    </div>
                  )
                })}
                {stats.total === 0 && <p className="pa-dashboard__empty">Aún no hay tenants.</p>}
              </section>

              <section className="pa-dashboard__panel">
                <h2>Nuevos tenants (últimos 6 meses)</h2>
                <div className="pa-dashboard__growth-chart">
                  {crecimientoMensual.map(m => (
                    <div key={m.label} className="pa-dashboard__growth-col">
                      <div
                        className="pa-dashboard__growth-bar"
                        style={{ height: `${Math.max(4, (m.count / maxCrecimiento) * 100)}px` }}
                        title={`${m.count} tenant(s)`}
                      />
                      <span className="pa-dashboard__growth-count">{m.count}</span>
                      <span className="pa-dashboard__growth-label">{m.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )
      )}

      {/* ── TAB: TENANTS ─────────────────────────────────────── */}
      {tab === 'tenants' && (
        <>
          <div className="pa-dashboard__tab-actions">
            <button className="pa-dashboard__btn-primary" onClick={() => setShowTenantForm(v => !v)}>
              {showTenantForm ? 'Cancelar' : '+ Nuevo tenant'}
            </button>
          </div>

          {showTenantForm && (
            <form className="pa-dashboard__form" onSubmit={handleCreateTenant}>
              <h2>Nuevo tenant</h2>
              <div className="pa-dashboard__form-grid">
                <label>
                  Nombre de la empresa
                  <input value={tenantForm.nombreEmpresa} required
                    onChange={e => setTenantForm(f => ({ ...f, nombreEmpresa: e.target.value }))} />
                </label>
                <label>
                  NIT
                  <input value={tenantForm.nit} required
                    onChange={e => setTenantForm(f => ({ ...f, nit: e.target.value }))} />
                </label>
                <label>
                  Plan
                  <select value={tenantForm.plan}
                    onChange={e => setTenantForm(f => ({ ...f, plan: e.target.value as CreateTenantPayload['plan'] }))}>
                    <option value="Standard">Standard</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </label>
                <label>
                  Nombre del administrador
                  <input value={tenantForm.adminNombre} required
                    onChange={e => setTenantForm(f => ({ ...f, adminNombre: e.target.value }))} />
                </label>
                <label>
                  Email del administrador
                  <input type="email" value={tenantForm.adminEmail} required
                    onChange={e => setTenantForm(f => ({ ...f, adminEmail: e.target.value }))} />
                </label>
                <label>
                  Contraseña temporal
                  <input type="password" value={tenantForm.adminPassword} required minLength={8}
                    onChange={e => setTenantForm(f => ({ ...f, adminPassword: e.target.value }))} />
                </label>
              </div>
              <p className="pa-dashboard__form-hint">
                El administrador quedará creado con rol "Alta Dirección" y podrá invitar al resto
                de su equipo desde Governex una vez inicie sesión.
              </p>
              <button type="submit" className="pa-dashboard__btn-primary" disabled={creatingTenant}>
                {creatingTenant ? 'Creando...' : 'Crear tenant'}
              </button>
            </form>
          )}

          <section className="pa-dashboard__table-section">
            <h2>Tenants ({filteredTenants.length}{filteredTenants.length !== tenants.length ? ` de ${tenants.length}` : ''})</h2>

            <div className="pa-dashboard__filters">
              <input
                type="text"
                className="pa-dashboard__search"
                placeholder="Buscar por nombre o NIT..."
                value={tenantSearch}
                onChange={e => setTenantSearch(e.target.value)}
              />
              <select value={tenantEstadoFilter} onChange={e => setTenantEstadoFilter(e.target.value as any)}>
                <option value="Todos">Todos los estados</option>
                <option value="Activo">Activo</option>
                <option value="Suspendido">Suspendido</option>
                <option value="Cancelado">Cancelado</option>
              </select>
              <select value={tenantPlanFilter} onChange={e => setTenantPlanFilter(e.target.value as any)}>
                <option value="Todos">Todos los planes</option>
                <option value="Standard">Standard</option>
                <option value="Pro">Pro</option>
                <option value="Enterprise">Enterprise</option>
              </select>
              {(tenantSearch || tenantEstadoFilter !== 'Todos' || tenantPlanFilter !== 'Todos') && (
                <button
                  className="pa-dashboard__btn-link"
                  onClick={() => { setTenantSearch(''); setTenantEstadoFilter('Todos'); setTenantPlanFilter('Todos') }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {loadingTenants ? (
              <p>Cargando...</p>
            ) : filteredTenants.length === 0 ? (
              <p className="pa-dashboard__empty">No se encontraron tenants con esos filtros.</p>
            ) : (
              <table className="pa-dashboard__table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>NIT</th>
                    <th>Plan</th>
                    <th>Usuarios</th>
                    <th>Creado</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map(t => (
                    <tr key={t.id}>
                      <td className="pa-dashboard__link-cell" onClick={() => setSelectedTenantId(t.id)}>
                        {t.nombre}
                      </td>
                      <td>{t.nit}</td>
                      <td>{t.plan}</td>
                      <td>{t.usuarios_count}</td>
                      <td>{new Date(t.fecha_creacion).toLocaleDateString()}</td>
                      <td>
                        <select
                          className={`pa-dashboard__estado pa-dashboard__estado--${t.estado.toLowerCase()}`}
                          value={t.estado}
                          onChange={e => {
                            e.stopPropagation()
                            handleTenantEstadoChange(t, e.target.value as TenantSummary['estado'])
                            }}
                        >
                          <option value="Activo">Activo</option>
                          <option value="Suspendido">Suspendido</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {/* ── TAB: ADMINISTRADORES ─────────────────────────────── */}
      {tab === 'admins' && (
        <>
          <div className="pa-dashboard__tab-actions">
            <button className="pa-dashboard__btn-primary" onClick={() => setShowAdminForm(v => !v)}>
              {showAdminForm ? 'Cancelar' : '+ Nuevo administrador'}
            </button>
          </div>

          {showAdminForm && (
            <form className="pa-dashboard__form" onSubmit={handleCreateAdmin}>
              <h2>Nuevo administrador de plataforma</h2>
              <div className="pa-dashboard__form-grid">
                <label>
                  Nombre
                  <input value={adminForm.nombre} required
                    onChange={e => setAdminForm(f => ({ ...f, nombre: e.target.value }))} />
                </label>
                <label>
                  Email
                  <input type="email" value={adminForm.email} required
                    onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))} />
                </label>
                <label>
                  Contraseña temporal
                  <input type="password" value={adminForm.password} required minLength={8}
                    onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))} />
                </label>
              </div>
              <p className="pa-dashboard__form-hint">
                Este usuario tendrá acceso completo a la administración de la plataforma: podrá
                crear/suspender tenants y crear/desactivar otros administradores.
              </p>
              <button type="submit" className="pa-dashboard__btn-primary" disabled={creatingAdmin}>
                {creatingAdmin ? 'Creando...' : 'Crear administrador'}
              </button>
            </form>
          )}

          <section className="pa-dashboard__table-section">
            <h2>Administradores de plataforma ({admins.length})</h2>
            {loadingAdmins ? (
              <p>Cargando...</p>
            ) : (
              <table className="pa-dashboard__table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Creado</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map(a => (
                    <tr key={a.id}>
                      <td>{a.nombre}{a.id === admin?.id && <span className="pa-dashboard__tag-self"> (tú)</span>}</td>
                      <td>{a.email}</td>
                      <td>{new Date(a.creado_en).toLocaleDateString()}</td>
                      <td>
                        <span className={`pa-dashboard__badge pa-dashboard__badge--${a.activo ? 'activo' : 'inactivo'}`}>
                          {a.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="pa-dashboard__btn-link"
                          onClick={() => handleAdminEstadoChange(a)}
                          disabled={a.id === admin?.id && a.activo}
                          title={a.id === admin?.id && a.activo ? 'No puedes desactivar tu propia cuenta' : undefined}
                        >
                          {a.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {/* ── TAB: AUDITORÍA ────────────────────────────────────── */}
      {tab === 'auditoria' && (
        <section className="pa-dashboard__table-section">
          <h2>Bitácora de acciones ({auditLog.length})</h2>
          <p className="pa-dashboard__form-hint">Muestra las últimas 200 acciones sensibles ejecutadas por administradores de plataforma.</p>
          {loadingAudit ? (
            <p>Cargando...</p>
          ) : (
            <table className="pa-dashboard__table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Administrador</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map(entry => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.creado_en).toLocaleString()}</td>
                    <td>{entry.actor_email}</td>
                    <td>{ACCION_LABELS[entry.accion] || entry.accion}</td>
                    <td className="pa-dashboard__audit-detail">
                      {Object.entries(entry.detalle).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {selectedTenantId !== null && (
        <TenantDetailModal
          tenantId={selectedTenantId}
          onClose={() => setSelectedTenantId(null)}
          onUpdated={loadTenants}
        />
      )}
    </div>
  )
}

export default PlatformAdminDashboardPage