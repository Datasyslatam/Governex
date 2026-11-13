#!/usr/bin/env node
/**
 * Alta segura de un platform_admin (reemplaza la siembra con hash fijo que
 * había en schema.sql y migrations/005).
 *
 * La contraseña NO se pasa como argumento (quedaría en el historial de la
 * terminal): se lee de la variable de entorno PLATFORM_ADMIN_PASSWORD, y
 * debe cumplir la política (12+ caracteres, 3 de 4 tipos).
 *
 * Uso (PowerShell):
 *   $env:PLATFORM_ADMIN_PASSWORD = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText
 *   node scripts/admin/create-platform-admin.cjs --email admin@empresa.com --nombre "Nombre Apellido"
 *   Remove-Item Env:PLATFORM_ADMIN_PASSWORD
 *
 * Usa DATABASE_URL del entorno (.env). Si el correo ya existe, no hace nada.
 */
require('dotenv').config()
const { Client } = require('pg')
const bcrypt = require('bcryptjs')

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}
const email = (arg('email') || '').trim().toLowerCase()
const nombre = (arg('nombre') || '').trim()
const password = process.env.PLATFORM_ADMIN_PASSWORD || ''

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !nombre) {
  console.error('Uso: node scripts/admin/create-platform-admin.cjs --email <correo> --nombre "<nombre>"')
  process.exit(1)
}
const tipos = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length
if (password.length < 12 || tipos < 3) {
  console.error('PLATFORM_ADMIN_PASSWORD no definida o débil: mínimo 12 caracteres y 3 de 4 tipos (minúsculas, mayúsculas, números, símbolos).')
  process.exit(1)
}

;(async () => {
  const url = process.env.DATABASE_URL || ''
  const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url)
  const client = new Client({ connectionString: url, ssl: local || url.includes('railway.internal') ? false : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' } })
  await client.connect()
  try {
    const hash = await bcrypt.hash(password, 12)
    const { rowCount } = await client.query(
      `INSERT INTO platform_admins (nombre, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
      [nombre, email, hash]
    )
    console.log(rowCount ? `platform_admin creado: ${email}` : `Ya existía un platform_admin con ${email}; no se modificó.`)
  } finally {
    await client.end()
  }
})().catch((e) => {
  console.error('Error:', e.message)
  process.exit(1)
})
