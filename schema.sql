-- ============================================================
--  GOVERNEX — Esquema Completo de Base de Datos PostgreSQL
--  Sistema de Gestión de Calidad (SGC) basado en ISO 9001:2015
--  Multi-Tenant | RBAC | Platform Admin
-- ============================================================
--  INSTRUCCIONES DE USO
--  ─────────────────────────────────────────────────────────
--  • Fresh install (BD vacía):
--      Ejecutar completo. Los IF NOT EXISTS son inofensivos;
--      la "SECCIÓN DE ACTUALIZACIÓN" al final no hará nada porque
--      todas las columnas/constraints ya existen.
--
--  • Actualización de BD existente (con migraciones previas):
--      Ejecutar completo. Los CREATE TABLE IF NOT EXISTS no
--      recrean tablas existentes; los ALTER TABLE ADD COLUMN
--      IF NOT EXISTS agregan solo lo que falte.
--
--  REQUIERE: PostgreSQL 13+
--  NOTAS:
--    · El bloque CREATE DATABASE es opcional: comentarlo si la BD
--      ya existe o si usas Railway / Supabase (ellos la crean).
--    · El primer tenant (id = 1) se siembra automáticamente.
--      Actualizar tenants.nit / tenants.nombre con datos reales
--      antes de pasar a producción.
-- ============================================================

-- ============================================================
-- (OPCIONAL) Creación de la base de datos
-- Comentar si la BD ya existe o si la gestiona Railway/Supabase.
-- ============================================================
-- CREATE DATABASE governex
--     WITH
--     OWNER = postgres
--     ENCODING = 'UTF8'
--     CONNECTION LIMIT = -1
--     IS_TEMPLATE = False;

-- ============================================================
-- §0 — PLATAFORMA GLOBAL
--     Tablas sin tenant_id: pertenecen a la infraestructura
--     de Governex, no a ninguna empresa cliente en particular.
-- ============================================================

