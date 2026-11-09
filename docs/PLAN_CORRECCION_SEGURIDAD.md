# Plan de corrección técnica y de seguridad: Governex

**Fecha:** 2026-11-08
**Alcance:** backend Express (`src/index.ts`, `src/routes`, `src/middleware`, `src/services`), frontend React (`src/pages`) y configuración.
**Criterio rector:** corregir los riesgos sin alterar la funcionalidad visible. Cada cambio se probó contra la versión original con las mismas peticiones HTTP (resultado al final).

Referencia normativa: ISO/IEC 27001:2022, Anexo A. Controles 5.15 (control de acceso), 8.3 (restricción de acceso a la información), 8.5 (autenticación segura), 8.24 (criptografía), 8.25 a 8.28 (desarrollo y codificación seguros).

---

## Fase 1: Correcciones aplicadas en esta rama

| # | Severidad | Hallazgo | Corrección | Archivos | Control 27001 |
|---|---|---|---|---|---|
| H1 | Crítica | `GET /api/uploads/view/:key` era **público**: cualquiera con la clave del archivo (predecible) descargaba archivos de cualquier empresa | Exige sesión y verifica que el archivo sea de la empresa (prefijo de la clave o `registro_cargas_r2`). Bloquea claves con `..`. `signed-url` acepta también valores con prefijo `/api/uploads/view/` | `src/routes/uploads.ts`, `src/services/storageService.ts` | 5.15, 8.3 |
| H1b | (compatibilidad) | Pantallas que abrían `/view` con un enlace directo | Requerimientos P/S abre el archivo vía `signed-url`. Riesgos y Enfoque al Cliente devuelven una URL firmada al crear | `RequerimientosPSPage.tsx`, `riesgoEvidencias.ts`, `enfoqueCliente.ts` | n/a |
| H2 | Crítica | `UPDATE plan_formacion … WHERE id = $2` **sin filtro de empresa**: escritura sobre datos de otra empresa | Se agrega `AND tenant_id = $3` | `src/routes/gemini.ts` | 8.3 |
| H3 | Crítica | El caché de permisos (RBAC) usaba `rol` como clave, pero la consulta evalúa permisos **por usuario**: un usuario heredaba el permiso de otro del mismo rol durante 60 s | La clave del caché usa el id del usuario | `src/middleware/rbac.ts` | 5.15, 5.18 |
| H4 | Alta | XSS: el Markdown de la IA se insertaba con `innerHTML` sin escapar | Se escapa el HTML antes de dar formato. El formato (títulos, negrita, listas) se conserva | `src/pages/competencias/CompetenciasPage.tsx` | 8.28 |
| H5 | Alta | 6 llamadas a Gemini enviaban la API key en la URL (`?key=`), que queda en los logs de proxies | La clave viaja en la cabecera `x-goog-api-key`, como en el resto del código | `src/routes/gemini.ts` | 8.24, 8.15 |
| H6 | Alta | El login de empresas no tenía límite de intentos fallidos | 10 intentos fallidos por IP + email cada 15 min (respuesta 429). Los logins correctos no cuentan | `src/middleware/rateLimit.ts`, `src/routes/auth.ts` | 8.5 |
| H7 | Media | `req.ip` era la IP del proxy de Railway, lo que debilitaba los limitadores | `trust proxy` configurable (`TRUST_PROXY`, por defecto 1) | `src/index.ts` | 8.5 |
| H8 | Media | Sin cabeceras de seguridad, y la cabecera `X-Powered-By: Express` expuesta | `nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy` y HSTS en producción. Se quita `X-Powered-By` | `src/index.ts` | 8.9, 8.26 |
| H9 | Media | CORS aceptaba cualquier origen con credenciales | Lista blanca opcional con `CORS_ORIGINS`. Si no se define, se mantiene el comportamiento anterior, con un aviso en el log | `src/index.ts` | 8.26 |
| H10 | Media | Si la BD fallaba, la verificación de "empresa activa" dejaba pasar a todos | Usa el último estado conocido. Si no hay ninguno, responde 503 (no cierra la sesión) | `src/middleware/auth.ts` | 5.15 |
| H11 | Bug | Editar un usuario y cambiar su contraseña **siempre fallaba con 500**: los parámetros SQL estaban invertidos | Se corrige el orden `$6` / `$7` | `src/routes/auth.ts` | n/a |
| H12 | Bug | Una respuesta 404 dejaba la transacción abierta y devolvía la conexión "sucia" al pool | `ROLLBACK` antes de responder | `src/routes/auth.ts` | n/a |
| H13 | Bug | Las imágenes de organigrama de más de ~75 KB fallaban con 413 (límite JSON de 100 KB) | Límite de 15 MB, configurable con `JSON_BODY_LIMIT` | `src/index.ts` | n/a |
| H14 | Baja | SSL de BD con `rejectUnauthorized: false` fijo | Opcional `DB_SSL_REJECT_UNAUTHORIZED=true`. El valor por defecto no cambia | `src/db.ts` | 8.24 |
| H15 | Baja | No había plantilla de variables de entorno (`.env.example` estaba ignorado) | Se versiona `.env.example`, sin valores reales | `.env.example`, `.gitignore` | 5.37 |

