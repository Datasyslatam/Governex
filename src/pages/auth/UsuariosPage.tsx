import React, { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import { usuariosService, Usuario, PermisoItem, RoleItem, LogActividad } from '../../services'
import './UsuariosPage.css'

const UsuariosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'usuarios' | 'logs'>('usuarios')
  
  const [users, setUsers] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [permisos, setPermisos] = useState<PermisoItem[]>([])
  const [logs, setLogs] = useState<LogActividad[]>([])
  
  const [loading, setLoading] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  // Form State
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rolId, setRolId] = useState<number>(3) // default to 'Operativo'
  const [activo, setActivo] = useState(true)
  const [tienePermisosPersonalizados, setTienePermisosPersonalizados] = useState(false)
  const [selectedPermisosIds, setSelectedPermisosIds] = useState<number[]>([])

  // Filter logs state
  const [logsQuery, setLogsQuery] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersData, rolesData, permisosData] = await Promise.all([
        usuariosService.getAll(),
        usuariosService.getRoles(),
        usuariosService.getPermisos(),
      ])
      setUsers(usersData)
      setRoles(rolesData)
      setPermisos(permisosData)
      
      if (rolesData.length > 0) {
        const defaultRole = rolesData.find(r => r.nombre === 'Operativo')?.id || rolesData[0].id
        setRolId(defaultRole)
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar datos',
        text: err.message || 'No se pudieron cargar los usuarios y roles.',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadLogs = async () => {
    setLoadingLogs(true)
    try {
      const logsData = await usuariosService.getActivityLogs()
      setLogs(logsData)
    } catch (err: any) {
      console.error(err)
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar bitácora',
        text: err.message || 'No se pudo cargar el registro de logs.',
      })
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs()
    }
  }, [activeTab])

  // Open modal for Create
  const handleCreateOpen = () => {
    setIsEditing(false)
    setSelectedUserId(null)
    setNombre('')
    setEmail('')
    setPassword('')
    setActivo(true)
    setTienePermisosPersonalizados(false)
    setSelectedPermisosIds([])
    const defaultRole = roles.find(r => r.nombre === 'Operativo')?.id || roles[0]?.id || 3
    setRolId(defaultRole)
    setShowModal(true)
  }

  // Open modal for Edit
  const handleEditOpen = (user: Usuario) => {
    setIsEditing(true)
    setSelectedUserId(user.id)
    setNombre(user.nombre)
    setEmail(user.email)
    setPassword('') 
    setRolId(user.rol_id)
    setActivo(user.activo)
    setTienePermisosPersonalizados(user.tiene_permisos_personalizados)
    setSelectedPermisosIds(user.permisos_ids || [])
    setShowModal(true)
  }

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || !email.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Nombre y correo electrónico son obligatorios.' })
      return
    }
    if (!isEditing && !password.trim()) {
      Swal.fire({ icon: 'warning', title: 'Contraseña requerida', text: 'La contraseña es obligatoria al crear un usuario.' })
      return
    }

    try {
      const payload = {
        nombre,
        email,
        password: password.trim() !== '' ? password : undefined,
        rol_id: Number(rolId),
        activo,
        tiene_permisos_personalizados: tienePermisosPersonalizados,
        permisos_ids: tienePermisosPersonalizados ? selectedPermisosIds : [],
      }

      if (isEditing && selectedUserId) {
        await usuariosService.update(selectedUserId, payload)
        Swal.fire({ icon: 'success', title: 'Usuario actualizado', timer: 1500, showConfirmButton: false })
      } else {
        await usuariosService.create(payload)
        Swal.fire({ icon: 'success', title: 'Usuario creado', timer: 1500, showConfirmButton: false })
      }

      setShowModal(false)
      loadData()
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error al guardar',
        text: err.message || 'Ocurrió un error al procesar el usuario.',
      })
    }
  }

  // Handle Delete
  const handleDelete = (userId: number, userName: string) => {
    Swal.fire({
      title: `¿Eliminar a ${userName}?`,
      text: 'Esta acción no se puede deshacer de forma sencilla.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await usuariosService.delete(userId)
          Swal.fire({
            icon: 'success',
            title: res.message ? 'Operación completada' : 'Usuario eliminado',
            text: res.message || 'El usuario ha sido removido con éxito.',
          })
          loadData()
        } catch (err: any) {
          Swal.fire({
            icon: 'error',
            title: 'Error al eliminar',
            text: err.message || 'No se pudo eliminar el usuario.',
          })
        }
      }
    })
  }

  // Filtered Logs
  const filteredLogs = logs.filter(log => {
    const q = logsQuery.toLowerCase()
    return (
      (log.usuario_nombre || '').toLowerCase().includes(q) ||
      (log.usuario_email || '').toLowerCase().includes(q) ||
      (log.usuario_rol || '').toLowerCase().includes(q) ||
      (log.accion || '').toLowerCase().includes(q) ||
      (log.recurso || '').toLowerCase().includes(q) ||
      (log.detalle || '').toLowerCase().includes(q)
    )
  })

  // Group permissions by resource for premium UI
  const permissionsByResource = permisos.reduce((acc, curr) => {
    if (!acc[curr.recurso]) acc[curr.recurso] = []
    acc[curr.recurso].push(curr)
    return acc
  }, {} as Record<string, PermisoItem[]>)

  return (
    <div className="usuarios-page">
      {/* HEADER */}
      <div className="usuarios-page__header">
        <div className="usuarios-page__title-block">
          <h1>👤 Gestión y Bitácora de Usuarios</h1>
          <p>Administra los accesos, roles y audita todas las actividades ejecutadas en el SGC</p>
          <span className="usuarios-page__clause">Administración SGC</span>
        </div>
        {activeTab === 'usuarios' && (
          <button className="btn-primary" onClick={handleCreateOpen}>
            ＋ Nuevo Usuario
          </button>
        )}
      </div>

      {/* TABS */}
      <div className="usuarios-page__tabs">
        <button
          className={`usuarios-tab-btn ${activeTab === 'usuarios' ? 'active' : ''}`}
          onClick={() => setActiveTab('usuarios')}
        >
          👤 Usuarios Activos
        </button>
        <button
          className={`usuarios-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📋 Bitácora de Actividades (Logs)
        </button>
      </div>

      {/* TAB 1: USUARIOS */}
      {activeTab === 'usuarios' && (
        <>
          {loading ? (
            <div className="usuarios-loading">
              <div className="usuarios-spinner" />
              <p>Cargando lista de usuarios...</p>
            </div>
          ) : (
            <div className="usuarios-table-wrapper">
              <table className="usuarios-matrix-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Permisos</th>
                    <th style={{ width: '100px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, idx) => (
                    <tr key={user.id}>
                      <td style={{ color: '#9ca3af', fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, color: '#1b3a6b' }}>{user.nombre}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`rol-badge ${user.rol?.toLowerCase().replace(' ', '-')}`}>
                          {user.rol}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${user.activo ? 'activo' : 'inactivo'}`}>
                          {user.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        {user.tiene_permisos_personalizados ? (
                          <span className="permisos-badge personalizados">
                            Personalizados ({user.permisos_ids?.length || 0})
                          </span>
                        ) : (
                          <span className="permisos-badge rol-defecto">
                            Por Defecto del Rol
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            className="btn-icon"
                            onClick={() => handleEditOpen(user)}
                            title="Editar usuario"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon danger"
                            onClick={() => handleDelete(user.id, user.nombre)}
                            title="Eliminar usuario"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAB 2: BITÁCORA DE ACTIVIDADES (LOGS) */}
      {activeTab === 'logs' && (
        <div className="logs-panel">
          <div className="logs-panel__toolbar">
            <input
              type="text"
              placeholder="Buscar por usuario, rol, acción, detalle o recurso..."
              value={logsQuery}
              onChange={e => setLogsQuery(e.target.value)}
              className="logs-search-input"
            />
            <button className="btn-secondary" onClick={loadLogs} disabled={loadingLogs}>
              🔄 Actualizar
            </button>
          </div>

          {loadingLogs ? (
            <div className="usuarios-loading">
              <div className="usuarios-spinner" />
              <p>Cargando bitácora de actividades...</p>
            </div>
          ) : (
            <div className="usuarios-table-wrapper">
              <table className="usuarios-matrix-table">
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Acción</th>
                    <th>Recurso</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                        No se encontraron registros en la bitácora que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap', color: '#4b5563', fontWeight: 500 }}>
                          {new Date(log.fecha_hora).toLocaleString()}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1b3a6b' }}>{log.usuario_nombre}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{log.usuario_email}</div>
                        </td>
                        <td>
                          <span className={`rol-badge ${log.usuario_rol?.toLowerCase().replace(' ', '-')}`}>
                            {log.usuario_rol}
                          </span>
                        </td>
                        <td>
                          <span className={`accion-pill ${log.accion.toLowerCase().replace(/á/g, 'a').replace(/ó/g, 'o').replace(/ /g, '-')}`}>
                            {log.accion}
                          </span>
                        </td>
                        <td>
                          <span className="recurso-badge">
                            {log.recurso || 'sistema'}
                          </span>
                        </td>
                        <td style={{ color: '#374151', fontSize: '0.8rem', lineHeight: '1.4' }}>
                          {log.detalle}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {showModal && (
        <div className="usuarios-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="usuarios-modal" onClick={e => e.stopPropagation()}>
            <h2>{isEditing ? '✏️ Editar Usuario' : '➕ Crear Nuevo Usuario'}</h2>
            
            <form onSubmit={handleSave} className="usuarios-form">
              <div className="form-grid">
                <label>
                  Nombre completo *
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                  />
                </label>

                <label>
                  Correo electrónico *
                  <input
                    type="email"
                    required
                    placeholder="juan@empresa.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </label>

                <label>
                  Contraseña {isEditing ? '(dejar en blanco para no cambiar)' : '*'}
                  <input
                    type="password"
                    placeholder="••••••••"
                    required={!isEditing}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </label>

                <label>
                  Rol *
                  <select value={rolId} onChange={e => setRolId(Number(e.target.value))}>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="switch-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={e => setActivo(e.target.checked)}
                  />
                  <span>Usuario Activo (Permite iniciar sesión)</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={tienePermisosPersonalizados}
                    onChange={e => setTienePermisosPersonalizados(e.target.checked)}
                  />
                  <span>Personalizar Permisos (Ignorar matriz por defecto del rol)</span>
                </label>
              </div>

              {tienePermisosPersonalizados && (
                <div className="permisos-personalizacion-panel">
                  <h3>🔑 Asignar Permisos Específicos</h3>
                  <p className="permisos-helper-text">
                    Selecciona las acciones y recursos del sistema a los que este usuario tendrá acceso exclusivo.
                  </p>
                  
                  <div className="permisos-recursos-lista">
                    {Object.entries(permissionsByResource).map(([recurso, list]) => (
                      <div key={recurso} className="permisos-recurso-grupo">
                        <h4>{recurso.toUpperCase().replace('_', ' ')}</h4>
                        <div className="permisos-acciones-grid">
                          {list.map(p => (
                            <label key={p.id} className="checkbox-label-mini">
                              <input
                                type="checkbox"
                                checked={selectedPermisosIds.includes(p.id)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedPermisosIds(prev => [...prev, p.id])
                                  } else {
                                    setSelectedPermisosIds(prev => prev.filter(id => id !== p.id))
                                  }
                                }}
                              />
                              <span className={`accion-label ${p.accion}`}>
                                {p.accion}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="usuarios-modal__footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UsuariosPage
