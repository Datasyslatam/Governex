# Governex: Fases 0 y 1 de seguridad. Registro de cambios y evidencia

**Fecha:** 2026-11-13 · **Rama:** `security/fase-0-1` (base `origin/main` 7b6f7b0)
**Alcance aprobado:** Fase 0 (entorno local) y Fase 1 (correcciones críticas y altas de bajo riesgo) del plan de auditoría.
**Entorno de prueba:** local exclusivamente (PostgreSQL 16 en Docker, API en `127.0.0.1:3001`). No se tocó Railway ni producción.

> Estas correcciones reducen riesgos concretos y verificados. No constituyen una certificación ni garantizan la ausencia de vulnerabilidades.

---

## 1. Resultado de las pruebas

| Ejecución | Resultado | Evidencia |
|---|---|---|
| Antes de los cambios (código de `origin/main`) | **16 / 26** | [`evidencias/pruebas-antes.json`](evidencias/pruebas-antes.json) |
| Después de los cambios | **34 / 34** (26 de seguridad + 8 de regresión) | [`evidencias/pruebas-despues.json`](evidencias/pruebas-despues.json) |

Pruebas adicionales:
- `npm run build` (servidor + frontend): **OK**.
- `tsc --noEmit` del frontend: 47 errores **antes y después** (deuda previa, ninguno nuevo).
- Build compilado en `NODE_ENV=production`: `/api/no-existe` → 404 JSON. Rutas del SPA → `index.html`. HSTS presente. JSON inválido → 400 genérico.
- Arranque con `JWT_SECRET` de 5 caracteres: el servidor **se niega a arrancar** (exit 1).
- `npm audit`: de **12** vulnerabilidades (3 críticas, 6 altas, 3 moderadas) a **2 moderadas**.

Reproducir: ver [ENTORNO_LOCAL.md](ENTORNO_LOCAL.md) → `npm run test:security`.

---

## 2. Estado de los hallazgos

| ID | Hallazgo | Crit. | Estado | Prueba que lo demuestra |
|---|---|---|---|---|
| V01 | Dependencias vulnerables (proxy-addr, multer, body-parser, qs, xmldom, vite, etc.) | Crítico | **Corregido parcialmente**: quedan 2 moderadas en `react-router` (ver §4) | `npm audit` antes/después |
| V03 | 57 GET sin permiso `leer` (BFLA) | Alto | **Corregido** | T12, T13 (antes FAIL); R01–R03 (regresión) |
| V04 | `DELETE /api/proveedores/:id` sin permiso | Alto | **Corregido** | T14 (antes FAIL) |
| V05 | IDOR por llave foránea de otra empresa | Alto | **Corregido** en 26 handlers | T18, T19 (antes FAIL); R04, R05 |
| V08 | Sin política de contraseñas | Alto | **Corregido parcialmente**: política aplicada. Argon2id, cambio y recuperación de contraseña quedan para la Fase 2 | T10 (antes FAIL), T11, R07, R08 |
| V11 | Credenciales sembradas en `schema.sql` y migración 005 | Alto | **Corregido en el repositorio**. ⚠️ Siguen en el historial de git: **rotar** (ver §5) | T25 (antes FAIL) |
| V12 | IA sin permiso ni cuota | Medio | **Corregido** | T15 (antes FAIL), R06 |
| V13 | Enumeración de usuarios y de estado de empresa en el login | Medio | **Corregido** (empresa y plataforma) | T05 (antes FAIL), T04 |
| V15 | JSON de 15 MB global, sin límite general | Medio | **Corregido** | T23 (antes FAIL), R06 |
| V17 | `error.message` expuesto en respuestas | Medio | **Corregido** | T24 + revisión de código |
| V18 | JWT sin algoritmo fijo ni validación de secretos | Medio | **Corregido** | T06, T07, arranque con secreto débil |
| V21 | `schema.sql` + `migrations/` no reconstruían la BD | Medio | **Corregido parcialmente**: migración 020 consolidada. El gestor de migraciones queda para la Fase 5 | Instalación desde cero OK; antes `POST /procesos` → 500 |

Los hallazgos V02, V06, V07, V09, V10, V14, V16, V19, V20, V22, V23, V24 y V25 siguen **abiertos** y corresponden a las Fases 2 a 7.

---

## 3. Archivos modificados

### Nuevos
| Archivo | Propósito |
|---|---|
| `src/middleware/tenantRefs.ts` | `requireTenantRefs({...})`: valida que los IDs foráneos del cuerpo pertenezcan a la empresa. Usa una lista blanca de tablas y falla cerrado |
| `src/middleware/passwordPolicy.ts` | `validarPassword()`: 12 a 128 caracteres, 3 de 4 tipos, sin correo ni nombre, sin contraseñas comunes |
| `src/middleware/securityConfig.ts` | HS256 fijo al firmar y verificar. `assertSecurityConfig()` impide arrancar con secretos débiles o iguales |
| `migrations/020_consolidar_ddl_huerfano.sql` | DDL que solo creaban scripts sueltos. Idempotente, segura en producción |
| `scripts/admin/create-platform-admin.cjs` | Alta segura del primer platform_admin (contraseña por variable de entorno, bcrypt 12) |
| `scripts/local/init-env.cjs`, `scripts/local/setup-db.cjs`, `docker-compose.yml` | Entorno local. Se niegan a operar fuera de localhost |
| `scripts/security/api-security-tests.cjs` | 34 pruebas automatizadas de seguridad y regresión |

