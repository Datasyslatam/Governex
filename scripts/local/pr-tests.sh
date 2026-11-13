#!/usr/bin/env bash
# Ejecuta tests/security.test.mjs en LOCAL igual que el CI, usando el
# PostgreSQL del contenedor docker-compose (no requiere psql instalado).
#   1. Recrea la BD governex_ci_test (schema.sql + línea base 005 + migraciones + fixtures)
#   2. Arranca una API en el puerto 3002 contra esa BD (valores de R2 de relleno, como en CI)
#   3. Corre `node --test tests/security.test.mjs` y detiene la API
# Uso: bash scripts/local/pr-tests.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
export MSYS_NO_PATHCONV=1

CONT=governex-db-local
TEST_DB=governex_ci_test
export DATABASE_URL="postgresql://governex:${LOCAL_DB_PASSWORD}@127.0.0.1:5433/${TEST_DB}"
export BASE_URL=http://127.0.0.1:3002
export R2_ENDPOINT=https://ci-placeholder.r2.cloudflarestorage.com R2_KEY=ci-placeholder R2_SECRET=ci-placeholder R2_BUCKET=ci-placeholder

docker exec "$CONT" psql -U governex -d governex -q -c "DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)" -c "CREATE DATABASE ${TEST_DB}"
docker exec -i "$CONT" psql -U governex -d "$TEST_DB" -q -v ON_ERROR_STOP=1 < schema.sql > /dev/null 2>&1
npx tsx scripts/migrate.ts --baseline=005 > /dev/null
npx tsx scripts/migrate.ts | tail -1
docker exec -i "$CONT" psql -U governex -d "$TEST_DB" -q -v ON_ERROR_STOP=1 < tests/fixtures.sql

# node directo (no npx) para que el PID sea el del servidor y el trap lo detenga
PORT=3002 node --import tsx src/index.ts > /tmp/governex-pr-tests.log 2>&1 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf "$BASE_URL/health" > /dev/null && break; sleep 1; done

node --test tests/security.test.mjs
