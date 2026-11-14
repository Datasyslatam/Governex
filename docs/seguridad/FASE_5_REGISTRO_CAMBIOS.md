# Fase 5: capa de datos (RLS, mínimo privilegio, TLS, retención)

**Fecha:** 2026-11-14 · **Rama:** `security/fase-5` · **Hallazgos:** V16 (BD) y V22 (datos personales)

> Estas medidas reducen el riesgo; no constituyen una certificación ni una garantía absoluta de seguridad.

## 1. Diagnóstico de partida

| Aspecto | Estado antes de la fase |
|---|---|
| Rol de conexión de la app | Superusuario de PostgreSQL (`postgres` en Railway): puede leer, alterar o borrar cualquier tabla, y salta cualquier RLS |
| Aislamiento entre empresas | Solo en la aplicación: cada consulta filtra por `tenant_id` (unos 370 puntos de acceso a la BD). Un solo olvido expone datos de otra empresa |
| Tablas con `tenant_id` | 60 de 69 |
| TLS hacia la BD | Red privada sin TLS. Hacia servidores externos, TLS **sin** validar el certificado (`rejectUnauthorized: false`) |
| Acceso público a la BD | Eliminado el 2026-11-14 (ver [MIGRACIONES_PRODUCCION.md](MIGRACIONES_PRODUCCION.md)) |
| Migraciones en producción | Automáticas en el pre-deploy de Railway (2026-11-14) |
| Retención | Sin purga: las sesiones (con IP y navegador) se acumulaban indefinidamente |
| Datos personales | Nombres y correos (`usuarios`, `personal`, `proveedores`, bitácoras). No hay documentos de identidad, salarios, cuentas bancarias ni datos de salud en columnas estructuradas |

## 2. Cambios

### 2.1 Rol de mínimo privilegio `governex_app` (migración 024)
- Sin superusuario, sin `BYPASSRLS`, sin crear bases ni roles, máximo 30 conexiones.
- Solo `SELECT/INSERT/UPDATE/DELETE` sobre las tablas y uso de secuencias. No puede crear, alterar ni borrar tablas. No puede desactivar RLS.
- Sin acceso a `schema_migrations`.
- En las bitácoras (`auditoria_eventos`, `logs_actividad`, `platform_admin_audit_log`) solo inserta y lee. Se le retiran `UPDATE`, `DELETE` y `TRUNCATE`, además de los triggers de solo inserción de la Fase 3.
- Las tablas que creen migraciones futuras reciben los mismos permisos (`ALTER DEFAULT PRIVILEGES`).
- **La contraseña no está en el repositorio.** La migración crea el rol `NOLOGIN`. `npm run migrate` le da acceso con la variable `GX_APP_DB_PASSWORD`, y la envía ya derivada (verificador SCRAM-SHA-256), así que la contraseña en claro no viaja en la sentencia ni puede quedar en los logs de PostgreSQL.
- Las migraciones siguen corriendo con el rol dueño, a través de la nueva variable `MIGRATION_DATABASE_URL` (`scripts/migrate-env.ts`).

### 2.2 Row-Level Security por empresa (migración 024 + `src/db.ts`)
- **En la BD:** las 58 tablas con `tenant_id` tienen RLS **forzado** con la política `gx_aislamiento_empresa`. Una fila solo se ve o se escribe si su `tenant_id` coincide con el contexto de la sesión de BD (`app.tenant_id`), o si la petición corre "como sistema" (`app.sistema = on`). Sin contexto no se ve ninguna fila.
- **Excluidas a propósito:**
  - `sesiones`: se busca por el hash del token antes de saber la empresa.
  - `auditoria_eventos`: es de solo inserción, se escribe desde cualquier contexto y la app filtra por empresa al leerla.
- **En la app:** `src/db.ts` guarda el contexto de cada petición en `AsyncLocalStorage` y lo fija en la conexión al entregarla del pool. **El código de las rutas no cambió.**

  | Quién fija el contexto | Contexto |
  |---|---|
  | Toda petición al empezar (`requestContext`) | Sin contexto |
  | `authMiddleware`, tras validar la sesión | Empresa del usuario |
  | `/api/auth` (login, MFA) y `/api/platform-admin` | Sistema |
  | Búsqueda interna de sesión/usuario en `authMiddleware`, bitácoras, retención | Sistema (explícito) |
  | Subida de archivos (multer pierde el contexto en sus eventos) | Empresa, restablecido explícitamente |

