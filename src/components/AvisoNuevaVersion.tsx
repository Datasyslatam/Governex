import React, { useEffect, useState } from 'react'
import { hayNuevaVersion, EVENTO_NUEVA_VERSION } from '../services/version'
import './AvisoNuevaVersion.css'

const INTERVALO_MS = 5 * 60_000

/**
 * Barra fija que avisa de una versión nueva de Governex y ofrece recargar.
 * Comprueba al volver a la pestaña, cada 5 minutos y cuando otra parte de la
 * app la detecta (p. ej. el login, antes de enviar las credenciales).
 * No recarga sola fuera del login: el usuario podría tener un formulario a
 * medio llenar.
 */
const AvisoNuevaVersion: React.FC = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const comprobar = () => { hayNuevaVersion().then((nueva) => nueva && setVisible(true)) }
    const alVolver = () => { if (document.visibilityState === 'visible') comprobar() }
    const alDetectar = () => setVisible(true)

    comprobar()
    const intervalo = window.setInterval(comprobar, INTERVALO_MS)
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', comprobar)
    window.addEventListener(EVENTO_NUEVA_VERSION, alDetectar)
    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', comprobar)
      window.removeEventListener(EVENTO_NUEVA_VERSION, alDetectar)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="aviso-version" role="status" aria-live="polite">
      <span>Hay una versión nueva de Governex. Guarda lo que estés haciendo y recarga la página.</span>
      <button type="button" onClick={() => window.location.reload()}>Recargar</button>
      <button type="button" className="aviso-version__cerrar" onClick={() => setVisible(false)} aria-label="Ocultar aviso">×</button>
    </div>
  )
}

export default AvisoNuevaVersion
