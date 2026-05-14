import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'

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
import objetivosCalidadRouter   from './routes/objetivosCalidad'    // §6.2
import planificacionCambiosRouter from './routes/planificacionCambios' // §6.3 ← NUEVO

// ── IA: Gemini ──────────────────────────────────────────────
import geminiRouter from './routes/gemini'

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: (_origin, callback) => callback(null, true),
  credentials: true,
}))
app.use(express.json())

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
app.use('/api/objetivos-calidad',     objetivosCalidadRouter)     // §6.2
app.use('/api/planificacion-cambios', planificacionCambiosRouter)  // §6.3 ← NUEVO

// ── IA ──────────────────────────────────────────────────────
app.use('/api/gemini',                geminiRouter)

// ── Health check Railway ────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// ── Frontend estático (Vite build) ──────────────────────────
const frontendDist = path.join(path.dirname(process.argv[1]), '..', 'dist')
app.use(express.static(frontendDist))
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Governex API + Frontend corriendo en puerto ${PORT}`)
})