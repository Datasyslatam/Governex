import React, { useEffect, useMemo, useState } from 'react'
import { usuariosService, EventoSeguridad } from '../../services'

/**
 * Pestaña "Eventos de seguridad" (Superusuario): bitácora inmutable de la
 * empresa (Fase 3). Inicios de sesión y fallos, MFA, bloqueos, cambios de
 * usuarios y permisos, accesos denegados y accesos de soporte de Governex.
 */
const CATEGORIAS: Record<string, string> = {
  autenticacion: 'Autenticación',
  acceso: 'Acceso denegado',
  usuarios: 'Usuarios y permisos',
  plataforma: 'Soporte Governex',
  datos: 'Cambios de datos',
  seguridad: 'Seguridad',
}

const RESULTADO_COLOR: Record<string, string> = { exito: '#1a9c5b', fallo: '#d93025', denegado: '#FE7F03' }

function resumen(ev: EventoSeguridad): string {
  const d = ev.detalle || {}
  const partes: string[] = []
  if (d.motivo) partes.push(`motivo: ${String(d.motivo).replace(/_/g, ' ')}`)
  if (d.usuario) partes.push(`usuario: ${d.usuario}`)
  if (d.permiso) partes.push(`permiso: ${d.permiso}`)
  if (d.email_intentado) partes.push(`correo intentado: ${d.email_intentado}`)
  if (d.elemento) partes.push(`elemento: ${d.elemento}`)
  if (d.cambios && typeof d.cambios === 'object') partes.push(`cambios: ${Object.keys(d.cambios as object).join(', ')}`)
  if (d.tipo_codigo) partes.push(`código: ${d.tipo_codigo}`)
  return partes.join(' · ')
}

const EventosSeguridadPanel: React.FC = () => {
  const [eventos, setEventos] = useState<EventoSeguridad[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [categoria, setCategoria] = useState('')
  const [resultado, setResultado] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const cargar = async () => {
    setCargando(true)
    setError('')
    try {
      setEventos(await usuariosService.getEventosSeguridad({ categoria: categoria || undefined, resultado: resultado || undefined }))
    } catch (e: any) {
      setError(e.message || 'No se pudieron cargar los eventos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [categoria, resultado]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return eventos
    return eventos.filter((e) => `${e.accion} ${e.actor_email || ''} ${e.ip || ''} ${resumen(e)}`.toLowerCase().includes(q))
  }, [eventos, busqueda])

  return (
    <div className="logs-panel">
      <div className="logs-panel__toolbar" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <input type="text" className="logs-search-input" placeholder="Buscar por acción, correo, IP o detalle..."
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar eventos" />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={resultado} onChange={(e) => setResultado(e.target.value)} aria-label="Resultado">
          <option value="">Todos los resultados</option>
          <option value="exito">Éxito</option>
          <option value="fallo">Fallo</option>
          <option value="denegado">Denegado</option>
        </select>
        <button className="btn-secondary" onClick={cargar} disabled={cargando}>Actualizar</button>
      </div>
      <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.25rem 0 0.75rem' }}>
        Registro inalterable: cada evento queda encadenado criptográficamente al anterior y no puede modificarse ni borrarse.
        Se muestran los últimos 500.
      </p>

      {error && <p style={{ color: '#d93025' }}>{error}</p>}
      {cargando ? (
        <div className="usuarios-loading"><div className="usuarios-spinner" /><p>Cargando eventos de seguridad...</p></div>
      ) : (
        <div className="usuarios-table-wrapper">
          <table className="usuarios-matrix-table">
            <thead><tr><th>Fecha y hora</th><th>Categoría</th><th>Acción</th><th>Resultado</th><th>Actor</th><th>IP</th><th>Detalle</th></tr></thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No hay eventos que coincidan.</td></tr>
              ) : filtrados.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ whiteSpace: 'nowrap', color: '#4b5563' }}>{new Date(ev.fecha).toLocaleString()}</td>
                  <td>{CATEGORIAS[ev.categoria] || ev.categoria}</td>
                  <td><code style={{ fontSize: '0.78rem' }}>{ev.accion}</code></td>
                  <td><strong style={{ color: RESULTADO_COLOR[ev.resultado] || 'inherit' }}>{ev.resultado}</strong></td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {ev.actor_tipo === 'platform_admin' ? `Soporte Governex (${ev.actor_email || '#' + ev.actor_id})`
                      : ev.actor_email || (ev.actor_tipo === 'anonimo' ? 'Anónimo' : `Usuario #${ev.actor_id}`)}
                    {ev.suplantado_por_admin && <div style={{ color: '#FE7F03', fontSize: '0.72rem' }}>vía soporte Governex</div>}
                  </td>
                  <td style={{ fontSize: '0.78rem', color: '#4b5563' }}>{ev.ip || '—'}</td>
                  <td style={{ fontSize: '0.78rem', color: '#374151' }}>{resumen(ev)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default EventosSeguridadPanel