### Acciones de configuración después del despliegue (Railway)
1. Definir **`CORS_ORIGINS`** con los dominios reales del frontend (p. ej. `https://governex.up.railway.app,https://app.midominio.com`). Mientras no se defina, CORS sigue abierto como antes.
2. Verificar que `JWT_SECRET` y `PLATFORM_ADMIN_JWT_SECRET` sean largos, aleatorios y **distintos**.
3. Si hay Cloudflare delante de Railway, poner `TRUST_PROXY=2`.

### Impacto funcional esperado
- Los enlaces `/api/uploads/view/...` copiados y abiertos **fuera de la aplicación** (marcadores, correos) dejan de funcionar. Es intencional: era la vulnerabilidad. Dentro de la app, los archivos se abren igual que antes.
- Archivos antiguos con clave sin prefijo de empresa y **sin** registro en `registro_cargas_r2`: el enlace de Requerimientos P/S mostrará "No se pudo abrir el archivo". Si aparece algún caso, se puede asociar el archivo a su empresa insertándolo en `registro_cargas_r2`.
- Si la aplicación se incrusta en un `<iframe>` de **otro** dominio, `X-Frame-Options: SAMEORIGIN` lo impedirá. Hoy no se detectó ese uso.

---

## Fase 2: Estado

| # | Mejora | Estado |
|---|---|---|
| 1 | Revisión completa de aislamiento entre empresas | **Hecho.** Ver "Resultado de la auditoría de aislamiento" |
| 2 | Pasar el JWT de `localStorage` a cookie `httpOnly` + `SameSite` | **Pendiente: requiere decisión.** Cambia el login, `api.ts` y las ~10 llamadas `fetch` directas que leen el token; además exige protección CSRF |
| 3 | Content-Security-Policy | **Hecho, en modo solo reporte.** Las violaciones se registran en el log como `[csp] …`. Tras revisarlas en producción, activar el bloqueo con `CSP_ENFORCE=true` |
| 4 | Gestor de migraciones con tabla de control | **Hecho.** `scripts/migrate.ts` + tabla `schema_migrations` (`npm run migrate`) |
| 5 | Sacar el `ALTER TABLE` automático de `src/db.ts` | **Hecho.** Ahora está en la migración 020 |
| 6 | Pruebas automatizadas + CI | **Hecho.** 47 pruebas en `tests/security.test.mjs`; `.github/workflows/ci.yml` las corre en cada PR |
| 7 | Limitador de intentos compartido (Redis) | **Pendiente.** Solo hace falta si Railway escala a más de una réplica |

### Resultado de la auditoría de aislamiento

**Método.** Un análisis estático (compilador de TypeScript) recorrió todas las consultas SQL de `src/routes`, `src/middleware` y `src/services`, y además todas las escrituras que reciben el id de un registro padre.

**Consultas sin filtro por empresa.** Hay 16 casos y todos son legítimos:
- consultas sobre el propio usuario (el id sale del token);
- estadísticas globales del administrador de plataforma, que son así por diseño;
- operaciones sobre usuarios precedidas de una verificación de empresa.

En ningún caso el tenant se toma de la petición: siempre sale del token. Todos los "upsert" usan claves compuestas `(tenant_id, …)`.

