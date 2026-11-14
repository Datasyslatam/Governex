import { Request, Response, NextFunction } from 'express'
import { logJson } from './requestContext'

/**
 * Cabeceras de seguridad del navegador (Fase 4, V07 / V25; OWASP ASVS V14.4,
 * OWASP Secure Headers Project).
 *
 * Content-Security-Policy BLOQUEANTE por defecto. Se calibró con:
 *  - inventario del frontend: sin recursos externos, sin eval/new Function,
 *    sin iframes, sin workers; imágenes data:/blob: (QR del MFA, PDFs) y
 *    URLs firmadas de Cloudflare R2;
 *  - los reportes reales de producción en modo solo reporte (PR #5): cero
 *    violaciones en el tráfico observado;
 *  - prueba pantalla por pantalla en el navegador con la política activa.
 * Válvula de escape: CSP_REPORT_ONLY=true la vuelve a modo solo reporte sin
 * desplegar código (p. ej. si una pantalla nueva se rompe en producción).
 *
 * 'unsafe-inline' SOLO en style-src: React aplica style={...} por CSSOM (eso
 * no lo bloquea la CSP) pero SweetAlert2 inserta etiquetas <style> en tiempo de
 * ejecución. Los scripts siguen siendo exclusivamente 'self'.
 */
const r2Origin = (() => {
  try { return process.env.R2_ENDPOINT ? new URL(process.env.R2_ENDPOINT).origin : '' } catch { return '' }
})()
const R2 = `https://*.r2.cloudflarestorage.com ${r2Origin}`.trim()
const PROD = process.env.NODE_ENV === 'production'

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${R2}`,
  `connect-src 'self' ${R2}`,
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  // (Sin upgrade-insecure-requests: el sitio solo se sirve por HTTPS con HSTS,
  // y esa directiva rompería las pruebas del build de producción en http://localhost.)
  'report-uri /api/csp-report',
].join('; ')

const REPORT_ONLY = process.env.CSP_REPORT_ONLY === 'true' || process.env.CSP_ENFORCE === 'false'
export const CSP_HEADER = REPORT_ONLY ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'

/**
 * Funciones del navegador que Governex no usa: se deshabilitan para la app y
 * para cualquier contenido incrustado. Solo se permiten el portapapeles
 * (copiar códigos de recuperación MFA) y la pantalla completa, para el propio sitio.
 */
export const PERMISSIONS_POLICY = [
  'accelerometer=()', 'autoplay=()', 'bluetooth=()', 'camera=()', 'display-capture=()',
  'encrypted-media=()', 'geolocation=()', 'gyroscope=()', 'hid=()', 'idle-detection=()',
  'magnetometer=()', 'microphone=()', 'midi=()', 'payment=()', 'publickey-credentials-get=()',
  'screen-wake-lock=()', 'serial=()', 'usb=()', 'xr-spatial-tracking=()',
  'clipboard-write=(self)', 'fullscreen=(self)',
].join(', ')

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader(CSP_HEADER, CSP)
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY)
  // Aísla la ventana de Governex de las que abre o la abren (Spectre / tabnabbing).
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  // Los recursos de Governex solo los puede cargar el propio sitio.
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.setHeader('Origin-Agent-Cluster', '?1')
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')
  if (PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000')

  // Las respuestas de la API contienen datos de la empresa: que ni el
  // navegador ni ningún proxy intermedio las guarden (ASVS 8.2.1).
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Pragma', 'no-cache')
  }
  next()
}

// ── Receptor de reportes de violación CSP ─────────────────────────
// Público (lo llama el navegador), cuerpo pequeño, y como mucho 30 registros
// por minuto para que no se pueda inundar el log. Formato JSON (SIEM).
let reportesEsteMinuto = 0
setInterval(() => { reportesEsteMinuto = 0 }, 60_000).unref()

export function recibirReporteCsp(req: Request, res: Response) {
  if (reportesEsteMinuto++ < 30) {
    const raw = req.body?.['csp-report'] ?? (Array.isArray(req.body) ? req.body[0]?.body : req.body) ?? {}
    logJson({
      tipo: 'csp',
      cid: req.correlationId,
      modo: REPORT_ONLY ? 'solo_reporte' : 'bloqueante',
      directiva: String(raw['violated-directive'] ?? raw.effectiveDirective ?? '?').slice(0, 100),
      bloqueado: String(raw['blocked-uri'] ?? raw.blockedURL ?? '?').slice(0, 200),
      pagina: String(raw['document-uri'] ?? raw.documentURL ?? '?').split('?')[0].slice(0, 200),
      ip: req.ip,
    })
  }
  res.status(204).end()
}
