# Governex: Fase 3 de seguridad (trazabilidad y auditoría). Registro de cambios y evidencia

**Fecha:** 2026-11-13 · **Rama:** `security/fase-3` (sobre `main` b500a81)
**Hallazgos:** V10 (auditoría), V19 (suplantación), V20 (separación de funciones en la plataforma).
**Entorno de prueba:** local exclusivamente. No se tocó Railway ni producción.

> Estas medidas aportan trazabilidad verificable. No constituyen una certificación ni garantizan la ausencia de vulnerabilidades.

---

## 1. Qué cambió

| Antes | Ahora |
|---|---|
| `logs_actividad` sin IP ni correlación, y modificable o borrable | Bitácora de seguridad **`auditoria_eventos`** de **solo inserción**, con **cadena de hashes SHA-256** (cada evento incluye el hash del anterior). `logs_actividad` y `platform_admin_audit_log` también quedan de solo inserción |
| No se registraban logins fallidos, bloqueos, accesos denegados ni cambios de permisos | Se registran **todos**, con IP, ID de correlación, resultado (`exito`/`fallo`/`denegado`) y motivo (sección 2) |
| Cambios de usuarios sin detalle | Se registra **qué cambió, antes → después** (rol, estado, nombre, correo, permisos agregados o quitados, contraseña restablecida) |
| Sin ID de correlación | Cabecera **`X-Request-Id`** en cada respuesta, propagada a la bitácora. **Log JSON por línea** en stdout para un SIEM |
| Suplantación sin justificación ni visibilidad para la empresa | **Motivo obligatorio** (10–300 caracteres). Queda en la bitácora inmutable y **la empresa lo ve** en su bitácora ("Acceso de soporte"). Todo lo que hace soporte durante la suplantación queda marcado |
| Cualquier platform_admin podía crear o desactivar a otros admins | Roles **`propietario`** (gestiona admins y verifica la bitácora) y **`operador`** (empresas, soporte). Lista opcional de **IP permitidas** para `/api/platform-admin` |
| Sin forma de probar que la bitácora no fue alterada | **`npm run audit:verify`** y `GET /api/platform-admin/auditoria/verificar` recalculan la cadena e indican la primera fila alterada |
| — | Pestaña **"Eventos de Seguridad"** para el Superusuario (solo los de su empresa) |
| **Fuga encontrada:** el registro genérico de actividad guardaba como "Elemento" el **código MFA** enviado a `/api/auth/mfa/*` (vino de la Fase 2) | Las rutas `/api/auth/*` ya no pasan por el registro genérico y registran eventos explícitos sin secretos. **La migración 023 reemplaza esos códigos** en los registros existentes antes de volver la tabla inmutable |

---

## 2. Eventos que se registran

| Categoría | Eventos |
|---|---|
| `autenticacion` | login (éxito / fallo con motivo `usuario_inexistente`, `password_incorrecta`, `cuenta_bloqueada`, `empresa_inactiva`), contraseña correcta a la espera de MFA, verificación MFA (éxito, fallo, uso de código de recuperación), MFA activado, cambio de contraseña, logout, cierre remoto de sesiones, login de plataforma |
| `seguridad` | cuenta bloqueada, MFA desactivado o códigos regenerados, hash migrado a Argon2id, **CSRF rechazado**, **referencia a datos de otra empresa** (IDOR), IP no autorizada para la plataforma |
| `acceso` | **permiso denegado** (RBAC, con el permiso faltante y el rol), rol de plataforma insuficiente |
| `usuarios` | usuario creado (rol, permisos), **modificado (antes → después)**, eliminado o desactivado, MFA restablecido por el Superusuario |
| `plataforma` | crear, editar y suspender empresas, **suplantación con motivo**, crear o desactivar admins (con rol), restablecer contraseñas, verificación de la bitácora |
| `datos` | toda escritura exitosa (crear, modificar, eliminar) en los módulos de negocio, con recurso, id y elemento |

**Nunca se registran:** contraseñas, códigos MFA ni de recuperación, cookies, tokens, tokens CSRF ni el cuerpo completo de las peticiones. Lo verifican las pruebas A02 y A09, además de una búsqueda en el log del servidor.

---

## 3. Evidencia

