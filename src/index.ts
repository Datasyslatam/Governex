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

// ── Cabeceras de seguridad básicas ──────────────────────────
// No se define Content-Security-Policy a propósito: la app usa estilos en
// línea e imágenes firmadas de R2, y una CSP mal calibrada rompería pantallas.
// Queda como mejora planificada (ver docs/PLAN_CORRECCION_SEGURIDAD.md).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000')
  }
  next()
})

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