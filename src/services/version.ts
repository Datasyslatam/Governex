/**
 * Detección de versión nueva desplegada.
 *
 * Una pestaña abierta conserva en memoria el código con el que se cargó. Si
 * mientras tanto se despliega una versión nueva, ese código viejo habla con
 * un servidor nuevo y puede fallar (pasó al introducir el MFA: la pantalla de
 * login vieja no entendía la respuesta "configura tu MFA").
 *
 * Cada build incrusta __APP_BUILD_ID__ y publica /version.json con el mismo
 * valor. Si el archivo publicado ya no coincide con el de esta pestaña, hay
 * una versión nueva y hay que recargar.
 */
// Uso directo (sin `typeof`): Vite/Rolldown no sustituye `define` dentro de
// `typeof` y eliminaría toda la comprobación como código muerto.
export const BUILD_ACTUAL: string = __APP_BUILD_ID__

export const EVENTO_NUEVA_VERSION = 'governex:nueva-version'

let detectada = false

/** true si el servidor ya publica un build distinto al de esta pestaña. */
export async function hayNuevaVersion(): Promise<boolean> {
  // En desarrollo (vite dev) no existe /version.json: Vite recarga solo.
  if (import.meta.env.DEV || !BUILD_ACTUAL) return false
  if (detectada) return true
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store', credentials: 'omit' })
    if (!res.ok) return false
    const { build } = await res.json()
    if (typeof build === 'string' && build && build !== BUILD_ACTUAL) {
      detectada = true
      window.dispatchEvent(new CustomEvent(EVENTO_NUEVA_VERSION))
      return true
    }
  } catch {
    /* sin red o archivo inválido: no se interrumpe al usuario */
  }
  return false
}
