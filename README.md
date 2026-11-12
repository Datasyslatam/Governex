# Governex — Sistema Integral de Gestión de Calidad (NTC-ISO 9001:2015) con IA

Plataforma empresarial **SaaS Multi-tenant** diseñada para la implementación, administración, automatización y auditoría continua de **Sistemas de Gestión de Calidad (SGC)** bajo la norma internacional **NTC-ISO 9001:2015**. Governex combina una arquitectura monolítica full-stack en **TypeScript (React + Node.js/Express)** con servicios de almacenamiento en la nube S3/R2 y capacidades avanzadas de **Inteligencia Artificial Generativa y Multimodal (Google Gemini)** para optimizar la carga documental, el análisis de riesgos, la identificación de causas raíz y el cumplimiento normativo.

---

## Tabla de Contenidos

1. [Visión General del Sistema](#visión-general-del-sistema)
2. [Arquitectura de Software](#arquitectura-de-software)
   - [Diagrama de Arquitectura de Alto Nivel](#diagrama-de-arquitectura-de-alto-nivel)
   - [Modelo Multi-Tenant y Aislamiento de Datos](#modelo-multi-tenant-y-aislamiento-de-datos)
   - [Esquema de Autenticación y Autorización (RBAC)](#esquema-de-autenticación-y-autorización-rbac)
   - [Panel de Superadministración e Impersonación](#panel-de-superadministración-e-impersonación)
   - [Almacenamiento de Objetos Seguro (S3 / Cloudflare R2)](#almacenamiento-de-objetos-seguro-s3--cloudflare-r2)
   - [Motor de Inteligencia Artificial (Google Gemini)](#motor-de-inteligencia-artificial-google-gemini)
3. [Stack Tecnológico Detallado](#stack-tecnológico-detallado)
   - [Frontend](#frontend)
   - [Backend](#backend)
   - [Base de Datos](#base-de-datos)
   - [Infraestructura y DevOps](#infraestructura-y-devops)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Módulos Funcionales (Alineación ISO 9001:2015)](#módulos-funcionales-alineación-iso-90012015)
6. [Instalación y Configuración Local](#instalación-y-configuración-local)
   - [Prerrequisitos](#prerrequisitos)
   - [Variables de Entorno](#variables-de-entorno)
   - [Migraciones de Base de Datos](#migraciones-de-base-de-datos)
   - [Ejecución en Entorno de Desarrollo](#ejecución-en-entorno-de-desarrollo)
7. [Scripts Disponibles](#scripts-disponibles)
8. [Despliegue en Producción (Railway)](#despliegue-en-producción-railway)
9. [Seguridad y Buenas Prácticas](#seguridad-y-buenas-prácticas)

---

## Visión General del Sistema

Governex centraliza el ciclo completo **PHVA (Planificar - Hacer - Verificar - Actuar)** exigido por la norma ISO 9001:2015 en una sola plataforma web reactiva y moderna. Permite a múltiples organizaciones operar en entornos lógicos completamente aislados, administrando sus procesos estratégicos, misionales y de apoyo, indicadores clave de desempeño (KPI), matrices de riesgos y oportunidades, auditorías internas y no conformidades asistidas por modelos de lenguaje e inferencia visual.

---

## Arquitectura de Software

La aplicación está diseñada bajo el patrón de **Monolito Modular Full-Stack en TypeScript**, empaquetando en un único repositorio el cliente SPA y la API RESTful. En producción, un único proceso Node.js sirve tanto las rutas de API como la compilación optimizada del frontend, simplificando despliegues, reduciendo latencias de red y eliminando la fricción de políticas CORS entre servicios independientes.

```
                           +----------------------------------------+
                           |          Navegador Web (SPA)           |
                           |   React 18 + Vite + Context APIs       |
                           +-------------------+--------------------+
                                               |
                                     HTTP/S    | (REST + JSON)
                                               v
+-----------------------------------------------------------------------------------+
| Express Server (Node.js >= 22 / TypeScript)                                       |
|                                                                                   |
|  [Security Middlewares]                                                           |
|   - Helmet / Headers (nosniff, SAMEORIGIN, HSTS)                                  |
|   - CORS whitelist & Trust Proxy                                                  |
|   - Rate Limiting (Filtro anti-fuerza bruta en Auth)                              |
|   - Activity Logger (Auditoría transversal a PostgreSQL)                          |
|                                                                                   |
|  [Auth & RBAC Middleware]                                                         |
|   - JWT Validation (Tenant Users vs. Platform Admins)                             |
|   - Permission Matrix Cache (Evaluación granular por Usuario: "recurso:accion")   |
|                                                                                   |
|  [API Routers (29+ Rutas de Negocio)]                                             |
|   - Contexto, Riesgos, Procesos, Auditorías, Compras, Producción, NC/AC...        |
|                                                                                   |
|  [Static SPA Handler (Producción)]                                                |
|   - Serve static bundle (dist/) + Catch-all fallback routing                      |
+--------------------+-----------------------+--------------------+-----------------+
                     |                       |                    |
                     v                       v                    v
      +--------------------+   +--------------------+   +--------------------+
      |  PostgreSQL 15+    |   | Cloudflare R2 / S3 |   | Google Gemini API  |
      |                    |   |                    |   | (v1beta REST)      |
      | - Esquema Relacional|   | - Buckets aislados |   | - Vision & Text    |
      | - Multi-tenant     |   |   por Tenant       |   | - Flash 3.8 / 3.1  |
      | - Connection Pool  |   | - Signed URLs      |   | - Fallback Chain   |
      +--------------------+   +--------------------+   +--------------------+
```

### Modelo Multi-Tenant y Aislamiento de Datos

Governex utiliza un modelo **Multi-Tenant con Base de Datos Compartida y Aislamiento por Discriminador Lógico (`tenant_id`)**:
- Todas las tablas principales del sistema (`procesos`, `riesgos`, `auditorias`, `nc_ac`, `usuarios`, `documentos`, etc.) incluyen una columna foránea obligatoria `tenant_id`.
- El middleware de autenticación inyecta la identidad verificada del tenant (`req.user.tenantId`) extraída del token JWT.
- Cada consulta a la base de datos restringe estrictamente su ámbito mediante cláusulas parametrizadas `WHERE tenant_id = $1`, impidiendo el acceso cruzado entre organizaciones.
- El almacenamiento en la nube organiza las rutas de archivos bajo carpetas exclusivas: `tenants/{tenantId}_{safeTenantName}/{timestamp}_[{user}_{role}]_{fileName}`, con validación estricta de propiedad previo a la emisión de enlaces de descarga.

### Esquema de Autenticación y Autorización (RBAC)

El control de acceso implementa un modelo híbrido **RBAC (Role-Based Access Control) + Permisos Granulares por Usuario**:
- **Roles predefinidos:** Administrador del Sistema, Líder de Calidad, Auditor, Responsable de Proceso, Colaborador.
- **Permisos granulares (`recurso:accion`):** Los permisos se definen en la tabla `permisos` sobre cada módulo (`riesgos:crear`, `auditorias:aprobar`, `competencias:editar`, etc.).
- **Sobrescritura por usuario:** Si un usuario tiene la bandera `tiene_permisos_personalizados = true`, el sistema evalúa la tabla `usuario_permisos` en lugar de `rol_permisos`.
- **Caché en memoria de permisos:** El middleware `requirePermission` almacena temporalmente los permisos evaluados de cada usuario con TTL corto para reducir el consumo de conexiones hacia PostgreSQL sin sacrificar reactividad ante cambios administrativos.
- **Protección contra ataques de fuerza bruta:** Limitador de tasa en memoria (`rateLimit.ts`) que bloquea combinaciones de IP + correo tras 10 intentos fallidos continuos en ventanas de 15 minutos.

### Panel de Superadministración e Impersonación

Para la operación y soporte global del SaaS existe un portal independiente (`/platform-admin`):
- **Aislamiento Criptográfico:** Autenticación independiente con secreto JWT exclusivo (`PLATFORM_ADMIN_JWT_SECRET`), tablas separadas (`platform_admins`) y middleware dedicado.
- **Gestión de Tenants:** Activación, suspensión, creación y monitoreo del estado operativo de empresas suscritas.
- **Modo Impersonación (Login as Tenant):** Permite a los superadministradores ingresar a la cuenta de un tenant para soporte técnico, registrando cada acción en `platform_admin_audit` y mostrando un banner persistente en pantalla (`ImpersonationBanner.tsx`) con opción de retorno inmediato.

### Almacenamiento de Objetos Seguro (S3 / Cloudflare R2)

La gestión de evidencias, manuales de funciones, actas, soportes de compras y registros se gestiona a través de la API S3 mediante **Cloudflare R2**:
- Los archivos **no son públicos**. Se accede mediante **URLs prefirmadas temporales (Presigned URLs)** con expiración breve (5 minutos).
- Servicio unificado en `storageService.ts`: subida, descarga mediante streaming, generación de firmas y borrado seguro.
- Control transversal anti-tampering y anti-directory-traversal: se rechazan keys que contengan caracteres `..` o separadores sospechosos.

### Motor de Inteligencia Artificial (Google Gemini)

La integración con **Google Gemini** automatiza tareas complejas de consultoría ISO:
- **Modelos integrados:** Estrategia de reintentos en cascada (`gemini-3.1-flash-lite`, `gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-flash-latest`) que garantiza disponibilidad continua si algún modelo experimenta cuotas saturadas o latencias elevadas.
- **Extracción multimodal (Vision):** Reconocimiento de organigramas corporativos y mapas de procesos cargados como imágenes (PNG/JPG), convirtiéndolos automáticamente en jerarquías de procesos y puestos de trabajo.
- **Generación estructurada:** Análisis PESTEL, Matrices FODA/DOFA, Caracterización de procesos (entradas, actividades, salidas, indicadores, riesgos), Fichas de indicadores y Guías formativas en Markdown.
- **Análisis de Causa Raíz:** Asistencia en la investigación de No Conformidades empleando metodologías estándar (Ishikawa / 6M y los 5 Porqués).
- **Reparación de esquemas JSON:** Parser especializado (`tryRepairTruncatedJson`) que recupera estructuras JSON interrumpidas por límites de tokens de salida.

---

## Stack Tecnológico Detallado

### Frontend

| Tecnología | Versión | Propósito |
|---|---|---|
| **React** | `18.3.x` | Biblioteca base para interfaces de usuario reactivas |
| **TypeScript** | `5.4.x` | Tipado estático y robustez en todo el cliente |
| **Vite** | `8.0.x` | Empaquetador ultrarrápido y servidor de desarrollo HMR |
| **React Router DOM** | `6.22.x` | Enrutamiento declarativo SPA, layouts anidados y guardias |
| **Recharts** | `3.10.x` | Gráficos estadísticos e interactivos para KPIs y auditorías |
| **SweetAlert2** | `11.26.x` | Cuadros de diálogo, modales y confirmaciones accesibles |
| **Context API** | Nativa | Manejo de estados globales (Auth, Admin, Temas, IA, Layout) |
| **CSS Modules / Custom CSS** | Nativo | Diseño adaptativo, tema corporativo y estilos normalizados (`iso-module.css`) |

### Backend

| Tecnología | Versión | Propósito |
|---|---|---|
| **Node.js** | `>= 22.12.0` | Entorno de ejecución de alto rendimiento |
| **Express** | `4.19.x` | Framework HTTP para la API REST y servicio de la SPA |
| **TypeScript** | `5.4.x` | Tipado estático en controladores, middlewares y servicios |
| **pg (node-postgres)** | `8.11.x` | Driver PostgreSQL con soporte para pool de conexiones y SSL |
| **jsonwebtoken** | `9.0.x` | Generación y verificación criptográfica de tokens JWT |
| **bcryptjs** | `2.4.x` | Hashing seguro de credenciales (Blowfish cipher) |
| **@aws-sdk/client-s3** | `3.1081.x` | Cliente AWS SDK v3 compatible con Cloudflare R2 |
| **@aws-sdk/s3-request-presigner** | `3.1089.x` | Generación de URLs firmadas temporales para archivos |
| **multer** | `2.2.x` | Manejo de peticiones `multipart/form-data` y uploads |
| **pdf-lib** | `1.17.x` | Lectura, inspección y manipulación programática de PDFs |
| **mammoth** | `1.12.x` | Extracción y conversión de documentos Microsoft Word (.docx) |
| **cors & dotenv** | `2.8.x / 16.4.x` | Manejo de políticas CORS y variables de configuración |

### Base de Datos

- **Motor:** PostgreSQL 15+.
- **Estrategia de conexión:** Pool de conexiones gestionado (`Pool` de `pg`) con tamaño máximo configurable, tiempos de espera inactivos (`idleTimeoutMillis: 30000`) y timeouts de conexión (`connectionTimeoutMillis: 5000`).
- **Control de esquemas:** Migraciones SQL secuenciales versionadas en el directorio `migrations/`.

### Infraestructura y DevOps

- **Hosting & Despliegue:** [Railway](https://railway.app/) con builder moderno `railpack`.
- **Healthchecks:** Endpoint `/health` (para balanceadores de carga) y `/api/health` (consumido por la pantalla de login).
- **Procesamiento de imágenes:** Soporte para cargas en base64 de hasta 15 MB para análisis de IA multimodal vía `JSON_BODY_LIMIT`.

---

## Estructura del Proyecto

```
governex/
├── .env.example               # Plantilla versionada de variables de entorno
├── .gitignore                  # Reglas de exclusión para Git
├── check_ts.cjs               # Script utilitario para validación de TypeScript
├── docs/                      # Documentación técnica, seguridad y arquitectura
│   └── PLAN_CORRECCION_SEGURIDAD.md
├── index.html                 # Punto de entrada HTML para Vite SPA
├── migrations/                # Scripts SQL incrementales de base de datos
│   ├── 001_multitenant.sql
│   ├── 004_rbac_extend_resources.sql
│   ├── 005_platform_admins.sql
│   ├── 010_matriz_permisos_definitiva.sql
│   ├── 018_analisis_causa_raiz_ia.sql
│   └── 019_auditorias_iso19011_upgrade.sql
├── package.json               # Dependencias, scripts y configuración del motor Node
├── railway.toml               # Configuración de compilación y despliegue en Railway
├── run_migration.ts           # Ejecutor programático de migraciones en Node/TypeScript
├── schema.sql                 # Esquema DDL consolidado de base de datos
├── tsconfig.json              # Configuración TypeScript del Frontend
├── tsconfig.server.json       # Configuración TypeScript del Backend (CommonJS -> dist-server)
├── vite.config.ts             # Configuración del empaquetador Vite y proxy de desarrollo
└── src/                       # Código fuente de la aplicación
    ├── App.tsx                # Componente raíz de React
    ├── main.tsx               # Bootstrap e hidratación del DOM de React
    ├── db.ts                  # Configuración del pool de conexión PostgreSQL
    ├── index.ts               # Servidor Express, middlewares globales y rutas
    ├── assets/                # Imágenes, logos y recursos estáticos
    ├── components/            # Componentes reutilizables de UI
    │   ├── charts/            # Componentes de visualización y métricas (Recharts)
    │   ├── forms/             # Formularios y selectores reutilizables
    │   ├── ui/                # Botones, tablas, tarjetas, alertas y modales
    │   └── ImpersonationBanner.tsx # Banner para sesión de soporte superadmin
    ├── constants/             # Constantes de negocio y configuración de subidas
    ├── context/               # Proveedores de estado global (Context API)
    │   ├── AuthContext.tsx    # Sesión, usuario activo y tokens
    │   ├── PlatformAdminAuthContext.tsx # Sesión de superadministración
    │   ├── AIAnalysisContext.tsx        # Estados transitorios de inferencia IA
    │   ├── ThemeContext.tsx   # Alternancia de temas visuales
    │   └── LayoutContext.tsx  # Estado de barra lateral y navegación
    ├── hooks/                 # Hooks personalizados de React (`useAuth`, etc.)
    ├── layout/                # Estructuras de diseño base (`MainLayout`, `AuthLayout`)
    ├── middleware/            # Middlewares de Express
    │   ├── activityLogger.ts  # Registro de auditoría transversal en BD
    │   ├── auth.ts            # Verificación de JWT para usuarios de tenants
    │   ├── platformAdminAuth.ts # Verificación de JWT para superadministradores
    │   ├── rateLimit.ts       # Limitador de peticiones para mitigación de ataques
    │   └── rbac.ts            # Control de acceso basado en roles y permisos
    ├── pages/                 # Vistas del frontend organizadas por módulo ISO
    │   ├── auditoria/         # §9.2 Auditorías internas ISO 19011
    │   ├── auth/              # Login, registro y gestión de usuarios
    │   ├── competencias/      # §7.2 Competencias y planes de formación
    │   ├── compras/           # §8.4 Control de procesos y proveedores
    │   ├── comunicacion/      # §7.4 Matriz de comunicación interna/externa
    │   ├── dashboard/         # Tablero general de estado del SGC
    │   ├── diseno-desarrollo/ # §8.3 Diseño y desarrollo de productos/servicios
    │   ├── documentos/        # §7.5 Información documentada y control de cambios
    │   ├── enfoque-cliente/   # §5.1.2 y §9.1.2 Satisfacción del cliente y NPS
    │   ├── indicadores/       # §9.1 Seguimiento, medición y métricas
    │   ├── liberacion-ps/     # §8.6 Liberación de productos y servicios
    │   ├── mejora-continua/   # §10.3 Oportunidades de mejora continua
    │   ├── nc-ac/             # §10.2 No conformidades y acciones correctivas
    │   ├── objetivos-calidad/ # §6.2 Objetivos de la calidad y planificación
    │   ├── planificacion-cambios/ # §6.3 Planificación de los cambios
    │   ├── planificacion-operacion/ # §8.1 Planificación y control operacional
    │   ├── platform-admin/    # Portal global de superadministración
    │   ├── politica/          # §5.2 Política de la calidad
    │   ├── procesos/          # §4.4 Mapa y caracterización de procesos
    │   ├── produccion-servicio/# §8.5 Producción y prestación del servicio
    │   ├── proveedores/       # §8.4 Evaluación y reevaluación de proveedores
    │   ├── recursos/          # §7.1 Recursos, infraestructura y ambiente
    │   ├── requerimientos-ps/ # §8.2 Requisitos para productos y servicios
    │   ├── rev-direccion/     # §9.3 Revisión por la dirección
    │   ├── riesgos/           # §6.1 Acciones para abordar riesgos y oportunidades
    │   ├── roles/             # §5.3 Roles, responsabilidades y autoridades
    │   ├── salidas-nc/        # §8.7 Control de salidas no conformes
    │   └── toma-consciencia/  # §7.3 Toma de consciencia
    ├── routes/                # Enrutadores Express (Backend) y Rutas React (Frontend)
    │   ├── AppRoutes.tsx      # Definición de rutas del cliente y Layouts
    │   ├── ProtectedRoute.tsx # Guardia de autenticación para tenants
    │   ├── PlatformAdminProtectedRoute.tsx # Guardia de superadministración
    │   ├── auth.ts            # Endpoints de autenticación y permisos
    │   ├── gemini.ts          # Integración de endpoints con IA
    │   ├── platformAdmin.ts   # Endpoints de superadministración de plataforma
    │   ├── uploads.ts         # Endpoints para URLs firmadas y streaming
    │   └── [modulos].ts       # 25+ controladores REST para cada sección ISO
    ├── services/              # Clientes de API, integraciones y lógica de negocio
    │   ├── api.ts             # Cliente HTTP frontend (Axios/Fetch con interceptores)
    │   ├── geminiService.ts   # Orquestador del SDK y prompts de Google Gemini
    │   ├── storageService.ts  # Adaptador S3 / Cloudflare R2 con firmas temporales
    │   └── platformAdminApi.ts# Cliente HTTP para superadministradores
    └── styles/                # Hojas de estilo y temas visuales
```

---

## Módulos Funcionales (Alineación ISO 9001:2015)

Governex estructura cada una de sus funciones conforme a la estructura de alto nivel de las normas ISO:

```
+---------------------------------------------------------------------------------------------------+
|                            CICLO PHVA - GESTIÓN DE CALIDAD ISO 9001:2015                          |
+---------------------------------------------------------------------------------------------------+
|  [PLANIFICAR]                                                                                     |
|   • Cláusula 4: Contexto de la Organización                                                       |
|       - Cuestiones internas y externas (Análisis PESTEL y Matrices FODA con IA).                  |
|       - Partes interesadas y alcance del SGC.                                                     |
|       - Mapa de procesos interactivo (Estratégicos, Misionales, Apoyo) y Caracterización.        |
|   • Cláusula 5: Liderazgo                                                                         |
|       - Política de Calidad y difusión corporativa.                                               |
|       - Roles, responsabilidades y autoridades (Matriz de cargos y manuales de funciones).        |
|       - Enfoque al cliente: encuestas de satisfacción, medición de NPS y análisis de sentimiento. |
|   • Cláusula 6: Planificación                                                                     |
|       - Matriz de Riesgos y Oportunidades con niveles de probabilidad e impacto.                  |
|       - Objetivos de Calidad vinculados a indicadores medibles.                                   |
|       - Planificación y gestión de cambios organizacionales.                                      |
+---------------------------------------------------------------------------------------------------+
|  [HACER]                                                                                          |
|   • Cláusula 7: Apoyo                                                                             |
|       - Gestión de Recursos: infraestructura, transporte y ambiente para la operación.            |
|       - Competencias del personal: perfiles, brechas y planes de formación con guías IA.          |
|       - Toma de consciencia y matriz de comunicaciones interna/externa.                           |
|       - Información Documentada: repositorio central con control de versiones y visor protegido.  |
|   • Cláusula 8: Operación                                                                         |
|       - Planificación y control operacional.                                                      |
|       - Requisitos para los productos y servicios (matriz de requisitos legales y cotizaciones).  |
|       - Diseño y desarrollo: fases, entradas, controles, verificaciones y salidas.                |
|       - Compras y evaluación continua de proveedores.                                             |
|       - Producción y prestación del servicio: trazabilidad, fichas y control de recursos.         |
|       - Liberación de productos y servicios con firmas de aceptación.                             |
|       - Tratamiento y disposición de Salidas No Conformes (concesión, desecho, retrabajo).        |
+---------------------------------------------------------------------------------------------------+
|  [VERIFICAR]                                                                                      |
|   • Cláusula 9: Evaluación del Desempeño                                                          |
|       - Seguimiento y medición mediante tablero de Indicadores (KPIs) en tiempo real.             |
|       - Gestión de Auditorías Internas (ISO 19011): planes, programas, listas de chequeo y actas. |
|       - Revisión por la Dirección: consolidación de datos y generación de actas con IA.           |
+---------------------------------------------------------------------------------------------------+
|  [ACTUAR]                                                                                         |
|   • Cláusula 10: Mejora                                                                           |
|       - No Conformidades y Acciones Correctivas (NC/AC).                                          |
|       - Análisis de causa raíz asistido por IA (Diagrama de Ishikawa / 5 Porqués).                |
|       - Seguimiento de planes de acción y evaluación de la eficacia de las correcciones.          |
|       - Gestión de iniciativas de Mejora Continua.                                                |
+---------------------------------------------------------------------------------------------------+
```

---

## Instalación y Configuración Local

### Prerrequisitos

- **Node.js**: Versión `22.12.0` o superior.
- **npm** (v10+), **pnpm** o **yarn**.
- **PostgreSQL**: Instancia local o remota (v14 o superior).
- **Cuenta de Google AI Studio**: Para obtener la `GEMINI_API_KEY`.
- **Bucket Cloudflare R2 / AWS S3**: Claves de acceso para almacenamiento de archivos.

### Variables de Entorno

Copia la plantilla de variables de entorno y ajusta los valores correspondientes:

```bash
cp .env.example .env
```

Configuración de las variables en `.env`:

```env
# ── Servidor ──
NODE_ENV=development
PORT=3001

# ── Base de Datos (PostgreSQL) ──
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/governex
DB_SSL_REJECT_UNAUTHORIZED=false

# ── Autenticación (Generar strings largos y aleatorios) ──
# Generar con: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=tu_clave_secreta_para_usuarios_tenant
PLATFORM_ADMIN_JWT_SECRET=tu_clave_secreta_distinta_para_superadministradores

# ── Inteligencia Artificial: Google Gemini ──
GEMINI_API_KEY=tu_gemini_api_key

# ── Almacenamiento: Cloudflare R2 (API S3) ──
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_KEY=tu_r2_access_key_id
R2_SECRET=tu_r2_secret_access_key
R2_BUCKET=nombre-del-bucket

# ── Seguridad HTTP y Proxy ──
CORS_ORIGINS=http://localhost:5173
TRUST_PROXY=1
JSON_BODY_LIMIT=15mb

# ── Frontend (Vite) ──
# En desarrollo se deja vacío para usar el proxy automático de Vite hacia el backend
VITE_API_URL=
```

### Migraciones de Base de Datos

1. Inicializa la base de datos con la estructura inicial:
```bash
# Puedes cargar schema.sql en tu base de datos PostgreSQL
psql -U usuario -d governex -f schema.sql
```

2. Aplica las migraciones adicionales necesarias usando el script de migración:
```bash
npm run migrate migrations/001_multitenant.sql
npm run migrate migrations/010_matriz_permisos_definitiva.sql
```

### Ejecución en Entorno de Desarrollo

El proyecto cuenta con un script concurrente que arranca simultáneamente el servidor backend en modo observación (`tsx watch`) y el servidor frontend de desarrollo con recarga rápida (`vite`):

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar Backend y Frontend en paralelo
npm run dev
```

- **Frontend (Vite):** `http://localhost:5173`
- **Backend API (Express):** `http://localhost:3001`
- **Proxy automático:** Cualquier petición desde el frontend hacia `/api/*` es reenviada por Vite transparentemente a `http://localhost:3001`.

---

## Scripts Disponibles

En el archivo `package.json` se encuentran definidos los siguientes comandos:

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia simultáneamente backend (`tsx watch`) y frontend (`vite`) mediante `concurrently`. |
| `npm run dev:backend` | Inicia únicamente el servidor Express con recarga en caliente vía `tsx watch src/index.ts`. |
| `npm run dev:frontend` | Inicia únicamente el servidor de desarrollo de Vite para el cliente React. |
| `npm run build` | Compila el backend a CommonJS (`dist-server/`) y empaqueta el frontend optimizado con Vite (`dist/`). |
| `npm start` | Ejecuta el servidor compilado en producción (`node dist-server/index.js`). |
| `npm run migrate` | Ejecuta scripts de migración SQL contra la base de datos (`tsx run_migration.ts <archivo.sql>`). |
| `npm run typecheck` | Ejecuta la verificación de tipos de TypeScript sin emitir archivos (`tsc --noEmit`). |

---

## Despliegue en Producción (Railway)

El repositorio incluye soporte nativo para **Railway** a través de `railway.toml`:

```toml
[build]
builder = "railpack"
buildCommand = "npm run build"

[variables]
RAILPACK_NO_SPA = "1"
RAILPACK_NODE_VERSION = "22.12"

[deploy]
startCommand = "node dist-server/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

### Proceso de Construcción en Producción
1. `tsc -p tsconfig.server.json`: Compila los archivos del backend TypeScript hacia la carpeta `dist-server/` en formato CommonJS.
2. Inyección de `dist-server/package.json` con `{"type": "commonjs"}` para compatibilidad con el entorno Node.
3. `vite build`: Compila, minifica y optimiza la SPA de React en la carpeta `dist/`.
4. El servidor Express sirve los archivos estáticos de `dist/` y atiende las peticiones a la API bajo `/api/*`. Si una ruta no coincide con la API, responde con `dist/index.html` para permitir el enrutamiento del lado del cliente (HTML5 History API).

---

## Seguridad y Buenas Prácticas

Governex incorpora controles de seguridad alineados con **ISO/IEC 27001:2022**:

- **Cabeceras HTTP Defensivas:**
  - `X-Content-Type-Options: nosniff`: Previene ataques de confusión de tipos MIME.
  - `X-Frame-Options: SAMEORIGIN`: Protege contra ataques de clickjacking.
  - `Referrer-Policy: strict-origin-when-cross-origin`: Minimiza la exposición de URLs sensibles en cabeceras Referer.
  - `Strict-Transport-Security (HSTS)`: Fuerza conexiones cifradas por HTTPS durante 180 días en producción.
  - Supresión de cabecera `X-Powered-By` para no divulgar detalles del stack tecnológico.
- **Protección de Archivos Privados:** El acceso a documentos almacenados en Cloudflare R2 requiere autenticación activa y validación del tenant propietario. Se generan URLs firmadas de corta duración, impidiendo la descarga no autorizada mediante adivinanza de rutas.
- **Desinfección XSS:** El contenido formateado generado por IA (Markdown) es sanitizado antes de ser renderizado en las interfaces web.
- **Auditoría de Actividad:** Cada acción relevante (creación, edición, eliminación de registros) se registra de forma inmutable mediante el middleware `logActivityMiddleware`.

---

© 2026 DataSys Latam — Governex. Todos los derechos reservados.
