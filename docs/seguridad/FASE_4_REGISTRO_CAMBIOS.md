# Governex: Fase 4 de seguridad (cabeceras del navegador). Registro de cambios y evidencia

**Fecha:** 2026-11-14 · **Rama:** `security/fase-4` (sobre `main` 6eabde0)
**Hallazgos:** V07 (CSP), V14 (CORS, ya corregido en la Fase 2), V25 (servidor de desarrollo de Vite).
**Migraciones:** ninguna. **Variables nuevas obligatorias:** ninguna.

> Estas medidas reducen riesgos concretos y verificados. No constituyen una certificación ni garantizan la ausencia de vulnerabilidades.

---

## 1. Qué cambió

| Antes | Ahora |
|---|---|
| CSP en modo **solo reporte** (PR #5): el navegador informaba pero **no bloqueaba** nada | CSP **bloqueante**. Scripts solo del propio sitio (`script-src 'self'`), sin scripts en línea, sin manejadores `onclick`/`onerror` en el HTML (`script-src-attr 'none'`), sin `eval`, sin plugins (`object-src 'none'`), sin incrustación por otros sitios (`frame-ancestors 'self'`) |
| Sin `Permissions-Policy` | Cámara, micrófono, geolocalización, pagos, USB, Bluetooth, sensores, etc. **desactivados**. Solo portapapeles y pantalla completa para el propio sitio |
| Sin aislamiento entre orígenes | `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Origin-Agent-Cluster`, `X-Permitted-Cross-Domain-Policies: none` |
| HSTS de 180 días | HSTS de **1 año** |
| Las respuestas de la API se podían guardar en caché | `Cache-Control: no-store` en toda `/api/*` (datos de la empresa) |
| Reportes CSP como texto libre en el log | Reportes CSP en **JSON** (SIEM), con modo, directiva, recurso bloqueado y página |
| Servidor de desarrollo de Vite expuesto a la red local (`host: true`) y aceptando cualquier nombre de host (`allowedHosts: true`): riesgo de *DNS rebinding* | Solo `localhost` por defecto. Para pruebas en red local: `VITE_DEV_HOST` y `VITE_ALLOWED_HOSTS` |

**Válvula de escape:** `CSP_REPORT_ONLY=true` en Railway vuelve la CSP a modo solo reporte **sin desplegar código**, por si una pantalla nueva se rompiera en producción.

---

## 2. Cómo se calibró la CSP (para no romper pantallas)

1. **Inventario del frontend:** no hay recursos externos (Gemini se llama solo desde el servidor; confirmé que la API key **no** llega al bundle), ni `eval`/`new Function`, ni iframes, ni workers. Las imágenes son `data:`/`blob:` (QR del MFA, PDF) y URLs firmadas de Cloudflare R2.
2. **Producción en modo solo reporte** (logs de Railway, ~500 peticiones con uso real: login, procesos, usuarios, NC/AC…): **0 violaciones** reportadas.
3. **Prueba en el navegador con la CSP bloqueante** (build de producción local):

| Prueba | Resultado |
|---|---|
| Login de empresa, login de plataforma y dashboard | Sin violaciones |
| **Las 28 pantallas** de la aplicación (contexto, liderazgo, planificación, apoyo, operación, evaluación, mejora, Mi seguridad) | **0 violaciones**, ninguna pantalla con error |
| QR del MFA (imagen `data:`) | Se muestra |
| Exportación del cuadro de auditorías a PDF (`blob:`) | Se genera (1.716 bytes, `application/pdf`) |
| Estilos de SweetAlert2 (los inserta en tiempo de ejecución) | Aplicados (179 reglas). Por eso `style-src` conserva `'unsafe-inline'` |
| **Ataque simulado:** `<script>` en línea, `<img onerror=…>` y script de un dominio externo | **Los 3 bloqueados**, ninguno se ejecutó, y los 3 reportados al servidor |

---

## 3. Pruebas automatizadas

| Prueba | Resultado |
|---|---|
| `scripts/security/api-security-tests.cjs` (63 previas + 5 nuevas, H01–H05) contra el build de producción | **68 / 68** ([`evidencias/pruebas-fase4.json`](evidencias/pruebas-fase4.json)) |
| `tests/security.test.mjs` (la prueba de la CSP se actualizó: ahora exige modo bloqueante) | **47 / 47** |
| Válvula `CSP_REPORT_ONLY=true` | Cambia a `Content-Security-Policy-Report-Only` |
| `tsc` del servidor · `npm run build` | Sin errores · OK |

---

## 4. Archivos
- **Nuevo:** `src/middleware/securityHeaders.ts` (CSP, Permissions-Policy, COOP/CORP, HSTS, no-store, receptor de reportes CSP).
- **Modificados:** `src/index.ts`, `vite.config.ts`, `tests/security.test.mjs`, `scripts/security/api-security-tests.cjs`, `.env.example`, `docs/seguridad/DIAGNOSTICO_SEGURIDAD.md`.

---

## 5. Pendiente o fuera de alcance
- **`style-src 'unsafe-inline'`:** lo exige SweetAlert2. Quitarlo requiere reemplazar la librería de diálogos o usar *nonces*. El riesgo residual es bajo: inyectar **estilos** no ejecuta código, y los scripts siguen bloqueados.
- **HSTS `includeSubDomains` / `preload`:** no se activó porque no conozco todos los subdominios de governex.app. Activarlo con uno sin HTTPS lo dejaría inaccesible. Decisión pendiente de Datasys.
- **Errores de React en consola (solo en desarrollo):** en Gestión de usuarios hay avisos `validateDOMNesting` por espacios entre etiquetas de tablas. Existían antes y no afectan a producción.

---

## 6. Despliegue
Sin migraciones ni variables obligatorias. Se fusiona y despliega normalmente.
- Después del despliegue, revisar los logs de Railway buscando `"tipo":"csp"` durante los primeros días.
- Si apareciera una violación legítima que rompe una pantalla, definir `CSP_REPORT_ONLY=true` en Railway (sin desplegar código) y avisarme para ajustar la política.
