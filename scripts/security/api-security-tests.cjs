#!/usr/bin/env node
/**
 * Pruebas de seguridad de la API de Governex (autenticación, autorización,
 * aislamiento entre empresas, cabeceras, CORS, límites).
 *
 * SOLO para el entorno LOCAL: se niega a ejecutarse si API_URL o
 * DATABASE_URL no apuntan a localhost. No realiza pruebas destructivas ni
 * de denegación de servicio (los límites se prueban con pocas peticiones).
 *
 * Requisitos: BD local construida con scripts/local/setup-db.cjs y API
 * corriendo (npm run dev:backend).
 *
 * Uso:  node scripts/security/api-security-tests.cjs [--json salida.json]
 * Sale con código 1 si alguna prueba falla.
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { Client } = require('pg')

const API = process.env.API_URL || 'http://127.0.0.1:3001'
const PASS = process.env.LOCAL_SEED_PASSWORD
const isLocal = (u) => { try { return ['127.0.0.1', 'localhost', '::1'].includes(new URL(u).hostname) } catch { return false } }
if (!isLocal(API) || !isLocal(process.env.DATABASE_URL || '')) {
  console.error('ABORTADO: estas pruebas solo se ejecutan contra la API y la BD locales.')
  process.exit(1)
}

const results = []
const RUN = Date.now().toString(36)

async function call(method, url, { token, body, headers = {}, raw } = {}) {
  const h = { ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  let payload
  if (raw !== undefined) { payload = raw; h['Content-Type'] = h['Content-Type'] || 'application/json' }
  else if (body !== undefined) { payload = JSON.stringify(body); h['Content-Type'] = 'application/json' }
  const res = await fetch(API + url, { method, headers: h, body: payload, redirect: 'manual' })
  let data = null
  const text = await res.text()
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data, headers: res.headers }
}

async function test(id, name, ref, fn) {
  try {
    const detail = await fn()
    results.push({ id, name, ref, ok: true, detail: detail || '' })
    console.log(`  PASS  ${id}  ${name}`)
  } catch (e) {
    results.push({ id, name, ref, ok: false, detail: e.message })
    console.log(`  FAIL  ${id}  ${name}\n          -> ${e.message}`)
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg) }
const expectStatus = (r, allowed, what) => {
  const list = Array.isArray(allowed) ? allowed : [allowed]
  expect(list.includes(r.status), `${what}: se esperaba ${list.join('/')} y llegó ${r.status} ${typeof r.data === 'object' ? JSON.stringify(r.data).slice(0, 160) : ''}`)
  return `HTTP ${r.status}`
}

async function login(email, password = PASS) {
  const r = await call('POST', '/api/auth/login', { body: { email, password } })
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${JSON.stringify(r.data)}`)
  return r.data.token
}

function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64url') }

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: false })
  await db.connect()
  const tid = async (nit) => (await db.query('SELECT id FROM tenants WHERE nit = $1', [nit])).rows[0].id
  const tenantA = await tid('LOCAL-A')
  const tenantB = await tid('LOCAL-B')
  const tipoB = (await db.query('SELECT id FROM tipos_proceso WHERE tenant_id = $1 LIMIT 1', [tenantB])).rows[0].id

  console.log(`\nGovernex – pruebas de seguridad (${API})\n`)

  const superA = await login('super.a@governex.test')
  const superB = await login('super.b@governex.test')
  const operA = await login('operativo.a@governex.test')
  const limA = await login('limitado.a@governex.test')

  // ── Base / regresión ────────────────────────────────────────
  await test('T01', 'Health check responde', 'Regresión', async () => expectStatus(await call('GET', '/health'), 200, 'health'))
  await test('T02', 'Usuario con permiso lee su módulo (riesgos)', 'Regresión', async () =>
    expectStatus(await call('GET', '/api/riesgos', { token: limA }), 200, 'limitado GET riesgos'))
  await test('T03', 'Superusuario lista usuarios de su empresa', 'Regresión', async () => {
    const r = await call('GET', '/api/auth/users', { token: superA })
    expectStatus(r, 200, 'GET users')
    expect(r.data.every((u) => u.email.endsWith('.a@governex.test')), 'aparecen usuarios de otra empresa')
    return `${r.data.length} usuarios, todos de la empresa A`
  })

  // ── Autenticación ───────────────────────────────────────────
  await test('T04', 'Login con contraseña incorrecta → 401 genérico', 'V13 / ASVS 2.2', async () => {
    const r1 = await call('POST', '/api/auth/login', { body: { email: 'super.a@governex.test', password: 'incorrecta' } })
    const r2 = await call('POST', '/api/auth/login', { body: { email: `noexiste.${RUN}@governex.test`, password: 'incorrecta' } })
    expectStatus(r1, 401, 'clave errada'); expectStatus(r2, 401, 'email inexistente')
    expect(r1.data.error === r2.data.error, 'mensajes distintos para usuario existente / inexistente')
    return 'mismo mensaje para ambos casos'
  })

  await test('T05', 'Empresa suspendida: clave errada NO revela el estado de la empresa', 'V13 / CWE-204', async () => {
    const r = await call('POST', '/api/auth/login', { body: { email: 'super.b@governex.test', password: 'incorrecta' } })
    // B está activa aquí; se suspende temporalmente por SQL local para la prueba.
    await db.query(`UPDATE tenants SET estado = 'Suspendido' WHERE id = $1`, [tenantB])
    try {
      const s = await call('POST', '/api/auth/login', { body: { email: 'super.b@governex.test', password: 'incorrecta' } })
      expectStatus(s, 401, 'clave errada en empresa suspendida')
      expect(s.data.error === r.data.error, 'el mensaje revela que la empresa está suspendida')
      return 'responde 401 genérico'
    } finally {
      await db.query(`UPDATE tenants SET estado = 'Activo' WHERE id = $1`, [tenantB])
    }
  })

  await test('T06', 'JWT con alg "none" es rechazado', 'V18 / CWE-347', async () => {
    const t = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ id: 1, tenantId: tenantA, rol: 'Superusuario' })}.`
    return expectStatus(await call('GET', '/api/riesgos', { token: t }), 401, 'alg none')
  })
  await test('T07', 'JWT firmado con otra clave es rechazado', 'V18 / CWE-347', async () => {
    const h = b64url({ alg: 'HS256', typ: 'JWT' }); const p = b64url({ id: 1, tenantId: tenantA, rol: 'Superusuario', exp: Math.floor(Date.now() / 1000) + 600 })
    const s = crypto.createHmac('sha256', 'clave-falsa').update(`${h}.${p}`).digest('base64url')
    return expectStatus(await call('GET', '/api/riesgos', { token: `${h}.${p}.${s}` }), 401, 'firma falsa')
  })
  await test('T08', 'Token de empresa no sirve en API de plataforma', 'Separación de privilegios', async () =>
    expectStatus(await call('GET', '/api/platform-admin/tenants', { token: superA }), 401, 'tenant→platform'))
  await test('T09', 'Endpoints de negocio exigen sesión', 'ASVS 4.1', async () => {
    for (const u of ['/api/riesgos', '/api/proveedores', '/api/uploads/view/tenants/1_x/a.pdf', '/api/gemini/generar-ideario']) {
      const r = await call(u.includes('gemini') ? 'POST' : 'GET', u, { body: u.includes('gemini') ? {} : undefined })
      expectStatus(r, 401, `sin token ${u}`)
    }
    return '4 endpoints → 401'
  })

  // ── Contraseñas ─────────────────────────────────────────────
  await test('T10', 'Política de contraseñas al crear usuario (rechaza "123456")', 'V08 / ASVS 2.1', async () => {
    const r = await call('POST', '/api/auth/users', { token: superA, body: { nombre: 'Débil', email: `debil.${RUN}@governex.test`, password: '123456', rol_id: 3 } })
    if (r.status === 201) await db.query('DELETE FROM usuarios WHERE email = $1', [`debil.${RUN}@governex.test`])
    return expectStatus(r, 400, 'contraseña débil')
  })
  await test('T11', 'Contraseña fuerte sí se acepta', 'Regresión', async () => {
    const roleId = (await db.query(`SELECT id FROM roles WHERE nombre = 'Operativo'`)).rows[0].id
    const email = `fuerte.${RUN}@governex.test`
    const r = await call('POST', '/api/auth/users', { token: superA, body: { nombre: 'Fuerte', email, password: PASS, rol_id: roleId } })
    await db.query('DELETE FROM usuarios WHERE email = $1', [email])
    return expectStatus(r, 201, 'contraseña fuerte')
  })

  // ── Autorización (BFLA) ─────────────────────────────────────
  await test('T12', 'Usuario sin "leer" en proveedores no puede listarlos', 'V03 / API5 BFLA', async () =>
    expectStatus(await call('GET', '/api/proveedores', { token: limA }), 403, 'limitado GET proveedores'))
  await test('T13', 'Usuario sin "leer" en documentos/auditorías/procesos no puede listarlos', 'V03 / API5 BFLA', async () => {
    for (const u of ['/api/documentos', '/api/auditorias', '/api/procesos', '/api/indicadores', '/api/nc-ac/no-conformidades', '/api/competencias/personal'])
      expectStatus(await call('GET', u, { token: limA }), 403, `limitado GET ${u}`)
    return '6 módulos → 403'
  })
  await test('T14', 'Operativo NO puede eliminar proveedores', 'V04 / CWE-862', async () => {
    const c = await call('POST', '/api/proveedores', { token: superA, body: { nit: `NIT-${RUN}`, razon: 'Proveedor prueba' } })
    expectStatus(c, 201, 'crear proveedor')
    const d = await call('DELETE', `/api/proveedores/${c.data.id}`, { token: operA })
    const still = (await db.query('SELECT 1 FROM proveedores WHERE id = $1', [c.data.id])).rowCount
    await db.query('DELETE FROM proveedores WHERE id = $1', [c.data.id])
    expect(still === 1, 'el proveedor fue eliminado por un Operativo')
    return expectStatus(d, 403, 'operativo DELETE proveedor')
  })
  await test('T15', 'Usuario sin permiso no puede usar la IA (consumo de costos)', 'V12 / API4', async () =>
    expectStatus(await call('POST', '/api/gemini/generar-ideario', { token: limA, body: {} }), 403, 'limitado POST gemini'))

  // ── Aislamiento entre empresas (BOLA / IDOR) ────────────────
  const procB = await call('POST', '/api/procesos', { token: superB, body: { codigo: `PB-${RUN}`, nombre: 'Proceso secreto de B', tipo_id: tipoB } })
  const riesgoB = await call('POST', '/api/riesgos', { token: superB, body: { codigo: `RB-${RUN}`, descripcion: 'Riesgo de B', probabilidad: 1, impacto: 1 } })

  await test('T16', 'Empresa A no ve procesos de B', 'API1 BOLA', async () => {
    expectStatus(procB, 201, 'crear proceso B')
    const r = await call('GET', '/api/procesos', { token: superA })
    expectStatus(r, 200, 'GET procesos A')
    expect(!JSON.stringify(r.data).includes('Proceso secreto de B'), 'A ve el proceso de B')
    return 'no aparece'
  })
  await test('T17', 'Empresa A no puede modificar un riesgo de B', 'API1 BOLA', async () => {
    expectStatus(riesgoB, 201, 'crear riesgo B')
    const r = await call('PUT', `/api/riesgos/${riesgoB.data.id}`, { token: superA, body: { descripcion: 'hackeado', probabilidad: 1, impacto: 1 } })
    const row = (await db.query('SELECT descripcion FROM riesgos WHERE id = $1', [riesgoB.data.id])).rows[0]
    expect(row.descripcion === 'Riesgo de B', 'el riesgo de B fue modificado')
    return expectStatus(r, [403, 404], 'PUT riesgo ajeno')
  })
  await test('T18', 'No se puede enlazar una auditoría a un proceso de otra empresa', 'V05 / CWE-639', async () => {
    const r = await call('POST', '/api/auditorias', { token: superA, body: { codigo: `AUD-${RUN}`, fecha_inicio: '2026-12-01', proceso_id: procB.data.id } })
    if (r.status === 201) await db.query('DELETE FROM auditorias WHERE id = $1', [r.data.id])
    return expectStatus(r, 400, 'auditoría con proceso ajeno')
  })
  await test('T19', 'No se puede enlazar un indicador a un proceso de otra empresa', 'V05 / CWE-639', async () => {
    const r = await call('POST', '/api/indicadores', { token: superA, body: { codigo: `IND-${RUN}`, titulo: 'x', proceso_id: procB.data.id, frecuencia: 'Mensual', meta: '1' } })
    if (r.status === 201) await db.query('DELETE FROM indicadores WHERE id = $1', [r.data.id])
    return expectStatus(r, 400, 'indicador con proceso ajeno')
  })
  await test('T20', 'Archivos: no se firma una key de otra empresa', 'API1 BOLA', async () =>
    expectStatus(await call('GET', `/api/uploads/signed-url?key=${encodeURIComponent(`tenants/${tenantB}_empresa_b/1_x.pdf`)}`, { token: superA }), 404, 'signed-url ajena'))

  // ── Configuración HTTP ──────────────────────────────────────
  await test('T21', 'Cabeceras de seguridad presentes y sin X-Powered-By', 'ASVS 14.4', async () => {
    const r = await call('GET', '/health')
    expect(r.headers.get('x-content-type-options') === 'nosniff', 'falta nosniff')
    expect(!!r.headers.get('x-frame-options'), 'falta X-Frame-Options')
    expect(!r.headers.get('x-powered-by'), 'expone X-Powered-By')
    return 'ok'
  })
  await test('T22', 'CORS no autoriza un origen externo', 'V14 / CWE-942', async () => {
    const r = await call('GET', '/health', { headers: { Origin: 'https://atacante.example' } })
    expect(r.headers.get('access-control-allow-origin') !== 'https://atacante.example' && r.headers.get('access-control-allow-origin') !== '*', `ACAO=${r.headers.get('access-control-allow-origin')}`)
    return 'sin Access-Control-Allow-Origin'
  })
  await test('T23', 'Cuerpo JSON de 2 MB en ruta normal → 413', 'V15 / CWE-400', async () => {
    const big = JSON.stringify({ codigo: `BIG-${RUN}`, descripcion: 'a'.repeat(2 * 1024 * 1024), probabilidad: 1, impacto: 1 })
    const r = await call('POST', '/api/riesgos', { token: superA, raw: big })
    await db.query('DELETE FROM riesgos WHERE codigo = $1', [`BIG-${RUN}`])
    return expectStatus(r, 413, 'payload 2MB')
  })
  await test('T24', 'Errores 404 de API no exponen detalles internos', 'V17 / CWE-209', async () => {
    const r = await call('GET', '/api/no-existe', { token: superA })
    expect(!/at |node_modules|\.ts:/.test(JSON.stringify(r.data)), 'traza expuesta')
    return `HTTP ${r.status}`
  })

  // ── Repositorio ─────────────────────────────────────────────
  await test('T25', 'schema.sql y migraciones no siembran credenciales', 'V11 / CWE-798', async () => {
    const root = path.join(__dirname, '..', '..')
    const files = ['schema.sql', ...fs.readdirSync(path.join(root, 'migrations')).map((f) => `migrations/${f}`)]
    const bad = files.filter((f) => /^[^-\n]*\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/m.test(fs.readFileSync(path.join(root, f), 'utf8')))
    expect(bad.length === 0, `hashes de contraseña sembrados en: ${bad.join(', ')}`)
    return 'sin hashes activos'
  })

  // ── Regresión: los roles legítimos siguen operando ──────────
  const gestA = await login('gestion.a@governex.test')
  const GETS = ['/api/riesgos', '/api/auditorias', '/api/auditorias/programas', '/api/auditorias/hallazgos', '/api/nc-ac/no-conformidades',
    '/api/nc-ac/acciones-correctivas', '/api/documentos', '/api/indicadores', '/api/proveedores', '/api/procesos', '/api/procesos/pestel',
    '/api/procesos/dofa', '/api/competencias/personal', '/api/competencias/plan-formacion', '/api/perfiles-cargo', '/api/politica',
    '/api/politica/lecturas', '/api/rev-direccion', '/api/planes-operacion', '/api/requerimientos-ps', '/api/requerimientos-ps/fichas-tecnicas',
    '/api/diseno-desarrollo', '/api/compras', '/api/compras/fichas-tecnicas', '/api/compras/evaluaciones', '/api/produccion', '/api/liberacion-ps',
    '/api/salidas-nc', '/api/toma-consciencia', '/api/comunicacion', '/api/mejora-continua', '/api/objetivos-calidad', '/api/planificacion-cambios',
    '/api/contexto-empresa/datos', '/api/contexto-empresa/matriz-roles', '/api/contexto-empresa/matriz-cargos', '/api/contexto-empresa/matriz-recursos',
    '/api/contexto-empresa/actividades', '/api/contexto-empresa/mapa-procedimiento', '/api/contexto-empresa/manual-procedimiento',
    '/api/riesgo-evidencias/eficacia/todos', '/api/enfoque-cliente']
  for (const [tid, who, tok] of [['R01', 'Superusuario', superA], ['R02', 'Gestión', gestA], ['R03', 'Operativo', operA]]) {
    await test(tid, `${who}: los ${GETS.length} listados de módulos siguen respondiendo (sin 403)`, 'Regresión V03', async () => {
      const bad = []
      for (const u of GETS) { const r = await call('GET', u, { token: tok }); if (r.status === 401 || r.status === 403) bad.push(`${u}→${r.status}`) }
      expect(bad.length === 0, bad.join(', '))
      return `${GETS.length} rutas sin 401/403`
    })
  }
  await test('R04', 'Enlazar una auditoría a un proceso PROPIO sigue funcionando', 'Regresión V05', async () => {
    const tipoA = (await db.query('SELECT id FROM tipos_proceso WHERE tenant_id = $1 LIMIT 1', [tenantA])).rows[0].id
    const p = await call('POST', '/api/procesos', { token: superA, body: { codigo: `PA-${RUN}`, nombre: 'Proceso A', tipo_id: tipoA } })
    expectStatus(p, 201, 'crear proceso A')
    const a = await call('POST', '/api/auditorias', { token: superA, body: { codigo: `AUDA-${RUN}`, fecha_inicio: '2026-12-01', proceso_id: p.data.id } })
    await db.query('DELETE FROM auditorias WHERE codigo = $1', [`AUDA-${RUN}`]); await db.query('DELETE FROM procesos WHERE id = $1', [p.data.id])
    return expectStatus(a, 201, 'auditoría con proceso propio')
  })
  await test('R05', 'Referencia con id no numérico → 400 (no 500)', 'Robustez V05', async () => {
    const r = await call('POST', '/api/indicadores', { token: superA, body: { codigo: `INDX-${RUN}`, titulo: 'x', proceso_id: "1 OR 1=1", frecuencia: 'Mensual', meta: '1' } })
    return expectStatus(r, 400, 'proceso_id inválido')
  })
  await test('R06', 'IA con permiso llega al controlador (no 403) y admite cuerpos grandes', 'Regresión V12/V15', async () => {
    const big = JSON.stringify({ base64: 'A'.repeat(3 * 1024 * 1024), mimeType: 'image/png', fileName: 'org.png' })
    const r = await call('POST', '/api/gemini/extraer-procesos-imagen', { token: superA, raw: big })
    expect(![401, 403, 413].includes(r.status), `HTTP ${r.status}`)
    expect(!r.headers.get('ratelimit-limit') || Number(r.headers.get('ratelimit-limit')) > 0, 'sin cabecera de cuota')
    return `HTTP ${r.status} (sin GEMINI_API_KEY en local se espera error controlado)`
  })
  await test('R07', 'Editar usuario con cambio de contraseña y entrar con la nueva', 'Regresión H11 / V08', async () => {
    const u = (await db.query(`SELECT id, nombre, email, rol_id FROM usuarios WHERE email = 'operativo.a@governex.test'`)).rows[0]
    const nueva = `Nv-${RUN}-Gx9!`
    const r = await call('PUT', `/api/auth/users/${u.id}`, { token: superA, body: { nombre: u.nombre, email: u.email, rol_id: u.rol_id, password: nueva, activo: true } })
    expectStatus(r, 200, 'editar usuario')
    await login(u.email, nueva)
    const debil = await call('PUT', `/api/auth/users/${u.id}`, { token: superA, body: { nombre: u.nombre, email: u.email, rol_id: u.rol_id, password: 'abc', activo: true } })
    await call('PUT', `/api/auth/users/${u.id}`, { token: superA, body: { nombre: u.nombre, email: u.email, rol_id: u.rol_id, password: PASS, activo: true } })
    return expectStatus(debil, 400, 'contraseña débil al editar')
  })
  await test('R08', 'Platform admin: login OK y alta de empresa con contraseña débil → 400', 'Regresión / V08', async () => {
    const l = await call('POST', '/api/platform-admin/login', { body: { email: 'platform@governex.test', password: PASS } })
    expectStatus(l, 200, 'login platform')
    const r = await call('POST', '/api/platform-admin/tenants', { token: l.data.token, body: { nombreEmpresa: 'X', nit: `NIT-${RUN}`, adminNombre: 'X', adminEmail: `x.${RUN}@governex.test`, adminPassword: 'corta123' } })
    expectStatus(r, 400, 'alta empresa con clave débil')
    const t = await call('GET', '/api/riesgos', { token: l.data.token })
    return expectStatus(t, 401, 'token de plataforma en API de empresa')
  })

  // ── Fuerza bruta (último: deja bloqueada la clave IP+email de prueba) ──
  await test('T26', 'Login: 11 intentos fallidos → 429', 'V09 / CWE-307', async () => {
    let last
    for (let i = 0; i < 11; i++) last = await call('POST', '/api/auth/login', { body: { email: `fuerza.${RUN}@governex.test`, password: 'x' } })
    return expectStatus(last, 429, 'intento 11')
  })

  // Limpieza de fixtures
  await db.query('DELETE FROM procesos WHERE codigo = $1', [`PB-${RUN}`]).catch(() => {})
  await db.query('DELETE FROM riesgos WHERE codigo = $1', [`RB-${RUN}`]).catch(() => {})
  await db.end()

  const passed = results.filter((r) => r.ok).length
  console.log(`\nResultado: ${passed}/${results.length} pruebas superadas\n`)
  const out = process.argv.indexOf('--json')
  if (out > -1) fs.writeFileSync(process.argv[out + 1], JSON.stringify({ fecha: new Date().toISOString(), api: API, passed, total: results.length, results }, null, 2))
  process.exit(passed === results.length ? 0 : 1)
}

main().catch((e) => { console.error('Error en la ejecución de pruebas:', e.message); process.exit(2) })