- **Integridad padre→hijo (migración 022):** su trigger pasa a `SECURITY DEFINER`. Con RLS activo no habría visto el registro padre de otra empresa y habría dejado pasar justamente la referencia cruzada que debe impedir. La prueba R08 lo verifica.
- **Observabilidad:**
  - Al arrancar, la app registra `{"tipo":"bd","rol":…,"rls_efectivo":…,"tablas_tenant_sin_rls":…}`.
  - Avisa si se conecta con un rol que anula RLS o si una tabla con `tenant_id` quedó sin política (`gx_tablas_tenant_sin_rls()`).
  - Si una consulta corre sin contexto (contexto perdido), deja un aviso con la pila, como máximo uno por minuto.

### 2.3 TLS hacia la base de datos (`src/db.ts`)
- **Red privada de Railway (`*.railway.internal`):** sin TLS de PostgreSQL. Según la documentación de Railway, el tráfico privado entre servicios va cifrado con túneles WireGuard.
- **Cualquier otro servidor no local:** TLS obligatorio y **el certificado se valida** (antes no se validaba).
  - `DB_SSL_CA` permite indicar una CA propia.
  - `DB_SSL_REJECT_UNAUTHORIZED=false` existe solo para el procedimiento manual de emergencia con el proxy público de Railway, y deja un aviso en el log.

### 2.4 Retención (`src/security/retention.ts`)
- Cada 6 horas se borran las sesiones vencidas o revocadas hace más de `RETENCION_SESIONES_DIAS` (30 por defecto). Contienen IP y navegador, y lo relevante de cada inicio y cierre de sesión ya queda en la bitácora de seguridad.
- **Las bitácoras no se purgan.** Su plazo de retención lo debe fijar el cliente según sus obligaciones regulatorias y contractuales. Al ser de solo inserción y estar encadenadas, una purga futura debe diseñarse con un ancla de verificación (pendiente de esa decisión).

### 2.5 Cifrado de campos: evaluado, no aplicado
- **Por qué no se aplicó:** el inventario no encontró datos de alta sensibilidad en columnas estructuradas, solo nombres y correos. El correo es la clave de inicio de sesión y de búsqueda. Cifrarlo exigiría un índice ciego y modificar decenas de consultas, con un riesgo de regresión desproporcionado frente al beneficio, ya que la BD no es accesible desde internet, la app usa un rol sin privilegios de administración y RLS aísla las empresas.
- **Cifrado en reposo:** queda a cargo del proveedor. La documentación de seguridad de Railway declara cifrado en reposo de los volúmenes; Cloudflare R2 cifra los objetos. **Confirmarlo en los contratos con los proveedores.**
- **Disparador para revisarlo:** si se agregan documentos de identidad, datos de salud, salarios o datos financieros, se cifrarán a nivel de campo (AES-256-GCM, como los secretos MFA). Si el cliente exige custodia de claves en un KMS, eso implica un servicio adicional con costo, que debe aprobarse antes.
- **Texto libre:** las descripciones pueden contener datos personales que escriban los usuarios. Se mitiga con RLS y control de acceso, no con cifrado.

## 3. Pruebas

| Suite | Resultado | Evidencia |
|---|---|---|
| `tests/security.test.mjs` (aislamiento entre empresas), con la API conectada como `governex_app` | **47 / 47** | CI job 1 |
| `scripts/security/api-security-tests.cjs` (autenticación, sesiones, MFA, CSRF, BFLA, IDOR), build de producción como `governex_app` | **68 / 68** | [`evidencias/fase5-api-con-rls.json`](evidencias/fase5-api-con-rls.json) |
| `scripts/security/rls-tests.cjs` (nueva) | **15 / 15** | [`evidencias/fase5-rls.json`](evidencias/fase5-rls.json) |
| Diferencial: 59 rutas GET × 2 usuarios, superusuario vs `governex_app` | 116 idénticas. Las 2 distintas son `/api/auth/sesiones`, que lista las sesiones propias (distintas en cada servidor). 0 errores de RLS y 0 avisos de contexto perdido | Local |
| Simulación de producción (BD en el estado actual, `npm run migrate` como pre-deploy) | 024 aplicada; segunda ejecución sin cambios | Local |

