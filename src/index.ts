import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { logActivityMiddleware } from './middleware/activityLogger'

// ── Rutas existentes ────────────────────────────────────────
import authRouter               from './routes/auth'
import riesgosRouter            from './routes/riesgos'
import auditoriasRouter         from './routes/auditorias'
import ncAcRouter               from './routes/ncAc'
import documentosRouter         from './routes/documentos'
import indicadoresRouter        from './routes/indicadores'
import proveedoresRouter        from './routes/proveedores'
import procesosRouter           from './routes/procesos'
import competenciasRouter       from './routes/competencias'
import perfilesCargoRouter      from './routes/perfilesCargo'
import { politicaRouter, revDireccionRouter } from './routes/otrosModulos'

// ── Módulos ISO adicionales ─────────────────────────────────
import planesOperacionRouter    from './routes/planesOperacion'
import requerimientosPSRouter   from './routes/requerimientosPS'
import disenoDesarrolloRouter   from './routes/disenoDesarrollo'
import comprasRouter            from './routes/compras'
import produccionRouter         from './routes/produccion'
import liberacionPSRouter       from './routes/liberacionPS'
import salidasNCRouter          from './routes/salidasNC'
import tomaConscienciaRouter    from './routes/tomaConsciencia'
import comunicacionRouter       from './routes/comunicacion'
import mejoraContinuaRouter     from './routes/mejoraContinua'
import objetivosCalidadRouter   from './routes/objetivosCalidad'
import planificacionCambiosRouter from './routes/planificacionCambios'
import contextoEmpresaRouter    from './routes/contextoEmpresa'
import riesgoEvidenciasRouter   from './routes/riesgoEvidencias'
import uploadsRouter from './routes/uploads'
import enfoqueClienteRouter from './routes/enfoqueCliente'
  import platformAdminRouter from './routes/platformAdmin'


// ── IA: Gemini ──────────────────────────────────────────────
import geminiRouter from './routes/gemini'

const app  = express()
const PORT = process.env.PORT || 3001

// Railway (y Cloudflare, si se usa) ponen un proxy delante: sin esto req.ip
// sería siempre la IP del proxy y el limitador de login no distinguiría
// clientes. Ajustable con TRUST_PROXY (número de saltos de proxy de confianza).
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1))
app.disable('x-powered-by')

// ── Content-Security-Policy (modo SOLO REPORTE) ─────────────
// Se publica como Content-Security-Policy-Report-Only: el navegador NO bloquea
// nada, solo informa a /api/csp-report lo que la política habría bloqueado.
// Tras revisar los reportes en producción, se puede pasar a la cabecera
// Content-Security-Policy (bloqueante) con CSP_ENFORCE=true.
// - 'unsafe-inline' en style-src: la app usa estilos en línea (style={...}).
// - R2: las miniaturas y descargas usan URLs firmadas del bucket.
const r2Origin = (() => {
  try { return process.env.R2_ENDPOINT ? new URL(process.env.R2_ENDPOINT).origin : '' } catch { return '' }
})()
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.r2.cloudflarestorage.com ${r2Origin}`.trim(),
  `connect-src 'self' https://*.r2.cloudflarestorage.com ${r2Origin}`.trim(),
  "font-src 'self' data:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  'report-uri /api/csp-report',
].join('; ')
const CSP_HEADER = process.env.CSP_ENFORCE === 'true' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only'

// ── Cabeceras de seguridad básicas ──────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader(CSP_HEADER, CSP)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000')
  }
  next()
})

// Receptor de reportes CSP: público (lo llama el navegador), cuerpo pequeño y
// registro limitado a 30 líneas por minuto para que no se pueda inundar el log.
let cspReportsThisMinute = 0
setInterval(() => { cspReportsThisMinute = 0 }, 60_000).unref()
app.post(
  '/api/csp-report',
  express.json({ type: ['application/csp-report', 'application/reports+json', 'application/json'], limit: '10kb' }),
  (req, res) => {
    if (cspReportsThisMinute++ < 30) {
      const raw = req.body?.['csp-report'] ?? (Array.isArray(req.body) ? req.body[0]?.body : req.body) ?? {}
      const directiva = raw['violated-directive'] ?? raw.effectiveDirective ?? '?'
      const bloqueado = raw['blocked-uri'] ?? raw.blockedURL ?? '?'
      const pagina = raw['document-uri'] ?? raw.documentURL ?? '?'
      console.warn(`[csp] ${directiva} bloquearía ${String(bloqueado).slice(0, 200)} en ${String(pagina).slice(0, 200)}`)
    }
    res.status(204).end()
  }
)

