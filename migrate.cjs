const { Client } = require('pg');
const fs = require('fs');

require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  await client.connect();
  console.log('Connected to DB');
  
  // Read schema.sql, strip out the CREATE DATABASE and connect parts
  const fullSchema = fs.readFileSync('schema.sql', 'utf8');
  const parts = fullSchema.split('IS_TEMPLATE = False;');
  const sqlToRun = parts.length > 1 ? parts[1] : fullSchema;
  
  try {
    console.log('Applying schema.sql...');
    await client.query(sqlToRun);
    console.log('Schema applied successfully.');
  } catch (e) {
    console.error('Error applying schema:', e);
  }
  
  try {
    console.log('Adding new columns for RF-018...');
    await client.query(`
      ALTER TABLE requerimientos_ps 
      ADD COLUMN IF NOT EXISTS cotizacion TEXT,
      ADD COLUMN IF NOT EXISTS aprobacion_interna TEXT,
      ADD COLUMN IF NOT EXISTS matriz_legal TEXT,
      ADD COLUMN IF NOT EXISTS url_contrato TEXT;
    `);
    console.log('Columns added successfully.');
  } catch (e) {
    console.error('Error adding columns:', e);
  }
  
  await client.end();
}

run();
