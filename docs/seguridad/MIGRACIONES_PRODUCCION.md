# Migraciones en producción (base de datos sin acceso público)

**Desde el 2026-11-14 la base de datos de producción NO es accesible desde internet.** Se eliminó el proxy TCP público de Postgres en Railway (`ballast.proxy.rlwy.net:44410`). La aplicación no se vio afectada, porque siempre se conectó por la red privada de Railway (`*.railway.internal`).

## Evidencia del cambio
| Verificación | Antes | Después |
|---|---|---|
| Proxies TCP del servicio Postgres (Railway) | 1 (`:44410 → 5432`) | **0** |
| Conexión al puerto público desde internet, con el protocolo de PostgreSQL | Abierto | **Rechazada** (`ECONNRESET`), estable durante 1 minuto |
| Destino de las conexiones de Governex a la BD (logs de flujo de red) | Red privada, puerto 5432 | Red privada (sin cambios) |
| `governex.app/api/health` y login (que consulta la BD) | OK | OK |

## Procedimiento para aplicar una migración nueva
Como la base de datos ya no tiene URL pública, `npm run migrate` desde tu PC necesita **abrir el acceso solo durante la migración**:

1. **Backup:** Railway → servicio **Postgres** → **Backups** → crear uno.
2. **Abrir el acceso público temporalmente:** Postgres → **Settings** → **Networking** → **TCP Proxy** → puerto `5432`. Railway genera una URL nueva en `DATABASE_PUBLIC_URL`, que normalmente tiene un host y un puerto distintos a los anteriores.
3. **Migrar** desde la carpeta del proyecto, en PowerShell:
   ```powershell
   $env:DATABASE_URL = "pega aquí la DATABASE_PUBLIC_URL nueva"
   npm run migrate:status
   npm run migrate
   npm run audit:verify
   Remove-Item Env:DATABASE_URL
   ```
4. **Cerrar el acceso público:** Postgres → **Settings** → **Networking** → elimina el TCP Proxy. **No dejes este paso para después.**
5. Guarda el ancla que imprime `audit:verify` en el gestor de secretos.

> **Mejora planificada (Fase 5):** que Railway aplique las migraciones automáticamente en cada despliegue, por la red privada, sin abrir nunca el acceso público.

## Variables obsoletas del servicio Governex
`JWT_SECRET`, `PLATFORM_ADMIN_JWT_SECRET`, `R2_PUBLIC_URL` y `NIXPACKS_NODE_VERSION` **no se usan en el código**: las dos primeras desde la Fase 2 (sesiones del servidor) y las otras dos nunca. Deben eliminarse de Railway (servicio Governex → Variables) para reducir la exposición de secretos.
