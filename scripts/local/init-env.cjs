#!/usr/bin/env node
/**
 * Genera un archivo .env para el entorno LOCAL de pruebas.
 *
 * - Nunca sobrescribe un .env existente (para no pisar configuración real).
 * - Todos los secretos se generan aleatoriamente en esta máquina; ninguno
 *   queda en el repositorio (.env está en .gitignore).
 * - Las contraseñas de los usuarios de prueba (LOCAL_SEED_PASSWORD) solo
 *   sirven contra la BD local del contenedor Docker.
 *
 * Uso: node scripts/local/init-env.cjs
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const envPath = path.join(__dirname, '..', '..', '.env')
if (fs.existsSync(envPath)) {
  console.log('[init-env] Ya existe .env: no se modifica. Bórralo manualmente si quieres regenerarlo.')
  process.exit(0)
}

const rnd = (bytes) => crypto.randomBytes(bytes).toString('base64url')
// Contraseña de prueba que cumple la política (mayúscula, minúscula, número, símbolo, >= 12).
const seedPassword = `Gx-${rnd(9)}-9a!`
const dbPassword = rnd(18)

const content = `# ============================================================
#  .env LOCAL generado por scripts/local/init-env.cjs
#  SOLO PARA PRUEBAS LOCALES. No usar estos valores en producción.
# ============================================================
# NODE_ENV no se define aquí: Vite lo lee del .env y "npm run build" generaría
# un bundle de desarrollo. Sin definir, el servidor se comporta como desarrollo.
PORT=3001

# PostgreSQL del contenedor docker-compose (127.0.0.1:5433)
LOCAL_DB_PASSWORD=${dbPassword}
DATABASE_URL=postgresql://governex:${dbPassword}@127.0.0.1:5433/governex

# Fase 5: contraseña del rol de mínimo privilegio governex_app (RLS). La fija
# "npm run migrate". Para correr la app con RLS en local:
#   DATABASE_URL=postgresql://governex_app:<esta clave>@127.0.0.1:5433/governex
GX_APP_DB_PASSWORD=${rnd(24)}

# Cifra los secretos MFA (TOTP) en la BD. 32 bytes en hex.
MFA_ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}

# Contraseña de TODOS los usuarios de prueba sembrados por setup-db.cjs
LOCAL_SEED_PASSWORD=${seedPassword}

# IA y archivos: vacíos en local (las funciones que dependen de ellos fallan con un error controlado)
GEMINI_API_KEY=
R2_ENDPOINT=
R2_KEY=
R2_SECRET=
R2_BUCKET=

CORS_ORIGINS=http://localhost:5173
TRUST_PROXY=0
VITE_API_URL=
`
fs.writeFileSync(envPath, content, { encoding: 'utf8', mode: 0o600 })
console.log('[init-env] .env local creado con secretos aleatorios.')
