# Governex: Fase 2 de seguridad (autenticación y sesiones). Registro de cambios y evidencia

**Fecha:** 2026-11-13 · **Rama:** `security/fase-2` (sobre `security/fase-0-1`)
**Entorno de prueba:** local exclusivamente (PostgreSQL 16 en Docker, API `:3001`, frontend Vite `:5173`). No se tocó Railway ni producción.

> Estas medidas reducen riesgos concretos y verificados. No constituyen una certificación ni garantizan la ausencia de vulnerabilidades.

---

## 1. Qué cambió para el usuario

| Antes | Ahora |
|---|---|
| JWT de 8 h guardado en `localStorage`, legible por JavaScript | Cookie de sesión `HttpOnly; Secure; SameSite=Strict`. JavaScript no la ve |
| Cerrar sesión solo borraba el token del navegador (seguía siendo válido) | La sesión se revoca en el servidor al instante |
| Sin límite de inactividad | Expira tras 30 min sin actividad o 8 h desde el inicio (plataforma: 4 h) |
| Sin MFA | MFA TOTP obligatorio para **Superusuario** y **platform_admin** (opcional para los demás), con 10 códigos de recuperación de un solo uso |
| bcrypt (costo 10) | **Argon2id** (m=19 MiB, t=2, p=1). Las cuentas existentes migran solas al iniciar sesión |
| Límite por IP+email en memoria | Además, **bloqueo por cuenta** en BD: 5 fallos → 15 min |
| Sin cambio de contraseña propio | Pantalla **Mi seguridad**: cambiar contraseña, MFA, sesiones activas |
| Una contraseña puesta por el administrador era definitiva | Es **temporal**: el usuario debe cambiarla al entrar |
| Cambiar rol o desactivar a un usuario no afectaba su token vigente | Se cierran sus sesiones de inmediato |
| CORS vacío = cualquier origen con credenciales | CORS vacío = solo el mismo origen |

---

## 2. Resultado de las pruebas

| Prueba | Resultado | Evidencia |
|---|---|---|
| Batería automatizada (T + R de las Fases 0 y 1, más 17 nuevas S01–S17) | **51 / 51**, estable en ejecuciones repetidas | [`evidencias/pruebas-fase2.json`](evidencias/pruebas-fase2.json) |
| TOTP contra los vectores oficiales del RFC 6238 (T=59 → 287082; T=1111111109 → 081804) | OK | Script de verificación |
| Cifrado AES-256-GCM del secreto (ida y vuelta; el texto cifrado no contiene el secreto) | OK | S12 |
| Navegador real (Vite + API): login de Superusuario → enrolamiento con QR → códigos de recuperación → dashboard (todas las API en 200) → Mi seguridad → cerrar otras sesiones (POST con CSRF, 200) → cerrar sesión (cookies borradas) → login con código TOTP → dashboard. Sin errores de consola | OK | Prueba manual guiada |
| En el navegador, `document.cookie` solo muestra `gx_csrf`. `localStorage` sin token | OK | Inspección en el navegador |
| Build de producción: `gx_session` sale con `HttpOnly; Secure; SameSite=Strict`. Un origen externo no recibe CORS | OK | Prueba rápida del build compilado |
| Arranque sin `MFA_ENCRYPTION_KEY` válida | El servidor **no arranca** (exit 1) | Prueba rápida |
| `tsc` del servidor | Sin errores | |
| `tsc` del frontend | 47 errores, los mismos previos. **Ninguno nuevo** | |
| `npm run build` | OK | |

### Pruebas nuevas (S)
S01 cookie HttpOnly sin token en el cuerpo · S02 la cookie copiada deja de servir tras el logout · S03 CSRF: POST sin cabecera → 403 · S04 la sesión previa al MFA no da acceso a datos · S05 código errado → 401, correcto → acceso, reutilización → 401 · S06 código de recuperación de un solo uso · S07 bloqueo por cuenta, mismo mensaje que un correo inexistente · S08 contraseña temporal: todo 403 hasta cambiarla · S09 cambiar la contraseña cierra las otras sesiones · S10 desactivar al usuario corta su sesión · S11 bcrypt → Argon2id · S12 secreto MFA cifrado · S13 expiración por inactividad · S14 platform_admin sin MFA no accede · S15 suplantación de 30 min marcada y visible · S16 el cambio de rol cierra la sesión · S17 los tokens Bearer antiguos se rechazan.

---

## 3. Estado de los hallazgos