| Prueba | Resultado |
|---|---|
| Batería de seguridad de la API (51 previas + 12 nuevas, A01–A12) | **63 / 63**, estable en ejecuciones repetidas ([`evidencias/pruebas-fase3.json`](evidencias/pruebas-fase3.json)) |
| Batería del PR #5 (`tests/security.test.mjs`, igual que el job del CI) | **47 / 47** |
| Migración 023 sobre una BD creada desde cero con el gestor | 18 migraciones aplicadas sin errores |
| Cadena de hashes: dos eventos encadenados, `gx_auditoria_verificar()` vacío | OK |
| `UPDATE`, `DELETE` y `TRUNCATE` sobre `auditoria_eventos`, `DELETE` sobre `logs_actividad`, `UPDATE` sobre `platform_admin_audit_log` | Todos **rechazados** (A06) |
| **Alteración simulada** (atacante con privilegios de dueño desactiva el trigger y modifica una fila) | **Detectada** por la verificación. Luego se restauró y la cadena volvió a verificar íntegra (A12) |
| Log JSON del servidor: búsqueda de la contraseña de prueba, contraseñas nuevas, cookies `gx_session`, cabecera CSRF y códigos de recuperación | **0** coincidencias |
| Lista de IP permitidas (IP exacta, CIDR, IPv4 mapeada a IPv6, lista vacía) | 7 / 7 casos |
| Navegador: pestaña "Eventos de Seguridad" con login, MFA, acceso de soporte con motivo, acciones marcadas "vía soporte" y cambios de usuario | OK |
| `tsc` del servidor / del frontend · `npm run build` | Sin errores / 47 previos, ninguno nuevo · OK |

---

## 4. Archivos

**Nuevos:** `migrations/023_bitacora_seguridad_inmutable.sql` · `src/security/audit.ts` · `src/middleware/requestContext.ts` · `src/pages/auth/EventosSeguridadPanel.tsx` · `scripts/security/verificar-bitacora.cjs`.

**Modificados:**
- **Middleware:** `src/index.ts`, `src/middleware/activityLogger.ts`, `rbac.ts`, `tenantRefs.ts`, `auth.ts`, `platformAdminAuth.ts`.
- **Rutas:** `src/routes/auth.ts`, `src/routes/platformAdmin.ts`.
- **Seguridad:** `src/security/sessions.ts`.
- **Frontend:**
  - Servicios: `src/services/index.ts`, `src/services/platformAdminApi.ts`.
  - Páginas: `UsuariosPage.tsx`, `TenantDetailModal.tsx`, `PlatformAdminDashboardPage.tsx`.
- **Scripts y configuración:** `scripts/migrate.ts` (checksum con saltos de línea normalizados: Git en Windows convertía LF→CRLF y generaba falsas alertas de "migración modificada"), `scripts/security/api-security-tests.cjs`, `package.json` (`audit:verify`), `.env.example`.

---

## 5. Limitaciones y operación recomendada
- **Inmutabilidad dentro de la BD:** los triggers impiden modificar la bitácora a cualquier usuario normal, pero el **dueño de la tabla** puede desactivarlos. La cadena de hashes hace **detectable** cualquier alteración, pero no la impide. Para que sea inalterable de punta a punta:
  1. Ejecutar **`npm run audit:verify` a diario** y guardar fuera de la BD el **ancla** que imprime (`id:hash` del último evento). Así también se detecta un truncado del final de la cadena.
  2. Enviar los logs JSON de stdout a un **SIEM** o almacenamiento WORM. Es el siguiente paso recomendado y requiere elegir proveedor (posible costo).
  3. A futuro, usar un usuario de BD de mínimo privilegio para la aplicación, distinto del dueño (Fase 5).
- **Retención:** la bitácora no se purga. Definir con el cliente el plazo de conservación exigido (en el sector financiero suele ser de varios años).
- **Volumen:** cada escritura de datos genera un evento. Con el volumen actual no es relevante; se revisará en la Fase 5 junto con la partición por fecha si hace falta.

---

## 6. ⚠️ Antes de desplegar en Railway
1. **Backup** de la BD.
2. Aplicar la migración con el gestor: `npm run migrate` (aplica la **023**). Requiere PostgreSQL 11+, que Railway ya cumple.
3. **Opcional:** definir `PLATFORM_ADMIN_IP_ALLOWLIST` con las IP o rangos de la oficina de Datasys. **Cuidado:** si se configura mal, nadie podrá entrar al panel de plataforma hasta corregir la variable.
4. Los platform_admins existentes quedan como **propietario**. Los nuevos se crean como **operador** por defecto.
5. Después del despliegue, ejecutar `npm run audit:verify` contra producción y guardar el ancla.
