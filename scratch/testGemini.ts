import { analyzeWithGemini } from '../src/services/geminiService';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const mapa = {
  cliente: 'Requisitos',
  satisfaccion: 'Satisfaccion',
  estrategicos: [{ nombre: 'Direccion' }],
  misionales: [{ nombre: 'Operaciones' }],
  apoyo: [{ nombre: 'RRHH' }],
  datosEmpresa: {
    nombreEmpresa: 'Test S.A.',
    sector: 'Tecnologia',
    tipoEmpresa: 'Servicios',
    tamano: 'Micro',
    ubicacion: 'Bogota',
    anoFundacion: '2020',
    mision: 'Test mision',
    vision: 'Test vision',
    politicaCalidad: 'Test politica',
    productosServicios: 'Software',
    mercadoObjetivo: 'B2B',
    cantidadEmpleados: '10',
    alcanceSGC: 'Desarrollo de software',
    certificaciones: 'Ninguna',
    parteInteresadas: 'Clientes',
  }
};

async function run() {
  try {
    const res = await analyzeWithGemini(mapa as any);
    console.log('PESTEL length:', res.pestel?.length);
    console.log('DOFA length:', res.dofa?.length);
    console.log('Caracterizacion length:', res.caracterizacion?.length);
    console.log('Roles length:', res.matrizRoles?.length);
    console.log('Recursos length:', res.matrizRecursos?.length);
  } catch (e) {
    console.error(e);
  }
}

run();
