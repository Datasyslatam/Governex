# Integración del PR #5 con las Fases 0–2

**Fecha:** 2026-11-13 · **Rama:** `security/integracion-pr5` (= `security/fase-2` + `main` + PR #5)

## 1. Por qué no se fusionó el PR #5 tal como estaba

El PR #5 (`feat(seguridad): Fase 2, aislamiento padre/hijo…`) se desarrolló en paralelo a las Fases 0–2 de este plan y partía de un `main` anterior. Fusionarlo directamente causaba tres problemas:

| Problema | Consecuencia |
|---|---|
| Sus migraciones `020` y `021` tenían **los mismos números** que las nuestras, con otro contenido | El gestor de migraciones usa el número como clave: dos `020_*` no pueden convivir. Además, producción **ya ejecutó** nuestra `020` |
| Sus pruebas y su CI iniciaban sesión con tokens `Bearer` | La Fase 2 eliminó los tokens (sesión en cookie HttpOnly + MFA): las 47 pruebas habrían fallado |
| El CI definía `JWT_SECRET` y no `MFA_ENCRYPTION_KEY` | El servidor de la Fase 2 no arranca sin `MFA_ENCRYPTION_KEY` |

## 2. Qué se conservó del PR #5 y cómo

| Aporte del PR #5 | Decisión |
|---|---|
| `scripts/migrate.ts`: gestor con tabla `schema_migrations`, checksum, advisory lock y línea base | **Se conserva tal cual.** También lo usan ahora el entorno local (`setup-db.cjs`) y los dos jobs del CI |
| Migración `020_tablas_fuera_de_migraciones` | **Se descarta**: es un subconjunto de nuestra `020_consolidar_ddl_huerfano`, que ya se aplicó en producción |
| Migración `021_integridad_tenant_padre` (trigger que impide referencias padre→hijo entre empresas) | **Se conserva, renumerada a `022`.** Es defensa en profundidad en la BD, complementaria a `requireTenantRefs` en la aplicación |
| Quitar el `ALTER TABLE` automático de `src/db.ts` | Se conserva. La columna ya la crea nuestra `020` |
| Corrección de `schema.sql` (restricción duplicada) | Ya estaba corregida en la Fase 0. Se mantuvo nuestra versión, que además **no** reintroduce las credenciales sembradas |
| CSP en modo **solo reporte** + receptor `/api/csp-report` | **Se conserva** (adelanta la Fase 4; `CSP_ENFORCE=true` la vuelve bloqueante) |
| `tests/security.test.mjs` (47 pruebas), `tests/fixtures.sql`, `tests/setup-db.sh` | **Se conservan, adaptados** a cookie + CSRF + MFA. Solo cambió el arnés de conexión, no las aserciones |
| `.github/workflows/ci.yml` | **Se amplía**: `MFA_ENCRYPTION_KEY` de prueba, `npm audit --audit-level=high` y un segundo job con `scripts/security/api-security-tests.cjs` |

## 3. Evidencia

| Prueba | Resultado |
|---|---|
| BD desde cero con el gestor (`schema.sql` + línea base 005 + `migrate`) | 17 migraciones aplicadas (006…022) sin errores |
| `tests/security.test.mjs` del PR #5, adaptado (como el job 1 del CI, con `scripts/local/pr-tests.sh`) | **47 / 47** |
| `scripts/security/api-security-tests.cjs` contra el **build de producción** (como el job 2 del CI) | **51 / 51** ([`evidencias/pruebas-integracion.json`](evidencias/pruebas-integracion.json)) |
| Cabecera `Content-Security-Policy-Report-Only` presente | OK |
| `npm audit --audit-level=high` | Sin vulnerabilidades altas ni críticas |
| `tsc` del servidor / del frontend | Sin errores / 47 previos, ninguno nuevo |
| `npm run build` | OK |

## 4. Migrar producción con el nuevo gestor (una sola vez)

En producción las migraciones 001–020 se aplicaron a mano, así que la tabla `schema_migrations` no existe. Hay que registrar una **línea base** antes del primer `npm run migrate`.

**Paso 1.** En el panel de datos de Railway (servicio PostgreSQL), averigua si ya ejecutaste la 021 (sesiones y MFA):

```sql
SELECT to_regclass('public.sesiones') IS NOT NULL AS ya_tiene_021;
```

**Paso 2.** Desde tu equipo, con la URL **pública** de la BD de producción (variable `DATABASE_PUBLIC_URL` del servicio PostgreSQL en Railway), en PowerShell:

```powershell
$env:DATABASE_URL = "<DATABASE_PUBLIC_URL de Railway>"
npm run migrate:status
# Si ya_tiene_021 = false:
npm run migrate -- --baseline=020
# Si ya_tiene_021 = true:
npm run migrate -- --baseline=021
npm run migrate          # aplica lo pendiente: 021 (si faltaba) y 022
Remove-Item Env:DATABASE_URL
```

**Paso 3.** Revisa la salida de la 022. Si aparece `ATENCIÓN: … referencian un … de otra empresa`, hay registros antiguos con referencias cruzadas entre empresas. La migración **no los modifica**, solo los reporta. Conviene revisarlos.

> Haz un backup de la BD en Railway antes del paso 2. El gestor detiene todo ante el primer error y cada migración corre en su propia transacción.

## 5. Cómo resolver el PR #5 en GitHub
1. Abre un PR nuevo desde `security/integracion-pr5` hacia `main`: incluye las Fases 0–2, el PR #5 adaptado y este documento.
2. Espera a que el CI pase sus dos jobs.
3. **Cierra el PR #5 sin fusionarlo**, con un comentario que apunte al nuevo PR. Su contenido ya está incluido y adaptado.
4. El PR de `security/fase-2`, si lo llegaste a abrir, también queda reemplazado por el nuevo.
