#!/usr/bin/env node
/**
 * Verifica la integridad de la bitácora de seguridad (auditoria_eventos).
 *
 * Recalcula la cadena SHA-256 de todas las filas con gx_auditoria_verificar()
 * (migración 023). Si alguien modificó o borró filas (por ejemplo,
 * desactivando los triggers con privilegios de dueño), la cadena se rompe y
 * aquí se informa la primera fila afectada.
 *
 * Uso:  npm run audit:verify            (usa DATABASE_URL del entorno)
 *       npm run audit:verify -- --json  (salida JSON, p. ej. para un job programado)
 * Sale con código 1 si la bitácora NO está íntegra.
 *
 * Recomendado: ejecutarlo a diario y guardar fuera de la BD (SIEM, correo,
 * almacenamiento WORM) el par (ultimo_id, ultimo_hash). Ese "ancla" permite
 * detectar también un truncado del final de la cadena.
 */
require('dotenv').config()
const { Client } = require('pg')

;(async () => {
  const url = process.env.DATABASE_URL || ''
  const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url)
  const client = new Client({
    connectionString: url,
    ssl: local || url.includes('railway.internal') ? false : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
  })
  await client.connect()
  try {
    const { rows: problemas } = await client.query('SELECT id, problema FROM gx_auditoria_verificar() LIMIT 100')
    const { rows } = await client.query(
      `SELECT count(*)::int AS total, max(id) AS ultimo_id,
              (SELECT hash FROM auditoria_eventos ORDER BY id DESC LIMIT 1) AS ultimo_hash,
              (SELECT fecha FROM auditoria_eventos ORDER BY id DESC LIMIT 1) AS ultima_fecha
       FROM auditoria_eventos`
    )
    const r = { integra: problemas.length === 0, verificado_en: new Date().toISOString(), ...rows[0], problemas }
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(r))
    } else {
      console.log(`Eventos en la bitácora: ${r.total}`)
      console.log(`Último evento: #${r.ultimo_id} (${r.ultima_fecha ? new Date(r.ultima_fecha).toISOString() : '—'})`)
      console.log(`Ancla (guardar fuera de la BD): ${r.ultimo_id}:${r.ultimo_hash}`)
      if (r.integra) console.log('Resultado: ÍNTEGRA — la cadena de hashes es consistente.')
      else {
        console.log(`Resultado: ALTERADA — ${problemas.length} fila(s) con problemas:`)
        for (const p of problemas) console.log(`  #${p.id}: ${p.problema}`)
      }
    }
    process.exitCode = r.integra ? 0 : 1
  } finally {
    await client.end()
  }
})().catch((e) => {
  console.error('Error verificando la bitácora:', e.message)
  process.exitCode = 2
})
