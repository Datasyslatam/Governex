-- ============================================================
--  GOVERNEX — Esquema de Base de Datos PostgreSQL
--  Sistema de Gestión de Calidad (SGC) basado en ISO 9001
-- ============================================================

CREATE TABLE roles (
    id        SERIAL PRIMARY KEY,
    nombre    VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE usuarios (
    id             SERIAL PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL,
    email          VARCHAR(150) NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    rol_id         INTEGER NOT NULL REFERENCES roles(id),
    activo         BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tipos_proceso (
    id     SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE procesos (
    id            SERIAL PRIMARY KEY,
    codigo        VARCHAR(20) NOT NULL UNIQUE,
    nombre        VARCHAR(150) NOT NULL,
    objetivo      TEXT,
    entradas      TEXT,
    salidas       TEXT,
    indicador_kpi TEXT,
    responsable   VARCHAR(100),
    tipo_id       INTEGER NOT NULL REFERENCES tipos_proceso(id),
    estado        VARCHAR(20) NOT NULL DEFAULT 'Activo'
                  CHECK (estado IN ('Activo', 'Revisión', 'Inactivo')),
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pestel (
    id           SERIAL PRIMARY KEY,
    factor       CHAR(1) NOT NULL CHECK (factor IN ('P','E','S','T','A','L')),
    categoria    VARCHAR(50) NOT NULL,
    descripcion  TEXT NOT NULL,
    impacto      VARCHAR(10) NOT NULL CHECK (impacto IN ('Alto','Medio','Bajo')),
    oportunidad  BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dofa (
    id           SERIAL PRIMARY KEY,
    tipo         VARCHAR(20) NOT NULL
                 CHECK (tipo IN ('Fortaleza','Oportunidad','Debilidad','Amenaza')),
    descripcion  TEXT NOT NULL,
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE politica_calidad (
    id              SERIAL PRIMARY KEY,
    version         VARCHAR(10) NOT NULL,
    contenido       TEXT NOT NULL,
    estado          VARCHAR(20) NOT NULL DEFAULT 'Vigente'
                    CHECK (estado IN ('Vigente', 'Obsoleto', 'Borrador')),
    aprobado_por    INTEGER REFERENCES usuarios(id),
    fecha_vigencia  DATE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE politica_lecturas (
    id             SERIAL PRIMARY KEY,
    politica_id    INTEGER NOT NULL REFERENCES politica_calidad(id),
    nombre_persona VARCHAR(100) NOT NULL,
    area           VARCHAR(100),
    fecha_lectura  DATE,
    estado         VARCHAR(30) NOT NULL DEFAULT 'Pendiente'
                   CHECK (estado IN ('Leído y Aceptado', 'Pendiente')),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE riesgos (
    id           SERIAL PRIMARY KEY,
    codigo       VARCHAR(20) NOT NULL UNIQUE,
    descripcion  TEXT NOT NULL,
    proceso_id   INTEGER REFERENCES procesos(id),
    probabilidad INTEGER NOT NULL CHECK (probabilidad BETWEEN 1 AND 5),
    impacto      INTEGER NOT NULL CHECK (impacto BETWEEN 1 AND 5),
    nivel        INTEGER GENERATED ALWAYS AS (probabilidad * impacto) STORED,
    estado       VARCHAR(20) NOT NULL DEFAULT 'MONITOREO'
                 CHECK (estado IN ('CRITICO', 'TRATAMIENTO', 'MONITOREO')),
    responsable  VARCHAR(100),
    tipo         VARCHAR(15) NOT NULL DEFAULT 'Riesgo'
                 CHECK (tipo IN ('Riesgo', 'Oportunidad')),
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE indicadores (
    id            SERIAL PRIMARY KEY,
    codigo        VARCHAR(20) NOT NULL UNIQUE,
    titulo        VARCHAR(200) NOT NULL,
    proceso_id    INTEGER REFERENCES procesos(id),
    frecuencia    VARCHAR(20) NOT NULL
                  CHECK (frecuencia IN ('Diaria','Semanal','Mensual','Trimestral','Semestral','Anual')),
    meta          VARCHAR(50) NOT NULL,
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE indicador_mediciones (
    id             SERIAL PRIMARY KEY,
    indicador_id   INTEGER NOT NULL REFERENCES indicadores(id),
    valor          VARCHAR(50) NOT NULL,
    tendencia      VARCHAR(10) CHECK (tendencia IN ('up', 'down', 'stable')),
    estado         VARCHAR(20) NOT NULL
                   CHECK (estado IN ('Cumple', 'Riesgo', 'No Cumple')),
    fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
    registrado_por INTEGER REFERENCES usuarios(id),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documentos (
    id          SERIAL PRIMARY KEY,
    codigo      VARCHAR(20) NOT NULL UNIQUE,
    titulo      VARCHAR(200) NOT NULL,
    tipo        VARCHAR(20) NOT NULL
                CHECK (tipo IN ('Manual','Política','Proceso','Instrucción','Formato','Otro')),
    proceso_id  INTEGER REFERENCES procesos(id),
    version     VARCHAR(10) NOT NULL,
    estado      VARCHAR(20) NOT NULL DEFAULT 'Borrador'
                CHECK (estado IN ('Aprobado','En Revision','Borrador','Obsoleto')),
    archivo_url TEXT,
    hash_sha256 TEXT,
    creado_por  INTEGER REFERENCES usuarios(id),
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documento_versiones (
    id            SERIAL PRIMARY KEY,
    documento_id  INTEGER NOT NULL REFERENCES documentos(id),
    version       VARCHAR(10) NOT NULL,
    descripcion   TEXT,
    archivo_url   TEXT,
    hash_sha256   TEXT,
    autor_id      INTEGER REFERENCES usuarios(id),
    fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documento_aprobaciones (
    id            SERIAL PRIMARY KEY,
    documento_id  INTEGER NOT NULL REFERENCES documentos(id),
    aprobador_id  INTEGER NOT NULL REFERENCES usuarios(id),
    paso          VARCHAR(50) NOT NULL,
    resultado     VARCHAR(20) CHECK (resultado IN ('Aprobado','Rechazado','Pendiente')),
    comentarios   TEXT,
    fecha         TIMESTAMPTZ
);

CREATE TABLE personal (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    cargo       VARCHAR(100),
    proceso_id  INTEGER REFERENCES procesos(id),
    usuario_id  INTEGER REFERENCES usuarios(id),
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE evaluaciones_competencia (
    id             SERIAL PRIMARY KEY,
    personal_id    INTEGER NOT NULL REFERENCES personal(id),
    brecha_pct     INTEGER NOT NULL DEFAULT 0 CHECK (brecha_pct BETWEEN 0 AND 100),
    estado         VARCHAR(20) NOT NULL
                   CHECK (estado IN ('Competente','En Formación','Brecha Crítica')),
    evaluado_por   INTEGER REFERENCES usuarios(id),
    fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE plan_formacion (
    id          SERIAL PRIMARY KEY,
    tema        VARCHAR(200) NOT NULL,
    fecha       DATE,
    estado      VARCHAR(20) NOT NULL DEFAULT 'Planificado'
                CHECK (estado IN ('Planificado','En Ejecución','Completado','Cancelado')),
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE formacion_asistentes (
    plan_id      INTEGER NOT NULL REFERENCES plan_formacion(id),
    personal_id  INTEGER NOT NULL REFERENCES personal(id),
    PRIMARY KEY (plan_id, personal_id)
);

CREATE TABLE proveedores (
    id          SERIAL PRIMARY KEY,
    nit         VARCHAR(30) NOT NULL UNIQUE,
    razon       VARCHAR(200) NOT NULL,
    tipo        VARCHAR(50),
    estado      VARCHAR(20) NOT NULL DEFAULT 'Aprobado'
                CHECK (estado IN ('Aprobado','Condicional','Suspendido')),
    prox_eval   DATE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE proveedor_evaluaciones (
    id             SERIAL PRIMARY KEY,
    proveedor_id   INTEGER NOT NULL REFERENCES proveedores(id),
    evaluador      VARCHAR(100),
    calidad        INTEGER NOT NULL CHECK (calidad BETWEEN 0 AND 100),
    entrega        INTEGER NOT NULL CHECK (entrega BETWEEN 0 AND 100),
    precio         INTEGER NOT NULL CHECK (precio BETWEEN 0 AND 100),
    servicio       INTEGER NOT NULL CHECK (servicio BETWEEN 0 AND 100),
    total          INTEGER GENERATED ALWAYS AS
                   ((calidad + entrega + precio + servicio) / 4) STORED,
    fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE programas_auditoria (
    id          SERIAL PRIMARY KEY,
    anio        INTEGER NOT NULL UNIQUE,
    objetivo    TEXT NOT NULL,
    duracion    VARCHAR(50),
    estado      VARCHAR(20) NOT NULL DEFAULT 'En Ejecución'
                CHECK (estado IN ('En Ejecución','Cerrado','Planificado')),
    avance_pct  INTEGER NOT NULL DEFAULT 0 CHECK (avance_pct BETWEEN 0 AND 100),
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auditorias (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    programa_id     INTEGER REFERENCES programas_auditoria(id),
    proceso_id      INTEGER REFERENCES procesos(id),
    fecha_inicio    DATE NOT NULL,
    duracion_dias   INTEGER NOT NULL DEFAULT 1,
    auditor_lider   VARCHAR(100),
    estado          VARCHAR(20) NOT NULL DEFAULT 'Planificada'
                    CHECK (estado IN ('Planificada','En Ejecución','Cerrada')),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hallazgos (
    id            SERIAL PRIMARY KEY,
    codigo        VARCHAR(20) NOT NULL UNIQUE,
    auditoria_id  INTEGER NOT NULL REFERENCES auditorias(id),
    tipo          VARCHAR(40) NOT NULL
                  CHECK (tipo IN (
                    'No Conformidad Menor',
                    'No Conformidad Mayor',
                    'Observación',
                    'Oportunidad de Mejora'
                  )),
    descripcion   TEXT NOT NULL,
    clausula      VARCHAR(20),
    estado        VARCHAR(20) NOT NULL DEFAULT 'Abierto'
                  CHECK (estado IN ('Abierto','Cerrado')),
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE no_conformidades (
    id           SERIAL PRIMARY KEY,
    codigo       VARCHAR(20) NOT NULL UNIQUE,
    fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
    origen       VARCHAR(50) NOT NULL
                 CHECK (origen IN (
                   'Auditoría Interna','Cliente (Queja)',
                   'Proceso Interno','Proveedor','Otro'
                 )),
    proceso_id   INTEGER REFERENCES procesos(id),
    descripcion  TEXT NOT NULL,
    gravedad     VARCHAR(20) NOT NULL
                 CHECK (gravedad IN ('Menor','Mayor','Crítica')),
    estado       VARCHAR(20) NOT NULL DEFAULT 'Abierta'
                 CHECK (estado IN ('Abierta','En Análisis','Verificación','Cerrada')),
    hallazgo_id  INTEGER REFERENCES hallazgos(id),
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE acciones_correctivas (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    nc_id           INTEGER NOT NULL REFERENCES no_conformidades(id),
    metodo_analisis VARCHAR(30)
                    CHECK (metodo_analisis IN ('5 Por Qué''s','Ishikawa','Pareto','Otro')),
    accion          TEXT NOT NULL,
    responsable     VARCHAR(100),
    fecha_fin       DATE,
    estado          VARCHAR(20) NOT NULL DEFAULT 'En Implementación'
                    CHECK (estado IN ('En Implementación','Verificación','Cerrada')),
    eficacia        VARCHAR(30) DEFAULT '-',
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rev_direccion (
    id          SERIAL PRIMARY KEY,
    fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
    asistentes  TEXT,
    temas       TEXT,
    conclusiones TEXT,
    decisiones  TEXT,
    proxima_rev DATE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  DATOS SEMILLA
-- ============================================================

INSERT INTO roles (nombre) VALUES
    ('Alta Dirección'),
    ('Admin SGC'),
    ('Usuario');

INSERT INTO tipos_proceso (nombre) VALUES
    ('Estratégico'),
    ('Misional'),
    ('Apoyo');


INSERT INTO usuarios (nombre, email, password_hash, rol_id)
VALUES (
    'Administrador',
    'admin2@governex.com',
    '$2a$10$6Mg2Yn3K2b3etwW/jpCzEu/V6HWvWtun4BBiEGkpGnKaJ3vn1Nad6',
    1
);
-- ============================================================
--  ÍNDICES
-- ============================================================

CREATE INDEX idx_documentos_estado      ON documentos(estado);
CREATE INDEX idx_auditorias_estado      ON auditorias(estado);
CREATE INDEX idx_nc_estado              ON no_conformidades(estado);
CREATE INDEX idx_ac_estado              ON acciones_correctivas(estado);
CREATE INDEX idx_riesgos_nivel          ON riesgos(nivel);
CREATE INDEX idx_indicador_med_fecha    ON indicador_mediciones(fecha);
CREATE INDEX idx_proveedor_eval_fecha   ON proveedor_evaluaciones(fecha);

-- ============================================================
--  GOVERNEX — Extensión del Esquema de Base de Datos
--  Migración: Tablas nuevas + columnas faltantes
--  Compatible con schema.sql existente
-- ============================================================


-- ============================================================
--  PARTE 1: COLUMNAS FALTANTES EN TABLAS EXISTENTES
-- ============================================================

-- ── riesgos: tratamiento y fecha_revision ──────────────────
ALTER TABLE riesgos
    ADD COLUMN IF NOT EXISTS tratamiento      TEXT,
    ADD COLUMN IF NOT EXISTS fecha_revision   DATE;

COMMENT ON COLUMN riesgos.tratamiento    IS 'Descripción del plan de acción / tratamiento del riesgo (ISO 9001 §6.1)';
COMMENT ON COLUMN riesgos.fecha_revision IS 'Próxima fecha programada de revisión del riesgo';

-- ── acciones_correctivas: causa_raiz y fecha_implementacion ─
ALTER TABLE acciones_correctivas
    ADD COLUMN IF NOT EXISTS causa_raiz           TEXT,
    ADD COLUMN IF NOT EXISTS fecha_implementacion DATE;

COMMENT ON COLUMN acciones_correctivas.causa_raiz           IS 'Causa raíz identificada mediante el método de análisis elegido';
COMMENT ON COLUMN acciones_correctivas.fecha_implementacion IS 'Fecha real en que se implementó la acción correctiva';

-- ── personal: email y fecha_ingreso ────────────────────────
ALTER TABLE personal
    ADD COLUMN IF NOT EXISTS email         VARCHAR(150),
    ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;

COMMENT ON COLUMN personal.email         IS 'Correo electrónico del colaborador';
COMMENT ON COLUMN personal.fecha_ingreso IS 'Fecha de ingreso a la organización';


-- ============================================================
--  PARTE 2: TABLAS NUEVAS — MÓDULOS SIN PERSISTENCIA
-- ============================================================

-- ── §8.1 — Planificación y Control Operacional ─────────────
CREATE TABLE IF NOT EXISTS planes_operacion (
    id             SERIAL PRIMARY KEY,
    proceso        VARCHAR(200) NOT NULL,
    objetivo       TEXT NOT NULL,
    criterios      TEXT,
    recursos       TEXT,
    controles      TEXT,
    responsable    VARCHAR(100),
    fecha_revision DATE,
    estado         VARCHAR(20) NOT NULL DEFAULT 'Vigente'
                   CHECK (estado IN ('Vigente', 'En revisión', 'Obsoleto')),
    creado_por     INTEGER REFERENCES usuarios(id),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE planes_operacion IS 'ISO 9001:2015 §8.1 — Planificación y control operacional';

-- ── §8.2 — Requerimientos para Productos y Servicios ───────
CREATE TABLE IF NOT EXISTS requerimientos_ps (
    id                  SERIAL PRIMARY KEY,
    cliente             VARCHAR(200) NOT NULL,
    producto_servicio   VARCHAR(200) NOT NULL,
    requisitos_cliente  TEXT,
    requisitos_legales  TEXT,
    requisitos_org      TEXT,
    fecha_revision      DATE,
    revisado_por        VARCHAR(100),
    estado              VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
                        CHECK (estado IN ('Aprobado', 'Pendiente', 'Rechazado')),
    creado_por          INTEGER REFERENCES usuarios(id),
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE requerimientos_ps IS 'ISO 9001:2015 §8.2 — Determinación y revisión de requisitos de P/S';

-- ── §8.3 — Diseño y Desarrollo ─────────────────────────────
CREATE TABLE IF NOT EXISTS proyectos_diseno (
    id             SERIAL PRIMARY KEY,
    nombre         VARCHAR(200) NOT NULL,
    cliente        VARCHAR(200),
    entradas       TEXT,
    salidas        TEXT,
    responsable    VARCHAR(100),
    fecha_inicio   DATE,
    fecha_entrega  DATE,
    etapa          VARCHAR(30) NOT NULL DEFAULT 'Planificación'
                   CHECK (etapa IN ('Planificación', 'Desarrollo', 'Verificación', 'Validación', 'Completado')),
    estado         VARCHAR(20) NOT NULL DEFAULT 'En tiempo'
                   CHECK (estado IN ('En tiempo', 'En riesgo', 'Retrasado')),
    creado_por     INTEGER REFERENCES usuarios(id),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE proyectos_diseno IS 'ISO 9001:2015 §8.3 — Diseño y desarrollo de productos y servicios';

-- ── §8.4 — Compras / Productos Suministrados Externamente ──
CREATE TABLE IF NOT EXISTS ordenes_compra (
    id             SERIAL PRIMARY KEY,
    proveedor_id   INTEGER REFERENCES proveedores(id),
    proveedor      VARCHAR(200) NOT NULL,
    producto       VARCHAR(200) NOT NULL,
    cantidad       VARCHAR(50),
    unidad         VARCHAR(50),
    precio_unit    VARCHAR(50),
    total          VARCHAR(50),
    fecha_emision  DATE,
    fecha_entrega  DATE,
    requisitos     TEXT,
    responsable    VARCHAR(100),
    estado         VARCHAR(30) NOT NULL DEFAULT 'Pendiente'
                   CHECK (estado IN (
                     'Pendiente',
                     'Recibido conforme',
                     'Recibido no conforme',
                     'Cancelado'
                   )),
    observaciones  TEXT,
    creado_por     INTEGER REFERENCES usuarios(id),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ordenes_compra IS 'ISO 9001:2015 §8.4 — Control de productos y servicios suministrados externamente';

-- ── §8.5 — Producción y Provisión del Servicio ─────────────
CREATE TABLE IF NOT EXISTS ordenes_produccion (
    id                  SERIAL PRIMARY KEY,
    codigo              VARCHAR(30) NOT NULL UNIQUE,
    producto_servicio   VARCHAR(200) NOT NULL,
    cliente             VARCHAR(200),
    cantidad            VARCHAR(50),
    instruccion_trabajo VARCHAR(50),
    equipos             TEXT,
    responsable         VARCHAR(100),
    fecha_inicio        DATE,
    fecha_entrega       DATE,
    etapa               VARCHAR(30) NOT NULL DEFAULT 'Programado'
                        CHECK (etapa IN (
                          'Programado',
                          'En proceso',
                          'Control de calidad',
                          'Entregado'
                        )),
    conformidad         VARCHAR(30) NOT NULL DEFAULT 'Pendiente inspección'
                        CHECK (conformidad IN (
                          'Conforme',
                          'No conforme',
                          'Pendiente inspección'
                        )),
    creado_por          INTEGER REFERENCES usuarios(id),
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ordenes_produccion IS 'ISO 9001:2015 §8.5 — Producción y provisión del servicio';

-- ── §8.6 — Liberación de Productos y Servicios ─────────────
CREATE TABLE IF NOT EXISTS liberaciones_ps (
    id                    SERIAL PRIMARY KEY,
    codigo_op             VARCHAR(30),
    orden_produccion_id   INTEGER REFERENCES ordenes_produccion(id),
    producto_servicio     VARCHAR(200) NOT NULL,
    cliente               VARCHAR(200),
    criterios_aceptacion  TEXT,
    inspeccion_realizada  TEXT,
    resultados            TEXT,
    autorizado_por        VARCHAR(100),
    fecha                 DATE NOT NULL DEFAULT CURRENT_DATE,
    decision              VARCHAR(20) NOT NULL DEFAULT 'Liberado'
                          CHECK (decision IN ('Liberado', 'Retenido', 'Rechazado')),
    observaciones         TEXT,
    creado_por            INTEGER REFERENCES usuarios(id),
    creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE liberaciones_ps IS 'ISO 9001:2015 §8.6 — Liberación de productos y servicios';

-- ── §8.7 — Control de las Salidas No Conformes ─────────────
CREATE TABLE IF NOT EXISTS salidas_nc (
    id             SERIAL PRIMARY KEY,
    codigo         VARCHAR(30) NOT NULL UNIQUE,
    descripcion    TEXT NOT NULL,
    proceso        VARCHAR(150),
    detectado_en   VARCHAR(30) NOT NULL
                   CHECK (detectado_en IN (
                     'Producción',
                     'Inspección final',
                     'Entrega',
                     'Postventa',
                     'Proveedor'
                   )),
    disposicion    VARCHAR(40) NOT NULL
                   CHECK (disposicion IN (
                     'Reparar',
                     'Reprocesar',
                     'Concesión al cliente',
                     'Devolver al proveedor',
                     'Desechar'
                   )),
    responsable    VARCHAR(100),
    fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
    accion_tomada  TEXT,
    verificado_por VARCHAR(100),
    estado         VARCHAR(20) NOT NULL DEFAULT 'Abierta'
                   CHECK (estado IN ('Abierta', 'En tratamiento', 'Cerrada')),
    nc_id          INTEGER REFERENCES no_conformidades(id),
    creado_por     INTEGER REFERENCES usuarios(id),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE salidas_nc IS 'ISO 9001:2015 §8.7 — Control de salidas no conformes';

-- ── §7.3 — Toma de Consciencia ──────────────────────────────
CREATE TABLE IF NOT EXISTS toma_consciencia (
    id           SERIAL PRIMARY KEY,
    colaborador  VARCHAR(100) NOT NULL,
    cargo        VARCHAR(100),
    proceso      VARCHAR(150),
    tema         VARCHAR(200) NOT NULL,
    fecha        DATE,
    modalidad    VARCHAR(20) NOT NULL
                 CHECK (modalidad IN (
                   'Capacitación',
                   'Comunicado',
                   'Taller',
                   'Inducción',
                   'E-learning'
                 )),
    evidencia    TEXT,
    estado       VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
                 CHECK (estado IN ('Pendiente', 'Completado', 'Vencido')),
    personal_id  INTEGER REFERENCES personal(id),
    creado_por   INTEGER REFERENCES usuarios(id),
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE toma_consciencia IS 'ISO 9001:2015 §7.3 — Toma de consciencia del personal sobre el SGC';

-- ── §7.4 — Comunicación ────────────────────────────────────
CREATE TABLE IF NOT EXISTS comunicaciones (
    id       SERIAL PRIMARY KEY,
    que      VARCHAR(200) NOT NULL,
    cuando   VARCHAR(200),
    quien    VARCHAR(100),
    a_quien  VARCHAR(200),
    como     VARCHAR(200),
    tipo     VARCHAR(10) NOT NULL DEFAULT 'Interna'
             CHECK (tipo IN ('Interna', 'Externa')),
    estado   VARCHAR(20) NOT NULL DEFAULT 'Activo'
             CHECK (estado IN ('Activo', 'Revisión', 'Inactivo')),
    creado_por INTEGER REFERENCES usuarios(id),
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE comunicaciones IS 'ISO 9001:2015 §7.4 — Matriz de comunicaciones internas y externas';

-- ── §10.3 — Mejora Continua ────────────────────────────────
CREATE TABLE IF NOT EXISTS mejoras_continuas (
    id                SERIAL PRIMARY KEY,
    codigo            VARCHAR(30) NOT NULL UNIQUE,
    titulo            VARCHAR(200) NOT NULL,
    origen            VARCHAR(40) NOT NULL
                      CHECK (origen IN (
                        'Auditoría',
                        'Indicador',
                        'Revisión dirección',
                        'Sugerencia',
                        'Análisis de datos',
                        'Quejas cliente'
                      )),
    proceso           VARCHAR(150),
    descripcion       TEXT,
    beneficio_esperado TEXT,
    responsable       VARCHAR(100),
    fecha_inicio      DATE,
    fecha_cierre      DATE,
    avance_pct        INTEGER NOT NULL DEFAULT 0
                      CHECK (avance_pct BETWEEN 0 AND 100),
    estado            VARCHAR(20) NOT NULL DEFAULT 'Propuesta'
                      CHECK (estado IN (
                        'Propuesta',
                        'Aprobada',
                        'En ejecución',
                        'Completada',
                        'Cancelada'
                      )),
    proceso_id        INTEGER REFERENCES procesos(id),
    creado_por        INTEGER REFERENCES usuarios(id),
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE mejoras_continuas IS 'ISO 9001:2015 §10.3 — Iniciativas de mejora continua del SGC';


-- ============================================================
--  PARTE 3: ÍNDICES PARA LAS NUEVAS TABLAS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_planes_op_estado         ON planes_operacion(estado);
CREATE INDEX IF NOT EXISTS idx_reqs_ps_estado           ON requerimientos_ps(estado);
CREATE INDEX IF NOT EXISTS idx_proyectos_diseno_etapa   ON proyectos_diseno(etapa);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_estado    ON ordenes_compra(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_prod_etapa       ON ordenes_produccion(etapa);
CREATE INDEX IF NOT EXISTS idx_ordenes_prod_conformidad ON ordenes_produccion(conformidad);
CREATE INDEX IF NOT EXISTS idx_liberaciones_decision    ON liberaciones_ps(decision);
CREATE INDEX IF NOT EXISTS idx_salidas_nc_estado        ON salidas_nc(estado);
CREATE INDEX IF NOT EXISTS idx_toma_consciencia_estado  ON toma_consciencia(estado);
CREATE INDEX IF NOT EXISTS idx_comunicaciones_tipo      ON comunicaciones(tipo);
CREATE INDEX IF NOT EXISTS idx_mejoras_estado           ON mejoras_continuas(estado);
CREATE INDEX IF NOT EXISTS idx_mejoras_origen           ON mejoras_continuas(origen);


-- ============================================================
--  PARTE 4: DATOS SEMILLA INICIALES
-- ============================================================

-- Datos semilla para comunicaciones (matriz base del SGC)
INSERT INTO comunicaciones (que, cuando, quien, a_quien, como, tipo, estado) VALUES
  ('Política y objetivos de calidad',    'Al ingreso y revisión anual',       'Alta Dirección',       'Todo el personal',              'Reunión, cartelera, intranet',              'Interna', 'Activo'),
  ('Resultados de auditorías internas',  'Al cierre de cada auditoría',        'Auditor Líder',        'Dueños de proceso auditados',   'Informe escrito + reunión de cierre',       'Interna', 'Activo'),
  ('Cambios en el SGC',                  'Antes de implementar cambios',       'Director de Calidad',  'Personal impactado',            'Correo electrónico + capacitación',         'Interna', 'Activo'),
  ('Retroalimentación al cliente',       'Después de cada entrega',            'Director Comercial',   'Clientes',                      'Encuesta de satisfacción + llamada',        'Externa', 'Activo'),
  ('Requisitos a proveedores',           'Al emitir orden de compra',          'Jefe de Compras',      'Proveedores aprobados',         'Orden de compra + especificaciones',        'Externa', 'Activo'),
  ('Indicadores de desempeño del SGC',   'Mensualmente',                       'Coordinador Calidad',  'Gerencia y dueños de proceso',  'Informe mensual + tablero de indicadores',  'Interna', 'Activo')
ON CONFLICT DO NOTHING;
