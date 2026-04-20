/**
 * src/index.ts  (MODIFICADO — agrega ruta Gemini)
 * Cambios respecto al original:
 *   + import geminiRouter from './routes/gemini'
 *   + app.use('/api/gemini', geminiRouter)
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'

// ── Rutas existentes ────────────────────────────────────────
import authRouter           from './routes/auth'
import riesgosRouter        from './routes/riesgos'
import auditoriasRouter     from './routes/auditorias'
import ncAcRouter           from './routes/ncAc'
import documentosRouter     from './routes/documentos'
import indicadoresRouter    from './routes/indicadores'
import proveedoresRouter    from './routes/proveedores'
import procesosRouter       from './routes/procesos'
import competenciasRouter   from './routes/competencias'
import { politicaRouter, revDireccionRouter } from './routes/otrosModulos'

// ── Rutas nuevas (módulos ISO sin persistencia previa) ──────
import planesOperacionRouter  from './routes/planesOperacion'   // §8.1
import requerimientosPSRouter from './routes/requerimientosPS'  // §8.2
import disenoDesarrolloRouter from './routes/disenoDesarrollo'  // §8.3
import comprasRouter          from './routes/compras'           // §8.4
import produccionRouter       from './routes/produccion'        // §8.5
import liberacionPSRouter     from './routes/liberacionPS'      // §8.6
import salidasNCRouter        from './routes/salidasNC'         // §8.7
import tomaConscienciaRouter  from './routes/tomaConsciencia'   // §7.3
import comunicacionRouter     from './routes/comunicacion'      // §7.4
import mejoraContinuaRouter   from './routes/mejoraContinua'    // §10.3

// ── IA: Gemini ──────────────────────────────────────────────
import geminiRouter from './routes/gemini'                      // ← NUEVO

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: (origin, callback) => {
    callback(null, true)
  },
  credentials: true
}))
app.use(express.json())

// ── API Routes — módulos existentes ────────────────────────
app.use('/api/auth',           authRouter)
app.use('/api/riesgos',        riesgosRouter)
app.use('/api/auditorias',     auditoriasRouter)
app.use('/api/nc-ac',          ncAcRouter)
app.use('/api/documentos',     documentosRouter)
app.use('/api/indicadores',    indicadoresRouter)
app.use('/api/proveedores',    proveedoresRouter)
app.use('/api/procesos',       procesosRouter)
app.use('/api/competencias',   competenciasRouter)
app.use('/api/politica',       politicaRouter)
app.use('/api/rev-direccion',  revDireccionRouter)

// ── API Routes — módulos nuevos ─────────────────────────────
app.use('/api/planes-operacion',   planesOperacionRouter)   // §8.1
app.use('/api/requerimientos-ps',  requerimientosPSRouter)  // §8.2
app.use('/api/diseno-desarrollo',  disenoDesarrolloRouter)  // §8.3
app.use('/api/compras',            comprasRouter)           // §8.4
app.use('/api/produccion',         produccionRouter)        // §8.5
app.use('/api/liberacion-ps',      liberacionPSRouter)      // §8.6
app.use('/api/salidas-nc',         salidasNCRouter)         // §8.7
app.use('/api/toma-consciencia',   tomaConscienciaRouter)   // §7.3
app.use('/api/comunicacion',       comunicacionRouter)      // §7.4
app.use('/api/mejora-continua',    mejoraContinuaRouter)    // §10.3

// ── IA ──────────────────────────────────────────────────────
app.use('/api/gemini',             geminiRouter)             // ← NUEVO

// ── Health check para Railway ───────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// ── Servir frontend (React/Vite build) ─────────────────────
const frontendDist = path.join(path.dirname(process.argv[1]), '..', 'dist')
app.use(express.static(frontendDist))

// Cualquier ruta que no sea /api/* la maneja React Router
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Governex API + Frontend corriendo en puerto ${PORT}`)
})
