// Pruebas de seguridad y regresión contra un servidor Governex en ejecución.
//
// Requisitos:
//   - BD de pruebas creada con tests/setup-db.sh
//   - servidor corriendo contra esa BD (npm run build && npm start)
// Variables:
//   BASE_URL      (por defecto http://localhost:3001)
//   DATABASE_URL  la MISMA BD de pruebas (para verificar el estado real de los datos)
//
// Ejecutar:  npm test
//
// Fase 2: la sesión viaja en una cookie HttpOnly (ya no hay tokens Bearer) y
// los Superusuarios tienen MFA obligatorio. `req` actúa como un navegador
// mínimo (guarda cookies y reenvía X-CSRF-Token) y `login` completa el
// enrolamiento/verificación TOTP cuando el servidor lo pide.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import pg from 'pg'

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const PASSWORD = 'Prueba123*'
const MARCADOR_B = 'SECRETO-B'

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
const tokens = {} // nombre -> sesión (jar de cookies)

class Sesion {
  constructor() { this.cookies = new Map() }
  absorber(lista) {
    for (const sc of lista) {
      const [par, ...attrs] = sc.split(';')
      const i = par.indexOf('=')
      const k = par.slice(0, i).trim(), v = par.slice(i + 1).trim()
      if (!v || attrs.some(a => /max-age=0\b/i.test(a.trim()))) this.cookies.delete(k)
      else this.cookies.set(k, v)
    }
  }
  get header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
  get csrf() { return decodeURIComponent(this.cookies.get('gx_csrf') || '') }
}