-- Empresas cliente registradas en la plataforma
CREATE TABLE IF NOT EXISTS tenants (
    id             SERIAL       PRIMARY KEY,
    nombre         VARCHAR(200) NOT NULL,
    nit            VARCHAR(30)  NOT NULL,
    estado         VARCHAR(20)  NOT NULL DEFAULT 'Activo'
                   CHECK (estado IN ('Activo', 'Suspendido', 'Cancelado')),
    plan           VARCHAR(30)  NOT NULL DEFAULT 'Standard'
                   CHECK (plan IN ('Standard', 'Pro', 'Enterprise')),
    fecha_creacion TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE tenants IS 'Empresas cliente de Governex. Cada fila es un Tenant aislado.';
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_nit ON tenants (nit);

-- Roles de negocio (catálogo global, igual para todos los tenants)
-- Nombres definitivos: Superusuario / Gestión / Operativo
CREATE TABLE IF NOT EXISTS roles (
    id     SERIAL      PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

-- Super-administradores de plataforma (sin tenant_id por diseño)
CREATE TABLE IF NOT EXISTS platform_admins (
    id            SERIAL       PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    activo        BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE platform_admins IS
    'Staff de Governex con acceso de administración de plataforma '
    '(crear/suspender tenants). Sin relación con TENANTS ni USUARIOS.';

-- Bitácora append-only de acciones sensibles de platform_admins
CREATE TABLE IF NOT EXISTS platform_admin_audit_log (
    id             SERIAL       PRIMARY KEY,
    actor_admin_id INTEGER      REFERENCES platform_admins (id) ON DELETE SET NULL,
    actor_email    VARCHAR(150) NOT NULL,   -- snapshot: se conserva aunque el admin sea borrado
    accion         VARCHAR(50)  NOT NULL,
    entidad_tipo   VARCHAR(30)  NOT NULL,   -- 'tenant' | 'platform_admin'
    entidad_id     VARCHAR(30),
    detalle        JSONB        NOT NULL DEFAULT '{}',
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE platform_admin_audit_log IS
    'Bitácora append-only de acciones sensibles de super-administradores. '
    'actor_email es snapshot para conservar trazabilidad si el autor es desactivado.';
CREATE INDEX IF NOT EXISTS idx_paal_actor   ON platform_admin_audit_log (actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_paal_entidad ON platform_admin_audit_log (entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_paal_creado  ON platform_admin_audit_log (creado_en DESC);

-- Catálogo RBAC: recurso + acción (granularidad por módulo ISO 9001)
CREATE TABLE IF NOT EXISTS permisos (
    id      SERIAL      PRIMARY KEY,
    recurso VARCHAR(60) NOT NULL,
    accion  VARCHAR(20) NOT NULL
            CHECK (accion IN ('leer', 'crear', 'editar', 'eliminar', 'aprobar')),
    CONSTRAINT uq_permisos_recurso_accion UNIQUE (recurso, accion)
);
COMMENT ON TABLE permisos IS 'Catálogo global de permisos (recurso + acción) disponibles en Governex.';

-- Asignación de permisos a roles (N:M)
CREATE TABLE IF NOT EXISTS rol_permisos (
    rol_id     INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permiso_id INTEGER NOT NULL REFERENCES permisos (id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);
COMMENT ON TABLE rol_permisos IS 'Matriz RBAC: qué puede hacer cada rol sobre cada recurso.';

-- ============================================================
-- §4 — CONTEXTO DE LA ORGANIZACIÓN
-- ============================================================

-- §4.4 — Tipos de proceso (catálogo por tenant)
CREATE TABLE IF NOT EXISTS tipos_proceso (
    id        SERIAL      PRIMARY KEY,
    nombre    VARCHAR(50) NOT NULL,
    tenant_id INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_tipos_proceso_tenant_nombre UNIQUE (tenant_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_tipos_proceso_tenant_id ON tipos_proceso (tenant_id);

-- §4.4 — Mapa de Procesos
CREATE TABLE IF NOT EXISTS procesos (
    id            SERIAL       PRIMARY KEY,
    codigo        VARCHAR(20)  NOT NULL,
    nombre        VARCHAR(150) NOT NULL,
    objetivo      TEXT,
    entradas      TEXT,
    salidas       TEXT,
    indicador_kpi TEXT,
    responsable   VARCHAR(100),
    tipo_id       INTEGER      NOT NULL REFERENCES tipos_proceso (id),
    estado        VARCHAR(20)  NOT NULL DEFAULT 'Activo'
                  CHECK (estado IN ('Activo', 'Revisión', 'Inactivo')),
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id     INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_procesos_tenant_codigo UNIQUE (tenant_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_procesos_tenant_id ON procesos (tenant_id);

-- §4.1 — Análisis PESTEL
CREATE TABLE IF NOT EXISTS pestel (
    id          SERIAL      PRIMARY KEY,
    factor      CHAR(1)     NOT NULL CHECK (factor IN ('P', 'E', 'S', 'T', 'A', 'L')),
    categoria   VARCHAR(50) NOT NULL,
    descripcion TEXT        NOT NULL,
    impacto     VARCHAR(10) NOT NULL CHECK (impacto IN ('Alto', 'Medio', 'Bajo')),
    oportunidad BOOLEAN     NOT NULL DEFAULT FALSE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id   INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_pestel_tenant_id ON pestel (tenant_id);

-- §4.1 — Análisis DOFA
CREATE TABLE IF NOT EXISTS dofa (
    id          SERIAL      PRIMARY KEY,
    tipo        VARCHAR(20) NOT NULL
                CHECK (tipo IN ('Fortaleza', 'Oportunidad', 'Debilidad', 'Amenaza')),
    descripcion TEXT        NOT NULL,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id   INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_dofa_tenant_id ON dofa (tenant_id);

-- §4.1 — Datos de la organización (contexto)
CREATE TABLE IF NOT EXISTS datos_empresa (
    id                    SERIAL       PRIMARY KEY,
    nombre_empresa        VARCHAR(200),
    sector                VARCHAR(100),
    tipo_empresa          VARCHAR(50),
    tamano                VARCHAR(50),
    ubicacion             VARCHAR(200),
    ano_fundacion         VARCHAR(10),
    mision                TEXT,
    vision                TEXT,
    politica_calidad      TEXT,
    productos_servicios   TEXT,
    mercado_objetivo      TEXT,
    cantidad_empleados    VARCHAR(20),
    alcance_sgc           TEXT,
    certificaciones       TEXT,
    parte_interesadas     TEXT,
    contexto_narrativo    TEXT,
    pdf_formulario_url    TEXT,
    pdf_formulario_nombre VARCHAR(300),
    organigrama_url       TEXT,
    organigrama_nombre    VARCHAR(300),
    actualizado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id             INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE datos_empresa IS
    'Datos organizacionales del formulario §4.1 — Contexto de la Organización. '
    'Registro único (última versión vigente) por tenant.';
CREATE INDEX IF NOT EXISTS idx_datos_empresa_tenant_id ON datos_empresa (tenant_id);

-- §4.1 / §8.1 — Actividades propias de la empresa
CREATE TABLE IF NOT EXISTS actividades_empresa (
    id          VARCHAR(60)  PRIMARY KEY,   -- id generado en frontend (timestamp+random)
    nombre      VARCHAR(200) NOT NULL,
    proceso     VARCHAR(200),
    responsable VARCHAR(150),
    objetivo    TEXT,
    indicador   TEXT,
    entradas    JSONB        NOT NULL DEFAULT '[]',
    salidas     JSONB        NOT NULL DEFAULT '[]',
    creada_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id   INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_actividades_empresa_tenant_id UNIQUE (tenant_id, id)
);
COMMENT ON TABLE actividades_empresa IS
    'Actividades registradas por el usuario en §4.1/§8.1; cada una puede generar '
    'Riesgo/Oportunidad en §6.1.';
COMMENT ON COLUMN actividades_empresa.entradas IS 'Array JSON de objetos {id, valor}.';
COMMENT ON COLUMN actividades_empresa.salidas  IS 'Array JSON de objetos {id, valor}.';
CREATE INDEX IF NOT EXISTS idx_actividades_empresa_tenant_id ON actividades_empresa (tenant_id);
CREATE INDEX IF NOT EXISTS idx_actividades_empresa_proceso   ON actividades_empresa (proceso);

-- ============================================================
-- §5 — LIDERAZGO
-- ============================================================

-- §5.3 — Usuarios del sistema SGC
-- NOTA: email es ÚNICO A NIVEL GLOBAL (no por tenant) porque el login
-- no recibe selección de tenant (POST /api/auth/login solo recibe email+password).
CREATE TABLE IF NOT EXISTS usuarios (
    id            SERIAL       PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL,
    password_hash TEXT         NOT NULL,
    rol_id        INTEGER      NOT NULL REFERENCES roles (id),
    activo        BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id     INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_usuarios_email UNIQUE (email)
);
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant_id ON usuarios (tenant_id);

-- §5.2 — Política de Calidad
CREATE TABLE IF NOT EXISTS politica_calidad (
    id             SERIAL      PRIMARY KEY,
    version        VARCHAR(10) NOT NULL,
    contenido      TEXT        NOT NULL,
    estado         VARCHAR(20) NOT NULL DEFAULT 'Vigente'
                   CHECK (estado IN ('Vigente', 'Obsoleto', 'Borrador')),
    aprobado_por   INTEGER     REFERENCES usuarios (id),
    fecha_vigencia DATE,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id      INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_politica_calidad_tenant_id ON politica_calidad (tenant_id);

-- §5.2 — Registro de lecturas de la política de calidad
CREATE TABLE IF NOT EXISTS politica_lecturas (
    id             SERIAL       PRIMARY KEY,
    politica_id    INTEGER      NOT NULL REFERENCES politica_calidad (id),
    nombre_persona VARCHAR(100) NOT NULL,
    area           VARCHAR(100),
    fecha_lectura  DATE,
    estado         VARCHAR(30)  NOT NULL DEFAULT 'Pendiente'
                   CHECK (estado IN ('Leído y Aceptado', 'Pendiente')),
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id      INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_politica_lecturas_tenant_id ON politica_lecturas (tenant_id);

-- §5.3 — Matriz de roles, responsabilidades y autoridad
CREATE TABLE IF NOT EXISTS matriz_roles (
    id          SERIAL       PRIMARY KEY,
    proceso     VARCHAR(200) NOT NULL,
    tipo        VARCHAR(20)  NOT NULL CHECK (tipo IN ('estrategico', 'misional', 'apoyo')),
    responsable VARCHAR(150),
    autoridad   TEXT,
    funciones   TEXT,
    recursos    TEXT,
    rendicion   TEXT,
    clausula    VARCHAR(50),
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id   INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE matriz_roles IS
    'ISO 9001:2015 §5.3 — Matriz de roles, responsabilidades y autoridad por proceso.';
CREATE INDEX IF NOT EXISTS idx_matriz_roles_tenant_id ON matriz_roles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_matriz_roles_proceso   ON matriz_roles (proceso);

-- §5.3 — Matriz de cargos con actividades concretas por proceso
CREATE TABLE IF NOT EXISTS matriz_cargos (
    id               SERIAL       PRIMARY KEY,
    proceso          VARCHAR(200) NOT NULL,
    tipo             VARCHAR(20)  NOT NULL CHECK (tipo IN ('estrategico', 'misional', 'apoyo')),
    actividades      JSONB        NOT NULL DEFAULT '[]',
    responsable      VARCHAR(150),
    funciones        TEXT,
    clausula         VARCHAR(20),
    clausula_detalle TEXT,
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id        INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE matriz_cargos IS
    'ISO 9001:2015 §5.3 — Matriz de cargos con actividades concretas por proceso.';
COMMENT ON COLUMN matriz_cargos.actividades IS 'Array JSON de strings con las actividades del cargo.';
CREATE INDEX IF NOT EXISTS idx_matriz_cargos_tenant_id ON matriz_cargos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_matriz_cargos_proceso   ON matriz_cargos (proceso);

-- ============================================================
-- §6 — PLANIFICACIÓN
-- ============================================================

-- §6.1 — Riesgos y Oportunidades
CREATE TABLE IF NOT EXISTS riesgos (
    id             SERIAL      PRIMARY KEY,
    codigo         VARCHAR(30) NOT NULL,
    descripcion    TEXT        NOT NULL,
    proceso_id     INTEGER     REFERENCES procesos (id),
    probabilidad   INTEGER     NOT NULL CHECK (probabilidad BETWEEN 1 AND 5),
    impacto        INTEGER     NOT NULL CHECK (impacto BETWEEN 1 AND 5),
    nivel          INTEGER     GENERATED ALWAYS AS (probabilidad * impacto) STORED,
    estado         VARCHAR(20) NOT NULL DEFAULT 'MONITOREO'
                   CHECK (estado IN ('CRITICO', 'TRATAMIENTO', 'MONITOREO')),
    responsable    VARCHAR(100),
    tipo           VARCHAR(15) NOT NULL DEFAULT 'Riesgo'
                   CHECK (tipo IN ('Riesgo', 'Oportunidad')),
    tratamiento    TEXT,
    fecha_revision DATE,
    fuente         VARCHAR(20),
    categoria      VARCHAR(150),
    actividad_id   VARCHAR(60),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id      INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_riesgos_tenant_codigo UNIQUE (tenant_id, codigo)
);
COMMENT ON COLUMN riesgos.tratamiento    IS 'Descripción del plan de acción / tratamiento del riesgo (ISO 9001 §6.1)';
COMMENT ON COLUMN riesgos.fecha_revision IS 'Próxima fecha programada de revisión del riesgo';
COMMENT ON COLUMN riesgos.fuente         IS 'Origen del riesgo/oportunidad: PESTEL | DOFA | Recursos | ACTIVIDAD';
COMMENT ON COLUMN riesgos.categoria      IS 'Categoría visible en la matriz (ej. "Fortaleza", "Recursos - Producción")';
COMMENT ON COLUMN riesgos.actividad_id   IS 'Referencia a actividades_empresa.id cuando FUENTE = ACTIVIDAD (sin FK física)';
CREATE INDEX IF NOT EXISTS idx_riesgos_tenant_id     ON riesgos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_riesgos_nivel         ON riesgos (nivel);
CREATE INDEX IF NOT EXISTS idx_riesgos_tenant_nivel  ON riesgos (tenant_id, nivel);
CREATE INDEX IF NOT EXISTS idx_riesgos_tenant_estado ON riesgos (tenant_id, estado);

-- §6.1 — Evidencias de riesgos (metadata; archivo real en bucket externo)
CREATE TABLE IF NOT EXISTS riesgo_evidencias (
    id             SERIAL       PRIMARY KEY,
    riesgo_codigo  VARCHAR(30)  NOT NULL,
    nombre_archivo VARCHAR(300) NOT NULL,
    url            TEXT         NOT NULL,
    tipo_mime      VARCHAR(100),
    tamano_bytes   INTEGER,
    subido_por     INTEGER      REFERENCES usuarios (id),
    subido_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id      INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE riesgo_evidencias IS
    'Evidencias de riesgos y oportunidades. El archivo real vive en el bucket externo.';
CREATE INDEX IF NOT EXISTS idx_riesgo_evidencias_tenant_id ON riesgo_evidencias (tenant_id);
CREATE INDEX IF NOT EXISTS idx_riesgo_evidencias_codigo    ON riesgo_evidencias (riesgo_codigo);

-- §6.1 — Overrides de eficacia sobre riesgos derivados dinámicamente
-- PK COMPUESTA (tenant_id, riesgo_codigo): permite multi-tenant con código R-001 por tenant
CREATE TABLE IF NOT EXISTS riesgo_eficacia (
    riesgo_codigo        VARCHAR(30)  NOT NULL,
    eficacia_pct         SMALLINT     NOT NULL DEFAULT 0 CHECK (eficacia_pct BETWEEN 0 AND 100),
    responsable_override VARCHAR(150),
    estado_override      VARCHAR(20)  CHECK (estado_override IN ('CRITICO', 'TRATAMIENTO', 'MONITOREO')),
    actualizado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id            INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    PRIMARY KEY (tenant_id, riesgo_codigo)
);
COMMENT ON TABLE riesgo_eficacia IS
    'Overrides editables por el usuario sobre riesgos derivados dinámicamente '
    '(que no tienen fila propia en la tabla riesgos).';

-- §6.3 — Planificación de los Cambios al SGC
CREATE TABLE IF NOT EXISTS planificacion_cambios (
    id                   SERIAL       PRIMARY KEY,
    codigo               VARCHAR(20),
    categoria            VARCHAR(30)  NOT NULL DEFAULT 'Otro'
                         CHECK (categoria IN (
                             'Tecnológico', 'Proceso', 'Estructura SGC', 'Infraestructura',
                             'Recursos Humanos', 'Normativo / Legal', 'Estratégico', 'Otro'
                         )),
    descripcion          TEXT         NOT NULL,
    justificacion        TEXT         NOT NULL,
    responsable          VARCHAR(100) NOT NULL,
    recursos             TEXT,
    implicaciones        TEXT,
    acciones             TEXT,
    fecha_inicio         DATE,
    fecha_fin            DATE,
    impacto              VARCHAR(10)  NOT NULL DEFAULT 'Medio'
                         CHECK (impacto IN ('Alto', 'Medio', 'Bajo')),
    estado               VARCHAR(20)  NOT NULL DEFAULT 'Planificado'
                         CHECK (estado IN ('Planificado', 'En Ejecución', 'Completado', 'Suspendido', 'Cancelado')),
    procesos_afectados   TEXT,
    documentos_afectados TEXT,
    aprobado_por         VARCHAR(150),
    observaciones        TEXT,
    creado_en            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id            INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_planificacion_cambios_tenant_codigo UNIQUE (tenant_id, codigo)
);
COMMENT ON TABLE planificacion_cambios IS 'ISO 9001:2015 §6.3 — Planificación de los cambios al SGC.';
CREATE INDEX IF NOT EXISTS idx_planificacion_cambios_tenant_id    ON planificacion_cambios (tenant_id);
CREATE INDEX IF NOT EXISTS idx_planificacion_cambios_estado       ON planificacion_cambios (estado);
CREATE INDEX IF NOT EXISTS idx_planificacion_cambios_categoria    ON planificacion_cambios (categoria);
CREATE INDEX IF NOT EXISTS idx_planificacion_cambios_tenant_estado ON planificacion_cambios (tenant_id, estado);

-- §6.2 — Objetivos de Calidad
CREATE TABLE IF NOT EXISTS objetivos_calidad (
    id                        SERIAL       PRIMARY KEY,
    codigo                    VARCHAR(20)  NOT NULL,
    objetivo                  TEXT         NOT NULL,
    proceso_relacionado       VARCHAR(150),
    fuente_riesgo_oportunidad TEXT,                      -- descripción del R/O que lo origina
    tipo_fuente               VARCHAR(20)  NOT NULL DEFAULT 'Riesgo'
                              CHECK (tipo_fuente IN ('Riesgo', 'Oportunidad')),
    accion                    TEXT         NOT NULL,     -- acción para tratar el R/O
    responsable               VARCHAR(100) NOT NULL,
    recursos                  TEXT,
    frecuencia_medicion       VARCHAR(30)  NOT NULL
                              CHECK (frecuencia_medicion IN (
                                  'Mensual', 'Bimestral', 'Trimestral',
                                  'Cuatrimestral', 'Semestral', 'Anual'
                              )),
    meta                      VARCHAR(150) NOT NULL,     -- valor / porcentaje esperado
    indicador                 TEXT         NOT NULL,     -- cómo se va a medir
    fecha_inicio              DATE,
    fecha_fin                 DATE,
    estado                    VARCHAR(30)  NOT NULL DEFAULT 'Pendiente'
                              CHECK (estado IN ('Pendiente', 'En Progreso', 'Cumplido', 'No Cumplido')),
    _riesgo_codigo            VARCHAR(20),               -- referencia lógica al riesgo de origen
    _riesgo_nivel             SMALLINT,
    creado_en                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id                 INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_objetivos_calidad_tenant_codigo UNIQUE (tenant_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_objetivos_calidad_tenant_id    ON objetivos_calidad (tenant_id);
CREATE INDEX IF NOT EXISTS idx_oc_riesgo_codigo               ON objetivos_calidad (_riesgo_codigo);
CREATE INDEX IF NOT EXISTS idx_oc_estado                      ON objetivos_calidad (estado);
CREATE INDEX IF NOT EXISTS idx_oc_tipo_fuente                 ON objetivos_calidad (tipo_fuente);
CREATE INDEX IF NOT EXISTS idx_objetivos_calidad_tenant_estado ON objetivos_calidad (tenant_id, estado);

-- §6.2 — Mediciones periódicas de los objetivos de calidad
CREATE TABLE IF NOT EXISTS objetivos_calidad_mediciones (
    id             SERIAL        PRIMARY KEY,
    objetivo_id    INTEGER       NOT NULL REFERENCES objetivos_calidad (id) ON DELETE CASCADE,
    periodo        VARCHAR(30)   NOT NULL,   -- ej. "Q1 2025", "Sem-1 2025"
    valor          NUMERIC(10,2) NOT NULL,
    estado         VARCHAR(30)   NOT NULL
                   CHECK (estado IN ('Cumplido', 'En Progreso', 'No Cumplido')),
    comentario     TEXT,
    fecha          DATE          NOT NULL DEFAULT CURRENT_DATE,
    registrado_por INTEGER       REFERENCES usuarios (id),
    creado_en      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    tenant_id      INTEGER       NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_ocm_objetivo_id                         ON objetivos_calidad_mediciones (objetivo_id);
CREATE INDEX IF NOT EXISTS idx_objetivos_calidad_mediciones_tenant_id  ON objetivos_calidad_mediciones (tenant_id);

-- ============================================================
-- §7 — SOPORTE
-- ============================================================

-- §7.2 — Personal (recursos humanos de la organización)
CREATE TABLE IF NOT EXISTS personal (
    id            SERIAL       PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    cargo         VARCHAR(100),
    proceso_id    INTEGER      REFERENCES procesos (id),
    usuario_id    INTEGER      REFERENCES usuarios (id),
    email         VARCHAR(150),
    fecha_ingreso DATE,
    activo        BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id     INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON COLUMN personal.email         IS 'Correo electrónico del colaborador';
COMMENT ON COLUMN personal.fecha_ingreso IS 'Fecha de ingreso a la organización';
CREATE INDEX IF NOT EXISTS idx_personal_tenant_id ON personal (tenant_id);

-- §7.2 — Evaluaciones de competencia del personal
CREATE TABLE IF NOT EXISTS evaluaciones_competencia (
    id           SERIAL      PRIMARY KEY,
    personal_id  INTEGER     NOT NULL REFERENCES personal (id),
    brecha_pct   INTEGER     NOT NULL DEFAULT 0 CHECK (brecha_pct BETWEEN 0 AND 100),
    estado       VARCHAR(20) NOT NULL
                 CHECK (estado IN ('Competente', 'En Formación', 'Brecha Crítica')),
    evaluado_por INTEGER     REFERENCES usuarios (id),
    fecha        DATE        NOT NULL DEFAULT CURRENT_DATE,
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id    INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_competencia_tenant_id ON evaluaciones_competencia (tenant_id);

-- §7.2 — Plan de Formación
CREATE TABLE IF NOT EXISTS plan_formacion (
    id        SERIAL       PRIMARY KEY,
    tema      VARCHAR(200) NOT NULL,
    fecha     DATE,
    estado    VARCHAR(20)  NOT NULL DEFAULT 'Planificado'
              CHECK (estado IN ('Planificado', 'En Ejecución', 'Completado', 'Cancelado')),
    creado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_plan_formacion_tenant_id ON plan_formacion (tenant_id);

-- §7.2 — Asistentes al plan de formación
CREATE TABLE IF NOT EXISTS formacion_asistentes (
    plan_id     INTEGER NOT NULL REFERENCES plan_formacion (id),
    personal_id INTEGER NOT NULL REFERENCES personal (id),
    tenant_id   INTEGER NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    PRIMARY KEY (plan_id, personal_id)
);
CREATE INDEX IF NOT EXISTS idx_formacion_asistentes_tenant_id ON formacion_asistentes (tenant_id);

-- §7.3 — Toma de Consciencia
CREATE TABLE IF NOT EXISTS toma_consciencia (
    id          SERIAL       PRIMARY KEY,
    colaborador VARCHAR(100) NOT NULL,
    cargo       VARCHAR(100),
    proceso     VARCHAR(150),
    tema        VARCHAR(200) NOT NULL,
    fecha       DATE,
    modalidad   VARCHAR(20)  NOT NULL
                CHECK (modalidad IN ('Capacitación', 'Comunicado', 'Taller', 'Inducción', 'E-learning')),
    evidencia   TEXT,
    estado      VARCHAR(20)  NOT NULL DEFAULT 'Pendiente'
                CHECK (estado IN ('Pendiente', 'Completado', 'Vencido')),
    personal_id INTEGER      REFERENCES personal (id),
    creado_por  INTEGER      REFERENCES usuarios (id),
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id   INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE toma_consciencia IS 'ISO 9001:2015 §7.3 — Toma de consciencia del personal sobre el SGC.';
CREATE INDEX IF NOT EXISTS idx_toma_consciencia_tenant_id     ON toma_consciencia (tenant_id);
CREATE INDEX IF NOT EXISTS idx_toma_consciencia_tenant_estado ON toma_consciencia (tenant_id, estado);

-- §7.4 — Comunicaciones internas y externas
CREATE TABLE IF NOT EXISTS comunicaciones (
    id         SERIAL       PRIMARY KEY,
    que        VARCHAR(200) NOT NULL,
    cuando     VARCHAR(200),
    quien      VARCHAR(100),
    a_quien    VARCHAR(200),
    como       VARCHAR(200),
    tipo       VARCHAR(10)  NOT NULL DEFAULT 'Interna'
               CHECK (tipo IN ('Interna', 'Externa')),
    estado     VARCHAR(20)  NOT NULL DEFAULT 'Activo'
               CHECK (estado IN ('Activo', 'Revisión', 'Inactivo')),
    creado_por INTEGER      REFERENCES usuarios (id),
    creado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id  INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE comunicaciones IS 'ISO 9001:2015 §7.4 — Matriz de comunicaciones internas y externas.';
CREATE INDEX IF NOT EXISTS idx_comunicaciones_tenant_id   ON comunicaciones (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comunicaciones_tipo        ON comunicaciones (tipo);
CREATE INDEX IF NOT EXISTS idx_comunicaciones_tenant_tipo ON comunicaciones (tenant_id, tipo);

-- §7.5 — Documentos del SGC
CREATE TABLE IF NOT EXISTS documentos (
    id          SERIAL       PRIMARY KEY,
    codigo      VARCHAR(20)  NOT NULL,
    titulo      VARCHAR(200) NOT NULL,
    tipo        VARCHAR(20)  NOT NULL
                CHECK (tipo IN ('Manual', 'Política', 'Proceso', 'Instrucción', 'Formato', 'Otro')),
    proceso_id  INTEGER      REFERENCES procesos (id),
    version     VARCHAR(10)  NOT NULL,
    estado      VARCHAR(20)  NOT NULL DEFAULT 'Borrador'
                CHECK (estado IN ('Aprobado', 'En Revision', 'Borrador', 'Obsoleto')),
    archivo_url TEXT,
    hash_sha256 TEXT,
    creado_por  INTEGER      REFERENCES usuarios (id),
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id   INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_documentos_tenant_codigo UNIQUE (tenant_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_documentos_tenant_id     ON documentos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_documentos_estado        ON documentos (estado);
CREATE INDEX IF NOT EXISTS idx_documentos_tenant_estado ON documentos (tenant_id, estado);

-- §7.5 — Versiones de documentos
CREATE TABLE IF NOT EXISTS documento_versiones (
    id           SERIAL      PRIMARY KEY,
    documento_id INTEGER     NOT NULL REFERENCES documentos (id),
    version      VARCHAR(10) NOT NULL,
    descripcion  TEXT,
    archivo_url  TEXT,
    hash_sha256  TEXT,
    autor_id     INTEGER     REFERENCES usuarios (id),
    fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id    INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_documento_versiones_tenant_id ON documento_versiones (tenant_id);

-- §7.5 — Aprobaciones de documentos (flujo de aprobación)
CREATE TABLE IF NOT EXISTS documento_aprobaciones (
    id           SERIAL      PRIMARY KEY,
    documento_id INTEGER     NOT NULL REFERENCES documentos (id),
    aprobador_id INTEGER     NOT NULL REFERENCES usuarios (id),
    paso         VARCHAR(50) NOT NULL,
    resultado    VARCHAR(20) CHECK (resultado IN ('Aprobado', 'Rechazado', 'Pendiente')),
    comentarios  TEXT,
    fecha        TIMESTAMPTZ,
    tenant_id    INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_documento_aprobaciones_tenant_id ON documento_aprobaciones (tenant_id);

-- §7.1 — Matriz de recursos y ambiente de trabajo
CREATE TABLE IF NOT EXISTS matriz_recursos (
    id                    SERIAL       PRIMARY KEY,
    proceso               VARCHAR(200) NOT NULL,
    n_personas            TEXT,
    infraestructura       TEXT,
    hardware_software     TEXT,
    transporte            TEXT,
    ambiente_social       TEXT,
    ambiente_psicologico  TEXT,
    ambiente_fisico       TEXT,
    var_social            SMALLINT     CHECK (var_social BETWEEN 1 AND 5),
    var_psicologica       SMALLINT     CHECK (var_psicologica BETWEEN 1 AND 5),
    var_fisica            SMALLINT     CHECK (var_fisica BETWEEN 1 AND 5),
    calificacion_promedio NUMERIC(3,1),
    nivel_riesgo_verde    VARCHAR(20),
    accion_requerida      TEXT,
    recurso_evaluado      TEXT,
    hallazgo              TEXT,
    riesgo                TEXT,
    impacto               VARCHAR(20),
    probabilidad          VARCHAR(20),
    nivel_riesgo_azul     VARCHAR(20),
    oportunidad           TEXT,
    accion                TEXT,
    creado_en             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id             INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE matriz_recursos IS
    'ISO 9001:2015 §7.1 — Matriz de recursos, ambiente de trabajo y riesgos/oportunidades derivados.';
CREATE INDEX IF NOT EXISTS idx_matriz_recursos_tenant_id ON matriz_recursos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_matriz_recursos_proceso   ON matriz_recursos (proceso);

-- §8.1 / §4.4 — Mapa de Procedimiento (generado con IA a partir de matrizRoles)
CREATE TABLE IF NOT EXISTS mapa_procedimiento (
    id             SERIAL      PRIMARY KEY,
    proceso        TEXT        NOT NULL,
    tipo           TEXT        NOT NULL DEFAULT 'misional'
                   CHECK (tipo IN ('estrategico', 'misional', 'apoyo')),
    responsable    TEXT,
    clausula       TEXT,
    funciones      TEXT,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id      INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mapa_procedimiento_tenant ON mapa_procedimiento (tenant_id);

-- §8.1 / §4.4 — Manual de Procedimiento (ficha técnica completa por proceso)
CREATE TABLE IF NOT EXISTS manual_procedimiento (
    id             SERIAL      PRIMARY KEY,
    codigo         TEXT        NOT NULL,
    proceso        TEXT        NOT NULL,
    objetivo       TEXT,
    entradas       TEXT,
    salidas        TEXT,
    indicador      TEXT,
    responsable    TEXT,
    estado         TEXT        NOT NULL DEFAULT 'Activo',
    clausula       TEXT,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id      INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_manual_procedimiento_tenant ON manual_procedimiento (tenant_id);

-- ============================================================
-- §8 — OPERACIÓN
-- ============================================================

-- §8.1 — Planes de Operación y Control Operacional
CREATE TABLE IF NOT EXISTS planes_operacion (
    id             SERIAL       PRIMARY KEY,
    proceso        VARCHAR(200) NOT NULL,
    objetivo       TEXT         NOT NULL,
    criterios      TEXT,
    recursos       TEXT,
    controles      TEXT,
    responsable    VARCHAR(100),
    fecha_revision DATE,
    estado         VARCHAR(20)  NOT NULL DEFAULT 'Vigente'
                   CHECK (estado IN ('Vigente', 'En revisión', 'Obsoleto')),
    creado_por     INTEGER      REFERENCES usuarios (id),
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id      INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE planes_operacion IS 'ISO 9001:2015 §8.1 — Planificación y control operacional.';
CREATE INDEX IF NOT EXISTS idx_planes_operacion_tenant_id     ON planes_operacion (tenant_id);
CREATE INDEX IF NOT EXISTS idx_planes_operacion_estado        ON planes_operacion (estado);
CREATE INDEX IF NOT EXISTS idx_planes_operacion_tenant_estado ON planes_operacion (tenant_id, estado);

-- §8.2 — Requerimientos de Productos y Servicios
CREATE TABLE IF NOT EXISTS requerimientos_ps (
    id                 SERIAL       PRIMARY KEY,
    cliente            VARCHAR(200) NOT NULL,
    producto_servicio  VARCHAR(200) NOT NULL,
    requisitos_cliente TEXT,
    requisitos_legales TEXT,
    requisitos_org     TEXT,
    fecha_revision     DATE,
    revisado_por       VARCHAR(100),
    estado             VARCHAR(20)  NOT NULL DEFAULT 'Pendiente'
                       CHECK (estado IN ('Aprobado', 'Pendiente', 'Rechazado')),
    cotizacion         TEXT,
    aprobacion_interna TEXT,
    matriz_legal       TEXT,
    url_contrato       TEXT,
    ficha_tecnica_id   VARCHAR(60),
    generado_con_ia    BOOLEAN      NOT NULL DEFAULT FALSE,
    creado_por         INTEGER      REFERENCES usuarios (id),
    creado_en          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id          INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE requerimientos_ps IS
    'ISO 9001:2015 §8.2 — Determinación y revisión de requisitos de productos/servicios.';
CREATE INDEX IF NOT EXISTS idx_requerimientos_ps_tenant_id     ON requerimientos_ps (tenant_id);
CREATE INDEX IF NOT EXISTS idx_requerimientos_ps_estado        ON requerimientos_ps (estado);
CREATE INDEX IF NOT EXISTS idx_requerimientos_ps_tenant_estado ON requerimientos_ps (tenant_id, estado);

-- §8.2 — Fichas Técnicas de Productos/Servicios (generales y educativas)
-- id generado en frontend (FT-timestamp). PK global + unique compuesto por tenant.
CREATE TABLE IF NOT EXISTS fichas_tecnicas_ps (
    id                       VARCHAR(60)  PRIMARY KEY,
    tipo                     VARCHAR(20)  NOT NULL CHECK (tipo IN ('educativa', 'general')),
    generada_con_ia          BOOLEAN      NOT NULL DEFAULT TRUE,
    cliente                  VARCHAR(200),
    producto_servicio        VARCHAR(200),
    version                  VARCHAR(20)  DEFAULT '1.0',
    fecha_elaboracion        DATE,
    elaborado_por            VARCHAR(150),
    aprobado_por             VARCHAR(150),
    estado                   VARCHAR(20)  NOT NULL DEFAULT 'En revisión'
                             CHECK (estado IN ('Vigente', 'En revisión', 'Obsoleta')),
    -- Campos ficha general
    descripcion              TEXT,
    especificaciones_tecnicas TEXT,
    normas_aplicables        TEXT,
    condiciones_uso          TEXT,
    -- Campos ficha educativa
    area_asignatura          VARCHAR(200),
    objetivo_general         TEXT,
    competencias             TEXT,
    unidades_curriculares    JSONB        NOT NULL DEFAULT '[]',
    total_horas_semana       INTEGER      DEFAULT 0,
    observaciones            TEXT,
    creado_por               INTEGER      REFERENCES usuarios (id),
    creado_en                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id                INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_fichas_tecnicas_ps_tenant_id UNIQUE (tenant_id, id)
);
COMMENT ON TABLE fichas_tecnicas_ps IS
    'ISO 9001:2015 §8.2 — Fichas técnicas de productos/servicios (generales o educativas con cursos).';
COMMENT ON COLUMN fichas_tecnicas_ps.unidades_curriculares IS
    'Array JSON de objetos {nombre, nivelCurso, gradoAnio, intensidadHoraria, periodo, docente, '
    'contenidoProgramatico, metodologia, recursosMateriales, criteriosEvaluacion, logros}. '
    'Solo aplica si tipo=educativa.';
CREATE INDEX IF NOT EXISTS idx_fichas_tecnicas_ps_tipo      ON fichas_tecnicas_ps (tipo);
CREATE INDEX IF NOT EXISTS idx_fichas_tecnicas_ps_tenant_id ON fichas_tecnicas_ps (tenant_id);

-- §8.4 — Fichas Técnicas de insumos/productos a comprar
CREATE TABLE IF NOT EXISTS fichas_tecnicas_compra (
    id                    SERIAL       PRIMARY KEY,
    nombre                VARCHAR(200) NOT NULL,
    descripcion           TEXT,
    especificaciones      TEXT,
    unidad_medida         VARCHAR(50),
    cantidad_minima       VARCHAR(50),
    documentos_requeridos JSONB        NOT NULL DEFAULT '[]',
    responsable           VARCHAR(150),
    fecha_creacion        DATE         NOT NULL DEFAULT CURRENT_DATE,
    creado_por            INTEGER      REFERENCES usuarios (id),
    creado_en             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id             INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE fichas_tecnicas_compra IS 'Fichas técnicas de insumos/productos a comprar (§8.4).';
COMMENT ON COLUMN fichas_tecnicas_compra.documentos_requeridos IS
    'Array JSON [{ "nombre": "Certificado.pdf", "url": "https://.../key" }]. '
    'La URL apunta al bucket externo (R2/S3).';
CREATE INDEX IF NOT EXISTS idx_fichas_tecnicas_compra_tenant_id ON fichas_tecnicas_compra (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fichas_tecnicas_nombre           ON fichas_tecnicas_compra (nombre);

-- §8.3 — Proyectos de Diseño y Desarrollo
CREATE TABLE IF NOT EXISTS proyectos_diseno (
    id            SERIAL       PRIMARY KEY,
    nombre        VARCHAR(200) NOT NULL,
    cliente       VARCHAR(200),
    entradas      TEXT,
    salidas       TEXT,
    responsable   VARCHAR(100),
    fecha_inicio  DATE,
    fecha_entrega DATE,
    etapa         VARCHAR(30)  NOT NULL DEFAULT 'Planificación'
                  CHECK (etapa IN ('Planificación', 'Desarrollo', 'Verificación', 'Validación', 'Completado')),
    estado        VARCHAR(20)  NOT NULL DEFAULT 'En tiempo'
                  CHECK (estado IN ('En tiempo', 'En riesgo', 'Retrasado')),
    control       TEXT,          -- §8.3 control/verificación de diseño
    actividad_id  VARCHAR(60),   -- referencia a caracterización o actividad de origen
    creado_por    INTEGER      REFERENCES usuarios (id),
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id     INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE proyectos_diseno IS 'ISO 9001:2015 §8.3 — Diseño y desarrollo de productos y servicios.';
COMMENT ON COLUMN proyectos_diseno.control      IS 'Texto de control/verificación de diseño, generado con IA o manual.';
COMMENT ON COLUMN proyectos_diseno.actividad_id IS 'Referencia al código de caracterización o id de actividad que originó el proyecto.';
CREATE INDEX IF NOT EXISTS idx_proyectos_diseno_tenant_id    ON proyectos_diseno (tenant_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_diseno_etapa        ON proyectos_diseno (etapa);
CREATE INDEX IF NOT EXISTS idx_proyectos_diseno_tenant_etapa ON proyectos_diseno (tenant_id, etapa);

-- §8.4 — Proveedores externos
CREATE TABLE IF NOT EXISTS proveedores (
    id                      SERIAL       PRIMARY KEY,
    nit                     VARCHAR(30)  NOT NULL,
    razon                   VARCHAR(200) NOT NULL,
    tipo                    VARCHAR(50),
    estado                  VARCHAR(20)  NOT NULL DEFAULT 'Aprobado'
                            CHECK (estado IN ('Aprobado', 'Condicional', 'Suspendido')),
    prox_eval               DATE,
    periodicidad_evaluacion VARCHAR(20)  NOT NULL DEFAULT 'Anual'
                            CHECK (periodicidad_evaluacion IN ('Semestral', 'Anual')),
    email                   VARCHAR(150),
    creado_en               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id               INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_proveedores_tenant_nit UNIQUE (tenant_id, nit)
);
COMMENT ON COLUMN proveedores.periodicidad_evaluacion IS 'Frecuencia de re-evaluación (Semestral | Anual)';
COMMENT ON COLUMN proveedores.email                   IS 'Correo de contacto del proveedor';
CREATE INDEX IF NOT EXISTS idx_proveedores_tenant_id ON proveedores (tenant_id);

-- §8.4 — Evaluaciones periódicas de proveedores (por NIT/proveedor general)
CREATE TABLE IF NOT EXISTS proveedor_evaluaciones (
    id               SERIAL       PRIMARY KEY,
    proveedor_id     INTEGER      NOT NULL REFERENCES proveedores (id),
    evaluador        VARCHAR(100),
    calidad          INTEGER      NOT NULL CHECK (calidad BETWEEN 0 AND 100),
    entrega          INTEGER      NOT NULL CHECK (entrega BETWEEN 0 AND 100),
    precio           INTEGER      NOT NULL CHECK (precio BETWEEN 0 AND 100),
    servicio         INTEGER      NOT NULL CHECK (servicio BETWEEN 0 AND 100),
    total            INTEGER      GENERATED ALWAYS AS ((calidad + entrega + precio + servicio) / 4) STORED,
    fecha            DATE         NOT NULL DEFAULT CURRENT_DATE,
    precio_mercado   VARCHAR(50),  -- precio referencia de mercado (puede incluir texto)
    precio_proveedor VARCHAR(50),  -- precio real cotizado por el proveedor
    debilidades      TEXT,
    generada_con_ia  BOOLEAN      DEFAULT FALSE,
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id        INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON COLUMN proveedor_evaluaciones.precio_mercado   IS 'Precio de referencia de mercado para comparativa (opcional)';
COMMENT ON COLUMN proveedor_evaluaciones.precio_proveedor IS 'Precio real cotizado por el proveedor (opcional)';
COMMENT ON COLUMN proveedor_evaluaciones.debilidades      IS 'Debilidades o comentarios cualitativos de la evaluación';
COMMENT ON COLUMN proveedor_evaluaciones.generada_con_ia  IS 'Indica si la evaluación fue generada con asistencia de IA (Gemini)';
CREATE INDEX IF NOT EXISTS idx_proveedor_evaluaciones_tenant_id    ON proveedor_evaluaciones (tenant_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_eval_fecha                ON proveedor_evaluaciones (fecha);
CREATE INDEX IF NOT EXISTS idx_proveedor_evaluaciones_tenant_fecha ON proveedor_evaluaciones (tenant_id, fecha);

-- §8.4 — Órdenes de Compra
CREATE TABLE IF NOT EXISTS ordenes_compra (
    id            SERIAL       PRIMARY KEY,
    proveedor_id  INTEGER      REFERENCES proveedores (id),
    proveedor     VARCHAR(200) NOT NULL,
    producto      VARCHAR(200) NOT NULL,
    cantidad      VARCHAR(50),
    unidad        VARCHAR(50),
    precio_unit   VARCHAR(50),
    total         VARCHAR(50),
    fecha_emision DATE,
    fecha_entrega DATE,
    requisitos    TEXT,
    responsable   VARCHAR(100),
    estado        VARCHAR(30)  NOT NULL DEFAULT 'Pendiente'
                  CHECK (estado IN ('Pendiente', 'Recibido conforme', 'Recibido no conforme', 'Cancelado')),
    observaciones TEXT,
    creado_por    INTEGER      REFERENCES usuarios (id),
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id     INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE ordenes_compra IS
    'ISO 9001:2015 §8.4 — Control de productos y servicios suministrados externamente.';
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_tenant_id     ON ordenes_compra (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_estado        ON ordenes_compra (estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_tenant_estado ON ordenes_compra (tenant_id, estado);

-- §8.4 — Evaluaciones por orden de compra específica
-- (distinta de proveedor_evaluaciones, que es por NIT/proveedor general)
CREATE TABLE IF NOT EXISTS evaluaciones_orden_compra (
    id                  SERIAL      PRIMARY KEY,
    orden_id            INTEGER     NOT NULL REFERENCES ordenes_compra (id) ON DELETE CASCADE,
    proveedor           VARCHAR(200) NOT NULL,
    producto            VARCHAR(200) NOT NULL,
    calidad             SMALLINT    NOT NULL CHECK (calidad BETWEEN 1 AND 5),
    tiempo_entrega      VARCHAR(20) NOT NULL CHECK (tiempo_entrega IN ('Cumplió', 'No cumplió')),
    dias_retraso        SMALLINT    NOT NULL DEFAULT 0,
    precio              VARCHAR(20) NOT NULL CHECK (precio IN ('Igual', 'Mayor', 'Menor')),
    capacidad_respuesta SMALLINT    NOT NULL CHECK (capacidad_respuesta BETWEEN 1 AND 5),
    puntaje_global      SMALLINT    NOT NULL CHECK (puntaje_global BETWEEN 0 AND 100),
    observaciones       TEXT,
    fecha_evaluacion    DATE        NOT NULL DEFAULT CURRENT_DATE,
    creado_por          INTEGER     REFERENCES usuarios (id),
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id           INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE evaluaciones_orden_compra IS
    'Evaluación de proveedor asociada a una orden de compra específica (§8.4).';
CREATE INDEX IF NOT EXISTS idx_evaluaciones_orden_compra_tenant_id ON evaluaciones_orden_compra (tenant_id);
CREATE INDEX IF NOT EXISTS idx_eval_orden_compra_orden_id          ON evaluaciones_orden_compra (orden_id);

-- §8.5 — Órdenes de Producción / Provisión del Servicio
CREATE TABLE IF NOT EXISTS ordenes_produccion (
    id                       SERIAL       PRIMARY KEY,
    codigo                   VARCHAR(30)  NOT NULL,
    producto_servicio        VARCHAR(200) NOT NULL,
    cliente                  VARCHAR(200),
    cantidad                 VARCHAR(50),
    instruccion_trabajo      VARCHAR(50),
    equipos                  TEXT,
    responsable              VARCHAR(100),
    fecha_inicio             DATE,
    fecha_entrega            DATE,
    etapa                    VARCHAR(30)  NOT NULL DEFAULT 'Programado'
                             CHECK (etapa IN ('Programado', 'En proceso', 'Control de calidad', 'Entregado')),
    conformidad              VARCHAR(30)  NOT NULL DEFAULT 'Pendiente inspección'
                             CHECK (conformidad IN ('Conforme', 'No conforme', 'Pendiente inspección')),
    -- §8.5.1 a) Ficha técnica e instructivo
    ficha_tecnica_id         VARCHAR(60)  REFERENCES fichas_tecnicas_ps (id) ON DELETE SET NULL,
    documento_instructivo_id INTEGER      REFERENCES documentos (id) ON DELETE SET NULL,
    -- §8.5.1 c/d) Infraestructura y ambiente
    infraestructura_ambiente TEXT,
    -- §8.5.1 e) Personal competente asignado
    personal_asignado        JSONB        NOT NULL DEFAULT '[]',
    -- §8.5.5 b) Postventa
    seguimiento_postventa    TEXT,
    fecha_postventa          DATE,
    creado_por               INTEGER      REFERENCES usuarios (id),
    creado_en                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id                INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_ordenes_produccion_tenant_codigo UNIQUE (tenant_id, codigo)
);
COMMENT ON TABLE ordenes_produccion IS 'ISO 9001:2015 §8.5 — Producción y provisión del servicio.';
COMMENT ON COLUMN ordenes_produccion.ficha_tecnica_id         IS '§8.5.1 a) — ficha técnica del producto/servicio terminado.';
COMMENT ON COLUMN ordenes_produccion.documento_instructivo_id IS '§8.5.1 a) — instructivo de trabajo documentado (tipo Instrucción).';
COMMENT ON COLUMN ordenes_produccion.infraestructura_ambiente IS '§8.5.1 c)/d) — infraestructura y ambiente apropiados.';
COMMENT ON COLUMN ordenes_produccion.personal_asignado        IS '§8.5.1 e)/§7.2 — [{id, nombre, cargo}] del personal competente asignado.';
COMMENT ON COLUMN ordenes_produccion.seguimiento_postventa    IS '§8.5.5 b) — actividades de seguimiento posterior a la entrega.';
CREATE INDEX IF NOT EXISTS idx_ordenes_produccion_tenant_id    ON ordenes_produccion (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_produccion_etapa        ON ordenes_produccion (etapa);
CREATE INDEX IF NOT EXISTS idx_ordenes_prod_conformidad        ON ordenes_produccion (conformidad);
CREATE INDEX IF NOT EXISTS idx_ordenes_produccion_tenant_etapa ON ordenes_produccion (tenant_id, etapa);

-- §8.5.1 b) — Puntos de control y medición durante la producción
CREATE TABLE IF NOT EXISTS puntos_control_produccion (
    id                   SERIAL       PRIMARY KEY,
    orden_produccion_id  INTEGER      NOT NULL REFERENCES ordenes_produccion (id) ON DELETE CASCADE,
    punto_control        VARCHAR(150) NOT NULL,
    parametro            VARCHAR(150),
    criterio_aceptacion  TEXT,
    valor_medido         VARCHAR(100),
    unidad               VARCHAR(30),
    instrumento_medicion VARCHAR(150),
    resultado            VARCHAR(20)  NOT NULL DEFAULT 'Pendiente'
                         CHECK (resultado IN ('Conforme', 'No conforme', 'Pendiente')),
    responsable          VARCHAR(100),
    fecha                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    observaciones        TEXT,
    registrado_por       INTEGER      REFERENCES usuarios (id),
    creado_en            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id            INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE CASCADE
);
COMMENT ON TABLE puntos_control_produccion IS
    'ISO 9001:2015 §8.5.1 b) — Seguimiento y medición durante la producción/prestación del servicio.';
CREATE INDEX IF NOT EXISTS idx_puntos_control_orden  ON puntos_control_produccion (orden_produccion_id);
CREATE INDEX IF NOT EXISTS idx_puntos_control_tenant ON puntos_control_produccion (tenant_id);
CREATE INDEX IF NOT EXISTS idx_puntos_control_result ON puntos_control_produccion (resultado);

-- §8.6 — Liberación de Productos y Servicios
CREATE TABLE IF NOT EXISTS liberaciones_ps (
    id                   SERIAL       PRIMARY KEY,
    codigo_op            VARCHAR(30),
    orden_produccion_id  INTEGER      REFERENCES ordenes_produccion (id),
    producto_servicio    VARCHAR(200) NOT NULL,
    cliente              VARCHAR(200),
    criterios_aceptacion TEXT,
    inspeccion_realizada TEXT,
    resultados           TEXT,
    autorizado_por       VARCHAR(100),
    fecha                DATE         NOT NULL DEFAULT CURRENT_DATE,
    decision             VARCHAR(20)  NOT NULL DEFAULT 'Liberado'
                         CHECK (decision IN ('Liberado', 'Retenido', 'Rechazado')),
    observaciones        TEXT,
    creado_por           INTEGER      REFERENCES usuarios (id),
    creado_en            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id            INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE liberaciones_ps IS 'ISO 9001:2015 §8.6 — Liberación de productos y servicios.';
CREATE INDEX IF NOT EXISTS idx_liberaciones_ps_tenant_id       ON liberaciones_ps (tenant_id);
CREATE INDEX IF NOT EXISTS idx_liberaciones_decision           ON liberaciones_ps (decision);
CREATE INDEX IF NOT EXISTS idx_liberaciones_ps_tenant_decision ON liberaciones_ps (tenant_id, decision);

-- ============================================================
-- §9 — EVALUACIÓN DEL DESEMPEÑO
-- ============================================================

-- §9.1 — Indicadores de desempeño de procesos
CREATE TABLE IF NOT EXISTS indicadores (
    id         SERIAL       PRIMARY KEY,
    codigo     VARCHAR(20)  NOT NULL,
    titulo     VARCHAR(200) NOT NULL,
    proceso_id INTEGER      REFERENCES procesos (id),
    frecuencia VARCHAR(20)  NOT NULL
               CHECK (frecuencia IN ('Diaria', 'Semanal', 'Mensual', 'Trimestral', 'Semestral', 'Anual')),
    meta       VARCHAR(50)  NOT NULL,
    activo     BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id  INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_indicadores_tenant_codigo UNIQUE (tenant_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_indicadores_tenant_id     ON indicadores (tenant_id);
CREATE INDEX IF NOT EXISTS idx_indicadores_tenant_activo ON indicadores (tenant_id, activo);

-- §9.1 — Mediciones de indicadores
CREATE TABLE IF NOT EXISTS indicador_mediciones (
    id             SERIAL      PRIMARY KEY,
    indicador_id   INTEGER     NOT NULL REFERENCES indicadores (id),
    valor          VARCHAR(50) NOT NULL,
    tendencia      VARCHAR(10) CHECK (tendencia IN ('up', 'down', 'stable')),
    estado         VARCHAR(20) NOT NULL CHECK (estado IN ('Cumple', 'Riesgo', 'No Cumple')),
    fecha          DATE        NOT NULL DEFAULT CURRENT_DATE,
    registrado_por INTEGER     REFERENCES usuarios (id),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id      INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_indicador_mediciones_tenant_id    ON indicador_mediciones (tenant_id);
CREATE INDEX IF NOT EXISTS idx_indicador_med_fecha               ON indicador_mediciones (fecha);
CREATE INDEX IF NOT EXISTS idx_indicador_mediciones_tenant_fecha ON indicador_mediciones (tenant_id, fecha);

-- §9.2 — Programas de Auditoría (anuales)
CREATE TABLE IF NOT EXISTS programas_auditoria (
    id         SERIAL      PRIMARY KEY,
    anio       INTEGER     NOT NULL,
    objetivo   TEXT        NOT NULL,
    duracion   VARCHAR(50),
    estado     VARCHAR(20) NOT NULL DEFAULT 'En Ejecución'
               CHECK (estado IN ('En Ejecución', 'Cerrado', 'Planificado')),
    avance_pct INTEGER     NOT NULL DEFAULT 0 CHECK (avance_pct BETWEEN 0 AND 100),
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id  INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_programas_auditoria_tenant_anio UNIQUE (tenant_id, anio)
);
CREATE INDEX IF NOT EXISTS idx_programas_auditoria_tenant_id ON programas_auditoria (tenant_id);

-- §9.2 — Auditorías internas
CREATE TABLE IF NOT EXISTS auditorias (
    id            SERIAL      PRIMARY KEY,
    codigo        VARCHAR(20) NOT NULL,
    programa_id   INTEGER     REFERENCES programas_auditoria (id),
    proceso_id    INTEGER     REFERENCES procesos (id),
    fecha_inicio  DATE        NOT NULL,
    duracion_dias INTEGER     NOT NULL DEFAULT 1,
    auditor_lider VARCHAR(100),
    estado        VARCHAR(20) NOT NULL DEFAULT 'Planificada'
                  CHECK (estado IN ('Planificada', 'En Ejecución', 'Cerrada')),
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id     INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_auditorias_tenant_codigo UNIQUE (tenant_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_auditorias_tenant_id     ON auditorias (tenant_id);
CREATE INDEX IF NOT EXISTS idx_auditorias_estado        ON auditorias (estado);
CREATE INDEX IF NOT EXISTS idx_auditorias_tenant_estado ON auditorias (tenant_id, estado);

-- §9.2 — Hallazgos de auditoría
CREATE TABLE IF NOT EXISTS hallazgos (
    id           SERIAL      PRIMARY KEY,
    codigo       VARCHAR(20) NOT NULL,
    auditoria_id INTEGER     NOT NULL REFERENCES auditorias (id),
    tipo         VARCHAR(40) NOT NULL
                 CHECK (tipo IN (
                     'No Conformidad Menor', 'No Conformidad Mayor',
                     'Observación', 'Oportunidad de Mejora'
                 )),
    descripcion  TEXT        NOT NULL,
    clausula     VARCHAR(20),
    estado       VARCHAR(20) NOT NULL DEFAULT 'Abierto'
                 CHECK (estado IN ('Abierto', 'Cerrado')),
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id    INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_hallazgos_tenant_codigo UNIQUE (tenant_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_hallazgos_tenant_id ON hallazgos (tenant_id);

-- §9.1.2 / §5.1.2 — PQRS (Peticiones, Quejas, Reclamos, Sugerencias)
CREATE TABLE IF NOT EXISTS pqrs_enfoque_cliente (
    id          SERIAL       PRIMARY KEY,
    tipo        VARCHAR(20)  NOT NULL CHECK (tipo IN ('Petición', 'Queja', 'Reclamo', 'Sugerencia')),
    origen      VARCHAR(200) NOT NULL,   -- nombre del cliente/proveedor
    fecha       DATE         NOT NULL DEFAULT CURRENT_DATE,
    descripcion TEXT         NOT NULL,
    estado      VARCHAR(20)  NOT NULL DEFAULT 'Abierta'
                CHECK (estado IN ('Abierta', 'En Proceso', 'Cerrada')),
    creado_por  INTEGER      REFERENCES usuarios (id),
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id   INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE pqrs_enfoque_cliente IS 'ISO 9001:2015 §5.1.2/§9.1.2 — Registro de PQRS.';
CREATE INDEX IF NOT EXISTS idx_pqrs_estado                        ON pqrs_enfoque_cliente (estado);
CREATE INDEX IF NOT EXISTS idx_pqrs_enfoque_cliente_tenant_id     ON pqrs_enfoque_cliente (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pqrs_enfoque_cliente_tenant_estado ON pqrs_enfoque_cliente (tenant_id, estado);

-- §9.1.2 — Archivos de encuestas/PQRS (metadata; binario en bucket externo)
CREATE TABLE IF NOT EXISTS archivos_enfoque_cliente (
    id           SERIAL       PRIMARY KEY,
    nombre       VARCHAR(300) NOT NULL,
    tipo         VARCHAR(30)  NOT NULL
                 CHECK (tipo IN ('Encuesta Cliente', 'Encuesta Proveedor', 'PQRS', 'Otro')),
    url          TEXT         NOT NULL,
    tipo_mime    VARCHAR(100),
    tamano_bytes INTEGER,
    subido_por   INTEGER      REFERENCES usuarios (id),
    subido_en    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id    INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE archivos_enfoque_cliente IS
    'Metadata de archivos subidos (encuestas respondidas, PQRS en PDF). '
    'El binario vive en el bucket externo.';
CREATE INDEX IF NOT EXISTS idx_archivos_enfoque_cliente_tenant_id ON archivos_enfoque_cliente (tenant_id);
CREATE INDEX IF NOT EXISTS idx_archivos_enfoque_tipo              ON archivos_enfoque_cliente (tipo);

-- §9.1.2 — Respuestas extraídas de encuestas de satisfacción (PDF interactivos)
CREATE TABLE IF NOT EXISTS respuestas_encuesta_satisfaccion (
    id                SERIAL       PRIMARY KEY,
    archivo_id        INTEGER      REFERENCES archivos_enfoque_cliente (id) ON DELETE SET NULL,
    archivo_nombre    VARCHAR(300) NOT NULL,
    tipo              VARCHAR(20)  NOT NULL CHECK (tipo IN ('cliente', 'proveedor')),
    campos            JSONB        NOT NULL DEFAULT '{}',   -- { "c1": "5", "c2": "texto libre", ... }
    nombre_encuestado VARCHAR(200),
    fecha             DATE,
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id         INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE respuestas_encuesta_satisfaccion IS
    'Respuestas extraídas de las encuestas PDF interactivas subidas por el usuario.';
CREATE INDEX IF NOT EXISTS idx_respuestas_encuesta_satisfaccion_tenant_id ON respuestas_encuesta_satisfaccion (tenant_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_encuesta_tipo                   ON respuestas_encuesta_satisfaccion (tipo);

-- §9.1.2 — Análisis DOFA de Enfoque al Cliente (generado con IA)
CREATE TABLE IF NOT EXISTS analisis_enfoque_cliente (
    id                    SERIAL      PRIMARY KEY,
    resumen_ejecutivo     TEXT        NOT NULL,
    dofa                  JSONB       NOT NULL DEFAULT '[]',
    documentos_analizados JSONB       NOT NULL DEFAULT '[]',
    creado_por            INTEGER     REFERENCES usuarios (id) ON DELETE SET NULL,
    creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id             INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_analisis_enfoque_cliente_tenant ON analisis_enfoque_cliente (tenant_id);

-- ============================================================
-- §10 — MEJORA
-- ============================================================

-- §10.2 — No Conformidades
CREATE TABLE IF NOT EXISTS no_conformidades (
    id          SERIAL      PRIMARY KEY,
    codigo      VARCHAR(20) NOT NULL,
    fecha       DATE        NOT NULL DEFAULT CURRENT_DATE,
    origen      VARCHAR(50) NOT NULL
                CHECK (origen IN (
                    'Auditoría Interna', 'Cliente (Queja)', 'Proceso Interno', 'Proveedor', 'Otro'
                )),
    proceso_id  INTEGER     REFERENCES procesos (id),
    descripcion TEXT        NOT NULL,
    gravedad    VARCHAR(20) NOT NULL CHECK (gravedad IN ('Menor', 'Mayor', 'Crítica')),
    estado      VARCHAR(20) NOT NULL DEFAULT 'Abierta'
                CHECK (estado IN ('Abierta', 'En Análisis', 'Verificación', 'Cerrada')),
    hallazgo_id INTEGER     REFERENCES hallazgos (id),
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id   INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_no_conformidades_tenant_codigo UNIQUE (tenant_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_no_conformidades_tenant_id     ON no_conformidades (tenant_id);
CREATE INDEX IF NOT EXISTS idx_nc_estado                      ON no_conformidades (estado);
CREATE INDEX IF NOT EXISTS idx_no_conformidades_tenant_estado ON no_conformidades (tenant_id, estado);

-- §10.2 — Acciones Correctivas
CREATE TABLE IF NOT EXISTS acciones_correctivas (
    id                   SERIAL       PRIMARY KEY,
    codigo               VARCHAR(20)  NOT NULL,
    nc_id                INTEGER      NOT NULL REFERENCES no_conformidades (id),
    metodo_analisis      VARCHAR(30)  CHECK (metodo_analisis IN ('5 Por Qué''s', 'Ishikawa', 'Pareto', 'Otro')),
    causa_raiz           TEXT,
    accion               TEXT         NOT NULL,
    responsable          VARCHAR(100),
    fecha_fin            DATE,
    fecha_implementacion DATE,
    estado               VARCHAR(20)  NOT NULL DEFAULT 'En Implementación'
                         CHECK (estado IN ('En Implementación', 'Verificación', 'Cerrada')),
    eficacia             VARCHAR(30)  DEFAULT '-',
    creado_en            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id            INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_acciones_correctivas_tenant_codigo UNIQUE (tenant_id, codigo)
);
COMMENT ON COLUMN acciones_correctivas.causa_raiz           IS 'Causa raíz identificada mediante el método de análisis elegido';
COMMENT ON COLUMN acciones_correctivas.fecha_implementacion IS 'Fecha real en que se implementó la acción correctiva';
CREATE INDEX IF NOT EXISTS idx_acciones_correctivas_tenant_id     ON acciones_correctivas (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ac_estado                          ON acciones_correctivas (estado);
CREATE INDEX IF NOT EXISTS idx_acciones_correctivas_tenant_estado ON acciones_correctivas (tenant_id, estado);

-- §8.7 — Control de Salidas No Conformes
-- (colocada en §10 por dependencia hacia no_conformidades)
CREATE TABLE IF NOT EXISTS salidas_nc (
    id                         SERIAL       PRIMARY KEY,
    codigo                     VARCHAR(30)  NOT NULL,
    descripcion                TEXT         NOT NULL,
    proceso                    VARCHAR(150),
    detectado_en               VARCHAR(30)  NOT NULL
                               CHECK (detectado_en IN (
                                   'Producción', 'Inspección final', 'Entrega', 'Postventa', 'Proveedor'
                               )),
    disposicion                VARCHAR(40)  NOT NULL
                               CHECK (disposicion IN (
                                   'Separar / Aislar', 'Reparar', 'Reprocesar',
                                   'Concesión al cliente', 'Devolver al proveedor', 'Desechar'
                               )),
    responsable                VARCHAR(100),
    fecha                      DATE         NOT NULL DEFAULT CURRENT_DATE,
    accion_tomada              TEXT,
    verificado_por             VARCHAR(100),
    -- §8.7.2 — Comunicación al cliente (cuando NC detectada tras la entrega)
    cliente_informado          BOOLEAN      NOT NULL DEFAULT FALSE,
    fecha_notificacion_cliente DATE,
    -- §8.7.1 c) — Concesión / autorización de aceptación bajo desviación
    concesion_otorgada         BOOLEAN      NOT NULL DEFAULT FALSE,
    concesion_autorizada_por   VARCHAR(100),
    fecha_concesion            DATE,
    observaciones_concesion    TEXT,
    estado                     VARCHAR(20)  NOT NULL DEFAULT 'Abierta'
                               CHECK (estado IN ('Abierta', 'En tratamiento', 'Cerrada')),
    nc_id                      INTEGER      REFERENCES no_conformidades (id),
    creado_por                 INTEGER      REFERENCES usuarios (id),
    creado_en                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id                  INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_salidas_nc_tenant_codigo UNIQUE (tenant_id, codigo)
);
COMMENT ON TABLE salidas_nc IS 'ISO 9001:2015 §8.7 — Control de salidas no conformes.';
COMMENT ON COLUMN salidas_nc.cliente_informado        IS '§8.7.2 — indica si se informó al cliente de la no conformidad';
COMMENT ON COLUMN salidas_nc.concesion_otorgada       IS '§8.7.1 c) — indica si se obtuvo concesión/autorización para aceptar la salida no conforme';
COMMENT ON COLUMN salidas_nc.concesion_autorizada_por IS 'Persona/rol que autorizó la concesión o la aceptación bajo desviación';
CREATE INDEX IF NOT EXISTS idx_salidas_nc_tenant_id     ON salidas_nc (tenant_id);
CREATE INDEX IF NOT EXISTS idx_salidas_nc_estado        ON salidas_nc (estado);
CREATE INDEX IF NOT EXISTS idx_salidas_nc_tenant_estado ON salidas_nc (tenant_id, estado);

-- §10.3 — Mejora Continua
CREATE TABLE IF NOT EXISTS mejoras_continuas (
    id                SERIAL       PRIMARY KEY,
    codigo            VARCHAR(30)  NOT NULL,
    titulo            VARCHAR(200) NOT NULL,
    origen            VARCHAR(40)  NOT NULL
                      CHECK (origen IN (
                          'Auditoría', 'Indicador', 'Revisión dirección',
                          'Sugerencia', 'Análisis de datos', 'Quejas cliente'
                      )),
    proceso           VARCHAR(150),
    descripcion       TEXT,
    beneficio_esperado TEXT,
    responsable       VARCHAR(100),
    fecha_inicio      DATE,
    fecha_cierre      DATE,
    avance_pct        INTEGER      NOT NULL DEFAULT 0 CHECK (avance_pct BETWEEN 0 AND 100),
    estado            VARCHAR(20)  NOT NULL DEFAULT 'Propuesta'
                      CHECK (estado IN ('Propuesta', 'Aprobada', 'En ejecución', 'Completada', 'Cancelada')),
    proceso_id        INTEGER      REFERENCES procesos (id),
    creado_por        INTEGER      REFERENCES usuarios (id),
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id         INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT uq_mejoras_continuas_tenant_codigo UNIQUE (tenant_id, codigo)
);
COMMENT ON TABLE mejoras_continuas IS 'ISO 9001:2015 §10.3 — Iniciativas de mejora continua del SGC.';
CREATE INDEX IF NOT EXISTS idx_mejoras_continuas_tenant_id     ON mejoras_continuas (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mejoras_estado                  ON mejoras_continuas (estado);
CREATE INDEX IF NOT EXISTS idx_mejoras_origen                  ON mejoras_continuas (origen);
CREATE INDEX IF NOT EXISTS idx_mejoras_continuas_tenant_estado ON mejoras_continuas (tenant_id, estado);

-- ============================================================
-- GESTIÓN GENERAL
-- ============================================================

-- §9.3 — Revisión por la Dirección
CREATE TABLE IF NOT EXISTS rev_direccion (
    id           SERIAL      PRIMARY KEY,
    fecha        DATE        NOT NULL DEFAULT CURRENT_DATE,
    asistentes   TEXT,
    temas        TEXT,
    conclusiones TEXT,
    decisiones   TEXT,
    proxima_rev  DATE,
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id    INTEGER     NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_rev_direccion_tenant_id ON rev_direccion (tenant_id);

-- Registro histórico de cargas de archivos al bucket R2/S3 externo
CREATE TABLE IF NOT EXISTS registro_cargas_r2 (
    id             SERIAL       PRIMARY KEY,
    tenant_id      INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    usuario_id     INTEGER      REFERENCES usuarios (id) ON DELETE SET NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    key_r2         TEXT         NOT NULL UNIQUE,
    mime_type      VARCHAR(100) NOT NULL,
    tamano_bytes   BIGINT       NOT NULL,
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE registro_cargas_r2 IS 'Registro histórico de todas las cargas de documentos a R2.';

-- ============================================================
-- SECCIÓN DE ACTUALIZACIÓN (para BDs existentes)
-- ============================================================
-- Si ejecutas este script sobre una BD anterior a la unificación,
-- estos ALTER TABLE agregan lo que pudiera faltar de las migraciones.
-- En una fresh install son NO-OP: los IF NOT EXISTS garantizan que
-- no se produce ningún error.
-- ============================================================

-- ── Columnas añadidas por migraciones a tablas que ya existían ──

-- RIESGOS (columnas de §6.1 avanzadas + fuente para matriz derivada)
ALTER TABLE riesgos ADD COLUMN IF NOT EXISTS tratamiento TEXT;
ALTER TABLE riesgos ADD COLUMN IF NOT EXISTS fecha_revision DATE;
ALTER TABLE riesgos ADD COLUMN IF NOT EXISTS fuente VARCHAR(20);
ALTER TABLE riesgos ADD COLUMN IF NOT EXISTS categoria VARCHAR(150);
ALTER TABLE riesgos ADD COLUMN IF NOT EXISTS actividad_id VARCHAR(60);

-- ACCIONES_CORRECTIVAS (causa raíz + fecha implementación)
ALTER TABLE acciones_correctivas ADD COLUMN IF NOT EXISTS causa_raiz TEXT;
ALTER TABLE acciones_correctivas ADD COLUMN IF NOT EXISTS fecha_implementacion DATE;

-- PERSONAL (email y fecha de ingreso)
ALTER TABLE personal ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE personal ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;

-- DATOS_EMPRESA (PDF de formulario y organigrama en bucket)
ALTER TABLE datos_empresa ADD COLUMN IF NOT EXISTS pdf_formulario_url    TEXT;
ALTER TABLE datos_empresa ADD COLUMN IF NOT EXISTS pdf_formulario_nombre VARCHAR(300);
ALTER TABLE datos_empresa ADD COLUMN IF NOT EXISTS organigrama_url       TEXT;
ALTER TABLE datos_empresa ADD COLUMN IF NOT EXISTS organigrama_nombre    VARCHAR(300);

-- PROYECTOS_DISENO (control de diseño y referencia de actividad)
ALTER TABLE proyectos_diseno ADD COLUMN IF NOT EXISTS control      TEXT;
ALTER TABLE proyectos_diseno ADD COLUMN IF NOT EXISTS actividad_id VARCHAR(60);

-- REQUERIMIENTOS_PS (campos de contratación + ficha técnica)
ALTER TABLE requerimientos_ps ADD COLUMN IF NOT EXISTS cotizacion         TEXT;
ALTER TABLE requerimientos_ps ADD COLUMN IF NOT EXISTS aprobacion_interna TEXT;
ALTER TABLE requerimientos_ps ADD COLUMN IF NOT EXISTS matriz_legal        TEXT;
ALTER TABLE requerimientos_ps ADD COLUMN IF NOT EXISTS url_contrato        TEXT;
ALTER TABLE requerimientos_ps ADD COLUMN IF NOT EXISTS ficha_tecnica_id    VARCHAR(60);
ALTER TABLE requerimientos_ps ADD COLUMN IF NOT EXISTS generado_con_ia     BOOLEAN NOT NULL DEFAULT FALSE;

-- PROVEEDORES (periodicidad de evaluación + email)
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS periodicidad_evaluacion VARCHAR(20) NOT NULL DEFAULT 'Anual';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS email VARCHAR(150);

-- PROVEEDOR_EVALUACIONES (campos de evaluación con IA)
ALTER TABLE proveedor_evaluaciones ADD COLUMN IF NOT EXISTS precio_mercado   VARCHAR(50);
ALTER TABLE proveedor_evaluaciones ADD COLUMN IF NOT EXISTS precio_proveedor VARCHAR(50);
ALTER TABLE proveedor_evaluaciones ADD COLUMN IF NOT EXISTS debilidades       TEXT;
ALTER TABLE proveedor_evaluaciones ADD COLUMN IF NOT EXISTS generada_con_ia   BOOLEAN DEFAULT FALSE;

-- SALIDAS_NC (comunicación al cliente + concesión)
ALTER TABLE salidas_nc ADD COLUMN IF NOT EXISTS cliente_informado          BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE salidas_nc ADD COLUMN IF NOT EXISTS fecha_notificacion_cliente DATE;
ALTER TABLE salidas_nc ADD COLUMN IF NOT EXISTS concesion_otorgada         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE salidas_nc ADD COLUMN IF NOT EXISTS concesion_autorizada_por   VARCHAR(100);
ALTER TABLE salidas_nc ADD COLUMN IF NOT EXISTS fecha_concesion             DATE;
ALTER TABLE salidas_nc ADD COLUMN IF NOT EXISTS observaciones_concesion     TEXT;

-- ORDENES_PRODUCCION (vínculos §8.5 agregados en migración 013)
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS ficha_tecnica_id
    VARCHAR(60) REFERENCES fichas_tecnicas_ps (id) ON DELETE SET NULL;
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS documento_instructivo_id
    INTEGER REFERENCES documentos (id) ON DELETE SET NULL;
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS infraestructura_ambiente TEXT;
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS personal_asignado        JSONB NOT NULL DEFAULT '[]';
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS seguimiento_postventa    TEXT;
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS fecha_postventa          DATE;

-- ── Constraints corregidos por migraciones ──

-- SALIDAS_NC: disposicion CHECK actualizado para incluir 'Separar / Aislar'
ALTER TABLE salidas_nc DROP CONSTRAINT IF EXISTS salidas_nc_disposicion_check;
ALTER TABLE salidas_nc ADD CONSTRAINT salidas_nc_disposicion_check CHECK (
    disposicion IN (
        'Separar / Aislar', 'Reparar', 'Reprocesar',
        'Concesión al cliente', 'Devolver al proveedor', 'Desechar'
    )
);

-- USUARIOS: email ÚNICO GLOBAL (no por tenant) — necesario para login sin selección de tenant
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS uq_usuarios_tenant_email;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_email_key;
ALTER TABLE usuarios ADD CONSTRAINT uq_usuarios_email UNIQUE (email);

-- UNIQUE compuestos tenant+codigo (reemplazan UNIQUE globales antiguos)
ALTER TABLE procesos             DROP CONSTRAINT IF EXISTS procesos_codigo_key;
ALTER TABLE indicadores          DROP CONSTRAINT IF EXISTS indicadores_codigo_key;
ALTER TABLE documentos           DROP CONSTRAINT IF EXISTS documentos_codigo_key;
ALTER TABLE proveedores          DROP CONSTRAINT IF EXISTS proveedores_nit_key;
ALTER TABLE programas_auditoria  DROP CONSTRAINT IF EXISTS programas_auditoria_anio_key;
ALTER TABLE auditorias           DROP CONSTRAINT IF EXISTS auditorias_codigo_key;
ALTER TABLE hallazgos            DROP CONSTRAINT IF EXISTS hallazgos_codigo_key;
ALTER TABLE no_conformidades     DROP CONSTRAINT IF EXISTS no_conformidades_codigo_key;
ALTER TABLE acciones_correctivas DROP CONSTRAINT IF EXISTS acciones_correctivas_codigo_key;
ALTER TABLE salidas_nc           DROP CONSTRAINT IF EXISTS salidas_nc_codigo_key;
ALTER TABLE mejoras_continuas    DROP CONSTRAINT IF EXISTS mejoras_continuas_codigo_key;
ALTER TABLE objetivos_calidad    DROP CONSTRAINT IF EXISTS objetivos_calidad_codigo_key;
ALTER TABLE ordenes_produccion   DROP CONSTRAINT IF EXISTS ordenes_produccion_codigo_key;
ALTER TABLE planificacion_cambios DROP CONSTRAINT IF EXISTS planificacion_cambios_codigo_key;
ALTER TABLE tipos_proceso         DROP CONSTRAINT IF EXISTS tipos_proceso_nombre_key;

-- RIESGO_EFICACIA: PK compuesta (tenant_id, riesgo_codigo) para multi-tenant
ALTER TABLE riesgo_eficacia DROP CONSTRAINT IF EXISTS riesgo_eficacia_pkey;
ALTER TABLE riesgo_eficacia ADD CONSTRAINT riesgo_eficacia_pkey PRIMARY KEY (tenant_id, riesgo_codigo);

-- ── tenant_id en BDs pre-multi-tenant (no-op si ya es NOT NULL) ──
-- Este bloque detecta columnas tenant_id que sean aún nullable
-- (BD anterior a la migración 001) y las completa con tenant 1.
DO $upgrade_tenants$
DECLARE
    tables TEXT[] := ARRAY[
        'usuarios', 'procesos', 'tipos_proceso', 'pestel', 'dofa',
        'politica_calidad', 'politica_lecturas', 'riesgos', 'indicadores',
        'indicador_mediciones', 'documentos', 'documento_versiones',
        'documento_aprobaciones', 'personal', 'evaluaciones_competencia',
        'plan_formacion', 'formacion_asistentes', 'proveedores',
        'proveedor_evaluaciones', 'programas_auditoria', 'auditorias',
        'hallazgos', 'no_conformidades', 'acciones_correctivas',
        'rev_direccion', 'planificacion_cambios', 'planes_operacion',
        'requerimientos_ps', 'proyectos_diseno', 'ordenes_compra',
        'ordenes_produccion', 'liberaciones_ps', 'salidas_nc',
        'toma_consciencia', 'comunicaciones', 'mejoras_continuas',
        'objetivos_calidad', 'objetivos_calidad_mediciones', 'datos_empresa',
        'matriz_roles', 'matriz_cargos', 'matriz_recursos',
        'actividades_empresa', 'fichas_tecnicas_compra',
        'evaluaciones_orden_compra', 'riesgo_evidencias',
        'pqrs_enfoque_cliente', 'archivos_enfoque_cliente',
        'respuestas_encuesta_satisfaccion', 'fichas_tecnicas_ps',
        'mapa_procedimiento', 'manual_procedimiento',
        'analisis_enfoque_cliente', 'puntos_control_produccion'
    ];
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = tbl
              AND column_name  = 'tenant_id'
              AND is_nullable  = 'YES'
        ) THEN
            EXECUTE format('UPDATE %I SET tenant_id = 1 WHERE tenant_id IS NULL', tbl);
            EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', tbl);
        END IF;
    END LOOP;
END $upgrade_tenants$;

-- ============================================================
-- DATOS SEMILLA
-- ============================================================

-- 1. Tenant inicial (id = 1)
-- IMPORTANTE: actualizar nombre y nit con los datos reales antes de producción.
INSERT INTO tenants (id, nombre, nit, estado, plan)
VALUES (1, 'Empresa Inicial Governex', 'PENDIENTE-ACTUALIZAR', 'Activo', 'Enterprise')
ON CONFLICT DO NOTHING;
SELECT setval(
    pg_get_serial_sequence('tenants', 'id'),
    GREATEST((SELECT MAX(id) FROM tenants), 1)
);

-- 2. Roles de negocio (nombres definitivos)
INSERT INTO roles (nombre) VALUES
    ('Superusuario'),
    ('Gestión'),
    ('Operativo')
ON CONFLICT (nombre) DO NOTHING;

-- Renombrar roles históricos si aún existen (BD con nombres anteriores a migración 007)
UPDATE roles SET nombre = 'Superusuario' WHERE nombre = 'Alta Dirección';
UPDATE roles SET nombre = 'Gestión'      WHERE nombre = 'Admin SGC';
UPDATE roles SET nombre = 'Operativo'    WHERE nombre = 'Usuario';

-- 3. Platform admin inicial
-- NOTA: Reemplazar el hash antes de desplegar. Generar con:
--   node -e "console.log(require('bcryptjs').hashSync('TU_PASSWORD_TEMPORAL', 10))"
INSERT INTO platform_admins (nombre, email, password_hash)
VALUES (
    'SuperAdmin',
    'luismj.dev@gmail.com',
    '$2a$10$yDFtxb/PoBcbCU6HS5RTp.2gTbLGh0LiRkcdlFeSx6a.CTmV62c5y'
) ON CONFLICT (email) DO NOTHING;

-- 4. Tipos de proceso base (para el tenant 1)
INSERT INTO tipos_proceso (nombre, tenant_id) VALUES
    ('Estratégico', 1),
    ('Misional',    1),
    ('Apoyo',       1)
ON CONFLICT DO NOTHING;

-- 5. Usuario administrador inicial (tenant 1)
-- NOTA: Cambiar contraseña en el primer inicio de sesión.
INSERT INTO usuarios (nombre, email, password_hash, rol_id, tenant_id)
VALUES (
    'Administrador',
    'admin@governex.com',
    '$2a$10$6Mg2Yn3K2b3etwW/jpCzEu/V6HWvWtun4BBiEGkpGnKaJ3vn1Nad6',
    (SELECT id FROM roles WHERE nombre = 'Superusuario'),
    1
) ON CONFLICT (email) DO NOTHING;

-- 6. Catálogo RBAC: todos los recursos × todas las acciones
INSERT INTO permisos (recurso, accion)
SELECT r.recurso, a.accion
FROM (VALUES
    ('procesos'), ('riesgos'), ('documentos'), ('auditorias'), ('no_conformidades'),
    ('acciones_correctivas'), ('indicadores'), ('proveedores'), ('competencias'),
    ('rev_direccion'), ('objetivos_calidad'), ('comunicaciones'), ('mejoras_continuas'),
    ('politica_calidad'), ('compras'), ('produccion'), ('diseno_desarrollo'),
    ('enfoque_cliente'), ('liberacion_ps'), ('planes_operacion'),
    ('planificacion_cambios'), ('requerimientos_ps'), ('salidas_nc'),
    ('toma_consciencia'), ('contexto_empresa')
) AS r(recurso)
CROSS JOIN (VALUES ('leer'), ('crear'), ('editar'), ('eliminar')) AS a(accion)
ON CONFLICT DO NOTHING;

-- 'aprobar' solo en módulos con flujo de aprobación real
INSERT INTO permisos (recurso, accion) VALUES
    ('documentos',       'aprobar'),
    ('auditorias',       'aprobar'),
    ('no_conformidades', 'aprobar'),
    ('rev_direccion',    'aprobar')
ON CONFLICT DO NOTHING;

-- 7. Matriz de permisos definitiva (equivalente a migración 010)
-- Se reconstruye completa desde cero para garantizar consistencia.
DELETE FROM rol_permisos
WHERE rol_id IN (
    SELECT id FROM roles
    WHERE nombre IN (
        'Superusuario', 'Gestión', 'Operativo',
        'Alta Dirección', 'Admin SGC', 'Usuario'
    )
);

-- SUPERUSUARIO: control total en todos los módulos (incluye 'aprobar')
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permisos p
WHERE r.nombre IN ('Superusuario', 'Alta Dirección')
ON CONFLICT DO NOTHING;

-- GESTIÓN: leer/crear/editar/eliminar en la mayoría; sin eliminar ni aprobar en módulos sensibles
-- (documentos, auditorias, no_conformidades, rev_direccion → sin eliminar ni aprobar)
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON TRUE
JOIN (VALUES
    ('procesos','leer'),             ('procesos','crear'),             ('procesos','editar'),
    ('politica_calidad','leer'),     ('politica_calidad','crear'),     ('politica_calidad','editar'),
    ('contexto_empresa','leer'),     ('contexto_empresa','crear'),     ('contexto_empresa','editar'),
    ('enfoque_cliente','leer'),      ('enfoque_cliente','crear'),      ('enfoque_cliente','editar'),      ('enfoque_cliente','eliminar'),
    ('riesgos','leer'),              ('riesgos','crear'),              ('riesgos','editar'),              ('riesgos','eliminar'),
    ('objetivos_calidad','leer'),    ('objetivos_calidad','crear'),    ('objetivos_calidad','editar'),    ('objetivos_calidad','eliminar'),
    ('planificacion_cambios','leer'),('planificacion_cambios','crear'),('planificacion_cambios','editar'),('planificacion_cambios','eliminar'),
    ('competencias','leer'),         ('competencias','crear'),         ('competencias','editar'),         ('competencias','eliminar'),
    ('toma_consciencia','leer'),     ('toma_consciencia','crear'),     ('toma_consciencia','editar'),     ('toma_consciencia','eliminar'),
    ('comunicaciones','leer'),       ('comunicaciones','crear'),       ('comunicaciones','editar'),       ('comunicaciones','eliminar'),
    ('documentos','leer'),           ('documentos','crear'),           ('documentos','editar'),
    ('planes_operacion','leer'),     ('planes_operacion','crear'),     ('planes_operacion','editar'),     ('planes_operacion','eliminar'),
    ('requerimientos_ps','leer'),    ('requerimientos_ps','crear'),    ('requerimientos_ps','editar'),    ('requerimientos_ps','eliminar'),
    ('diseno_desarrollo','leer'),    ('diseno_desarrollo','crear'),    ('diseno_desarrollo','editar'),    ('diseno_desarrollo','eliminar'),
    ('compras','leer'),              ('compras','crear'),              ('compras','editar'),              ('compras','eliminar'),
    ('proveedores','leer'),          ('proveedores','crear'),          ('proveedores','editar'),          ('proveedores','eliminar'),
    ('produccion','leer'),           ('produccion','crear'),           ('produccion','editar'),           ('produccion','eliminar'),
    ('liberacion_ps','leer'),        ('liberacion_ps','crear'),        ('liberacion_ps','editar'),        ('liberacion_ps','eliminar'),
    ('salidas_nc','leer'),           ('salidas_nc','crear'),           ('salidas_nc','editar'),           ('salidas_nc','eliminar'),
    ('auditorias','leer'),           ('auditorias','crear'),           ('auditorias','editar'),
    ('indicadores','leer'),          ('indicadores','crear'),          ('indicadores','editar'),          ('indicadores','eliminar'),
    ('rev_direccion','leer'),        ('rev_direccion','crear'),        ('rev_direccion','editar'),
    ('acciones_correctivas','leer'), ('acciones_correctivas','crear'), ('acciones_correctivas','editar'), ('acciones_correctivas','eliminar'),
    ('no_conformidades','leer'),     ('no_conformidades','crear'),     ('no_conformidades','editar'),
    ('mejoras_continuas','leer'),    ('mejoras_continuas','crear'),    ('mejoras_continuas','editar'),    ('mejoras_continuas','eliminar')
) AS matriz(recurso, accion) ON matriz.recurso = p.recurso AND matriz.accion = p.accion
WHERE r.nombre IN ('Gestión', 'Admin SGC')
ON CONFLICT DO NOTHING;

-- OPERATIVO: leer + crear en módulos de captura; solo leer en módulos de gobierno del SGC
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON TRUE
JOIN (VALUES
    ('procesos','leer'),
    ('politica_calidad','leer'),
    ('contexto_empresa','leer'),
    ('enfoque_cliente','leer'),      ('enfoque_cliente','crear'),
    ('riesgos','leer'),              ('riesgos','crear'),
    ('objetivos_calidad','leer'),
    ('planificacion_cambios','leer'),
    ('competencias','leer'),
    ('toma_consciencia','leer'),     ('toma_consciencia','crear'),
    ('comunicaciones','leer'),       ('comunicaciones','crear'),
    ('documentos','leer'),           ('documentos','crear'),
    ('planes_operacion','leer'),     ('planes_operacion','crear'),
    ('requerimientos_ps','leer'),    ('requerimientos_ps','crear'),
    ('diseno_desarrollo','leer'),    ('diseno_desarrollo','crear'),
    ('compras','leer'),              ('compras','crear'),
    ('proveedores','leer'),          ('proveedores','crear'),
    ('produccion','leer'),           ('produccion','crear'),
    ('liberacion_ps','leer'),
    ('salidas_nc','leer'),           ('salidas_nc','crear'),
    ('auditorias','leer'),
    ('indicadores','leer'),          ('indicadores','crear'),
    ('rev_direccion','leer'),
    ('acciones_correctivas','leer'), ('acciones_correctivas','crear'),
    ('no_conformidades','leer'),     ('no_conformidades','crear'),
    ('mejoras_continuas','leer'),    ('mejoras_continuas','crear')
) AS matriz(recurso, accion) ON matriz.recurso = p.recurso AND matriz.accion = p.accion
WHERE r.nombre IN ('Operativo', 'Usuario')
ON CONFLICT DO NOTHING;

-- 8. Comunicaciones base del SGC (matriz inicial para el tenant 1)
INSERT INTO comunicaciones (que, cuando, quien, a_quien, como, tipo, estado, tenant_id)
VALUES
    ('Política y objetivos de calidad',   'Al ingreso y revisión anual',   'Alta Dirección',      'Todo el personal',             'Reunión, cartelera, intranet',             'Interna', 'Activo', 1),
    ('Resultados de auditorías internas', 'Al cierre de cada auditoría',   'Auditor Líder',       'Dueños de proceso auditados',  'Informe escrito + reunión de cierre',      'Interna', 'Activo', 1),
    ('Cambios en el SGC',                 'Antes de implementar cambios',  'Director de Calidad', 'Personal impactado',           'Correo electrónico + capacitación',        'Interna', 'Activo', 1),
    ('Retroalimentación al cliente',      'Después de cada entrega',       'Director Comercial',  'Clientes',                     'Encuesta de satisfacción + llamada',       'Externa', 'Activo', 1),
    ('Requisitos a proveedores',          'Al emitir orden de compra',     'Jefe de Compras',     'Proveedores aprobados',        'Orden de compra + especificaciones',       'Externa', 'Activo', 1),
    ('Indicadores de desempeño del SGC',  'Mensualmente',                  'Coordinador Calidad', 'Gerencia y dueños de proceso', 'Informe mensual + tablero de indicadores', 'Interna', 'Activo', 1)
ON CONFLICT DO NOTHING;