### Modificados
| Archivo | Cambio |
|---|---|
| `src/index.ts` | Valida secretos al arrancar. Límite general `/api` por IP. JSON de 1 MB global y 15 MB solo en `/api/gemini`. 404 JSON para `/api/*` desconocido. Manejador final de errores genérico |
| `src/middleware/rateLimit.ts` | Nuevo `requestRateLimit()` (ventana fija, cabeceras `RateLimit-*`, `Retry-After`) |
| `src/middleware/auth.ts`, `src/middleware/platformAdminAuth.ts` | `jwt.verify` con `algorithms: ['HS256']` |
| `src/routes/auth.ts` | Login: verifica primero la contraseña (hash ficticio si el correo no existe) y solo después informa el estado de la empresa. Exige que email y contraseña sean texto. Política de contraseñas en alta y edición. Firma HS256 |
| `src/routes/platformAdmin.ts` | Mismo endurecimiento de login. Política de contraseñas en alta de empresa, alta de platform_admin y restablecimiento. Firma HS256 |
| `src/routes/gemini.ts` | Permiso por endpoint (17). Cuota de 40 solicitudes cada 10 min por usuario. Errores genéricos |
| `src/routes/proveedores.ts` | `DELETE /:id` exige `proveedores:eliminar` |
| 23 archivos de `src/routes/*.ts` | `requirePermission('<módulo>', 'leer')` en 57 GET. `requireTenantRefs` en 26 handlers POST/PUT |
| `schema.sql` | Sin siembra de platform_admin ni de `admin@governex.com`. `DROP CONSTRAINT IF EXISTS uq_usuarios_email` antes de crearla (la instalación desde cero fallaba) |
| `migrations/005_platform_admins.sql` | Sin INSERT con correo personal y hash fijo |
| `package.json` / `package-lock.json` | `express` ^4.22.3. Árbol de dependencias actualizado con `npm audit fix` (sin cambios mayores). Scripts `local:*` y `test:security` |
| `.env.example` | Requisito de longitud de secretos. `JSON_BODY_LIMIT=1mb`, `JSON_BODY_LIMIT_IA`, `API_RATE_LIMIT_MAX`, `IA_RATE_LIMIT_MAX` |

### Mapa de permisos de la IA (`/api/gemini/*`)
Cada endpoint exige el permiso de **crear** (o **editar**, en los de regeneración) del módulo cuyo contenido genera. Ejemplos: `generar-ideario` → `contexto_empresa:crear`; `analizar-nc-causa-raiz` → `acciones_correctivas:crear`; `regenerar-caracterizacion` → `procesos:editar`. La lista completa está en el código de `src/routes/gemini.ts`.

---

## 4. Riesgos aceptados o pendientes en esta fase
- **`react-router-dom` 6.30 (2 moderadas, GHSA-wrjc-x8rr-h8h6 y GHSA-337j-9hxr-rhxg):** la corrección exige migrar a v7 (cambio mayor). La primera solo se explota navegando a rutas controladas por un atacante (no encontré `navigate()` con datos de URL o del usuario). La segunda solo afecta a SSR, que Governex no usa. Se planifica la migración.
- **Impacto funcional del permiso `leer`:** los tres roles estándar tienen `leer` en todos los módulos (verificado en BD: 0 roles sin `leer`). Solo cambia para usuarios con **permisos personalizados**: si a alguno se le quitó `leer` de un módulo, ya no podrá consultarlo por API. Ese es el comportamiento correcto. Si una pantalla usa listas de otro módulo (p. ej. procesos en un desplegable), ese usuario necesitará `procesos:leer`.
- **Límites en memoria:** los contadores de intentos y cuotas son por instancia y se reinician al redesplegar (Redis en la Fase 2 si Railway escala a varias réplicas).

---

## 5. Acciones obligatorias antes de desplegar en Railway
1. **Verificar que `JWT_SECRET` y `PLATFORM_ADMIN_JWT_SECRET` tengan 32 o más caracteres y sean distintas.** Si no, el servicio **no arrancará**. Si hay que cambiarlas, todos los usuarios deberán volver a iniciar sesión.
2. **Ejecutar `migrations/020_consolidar_ddl_huerfano.sql`** (idempotente) en la BD de producción.
3. **Rotar credenciales sembradas:** si en producción existen el platform_admin sembrado por `schema.sql` / `005` o `admin@governex.com`, cambiar sus contraseñas o desactivarlos. Sus hashes siguen en el historial público o privado del repositorio. No reescribí el historial de git porque es una operación destructiva que requiere decisión explícita.
4. Revisar `CORS_ORIGINS` (sigue abierto si está vacío; se cierra en la Fase 4).