| ID | Hallazgo | Estado tras la Fase 2 |
|---|---|---|
| V02 | Sin MFA | **Corregido** para Superusuario y platform_admin (S04, S05, S06, S14). Configurable para otros roles con `MFA_REQUIRED_ROLES` |
| V06 | JWT sin revocación ni inactividad | **Corregido** (S02, S09, S10, S13, S16) |
| V07 | Token en `localStorage`, sin CSP | **Parcial**: la sesión ya no es accesible desde JS (S01, S17). La CSP queda para la Fase 4 |
| V08 | Contraseñas | **Corregido**: política (Fase 1) + Argon2id (S11) + cambio propio + contraseña temporal (S08). Sin recuperación por correo (requiere SMTP) |
| V09 | Fuerza bruta | **Corregido**: bloqueo por cuenta en BD (S07) + limitador por IP+email |
| V14 | CORS abierto | **Corregido**: vacío = mismo origen |
| V19 | Suplantación | **Parcial**: sesión marcada `suplantado_por_admin`, 30 min, visible en "Mi seguridad" (S15). Motivo obligatorio y bitácora inmutable: Fase 3 |

---

## 4. Archivos

### Nuevos
| Archivo | Propósito |
|---|---|
| `migrations/021_sesiones_mfa_bloqueo.sql` | Tablas `sesiones` y `mfa_codigos_recuperacion`. Columnas de MFA, bloqueo y contraseña temporal. Aditiva e idempotente |
| `src/security/sessions.ts` | Sesiones del servidor: cookie, hash SHA-256, inactividad y expiración, revocación, CSRF |
| `src/security/mfa.ts` | TOTP RFC 6238 sin dependencias, cifrado AES-256-GCM, códigos de recuperación |
| `src/security/passwords.ts` | Argon2id + verificación de bcrypt heredado + rehash transparente |
| `src/security/lockout.ts` | Bloqueo por cuenta en BD |
| `src/security/authFlow.ts` | Flujo contraseña → MFA → sesión, compartido por empresa y plataforma |
| `src/components/auth/MfaPaso.tsx/.css` | Paso MFA del login (verificar o enrolar con QR, códigos de recuperación) |
| `src/pages/cuenta/SeguridadCuentaPage.tsx/.css` | "Mi seguridad": contraseña, MFA, sesiones activas |

### Modificados (principales)
| Archivo | Cambio |
|---|---|
| `src/middleware/auth.ts`, `platformAdminAuth.ts` | Autenticación por sesión del servidor + CSRF + bloqueo por contraseña temporal. `req.user` conserva su forma: **ninguna ruta de negocio cambió** |
| `src/routes/auth.ts` | Login por etapas, `/mfa/*`, `/me`, `/password`, `/sesiones`, logout real, restablecer MFA de un usuario, revocación al editar o eliminar usuarios |
| `src/routes/platformAdmin.ts` | Login con MFA obligatorio, `/me`, `/password`, logout. Suplantación por cookie. Reset de contraseña = temporal + revocación |
| `src/middleware/securityConfig.ts` | Exige `MFA_ENCRYPTION_KEY`. Los secretos JWT ya no se usan |
| `src/index.ts` | CORS cerrado por defecto |
| Frontend: `services/api.ts`, `services/index.ts`, `services/platformAdminApi.ts`, contextos, `LoginPage`, `PlatformAdminLoginPage`, `ProtectedRoute`, `PlatformAdminProtectedRoute`, `Topbar`, `UsuariosPage`, `TenantDetailModal` y 4 páginas con `fetch` manual | Sin tokens en JS: cookies de mismo origen + cabecera `X-CSRF-Token` |
| `package.json` | `@node-rs/argon2` (binarios precompilados, sin scripts de instalación) y `qrcode` |

---

## 5. Pendiente o fuera de alcance
- **Recuperación de contraseña por correo:** requiere un proveedor SMTP (Resend, SES, etc.). Mientras tanto, un Superusuario o un platform_admin restablece la contraseña y queda como temporal.
- **Contadores en memoria:** el limitador por IP y la cuota de IA siguen en memoria. El bloqueo por cuenta y las sesiones ya están en la BD (compatibles con varias réplicas).
- **CSP:** Fase 4.

---

## 6. ⚠️ Acciones obligatorias antes de desplegar en Railway
1. **Crear la variable `MFA_ENCRYPTION_KEY`** (64 caracteres hex) en Railway **y guardarla en un gestor de secretos**. Sin ella el servicio no arranca. Si se pierde, todos los usuarios tendrán que volver a enrolar su MFA.
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **Aplicar las migraciones 021 y 022 en producción** antes del despliegue, con el gestor `npm run migrate` (ver [INTEGRACION_PR5.md §4](INTEGRACION_PR5.md)).
3. **Avisar a los usuarios:**
   - Todos deberán iniciar sesión de nuevo, porque los tokens anteriores dejan de valer.
   - Los **Superusuarios** y **platform_admins** configurarán su app autenticadora en el primer ingreso.
4. Verificar que `CORS_ORIGINS` esté vacía (solo mismo origen) o contenga únicamente dominios propios.
5. `JWT_SECRET` y `PLATFORM_ADMIN_JWT_SECRET` ya no se usan. Se pueden eliminar de Railway después del despliegue.
