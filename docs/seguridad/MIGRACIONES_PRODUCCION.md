# Migraciones en producción (base de datos sin acceso público)

**Desde el 2026-11-14 la base de datos de producción NO es accesible desde internet.** Se eliminó el proxy TCP público de Postgres en Railway (`ballast.proxy.rlwy.net:44410`). La aplicación no se vio afectada, porque siempre se conectó por la red privada de Railway (`*.railway.internal`).

## Evidencia del cambio
| Verificación | Antes | Después |
|---|---|---|
| Proxies TCP del servicio Postgres (Railway) | 1 (`:44410 → 5432`) | **0** |
| Conexión al puerto público desde internet, con el protocolo de PostgreSQL | Abierto | **Rechazada** (`ECONNRESET`), estable durante 1 minuto |
| Destino de las conexiones de Governex a la BD (logs de flujo de red) | Red privada, puerto 5432 | Red privada (sin cambios) |
| `governex.app/api/health` y login (que consulta la BD) | OK | OK |

## Migraciones automáticas en cada despliegue (desde 2026-11-14)
`railway.toml` define `preDeployCommand = ["npm run migrate"]`. En cada despliegue Railway:

1. Construye la nueva versión.
2. Ejecuta `npm run migrate` **dentro de la red privada**, con la `DATABASE_URL` del servicio. Aplica solo las migraciones pendientes, cada una en su transacción, con advisory lock.
3. Solo si el paso 2 termina bien, pone en marcha la nueva versión. **Si una migración falla, el despliegue se detiene y la versión anterior sigue atendiendo.**

La salida queda en los logs del despliegue (Railway → Governex → Deployments → el despliegue → *Pre-deploy*). La primera línea indica la base de datos destino (servidor, puerto y nombre, sin credenciales):

```
Base de datos destino: postgres.railway.internal:5432/railway  ·  conexión tomada de: variable de entorno
Aplicando 0NN_....sql... OK
```

**Ya no hay que abrir el acceso público ni ejecutar migraciones desde un PC.** Antes de fusionar un PR que trae una migración nueva, haz un backup (Postgres → Backups).

### Línea base automática (`--baseline-si-vacia=019`)
El comando real del pre-deploy es `npm run migrate -- --baseline-si-vacia=019`. Si la BD ya tiene esquema pero `schema_migrations` está vacía, registra 001–019 como línea base y aplica 020 en adelante. Si la tabla ya tiene filas, no hace nada distinto de `npm run migrate`.

Producción estaba en ese caso: 001–019 se aplicaron a mano y 020–022 desde el panel de Railway, sin registrar la línea base. El primer intento de despliegue (PR #13) se detuvo con *Pre-deploy command failed*. La versión anterior siguió atendiendo y `governex.app/api/health` respondió 200.

Es seguro re-ejecutar 020–023 sobre una BD que ya las tenga, porque todas sus sentencias son idempotentes (`IF NOT EXISTS`, `OR REPLACE`, `DROP … IF EXISTS`). **Toda migración nueva debe mantener esa propiedad.**

Prueba local con una BD en el estado de producción (001–022 aplicadas, sin `schema_migrations`, con datos):

| Paso | Resultado |
|---|---|
| `npm run migrate` (pre-deploy del PR #13) | Error: `La tabla schema_migrations está vacía` (igual que en Railway) |
| `npm run migrate -- --baseline-si-vacia=019` | Línea base 001–019. 020, 021, 022 y 023 aplicadas OK |
| La misma orden de nuevo (siguiente despliegue) | `No hay migraciones pendientes.` |
| Logins (plataforma con correo inexistente / plataforma y empresa con credenciales correctas) | 401 / 200 / 200; datos existentes intactos |
| `gx_auditoria_verificar()` | 0 problemas |

### Si el pre-deploy falla
- `Se detuvo en 0NN_...`: la migración tiene un error. La BD queda como estaba, porque esa migración se revierte completa. Se corrige el archivo en un PR nuevo.

## Incidente que motivó el cambio (2026-11-14)
Tras desplegar la Fase 3, la migración `023_bitacora_seguridad_inmutable` no estaba aplicada en producción. El comando se había ejecutado sin `DATABASE_URL` definida en esa terminal, así que `dotenv` tomó la conexión del archivo `.env` y migró la BD **local**. Consecuencias en producción:

| Síntoma | Causa |
|---|---|
| `POST /api/platform-admin/login` → 500 | `column "rol" does not exist` (`platform_admins.rol`) |
| Login de empresa con credenciales correctas → 500 | `column "motivo_suplantacion" of relation "sesiones" does not exist` |
| Eventos de seguridad solo en stdout, no en BD | `relation "auditoria_eventos" does not exist` |

Correcciones:
1. Migraciones en el pre-deploy de Railway (arriba).
2. `scripts/migrate.ts` imprime siempre la BD destino y avisa si la conexión salió de `.env`.

Prueba local, con una BD en el mismo estado que producción (`schema.sql` + 006…022, sin la 023):

| Prueba | Sin la 023 | Tras `npm run migrate` (pre-deploy simulado) |
|---|---|---|
| Login de plataforma con correo inexistente | 500 | **401** |
| Login de plataforma con credenciales correctas | 500 | **200** |
| Login de empresa con credenciales correctas | 500 | **200** |
| Segunda ejecución de `npm run migrate` | n/a | `No hay migraciones pendientes.` |
| `gx_auditoria_verificar()` | n/a | 0 problemas |

## Procedimiento manual (solo de respaldo)
Solo para casos excepcionales, como registrar una línea base. Como la base de datos no tiene URL pública, hay que **abrir el acceso únicamente durante la operación**:

1. **Backup:** Railway → servicio **Postgres** → **Backups** → crear uno.
2. **Abrir el acceso público temporalmente:** Postgres → **Settings** → **Networking** → **TCP Proxy** → puerto `5432`. Railway genera una URL nueva en `DATABASE_PUBLIC_URL`.
3. Ejecuta, en **una misma ventana** de PowerShell, desde la carpeta del proyecto:
   ```powershell
   $env:DATABASE_URL = "pega aquí la DATABASE_PUBLIC_URL nueva"
   npm run migrate:status
   ```
   Comprueba que la primera línea diga `conexión tomada de: variable de entorno` y un servidor `*.proxy.rlwy.net`. Si dice `archivo .env` o `127.0.0.1`, **detente**: estás contra la BD local.
   ```powershell
   npm run migrate
   npm run audit:verify
   Remove-Item Env:DATABASE_URL
   ```
4. **Cerrar el acceso público:** Postgres → **Settings** → **Networking** → elimina el TCP Proxy. **No dejes este paso para después.**
5. Guarda el ancla que imprime `audit:verify` en el gestor de secretos.

## Variables obsoletas del servicio Governex
`JWT_SECRET`, `PLATFORM_ADMIN_JWT_SECRET`, `R2_PUBLIC_URL` y `NIXPACKS_NODE_VERSION` no se usaban en el código. **Se eliminaron de Railway el 2026-11-14.** El servicio quedó con `DATABASE_URL`, `GEMINI_API_KEY`, `MFA_ENCRYPTION_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_KEY` y `R2_SECRET`.