// ── CORS ────────────────────────────────────────────────────
// En producción el frontend lo sirve este mismo Express (mismo origen) y en
// desarrollo Vite hace de proxy, así que ninguno depende de CORS. Si se
// define CORS_ORIGINS (lista separada por comas), solo esos orígenes externos
// quedan autorizados. Si no se define, se mantiene el comportamiento anterior
// (cualquier origen) para no romper integraciones existentes, con un aviso.
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

if (corsOrigins.length === 0 && process.env.NODE_ENV === 'production') {
  console.warn('[seguridad] CORS_ORIGINS no está definida: se acepta cualquier origen. Defínela en Railway.')
}

app.use(cors({
  origin: (origin, callback) => {
    if (corsOrigins.length === 0) return callback(null, true) // comportamiento anterior
    if (!origin || corsOrigins.includes(origin)) return callback(null, true)
    return callback(null, false) // sin cabeceras CORS: el navegador bloquea la respuesta
  },
  credentials: true,
}))

// 100 KB (valor por defecto de Express) no alcanzaba para las imágenes en
// base64 que se envían a /api/gemini/extraer-procesos-imagen (organigramas):
// cualquier imagen de más de ~75 KB fallaba con 413. Ajustable con JSON_BODY_LIMIT.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '15mb' }))
app.use(logActivityMiddleware)

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',                  authRouter)
app.use('/api/riesgos',               riesgosRouter)
app.use('/api/auditorias',            auditoriasRouter)
app.use('/api/nc-ac',                 ncAcRouter)
app.use('/api/documentos',            documentosRouter)
app.use('/api/indicadores',           indicadoresRouter)
app.use('/api/proveedores',           proveedoresRouter)
app.use('/api/procesos',              procesosRouter)
app.use('/api/competencias',          competenciasRouter)
app.use('/api/perfiles-cargo',        perfilesCargoRouter)
app.use('/api/politica',              politicaRouter)
app.use('/api/rev-direccion',         revDireccionRouter)
app.use('/api/planes-operacion',      planesOperacionRouter)
app.use('/api/requerimientos-ps',     requerimientosPSRouter)
app.use('/api/diseno-desarrollo',     disenoDesarrolloRouter)
app.use('/api/compras',               comprasRouter)
app.use('/api/produccion',            produccionRouter)
app.use('/api/liberacion-ps',         liberacionPSRouter)
app.use('/api/salidas-nc',            salidasNCRouter)
app.use('/api/toma-consciencia',      tomaConscienciaRouter)
app.use('/api/comunicacion',          comunicacionRouter)
app.use('/api/mejora-continua',       mejoraContinuaRouter)
app.use('/api/objetivos-calidad',     objetivosCalidadRouter)
app.use('/api/planificacion-cambios', planificacionCambiosRouter)
app.use('/api/contexto-empresa',      contextoEmpresaRouter)
app.use('/api/riesgo-evidencias',     riesgoEvidenciasRouter)
app.use('/api/uploads', uploadsRouter)
app.use('/api/enfoque-cliente', enfoqueClienteRouter)
app.use('/api/platform-admin', platformAdminRouter)
// ── IA ──────────────────────────────────────────────────────
app.use('/api/gemini',                geminiRouter)

// ── Health check Railway ────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }))
// Mismo chequeo bajo /api: lo usa el indicador "Servidor en línea" del login.
// (En desarrollo, Vite solo redirige /api al backend; /health devolvería el
// index.html de Vite con 200 y mostraría "en línea" aunque el backend no corra.)
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// ── Frontend estático (Vite build) ──────────────────────────
// Solo en producción: en dev, Vite (puerto 5173) sirve el frontend y
// maneja su propio SPA routing. Si este catch-all corriera en dev,
// cualquier petición mal enrutada al backend intentaría servir
// dist/index.html —que no existe— y tiraría ENOENT en vez de un 404 claro.
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(path.dirname(process.argv[1]), '..', 'dist')
  app.use(express.static(frontendDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
} else {
  app.get('*', (_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' })
  })
}

app.listen(PORT, () => {
  console.log(`Governex API + Frontend corriendo en puerto ${PORT}`)
})