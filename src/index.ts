import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { logActivityMiddleware } from './middleware/activityLogger'
import { assertSecurityConfig } from './middleware/securityConfig'
import { requestRateLimit } from './middleware/rateLimit'
import { requestContext } from './middleware/requestContext'
import { securityHeaders, recibirReporteCsp } from './middleware/securityHeaders'

// Falla rápido si los secretos JWT no son seguros (ver securityConfig.ts).
assertSecurityConfig()

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

// ID de correlación (X-Request-Id) y log JSON de acceso por petición (Fase 3).
app.use(requestContext)

// ── Cabeceras de seguridad del navegador (Fase 4) ───────────
// CSP bloqueante, Permissions-Policy, COOP/CORP, HSTS y no-store en la API.
// Ver src/middleware/securityHeaders.ts.
app.use(securityHeaders)
app.post(
  '/api/csp-report',
  express.json({ type: ['application/csp-report', 'application/reports+json', 'application/json'], limit: '10kb' }),
  recibirReporteCsp
)

// ── CORS ────────────────────────────────────────────────────
// En producción el frontend lo sirve este mismo Express (mismo origen) y en
// desarrollo Vite hace de proxy, así que ninguno depende de CORS. Si se
// define CORS_ORIGINS (lista separada por comas), solo esos orígenes externos
// quedan autorizados. Si NO se define, no se autoriza ningún origen externo
// (V14). Antes, vacío significaba "cualquier origen con credenciales", algo
// inaceptable ahora que la sesión viaja en cookies.
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsOrigins.includes(origin)) return callback(null, true)
    return callback(null, false) // sin cabeceras CORS: el navegador bloquea la respuesta
  },
  credentials: true,
}))

// ── Límite general de peticiones a la API (V15 / CWE-770) ───
// Freno contra abuso y automatización, no contra el uso normal: el valor es
// alto porque varios usuarios de una empresa pueden compartir la IP de salida
// de su red corporativa. Ajustable con API_RATE_LIMIT_MAX (por IP / 5 min).
app.use('/api', requestRateLimit({
  windowMs: 5 * 60_000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 3000),
}))

// ── Tamaño de los cuerpos JSON (V15 / CWE-400) ──────────────
// Solo la IA recibe imágenes y documentos en base64 (organigramas, manuales
// de funciones, cotizaciones), así que solo /api/gemini admite cuerpos
// grandes (JSON_BODY_LIMIT_IA, 15 MB por defecto). El resto de la API usa
// JSON_BODY_LIMIT (1 MB por defecto). Antes los 15 MB aplicaban a todo.
// El parser de /api/gemini va primero; el global omite cuerpos ya leídos.
app.use('/api/gemini', express.json({ limit: process.env.JSON_BODY_LIMIT_IA || '15mb' }))
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }))
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

// Cualquier /api/* no reconocido responde 404 JSON (antes, en producción, el
// catch-all del frontend devolvía index.html con 200 a rutas de API inexistentes).
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

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

// ── Manejador final de errores (V17 / CWE-209) ──────────────
// Respuestas JSON genéricas: nunca se devuelve el mensaje ni la traza
// interna al cliente; el detalle queda solo en el log del servidor.
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err)
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El contenido enviado supera el tamaño máximo permitido', code: 'PAYLOAD_TOO_LARGE' })
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El contenido enviado no es un JSON válido', code: 'INVALID_JSON' })
  }
  console.error('[error no controlado]', err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`Governex API + Frontend corriendo en puerto ${PORT}`)
})