**Hallazgo H16 (alta).** 29 escrituras de 54 aceptan el id de un registro padre (`proceso_id`, `nc_id`, `proveedor_id`, `personal_id`, `ficha_tecnica_id`, …) sin verificar que sea de la misma empresa. Por ejemplo, la empresa A podía crear un indicador colgado de un proceso de la empresa B (comprobado: respuesta 201), y en sus listados ver datos de B.

**Corrección.** La migración 021 instala un trigger genérico (64 relaciones, detectadas desde el catálogo de PostgreSQL) que rechaza cualquier referencia a un padre de otra empresa. Protege también el código futuro. Los registros antiguos con referencias cruzadas se pueden seguir editando mientras no cambie la referencia, y la migración los **reporta** al aplicarse.

**Pruebas por HTTP.** Sobre 8 recursos, la empresa A no ve en los listados, no lee, no modifica y no borra registros de B, y no puede colgar registros de padres de B.

### Pasos en producción para la Fase 2
1. Hacer un respaldo de la base de datos.
2. `npm run migrate -- --baseline=019` (una sola vez) y luego `npm run migrate`.
3. Revisar la salida de la migración 021: si aparece `ATENCIÓN: … referencian un … de otra empresa`, esos registros se crearon con una referencia cruzada antes de la corrección y conviene revisarlos.
4. Después de unos días, buscar líneas `[csp]` en los logs de Railway. Si no hay violaciones de la propia aplicación, definir `CSP_ENFORCE=true`.

## Fase 3: Deuda técnica y diseño

- Separar `src/` en `client/` y `server/`: hoy `src/routes` y `src/services` mezclan código de React y de Express.
- Activar `strict` en `tsconfig.server.json` y corregir los 47 errores de tipos del frontend, que ya existían.
- Unificar el bucle de modelos de Gemini en una sola función de `geminiService.ts`. Hoy `gemini.ts` tiene ~1.900 líneas con el bucle repetido unas 20 veces.
- Carga diferida (`React.lazy`) de las páginas: el bundle principal supera 500 KB.
- Optimizar o eliminar logos duplicados en `src/assets/` (~2,5 MB).
- Crear o corregir los íconos PWA referenciados en `index.html` y `public/manifest.json`, que no existen.
- Mover o eliminar los scripts sueltos de la raíz y de `scratch/`.
- ~~Actualizar el README (requisito Node ≥ 22.12).~~ Hecho en la Fase 2.
- Revisar `actividades_empresa.id` y `fichas_tecnicas_ps.id`: son claves de texto con unicidad **global**, no por empresa. Hoy se generan con fecha y aleatorio, así que no chocan en la práctica, pero conviene migrarlas a claves compuestas `(tenant_id, id)`.
- Reemplazar `document.body.innerHTML = …` en la impresión de Competencias, que destruye el árbol de React, por una ventana o iframe de impresión.

---

## Evidencia de verificación

Entorno: PostgreSQL 16 local con `schema.sql` + `migrations/`, dos empresas de prueba, usuarios con distintos roles y permisos personalizados. Las mismas 28 peticiones HTTP se ejecutaron contra ambas versiones.

| Versión | Resultado |
|---|---|
| Original (`aadb2da`) | 16 / 28: confirma H1, H3, H11, H13 y la falta de cabeceras y de limitador |
| Corregida | **28 / 28** |

Además:
- `npm run build` (servidor + frontend) pasa sin errores.
- `tsc --noEmit` del frontend: los mismos 47 errores previos y **ninguno nuevo**.
- SQL de H2: la empresa A intenta actualizar el plan de B → `UPDATE 0`. B sobre su propio plan → `UPDATE 1`.
- H4: un `<img onerror=…>` dentro del Markdown queda escapado y los títulos, negritas y listas se mantienen.

### Verificación manual recomendada tras desplegar
1. Iniciar sesión y abrir un adjunto en **Requerimientos P/S** (cotización y evidencia).
2. Subir una evidencia en **Riesgos** y ver la miniatura de inmediato.
3. Subir un archivo en **Enfoque al Cliente** y descargarlo.
4. Ver el organigrama y el PDF en **Plantilla de Organización**.
5. Generar una guía de capacitación en **Competencias** y su impresión o PDF.
6. Extraer procesos desde una imagen de organigrama mayor de 100 KB.
7. Editar un usuario cambiándole la contraseña y entrar con la nueva.
