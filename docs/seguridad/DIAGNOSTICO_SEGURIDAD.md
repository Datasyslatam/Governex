# Governex: diagnóstico de seguridad y plan de tratamiento

**Fecha:** 2026-11-13 · **Versión auditada:** `origin/main` 7b6f7b0 · **Método:** revisión estática de código, configuración, esquema y dependencias (`npm audit`), más pruebas dinámicas en el entorno local (ver [FASE_0_1_REGISTRO_CAMBIOS.md](FASE_0_1_REGISTRO_CAMBIOS.md)).

> Este informe se basa en buenas prácticas (OWASP ASVS 4.0 nivel 2, OWASP Top 10 / API Top 10, ISO/IEC 27001/27002:2022, NIST CSF 2.0). No constituye una certificación de cumplimiento.

## 1. Arquitectura e inventario de activos

| Componente | Tecnología | Exposición |
|---|---|---|
| Backend | Express 4 + TypeScript (`src/index.ts`, `src/routes`, `src/middleware`) | ~240 endpoints REST en `/api/*` |
| Frontend | React 18 + Vite, servido por el mismo Express en producción | SPA. JWT en `localStorage` |
| Base de datos | PostgreSQL (Railway), `pg` sin ORM | Multiempresa por columna `tenant_id`, sin RLS |
| Archivos | Cloudflare R2 (API S3), URLs firmadas | Claves `tenants/{id}_…` |
| IA | Google Gemini (API externa) | Los datos de la empresa salen hacia Google |
| Despliegue | Railway (railpack), `/health` | Sin Dockerfile, CI ni WAF |
| Identidades | Usuarios de empresa (JWT 8 h) y platform_admin (JWT 4 h, otra secret, puede suplantar usuarios) | Sin MFA |

**PCI DSS:** no aplica. Governex es un sistema de gestión de calidad y no almacena, procesa ni transmite datos de tarjetas. Para un cliente financiero, Governex es un **proveedor tecnológico tercero (tercerización / nube)**.

## 2. Matriz de vulnerabilidades y riesgos

Estado al 2026-11-14 (tras la Fase 4). "Corregido" significa que una prueba automatizada lo demuestra (ver los registros de las Fases 0–1 y 2).

| ID | Componente | Hallazgo | Crit. | Prob. / Impacto | CWE | Control recomendado | Estado |
|---|---|---|---|---|---|---|---|
| V01 | Dependencias | proxy-addr (crítica), multer, body-parser, qs, react-router, xmldom | Crítico | Alta / Alta | CWE-1395 | SCA continuo + actualización | Parcial (2 moderadas) |
| V02 | Autenticación | Sin MFA, incluido platform_admin con suplantación | Crítico | Media / Muy alta | CWE-308 | TOTP obligatorio para roles privilegiados | Corregido (Fase 2) |
| V03 | Autorización | GET sin permiso `leer` (BFLA) | Alto | Alta / Alta | CWE-285 | `requirePermission` en toda ruta | Corregido |
| V04 | Autorización | `DELETE /proveedores/:id` sin permiso | Alto | Alta / Media | CWE-862 | Permiso `eliminar` | Corregido |
| V05 | Autorización | IDOR por llave foránea de otra empresa | Alto | Media / Alta | CWE-639 | `requireTenantRefs` | Corregido |
| V06 | Sesiones | JWT de 8 h sin revocación ni timeout por inactividad. El logout no invalida | Alto | Media / Alta | CWE-613 | Sesiones del servidor revocables | Corregido (Fase 2) |
| V07 | Frontend | JWT en `localStorage`, sin CSP | Alto | Media / Alta | CWE-922 | Cookie HttpOnly + CSP | Corregido (cookie HttpOnly en Fase 2; CSP bloqueante en Fase 4) |
| V08 | Contraseñas | Sin política. bcrypt 10. Sin cambio ni recuperación | Alto | Alta / Media | CWE-521 | Política + Argon2id + flujo de recuperación | Corregido salvo recuperación por correo (requiere SMTP) |
| V09 | Fuerza bruta | Límite por IP+email en memoria, sin bloqueo por cuenta | Alto | Media / Alta | CWE-307 | Bloqueo por cuenta en BD | Corregido (Fase 2) |
| V10 | Auditoría | Bitácora sin IP, correlación ni resultado. No registra fallos ni 403. Es mutable | Alto | Alta / Alta | CWE-778 | Bitácora de seguridad inmutable, exportable a SIEM | Corregido (Fase 3; envío a SIEM externo pendiente de proveedor) |
| V11 | Repositorio | Credenciales sembradas (hash fijo, correo personal) | Alto | Media / Muy alta | CWE-798 | Quitar la siembra y rotar | Corregido en el repo (rotar en prod) |
| V12 | IA | 17 endpoints sin permiso ni cuota. Datos a un tercero | Medio | Alta / Media | CWE-770 | Permiso + cuota + minimización | Corregido (permiso y cuota) |
| V13 | Autenticación | Enumeración de correos y del estado de la empresa | Medio | Alta / Baja | CWE-204 | Respuesta y tiempo uniformes | Corregido |
| V14 | CORS | Abierto si `CORS_ORIGINS` está vacío | Medio | Media / Media | CWE-942 | Cerrado por defecto | Corregido (Fase 2) |
| V15 | DoS | JSON de 15 MB global, sin límite general | Medio | Media / Media | CWE-400 | Límites por ruta + rate limit | Corregido |
| V16 | BD | TLS sin validar, usuario dueño, sin RLS. **2026-11-14: se eliminó el acceso público a la BD (proxy TCP)**; la app usa la red privada | Medio | Baja / Alta | CWE-295 | TLS verificado, mínimo privilegio, RLS | Abierto (Fase 5) |
| V17 | Errores | `error.message` expuesto | Medio | Media / Baja | CWE-209 | Errores genéricos | Corregido |
| V18 | JWT | Sin algoritmo fijo ni validación de secretos | Medio | Baja / Alta | CWE-347 | HS256 fijo + validación al arrancar | Corregido |
| V19 | Suplantación | Misma secret, sin rastro visible para la empresa, sin motivo | Medio | Baja / Alta | CWE-269 | Token marcado + bitácora + motivo | Corregido (Fase 3) |
| V20 | Platform admin | Sin separación de funciones ni restricción de IP | Medio | Baja / Muy alta | CWE-269 | Roles de plataforma + allowlist de IP | Corregido (Fase 3) |
| V21 | Esquema | Migraciones no reproducibles. ALTER en cada arranque | Medio | Media / Media | n/a | Gestor de migraciones | Parcial (migración 020) |
| V22 | Datos personales | Sin cifrado de campo, retención ni enmascaramiento | Medio | Media / Media | CWE-311 | Clasificación + cifrado + retención | Abierto (Fase 5) |
| V23 | DevSecOps | Sin CI, SAST, SCA ni escaneo de secretos | Medio | Media / Media | n/a | GitHub Actions + Dependabot + CodeQL + gitleaks | Abierto (Fase 6) |
| V24 | Continuidad | Sin evidencia de backups, restauración, RPO/RTO ni plan de incidentes | Medio | Media / Alta | n/a | DRP/BCP con pruebas | Abierto (Fase 7) |
| V25 | Dev | `vite.config.ts` con `allowedHosts: true` | Bajo | Baja / Baja | CWE-350 | Lista de hosts | Corregido (Fase 4) |

