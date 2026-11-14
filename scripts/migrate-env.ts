/**
 * Se importa ANTES que src/db en scripts/migrate.ts.
 *
 * Fase 5: la aplicación se conecta con el rol de mínimo privilegio
 * (governex_app, en DATABASE_URL), que no puede crear ni alterar tablas.
 * Las migraciones necesitan el rol dueño: si MIGRATION_DATABASE_URL está
 * definida, se usa esa conexión para migrar.
 */
import 'dotenv/config'

if (process.env.MIGRATION_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL
  process.env.GX_ORIGEN_URL_MIGRACION = 'variable MIGRATION_DATABASE_URL'
}