Pruebas de `rls-tests.cjs`:

| ID | Verifica |
|---|---|
| R01 | La app usa un rol sin superusuario, sin BYPASSRLS y sin ser dueño de tablas |
| R02 | Todas las tablas con `tenant_id` tienen RLS forzado (58), salvo las 2 excluidas |
| R03 | Sin contexto no se ven filas |
| R04 | Con contexto de la empresa A solo se ven filas de A, **aunque la consulta no filtre por empresa** |
| R05 | La empresa A no puede modificar ni borrar filas de B (0 filas afectadas) |
| R06–R07 | La empresa A no puede insertar a nombre de B ni mover filas a B (`42501`) |
| R08 | La integridad padre→hijo sigue bloqueando referencias a otra empresa con RLS activo |
| R09 | El contexto "sistema" ve todas las empresas |
| R10 | El rol de la app no puede crear, borrar ni alterar tablas, ni desactivar RLS |
| R11 | El rol de la app no lee `schema_migrations` ni modifica bitácoras |
| R12 | El pool real de la app aplica el contexto empresa / sin contexto / sistema |
| R13 | El contexto no se filtra entre 400 consultas concurrentes que comparten el pool |
| R14 | La retención borra sesiones viejas y conserva las vigentes |
| R15 | TLS: valida el certificado hacia servidores externos y la exención solo es explícita |

El CI ahora arranca el servidor con `governex_app`, **falla si `rls_efectivo` no es `true`** y ejecuta `rls-tests.cjs`.

## 4. Activación en producción (en tres pasos, con vuelta atrás)

La migración 024 por sí sola **no cambia el comportamiento**: mientras la app se conecte como `postgres` (superusuario), PostgreSQL no aplica las políticas. RLS se activa en el paso 3.

**Paso 1: antes de fusionar el PR.** En Railway → servicio **Governex** → **Variables**, agrega:

| Variable | Valor |
|---|---|
| `GX_APP_DB_PASSWORD` | Contraseña aleatoria de **al menos 32 caracteres, solo letras y números** (generada en el gestor de secretos y guardada allí) |
| `MIGRATION_DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referencia a la variable del servicio Postgres) |

No cambies `DATABASE_URL` todavía. Railway redesplegará la versión actual, que ignora estas variables.

**Paso 2: fusionar el PR.** El pre-deploy aplica la 024 con `MIGRATION_DATABASE_URL` y habilita el rol. El log del pre-deploy debe mostrar:
```
Aplicando 024_rol_minimo_privilegio_rls.sql... OK
Rol governex_app: acceso habilitado con la contraseña de GX_APP_DB_PASSWORD.
```
La app sigue como `postgres`. Su log mostrará `"rls_efectivo":false` y un aviso: es lo esperado en este paso.

**Paso 3: cambiar la conexión de la app.** En las variables de **Governex**, cambia `DATABASE_URL` a:
```
postgresql://governex_app:${{GX_APP_DB_PASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
```
Despliega. El log de arranque debe mostrar `"rol":"governex_app","rls_efectivo":true,"tablas_tenant_sin_rls":0`.

**Verificación:** prueba de humo de producción e ingreso real de un usuario de empresa y de un administrador de plataforma.

**Vuelta atrás (inmediata):** devolver `DATABASE_URL` a `${{Postgres.DATABASE_URL}}` y desplegar. El rol y las políticas pueden quedar: con el superusuario no tienen efecto.

## 5. Pendiente y riesgos residuales
- **Plazo de retención de las bitácoras.** Debe definirlo el cliente según la normativa y el contrato.
- **Tablas hijas sin `tenant_id`** (p. ej. `rol_permisos`, `usuario_permisos`, `mfa_codigos_recuperacion`): no tienen RLS. Su aislamiento depende de la aplicación y de las claves foráneas.
- **Contexto "sistema"** en login y panel de plataforma: esas rutas no quedan restringidas por RLS, sino por su propia autenticación (MFA, roles de plataforma, lista de IP).
- **Credencial `postgres`:** sigue existiendo y la usan las migraciones. Conviene rotarla periódicamente desde Railway.
- **Local:** `npm run dev` sigue usando el superusuario del `.env`, y la app lo advierte al arrancar. Las pruebas locales y el CI usan `governex_app`.