## 3. Plan de tratamiento

| Fase | Contenido | Requiere infraestructura o licencias |
|---|---|---|
| 0 | Entorno local reproducible (Docker) | Docker ✔ |
| 1 | V01, V03, V04, V05, V08 (política), V11, V12, V13, V15, V17, V18, V21 (parcial) | No ✔ **completada** |
| 2 | MFA TOTP, Argon2id, bloqueo por cuenta, sesión del servidor en cookie HttpOnly + CSRF, logout real, sesiones activas, cambio de contraseña, CORS cerrado | ✔ **completada** (recuperación por correo pendiente: requiere SMTP) |
| 3 | Bitácora de seguridad inmutable, suplantación trazable, separación de funciones del platform_admin | ✔ **completada** (envío a SIEM externo: según el proveedor que se elija) |
| 4 | CSP bloqueante, Permissions-Policy, COOP/CORP, no-store en la API, hosts de Vite (CORS cerrado ya en la Fase 2) | ✔ **completada** |
| 5 | RLS, usuario de BD de mínimo privilegio, TLS verificado, gestor de migraciones, cifrado de campos, retención | Posible KMS |
| 6 | CI: typecheck, pruebas de seguridad, CodeQL/Semgrep, gitleaks, Dependabot, protección de rama. DAST con OWASP ZAP en local o staging | No |
| 7 | Entregables: matriz final, roles × permisos, catálogo de controles, DRP/BCP (RPO/RTO), checklist de puesta en producción | Depende del plan de Railway |

## 4. Marco normativo aplicable (sector financiero colombiano)

> Vigencia verificada parcialmente. Confirmar el texto consolidado en superfinanciera.gov.co antes del contrato. No se declara cumplimiento.

| Norma | Tipo | Sujeto obligado | Implicación para Governex |
|---|---|---|---|
| Circular Básica Jurídica (C.E. 029/2014), Parte I, Tít. IV, Cap. V: seguridad de la información y ciberseguridad (C.E. 007/2018). CBJ reexpedida con la C.E. 006/2025 | Obligatoria | Entidad vigilada (cliente) | Exigencias contractuales al proveedor: incidentes, vulnerabilidades, pruebas, cifrado, trazabilidad, continuidad |
| Carta Circular 014/2026: tercerización y servicios en la nube | Instrucción de la SFC | Cliente, que la traslada a sus terceros | Cláusulas con terceros críticos y subcontratistas (Railway, Cloudflare, Google) |
| C.E. 033/2020 (taxonomía de incidentes) y riesgo operacional (SIAR) | Obligatoria | Cliente | Evidencia y avisos de incidentes en los plazos contractuales |
| Ley 1581/2012 y Decreto 1074/2015 (datos personales) | Obligatoria | Cliente (responsable) y Governex (encargado) | Contrato de transmisión, seguridad, transferencia internacional |
| Ley 1266/2008 (habeas data financiero) | Obligatoria si hay datos crediticios | Cliente | Probablemente no aplica a un sistema de calidad |
| ISO 27001/27002, NIST CSF 2.0, OWASP, CIS | Buenas prácticas | Proveedor | Catálogo de controles. Objetivo: ASVS nivel 2 |
| PCI DSS v4.0.1 | No aplica | n/a | n/a |

Fuentes: [CBJ – SFC](https://www.superfinanciera.gov.co/publicaciones/10083443/normativanormativa-generalcircular-basica-juridica-ce-10083443/), [CBJ Parte I – SFC](https://www.superfinanciera.gov.co/publicaciones/10083444/normativanormativa-generalcircular-basica-juridica-ce-parte-i-instrucciones-generales-aplicables-a-las-entidades-vigiladas-10083444/), [C.E. 007/2018](https://normativa.colpensiones.gov.co/colpensiones/docs/circular_superfinanciera_0007_2018.htm), [Carta Circular 014/2026 – CER](https://www.cerlatam.com/normatividad/superfinanciera-carta-circular-014-de-2026-04-mar-26/).
