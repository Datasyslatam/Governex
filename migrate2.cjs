const { Client } = require('pg');
const fs = require('fs');

require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  await client.connect();
  console.log('Connected to DB');
  
  try {
    console.log('Creating missing tables...');
    await client.query(`
    CREATE TABLE IF NOT EXISTS fichas_tecnicas_ps (
        ID VARCHAR(60) PRIMARY KEY,
        TIPO VARCHAR(20) NOT NULL CHECK (TIPO IN ('educativa', 'general')),
        GENERADA_CON_IA BOOLEAN NOT NULL DEFAULT TRUE,
        CLIENTE VARCHAR(200),
        PRODUCTO_SERVICIO VARCHAR(200),
        VERSION VARCHAR(20) DEFAULT '1.0',
        FECHA_ELABORACION DATE,
        ELABORADO_POR VARCHAR(150),
        APROBADO_POR VARCHAR(150),
        ESTADO VARCHAR(20) NOT NULL DEFAULT 'En revisión' CHECK (ESTADO IN ('Vigente', 'En revisión', 'Obsoleta')),
        DESCRIPCION TEXT,
        ESPECIFICACIONES_TECNICAS TEXT,
        NORMAS_APLICABLES TEXT,
        CONDICIONES_USO TEXT,
        AREA_ASIGNATURA VARCHAR(200),
        OBJETIVO_GENERAL TEXT,
        COMPETENCIAS TEXT,
        UNIDADES_CURRICULARES JSONB NOT NULL DEFAULT '[]',
        TOTAL_HORAS_SEMANA INTEGER DEFAULT 0,
        OBSERVACIONES TEXT,
        CREADO_POR INTEGER REFERENCES USUARIOS (ID),
        CREADO_EN TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    `);
    console.log('Tables created successfully.');
  } catch (e) {
    console.error('Error applying schema:', e);
  }
  
  await client.end();
}

run();
