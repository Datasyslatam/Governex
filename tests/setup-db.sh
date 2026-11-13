#!/usr/bin/env bash
# Crea desde cero la BD de pruebas: schema.sql + migraciones (vía el gestor)
# + datos de prueba. Uso:
#   DATABASE_URL=postgresql://usuario@host:puerto/governex_test bash tests/setup-db.sh
# ATENCIÓN: borra y recrea la base indicada en DATABASE_URL. Nunca apuntar a producción.
set -euo pipefail

: "${DATABASE_URL:?Defina DATABASE_URL apuntando a una BD de PRUEBAS}"

DB_NAME="${DATABASE_URL##*/}"
DB_NAME="${DB_NAME%%\?*}"
ADMIN_URL="${DATABASE_URL%/*}/postgres"

case "$DB_NAME" in
  *test*|*prueba*|*ci*) ;;
  *) echo "Por seguridad, el nombre de la BD debe contener 'test', 'prueba' o 'ci' (recibido: $DB_NAME)"; exit 1 ;;
esac

cd "$(dirname "$0")/.."

psql "$ADMIN_URL" -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$DB_NAME\"" -c "CREATE DATABASE \"$DB_NAME\""
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f schema.sql > /dev/null
npx tsx scripts/migrate.ts --baseline=005
npx tsx scripts/migrate.ts
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f tests/fixtures.sql
echo "BD de pruebas lista: $DB_NAME"
