# Governex

Sistema de gestión de calidad multi-empresa. Frontend en React + TypeScript + Vite, backend en Express + PostgreSQL y almacenamiento de archivos en Cloudflare R2. Se despliega en Railway.

## Requisitos

- Node.js 22.12 o superior
- PostgreSQL 16
- Variables de entorno: ver `.env.example`

## Desarrollo

```bash
npm install
cp .env.example .env   # completar valores
npm run dev            # backend (3001) + frontend Vite (5173)
```

## Base de datos y migraciones

El esquema se gestiona con `scripts/migrate.ts`, que registra en la tabla `schema_migrations` qué archivos de `migrations/` ya se aplicaron.

```bash
npm run migrate          # aplica las migraciones pendientes
npm run migrate:status   # muestra aplicadas y pendientes (no cambia nada)
```

**Primera vez en una base existente (producción).** Las migraciones 001 a 019 se aplicaron a mano antes de que existiera el gestor. Registre la línea base y después aplique las nuevas:

```bash
npm run migrate -- --baseline=019
npm run migrate
```

**Base nueva.** `schema.sql` equivale al estado tras la migración 005:

```bash
psql "$DATABASE_URL" -f schema.sql
npm run migrate -- --baseline=005
npm run migrate
```

## Pruebas

`tests/security.test.mjs` contiene pruebas de seguridad y de aislamiento entre empresas que se ejecutan contra un servidor real con una base de pruebas. La CI (`.github/workflows/ci.yml`) las corre en cada pull request.

Para correrlas localmente:

```bash
export DATABASE_URL=postgresql://usuario@localhost:5432/governex_test   # el nombre debe contener "test"
bash tests/setup-db.sh                 # BORRA y recrea esa base
npm run build && npm start &           # con las variables de .env.example
BASE_URL=http://localhost:3001 npm test
```

## Seguridad

Ver `docs/PLAN_CORRECCION_SEGURIDAD.md` para el plan de corrección, los hallazgos resueltos y la configuración recomendada en Railway.