async function req(method, path, { token, body, headers = {} } = {}) {
  const sesion = token instanceof Sesion ? token : null
  const res = await fetch(BASE + path, {
    method,
    redirect: 'manual',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(sesion?.header ? { Cookie: sesion.header } : {}),
      ...(sesion && method !== 'GET' && sesion.csrf ? { 'X-CSRF-Token': sesion.csrf } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (sesion) sesion.absorber(res.headers.getSetCookie())
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data, headers: res.headers, text }
}

// ── TOTP (RFC 6238), como una app autenticadora ──────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function totp(secreto, paso) {
  let bits = 0, val = 0; const k = []
  for (const ch of secreto) { val = (val << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { k.push((val >>> (bits - 8)) & 255); bits -= 8 } }
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(paso))
  const h = crypto.createHmac('sha1', Buffer.from(k)).update(c).digest()
  const o = h[h.length - 1] & 15
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0')
}
const secretos = new Map(), ultimoPaso = new Map()
async function codigo(email) {
  const paso = () => Math.floor(Date.now() / 30000)
  while (ultimoPaso.has(email) && paso() <= ultimoPaso.get(email)) await new Promise(r => setTimeout(r, 1000))
  ultimoPaso.set(email, paso())
  return totp(secretos.get(email), paso())
}

/** Primer paso del login. Devuelve { status, data, sesion }. */
async function login(email, password = PASSWORD) {
  const sesion = new Sesion()
  const r = await req('POST', '/api/auth/login', { token: sesion, body: { email, password } })
  return { ...r, sesion }
}

/** Login completo (incluye MFA si el servidor lo exige). Devuelve la sesión. */
async function iniciarSesion(email, password = PASSWORD) {
  const r = await login(email, password)
  assert.equal(r.status, 200, `login de ${email} debería funcionar: ${r.text}`)
  if (r.data.estado === 'enrolar_mfa') {
    const c = await req('POST', '/api/auth/mfa/configurar', { token: r.sesion, body: {} })
    assert.equal(c.status, 200, c.text)
    secretos.set(email, c.data.secreto)
    const a = await req('POST', '/api/auth/mfa/activar', { token: r.sesion, body: { codigo: await codigo(email) } })
    assert.equal(a.status, 200, a.text)
  } else if (r.data.estado === 'mfa') {
    const v = await req('POST', '/api/auth/mfa/verificar', { token: r.sesion, body: { codigo: await codigo(email) } })
    assert.equal(v.status, 200, v.text)
  }
  return r.sesion
}

const fila = async (tabla, id) => (await db.query(`SELECT * FROM ${tabla} WHERE id = $1`, [id])).rows[0]

before(async () => {
  assert.ok(process.env.DATABASE_URL, 'Defina DATABASE_URL (BD de pruebas)')
  await db.connect()
  for (const [k, email] of Object.entries({ A: 'supera@a.test', B: 'superb@b.test', op1: 'opa1@a.test', op2: 'opa2@a.test' })) {
    tokens[k] = await iniciarSesion(email)
  }
})
after(() => db.end())

describe('Funcionalidad base', () => {
  test('healthchecks responden', async () => {
    assert.equal((await req('GET', '/health')).status, 200)
    const api = await req('GET', '/api/health')
    assert.equal(api.status, 200)
    assert.equal(api.data.status, 'ok')
  })
  test('login: contraseña incorrecta → 401', async () => {
    assert.equal((await login('supera@a.test', 'incorrecta')).status, 401)
  })
  test('login: empresa suspendida → 403', async () => {
    assert.equal((await login('susp@c.test')).status, 403)
  })
  test('sin sesión → 401', async () => {
    assert.equal((await req('GET', '/api/riesgos')).status, 401)
  })
  test('usuario autenticado lista sus riesgos → 200', async () => {
    assert.equal((await req('GET', '/api/riesgos', { token: tokens.A })).status, 200)
  })
})

describe('Aislamiento entre empresas: listados no muestran datos de otra empresa', () => {
  const listados = [
    '/api/riesgos', '/api/indicadores', '/api/proveedores', '/api/comunicacion',
    '/api/mejora-continua', '/api/nc-ac/no-conformidades', '/api/salidas-nc', '/api/procesos',
  ]
  for (const ruta of listados) {
    test(`GET ${ruta} (empresa A) no contiene datos de B`, async () => {
      const r = await req('GET', ruta, { token: tokens.A })
      assert.equal(r.status, 200, r.text.slice(0, 200))
      assert.ok(!r.text.includes(MARCADOR_B), `la respuesta incluye datos de la empresa B: ${r.text.slice(0, 200)}`)
    })
  }
  test('control: la empresa B sí ve sus propios datos', async () => {
    const r = await req('GET', '/api/riesgos', { token: tokens.B })
    assert.ok(r.text.includes(MARCADOR_B))
  })
})

describe('Aislamiento entre empresas: A no puede leer, modificar ni borrar registros de B por id', () => {
  const lecturas = [['/api/comunicacion/9304'], ['/api/mejora-continua/9305'], ['/api/salidas-nc/9307']]
  for (const [ruta] of lecturas) {
    test(`GET ${ruta} → no entrega el registro de B`, async () => {
      const r = await req('GET', ruta, { token: tokens.A })
      assert.ok(r.status === 404 || r.status === 403, `status ${r.status}`)
      assert.ok(!r.text.includes(MARCADOR_B))
    })
  }

  const ediciones = [
    ['riesgos', 9301, '/api/riesgos/9301', { descripcion: 'HACKEADO', probabilidad: 1, impacto: 1, estado: 'MONITOREO', tipo: 'Riesgo' }, 'descripcion'],
    ['indicadores', 9302, '/api/indicadores/9302', { titulo: 'HACKEADO', frecuencia: 'Mensual', meta: '1', activo: true }, 'titulo'],
    ['proveedores', 9303, '/api/proveedores/9303', { nit: 'NIT-B-01', razon: 'HACKEADO', estado: 'Aprobado', periodicidad_evaluacion: 'Anual' }, 'razon'],
    ['comunicaciones', 9304, '/api/comunicacion/9304', { que: 'HACKEADO', tipo: 'Interna', estado: 'Activo' }, 'que'],
    ['mejoras_continuas', 9305, '/api/mejora-continua/9305', { codigo: 'M-B-01', titulo: 'HACKEADO', origen: 'Sugerencia', estado: 'Propuesta', avance_pct: 0 }, 'titulo'],
    ['no_conformidades', 9306, '/api/nc-ac/no-conformidades/9306', { origen: 'Otro', descripcion: 'HACKEADO', gravedad: 'Menor', estado: 'Abierta' }, 'descripcion'],
    ['salidas_nc', 9307, '/api/salidas-nc/9307', { codigo: 'S-B-01', descripcion: 'HACKEADO', detectado_en: 'Producción', disposicion: 'Reparar', estado: 'Abierta' }, 'descripcion'],
  ]
  for (const [tabla, id, ruta, body, campo] of ediciones) {
    test(`PUT ${ruta} → el registro de B no cambia`, async () => {
      const antes = await fila(tabla, id)
      const r = await req('PUT', ruta, { token: tokens.A, body })
      assert.ok(r.status >= 400, `status ${r.status}: ${r.text.slice(0, 150)}`)
      const despues = await fila(tabla, id)
      assert.equal(despues[campo], antes[campo])
      assert.equal(despues.tenant_id, 9002)
    })
  }

  const borrados = [
    ['riesgos', 9301, '/api/riesgos/9301'], ['indicadores', 9302, '/api/indicadores/9302'],
    ['proveedores', 9303, '/api/proveedores/9303'], ['comunicaciones', 9304, '/api/comunicacion/9304'],
    ['mejoras_continuas', 9305, '/api/mejora-continua/9305'], ['salidas_nc', 9307, '/api/salidas-nc/9307'],
  ]
  for (const [tabla, id, ruta] of borrados) {
    test(`DELETE ${ruta} → el registro de B sigue existiendo`, async () => {
      await req('DELETE', ruta, { token: tokens.A })
      assert.ok(await fila(tabla, id), `la empresa A borró el registro ${tabla}#${id} de la empresa B`)
    })
  }
})

describe('Integridad padre → hijo (migración 022)', () => {
  test('A no puede crear un indicador colgado de un proceso de B', async () => {
    const r = await req('POST', '/api/indicadores', {
      token: tokens.A,
      body: { codigo: 'I-ATAQUE', titulo: 'Ataque', proceso_id: 9202, frecuencia: 'Mensual', meta: '1' },
    })
    assert.ok(r.status >= 400, `status ${r.status}`)
    const { rowCount } = await db.query(`SELECT 1 FROM indicadores WHERE codigo = 'I-ATAQUE'`)
    assert.equal(rowCount, 0)
  })
  test('A sí puede crear un indicador de su propio proceso', async () => {
    const r = await req('POST', '/api/indicadores', {
      token: tokens.A,
      body: { codigo: 'I-PROPIO', titulo: 'Propio', proceso_id: 9201, frecuencia: 'Mensual', meta: '1' },
    })
    assert.ok(r.status === 200 || r.status === 201, `status ${r.status}: ${r.text.slice(0, 150)}`)
  })
  test('A no puede reasignar su riesgo a un proceso de B', async () => {
    await db.query(`INSERT INTO riesgos (id, codigo, descripcion, probabilidad, impacto, proceso_id, tenant_id)
                    VALUES (9401, 'R-A-01', 'Riesgo de A', 2, 2, 9201, 9001) ON CONFLICT DO NOTHING`)
    const r = await req('PUT', '/api/riesgos/9401', {
      token: tokens.A,
      body: { descripcion: 'Riesgo de A', proceso_id: 9202, probabilidad: 2, impacto: 2, estado: 'MONITOREO', tipo: 'Riesgo' },
    })
    assert.ok(r.status >= 400, `status ${r.status}`)
    assert.equal((await fila('riesgos', 9401)).proceso_id, 9201)
  })
})

describe('Archivos (H1)', () => {
  const ajena = '/api/uploads/view/tenants/9002_empresa_b/1_[x]_secreto.pdf'
  test('/uploads/view sin sesión → 401', async () => {
    assert.equal((await req('GET', ajena)).status, 401)
  })
  test('/uploads/view de archivo de otra empresa → 404', async () => {
    assert.equal((await req('GET', ajena, { token: tokens.A })).status, 404)
  })
  test('/uploads/view de archivo propio → 302 a URL firmada', async () => {
    assert.equal((await req('GET', '/api/uploads/view/tenants/9001_empresa_a/1_[x]_propio.pdf', { token: tokens.A })).status, 302)
  })
  test('signed-url acepta el prefijo /api/uploads/view/', async () => {
    const k = encodeURIComponent('/api/uploads/view/tenants/9001_empresa_a/1_[x]_propio.pdf')
    assert.equal((await req('GET', `/api/uploads/signed-url?key=${k}`, { token: tokens.A })).status, 200)
  })
  test('archivo heredado registrado: visible para su empresa, no para otra', async () => {
    assert.equal((await req('GET', '/api/uploads/signed-url?key=legacy_flat_key.pdf', { token: tokens.A })).status, 200)
    assert.equal((await req('GET', '/api/uploads/signed-url?key=legacy_flat_key.pdf', { token: tokens.B })).status, 404)
  })
  test('clave con ".." rechazada', async () => {
    const k = encodeURIComponent('9001/../tenants/9002_empresa_b/x.pdf')
    assert.equal((await req('GET', `/api/uploads/signed-url?key=${k}`, { token: tokens.A })).status, 404)
  })
})

describe('Permisos y usuarios', () => {
  test('H3: caché RBAC por usuario, no por rol', async () => {
    const r1 = await req('DELETE', '/api/riesgos/999999', { token: tokens.op1 }) // puebla la caché
    const r2 = await req('DELETE', '/api/riesgos/999999', { token: tokens.op2 })
    assert.notEqual(r1.status, 403, 'usuario con permiso personalizado debería pasar RBAC')
    assert.equal(r2.status, 403, 'usuario sin permiso (mismo rol) debería recibir 403')
  })
  test('H2: guía de capacitación no se escribe sobre planes de otra empresa', async () => {
    // Sin GEMINI_API_KEY real la IA no responde; se verifica que el plan de B
    // no haya sido tocado por ninguna ruta.
    assert.equal((await fila('plan_formacion', 9308)).guia_markdown, null)
  })
  test('H11: editar usuario cambiando la contraseña funciona', async () => {
    const r = await req('PUT', '/api/auth/users/90103', {
      token: tokens.A, body: { nombre: 'Oper A2', email: 'opa2@a.test', rol_id: 3, activo: true, password: 'NuevaClave456*' },
    })
    assert.equal(r.status, 200, r.text)
    assert.equal((await login('opa2@a.test', 'NuevaClave456*')).status, 200)
  })
  test('H12: editar usuario de otra empresa → 404 y el pool sigue sano', async () => {
    for (let i = 0; i < 12; i++) {
      const r = await req('PUT', '/api/auth/users/90201', { token: tokens.A, body: { nombre: 'x', email: 'x@x.test', rol_id: 1 } })
      assert.equal(r.status, 404)
    }
    for (let i = 0; i < 12; i++) assert.equal((await req('GET', '/api/auth/users', { token: tokens.A })).status, 200)
  })
})

describe('HTTP', () => {
  test('H13: JSON de ~300 KB no es rechazado con 413', async () => {
    const r = await req('POST', '/api/gemini/extraer-procesos-imagen', {
      token: tokens.A, body: { base64: 'A'.repeat(300 * 1024), mimeType: 'image/png', fileName: 'org.png' },
    })
    assert.notEqual(r.status, 413)
  })
  test('cabeceras de seguridad presentes y sin X-Powered-By', async () => {
    const r = await req('GET', '/health')
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN')
    assert.equal(r.headers.get('x-powered-by'), null)
  })
  test('CSP en modo solo-reporte presente en el frontend', async () => {
    const r = await req('GET', '/login')
    assert.ok(r.headers.get('content-security-policy-report-only'), 'falta Content-Security-Policy-Report-Only')
    assert.equal(r.headers.get('content-security-policy'), null, 'la CSP no debe bloquear todavía')
  })
})

// Va al final: deja bloqueado al usuario opa1 por 15 minutos en este servidor.
describe('Límite de intentos de login', () => {
  test('el intento 11 tras 10 fallidos → 429, sin afectar a otro usuario', async () => {
    let ultimo
    for (let i = 0; i < 11; i++) ultimo = await login('opa1@a.test', 'mala')
    assert.equal(ultimo.status, 429)
    assert.equal((await login('supera@a.test')).status, 200)
  })
})
