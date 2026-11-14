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

/**
 * "Navegador" mínimo: guarda las cookies que fija el servidor (sesión HttpOnly
 * y CSRF) y las reenvía, igual que haría el frontend.
 */
class Agente {
  constructor(nombre) { this.nombre = nombre; this.cookies = new Map(); this.setCookies = [] }
  absorber(lista) {
    for (const sc of lista) {
      this.setCookies.push(sc)
      const [par, ...attrs] = sc.split(';')
      const i = par.indexOf('=')
      const k = par.slice(0, i).trim(), v = par.slice(i + 1).trim()
      const borrar = !v || attrs.some((a) => /max-age=0\b/i.test(a.trim()) || (/^expires=/i.test(a.trim()) && new Date(a.split('=')[1]) < new Date()))
      if (borrar) this.cookies.delete(k); else this.cookies.set(k, v)
    }
  }
  header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
  csrf(url) { return decodeURIComponent(this.cookies.get(url.startsWith('/api/platform-admin') ? 'gx_pcsrf' : 'gx_csrf') || '') }
  clon(nombre) { const a = new Agente(nombre); a.cookies = new Map(this.cookies); return a }
}

/** token: un Agente (cookies de sesión) o un string (se envía como Bearer). */
async function call(method, url, { token, body, headers = {}, raw, sinCsrf } = {}) {
  const h = { ...headers }
  if (token instanceof Agente) {
    const c = token.header()
    if (c) h.Cookie = c
    if (!['GET', 'HEAD'].includes(method) && !sinCsrf && token.csrf(url)) h['X-CSRF-Token'] = token.csrf(url)
  } else if (token) h.Authorization = `Bearer ${token}`
  let payload
  if (raw !== undefined) { payload = raw; h['Content-Type'] = h['Content-Type'] || 'application/json' }
  else if (body !== undefined) { payload = JSON.stringify(body); h['Content-Type'] = 'application/json' }
  const res = await fetch(API + url, { method, headers: h, body: payload, redirect: 'manual' })
  if (token instanceof Agente) token.absorber(res.headers.getSetCookie())
  let data = null
  const text = await res.text()
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data, headers: res.headers }
}

// ── TOTP (RFC 6238) para simular la app autenticadora ──────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function b32dec(s) {
  let bits = 0, val = 0; const out = []
  for (const ch of s.replace(/[^A-Z2-7]/g, '')) { val = (val << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8 } }
  return Buffer.from(out)
}
const pasoActual = () => Math.floor(Date.now() / 30000)
function totp(secreto, paso = pasoActual()) {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(paso))
  const h = crypto.createHmac('sha1', b32dec(secreto)).update(c).digest()
  const o = h[h.length - 1] & 15
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0')
}
const SECRETOS = new Map() // email -> secreto TOTP enrolado
const ULTIMO_PASO = new Map() // email -> último paso usado (anti-replay)
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
/** Código TOTP aún no usado por ese usuario (espera al siguiente paso si hace falta). */
async function codigoFresco(email) {
  while (ULTIMO_PASO.get(email) != null && pasoActual() <= ULTIMO_PASO.get(email)) await esperar(1000)
  ULTIMO_PASO.set(email, pasoActual())
  return totp(SECRETOS.get(email))
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

/**
 * Inicio de sesión completo como lo hace el frontend: contraseña y, si el
 * servidor lo pide, enrolamiento o verificación MFA. Devuelve el Agente.
 */
async function login(email, password = PASS, { plataforma = false } = {}) {
  const base = plataforma ? '/api/platform-admin' : '/api/auth'
  const ag = new Agente(email)
  const r = await call('POST', `${base}/login`, { token: ag, body: { email, password } })
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${JSON.stringify(r.data)}`)
  ag.ultimaRespuesta = r.data
  if (r.data.estado === 'enrolar_mfa') {
    const c = await call('POST', `${base}/mfa/configurar`, { token: ag, body: {} })
    if (c.status !== 200) throw new Error(`mfa/configurar ${email} -> ${c.status} ${JSON.stringify(c.data)}`)
    SECRETOS.set(email, c.data.secreto)
    const a = await call('POST', `${base}/mfa/activar`, { token: ag, body: { codigo: await codigoFresco(email) } })
    if (a.status !== 200) throw new Error(`mfa/activar ${email} -> ${a.status} ${JSON.stringify(a.data)}`)
    ag.codigosRecuperacion = a.data.codigosRecuperacion
    ag.ultimaRespuesta = a.data
  } else if (r.data.estado === 'mfa') {
    const v = await call('POST', `${base}/mfa/verificar`, { token: ag, body: { codigo: await codigoFresco(email) } })
    if (v.status !== 200) throw new Error(`mfa/verificar ${email} -> ${v.status} ${JSON.stringify(v.data)}`)
    ag.ultimaRespuesta = v.data
  }
  return ag
}

function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64url') }

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: false })
  await db.connect()
  const tid = async (nit) => (await db.query('SELECT id FROM tenants WHERE nit = $1', [nit])).rows[0].id
  const tenantA = await tid('LOCAL-A')
  const tenantB = await tid('LOCAL-B')
  const tipoB = (await db.query('SELECT id FROM tipos_proceso WHERE tenant_id = $1 LIMIT 1', [tenantB])).rows[0].id

  // Estado inicial reproducible (solo BD local): sin MFA, sin bloqueos, sin contraseñas temporales.
  await db.query(`UPDATE usuarios SET mfa_habilitado = false, mfa_secreto_cifrado = NULL, mfa_ultimo_paso = NULL,
                    intentos_fallidos = 0, bloqueado_hasta = NULL, debe_cambiar_password = false, activo = true
                  WHERE email LIKE '%@governex.test'`)
  await db.query(`UPDATE platform_admins SET mfa_habilitado = false, mfa_secreto_cifrado = NULL, mfa_ultimo_paso = NULL,
                    intentos_fallidos = 0, bloqueado_hasta = NULL, debe_cambiar_password = false
                  WHERE email LIKE '%@governex.test'`)
  await db.query(`DELETE FROM mfa_codigos_recuperacion`)

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
  await test('R07', 'Admin restablece contraseña: el usuario entra con ella y queda obligado a cambiarla', 'Regresión H11 / V08', async () => {
    const u = (await db.query(`SELECT id, nombre, email, rol_id FROM usuarios WHERE email = 'operativo.a@governex.test'`)).rows[0]
    const nueva = `Nv-${RUN}-Gx9!`
    const r = await call('PUT', `/api/auth/users/${u.id}`, { token: superA, body: { nombre: u.nombre, email: u.email, rol_id: u.rol_id, password: nueva, activo: true } })
    expectStatus(r, 200, 'editar usuario')
    const ag = await login(u.email, nueva)
    expect(ag.ultimaRespuesta.user.debeCambiarPassword === true, 'no quedó marcado debeCambiarPassword')
    const debil = await call('PUT', `/api/auth/users/${u.id}`, { token: superA, body: { nombre: u.nombre, email: u.email, rol_id: u.rol_id, password: 'abc', activo: true } })
    await call('PUT', `/api/auth/users/${u.id}`, { token: superA, body: { nombre: u.nombre, email: u.email, rol_id: u.rol_id, password: PASS, activo: true } })
    await db.query('UPDATE usuarios SET debe_cambiar_password = false WHERE id = $1', [u.id])
    return expectStatus(debil, 400, 'contraseña débil al editar')
  })

  // ═══ FASE 2: autenticación y sesiones ═══════════════════════════
  const plat = await login('platform@governex.test', PASS, { plataforma: true })

  await test('R08', 'Platform admin (con MFA): alta de empresa con contraseña débil → 400', 'Regresión / V08', async () => {
    const r = await call('POST', '/api/platform-admin/tenants', { token: plat, body: { nombreEmpresa: 'X', nit: `NIT-${RUN}`, adminNombre: 'X', adminEmail: `x.${RUN}@governex.test`, adminPassword: 'corta123' } })
    expectStatus(r, 400, 'alta empresa con clave débil')
    return expectStatus(await call('GET', '/api/riesgos', { token: plat }), 401, 'sesión de plataforma en API de empresa')
  })

  await test('S01', 'Login no entrega token al JavaScript: cookie HttpOnly + SameSite=Strict', 'V07 / ASVS 3.4', async () => {
    const ag = await login('gestion.b@governex.test')
    expect(!('token' in ag.ultimaRespuesta), 'la respuesta incluye un token')
    const sc = ag.setCookies.find((c) => c.startsWith('gx_session='))
    expect(sc && /HttpOnly/i.test(sc) && /SameSite=Strict/i.test(sc), `cookie insegura: ${sc}`)
    const csrf = ag.setCookies.find((c) => c.startsWith('gx_csrf='))
    expect(csrf && !/HttpOnly/i.test(csrf), 'cookie CSRF ausente o no legible')
    return 'sin token en el cuerpo; gx_session HttpOnly, SameSite=Strict'
  })

  await test('S02', 'Logout revoca la sesión en el servidor (la cookie robada deja de servir)', 'V06 / ASVS 3.3.1', async () => {
    const ag = await login('gestion.b@governex.test')
    const robada = ag.clon('copia')
    expectStatus(await call('GET', '/api/riesgos', { token: robada }), 200, 'antes del logout')
    expectStatus(await call('POST', '/api/auth/logout', { token: ag, body: {} }), 200, 'logout')
    return expectStatus(await call('GET', '/api/riesgos', { token: robada }), 401, 'cookie copiada tras logout')
  })

  await test('S03', 'CSRF: POST sin X-CSRF-Token → 403; con token → permitido', 'ASVS 4.2.2 / CWE-352', async () => {
    const sin = await call('POST', '/api/riesgos', { token: superA, sinCsrf: true, body: { codigo: `CSRF-${RUN}`, descripcion: 'x', probabilidad: 1, impacto: 1 } })
    expectStatus(sin, 403, 'sin token CSRF')
    expect(sin.data.code === 'CSRF', 'no es rechazo CSRF')
    const con = await call('POST', '/api/riesgos', { token: superA, body: { codigo: `CSRF-${RUN}`, descripcion: 'x', probabilidad: 1, impacto: 1 } })
    await db.query('DELETE FROM riesgos WHERE codigo = $1', [`CSRF-${RUN}`])
    return expectStatus(con, 201, 'con token CSRF')
  })

  await test('S04', 'Superusuario debe enrolar MFA: la sesión previa no da acceso a datos', 'V02 / ASVS 2.8', async () => {
    await db.query(`UPDATE usuarios SET mfa_habilitado = false, mfa_secreto_cifrado = NULL WHERE email = 'super.b@governex.test'`)
    const ag = new Agente('pre')
    const r = await call('POST', '/api/auth/login', { token: ag, body: { email: 'super.b@governex.test', password: PASS } })
    expect(r.data.estado === 'enrolar_mfa', `estado=${r.data.estado}`)
    return expectStatus(await call('GET', '/api/riesgos', { token: ag }), 401, 'datos con sesión previa')
  })

  await test('S05', 'MFA: código errado → 401; correcto → acceso; el mismo código no se reutiliza', 'V02 / ASVS 2.8.4', async () => {
    const email = 'super.a@governex.test'
    const ag = new Agente('mfa')
    const r = await call('POST', '/api/auth/login', { token: ag, body: { email, password: PASS } })
    expect(r.data.estado === 'mfa', `estado=${r.data.estado}`)
    expectStatus(await call('POST', '/api/auth/mfa/verificar', { token: ag, body: { codigo: '000000' } }), 401, 'código errado')
    const codigo = await codigoFresco(email)
    expectStatus(await call('POST', '/api/auth/mfa/verificar', { token: ag, body: { codigo } }), 200, 'código correcto')
    expectStatus(await call('GET', '/api/riesgos', { token: ag }), 200, 'acceso tras MFA')
    const ag2 = new Agente('replay')
    await call('POST', '/api/auth/login', { token: ag2, body: { email, password: PASS } })
    return expectStatus(await call('POST', '/api/auth/mfa/verificar', { token: ag2, body: { codigo } }), 401, 'reutilizar el mismo código')
  })

  await test('S06', 'Código de recuperación sirve una sola vez', 'V02 / ASVS 2.6', async () => {
    const codigo = superA.codigosRecuperacion[0]
    const a1 = new Agente('rec1')
    await call('POST', '/api/auth/login', { token: a1, body: { email: 'super.a@governex.test', password: PASS } })
    expectStatus(await call('POST', '/api/auth/mfa/verificar', { token: a1, body: { codigo } }), 200, 'primer uso')
    const a2 = new Agente('rec2')
    await call('POST', '/api/auth/login', { token: a2, body: { email: 'super.a@governex.test', password: PASS } })
    return expectStatus(await call('POST', '/api/auth/mfa/verificar', { token: a2, body: { codigo } }), 401, 'segundo uso')
  })

  await test('S07', 'Bloqueo por cuenta: tras 5 fallos, ni la contraseña correcta entra', 'V09 / CWE-307', async () => {
    const email = 'gestion.a@governex.test'
    for (let i = 0; i < 5; i++) await call('POST', '/api/auth/login', { body: { email, password: `mala-${i}` } })
    const r = await call('POST', '/api/auth/login', { body: { email, password: PASS } })
    const row = (await db.query('SELECT bloqueado_hasta FROM usuarios WHERE email = $1', [email])).rows[0]
    await db.query('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE email = $1', [email])
    expect(row.bloqueado_hasta && new Date(row.bloqueado_hasta) > new Date(), 'la cuenta no quedó bloqueada')
    expectStatus(r, 401, 'contraseña correcta durante el bloqueo')
    const otro = await call('POST', '/api/auth/login', { body: { email: `noexiste.${RUN}@governex.test`, password: 'x' } })
    expect(r.data.error === otro.data.error, 'el mensaje de bloqueo revela que la cuenta existe')
    return 'bloqueada 15 min; mismo mensaje que un correo inexistente'
  })

  await test('S08', 'Contraseña temporal: todo responde 403 hasta cambiarla; luego acceso normal', 'V08 / ASVS 2.1.11', async () => {
    const u = (await db.query(`SELECT id FROM usuarios WHERE email = 'operativo.b@governex.test'`)).rows[0]
    await db.query('UPDATE usuarios SET debe_cambiar_password = true WHERE id = $1', [u.id])
    const ag = await login('operativo.b@governex.test')
    const r = await call('GET', '/api/riesgos', { token: ag })
    expectStatus(r, 403, 'acceso con contraseña temporal')
    expect(r.data.code === 'PASSWORD_CHANGE_REQUIRED', 'código distinto')
    const nueva = `Op-${RUN}-Nueva9!`
    expectStatus(await call('POST', '/api/auth/password', { token: ag, body: { actual: PASS, nueva } }), 200, 'cambiar contraseña')
    expectStatus(await call('GET', '/api/riesgos', { token: ag }), 200, 'acceso tras cambiarla')
    await db.query('UPDATE usuarios SET password_hash = (SELECT password_hash FROM usuarios WHERE email = $1) WHERE id = $2', ['operativo.a@governex.test', u.id])
    return 'bloqueo hasta el cambio y acceso posterior'
  })

  await test('S09', 'Cambiar la contraseña cierra las demás sesiones del usuario', 'V06 / ASVS 3.3.3', async () => {
    const email = 'gestion.b@governex.test'
    const a1 = await login(email), a2 = await login(email)
    const nueva = `Ge-${RUN}-Nueva9!`
    expectStatus(await call('POST', '/api/auth/password', { token: a1, body: { actual: PASS, nueva } }), 200, 'cambio')
    const r1 = await call('GET', '/api/riesgos', { token: a1 }), r2 = await call('GET', '/api/riesgos', { token: a2 })
    await db.query('UPDATE usuarios SET password_hash = (SELECT password_hash FROM usuarios WHERE email = $1) WHERE email = $2', ['gestion.a@governex.test', email])
    expectStatus(r1, 200, 'sesión que cambió la contraseña')
    return expectStatus(r2, 401, 'otra sesión del mismo usuario')
  })

  await test('S10', 'Desactivar un usuario corta su sesión de inmediato', 'V06 / ASVS 3.3', async () => {
    const u = (await db.query(`SELECT id, nombre, email, rol_id FROM usuarios WHERE email = 'limitado.a@governex.test'`)).rows[0]
    const ag = await login(u.email)
    expectStatus(await call('GET', '/api/riesgos', { token: ag }), 200, 'antes')
    expectStatus(await call('PUT', `/api/auth/users/${u.id}`, { token: superA, body: { nombre: u.nombre, email: u.email, rol_id: u.rol_id, activo: false, tiene_permisos_personalizados: true, permisos_ids: (await db.query(`SELECT id FROM permisos WHERE recurso='riesgos' AND accion='leer'`)).rows.map((x) => x.id) } }), 200, 'desactivar')
    const r = await call('GET', '/api/riesgos', { token: ag })
    await db.query('UPDATE usuarios SET activo = true WHERE id = $1', [u.id])
    return expectStatus(r, 401, 'sesión de usuario desactivado')
  })

  await test('S11', 'Migración transparente: el hash bcrypt pasa a Argon2id al iniciar sesión', 'V08 / ASVS 2.4.1', async () => {
    // Precondición: hash bcrypt (como el de las cuentas creadas antes de la Fase 2).
    await db.query(`UPDATE usuarios SET password_hash = $1 WHERE email = 'limitado.b@governex.test'`, [require('bcryptjs').hashSync(PASS, 10)])
    await login('limitado.b@governex.test')
    const h2 = (await db.query(`SELECT password_hash FROM usuarios WHERE email = 'limitado.b@governex.test'`)).rows[0].password_hash
    expect(h2.startsWith('$argon2id$v=19$m=19456,t=2,p=1$'), `hash resultante: ${h2.slice(0, 30)}`)
    return 'bcrypt → $argon2id$ m=19456,t=2,p=1'
  })

  await test('S12', 'El secreto MFA se guarda cifrado (no en claro) en la BD', 'V02 / ASVS 6.2 / CWE-312', async () => {
    const row = (await db.query(`SELECT mfa_secreto_cifrado FROM usuarios WHERE email = 'super.a@governex.test'`)).rows[0]
    expect(row.mfa_secreto_cifrado.startsWith('v1:') && !row.mfa_secreto_cifrado.includes(SECRETOS.get('super.a@governex.test')), 'secreto legible')
    return 'AES-256-GCM (v1:iv:tag:dato)'
  })

  await test('S13', 'Sesión inactiva 31 min expira', 'V06 / ASVS 3.3.2', async () => {
    const ag = await login('gestion.b@governex.test')
    await db.query(`UPDATE sesiones SET ultimo_uso_en = NOW() - interval '31 minutes' WHERE usuario_id = (SELECT id FROM usuarios WHERE email = 'gestion.b@governex.test') AND revocada_en IS NULL`)
    return expectStatus(await call('GET', '/api/riesgos', { token: ag }), 401, 'tras inactividad')
  })

  await test('S14', 'Platform admin: MFA obligatorio antes de cualquier acceso', 'V02 / V20', async () => {
    const email = 'platform@governex.test'
    const ag = new Agente('pa')
    const r = await call('POST', '/api/platform-admin/login', { token: ag, body: { email, password: PASS } })
    expect(['mfa', 'enrolar_mfa'].includes(r.data.estado), `estado=${r.data.estado}`)
    return expectStatus(await call('GET', '/api/platform-admin/tenants', { token: ag }), 401, 'tenants sin MFA')
  })

  await test('S15', 'Suplantación: sesión de 30 min marcada y visible en /me', 'V19 / trazabilidad', async () => {
    const u = (await db.query(`SELECT id FROM usuarios WHERE email = 'operativo.a@governex.test'`)).rows[0]
    const imp = plat.clon('suplantacion')
    const r = await call('POST', `/api/platform-admin/tenants/${tenantA}/impersonate`, { token: imp, body: { usuarioId: u.id, motivo: 'Prueba S15 de suplantación' } })
    expectStatus(r, 200, 'impersonate')
    expect(!('token' in r.data), 'devuelve token en el cuerpo')
    const me = await call('GET', '/api/auth/me', { token: imp })
    expectStatus(me, 200, '/me suplantado')
    expect(me.data.suplantacion === true, 'no marca suplantación')
    const s = (await db.query(`SELECT suplantado_por_admin, EXTRACT(EPOCH FROM expira_en - creada_en) AS seg FROM sesiones WHERE usuario_id = $1 AND suplantado_por_admin IS NOT NULL ORDER BY creada_en DESC LIMIT 1`, [u.id])).rows[0]
    expect(s && Math.abs(Number(s.seg) - 1800) < 5, `duración ${s && s.seg} s`)
    return 'suplantado_por_admin registrado; 30 min'
  })

  await test('S16', 'Cambio de rol: se aplica de inmediato y cierra la sesión', 'V06 / BFLA', async () => {
    const u = (await db.query(`SELECT id, nombre, email, rol_id FROM usuarios WHERE email = 'gestion.b@governex.test'`)).rows[0]
    const ag = await login(u.email)
    const operativo = (await db.query(`SELECT id FROM roles WHERE nombre = 'Operativo'`)).rows[0].id
    const superB2 = await login('super.b@governex.test')
    expectStatus(await call('PUT', `/api/auth/users/${u.id}`, { token: superB2, body: { nombre: u.nombre, email: u.email, rol_id: operativo, activo: true } }), 200, 'cambiar rol')
    const r = await call('GET', '/api/riesgos', { token: ag })
    await db.query('UPDATE usuarios SET rol_id = $2 WHERE id = $1', [u.id, u.rol_id])
    return expectStatus(r, 401, 'sesión con el rol anterior')
  })

  await test('S17', 'Los tokens Bearer (esquema anterior) ya no se aceptan', 'V07', async () => {
    const r = await call('GET', '/api/riesgos', { token: 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.x' })
    return expectStatus(r, 401, 'Bearer')
  })

  // ═══ FASE 3: trazabilidad y auditoría ═══════════════════════════
  const eventosPorCid = async (cid) => (await db.query('SELECT * FROM auditoria_eventos WHERE correlation_id = $1 ORDER BY id', [cid])).rows

  await test('A01', 'ID de correlación: se respeta X-Request-Id válido y se genera uno si no viene', 'V10 / ASVS 7.1', async () => {
    const propio = `prueba-${RUN}-cid`
    const r1 = await call('GET', '/api/health', { headers: { 'X-Request-Id': propio } })
    expect(r1.headers.get('x-request-id') === propio, `devolvió ${r1.headers.get('x-request-id')}`)
    const r2 = await call('GET', '/api/health', { headers: { 'X-Request-Id': 'malo<script>' } })
    expect(/^[0-9a-f-]{36}$/.test(r2.headers.get('x-request-id') || ''), `id generado inválido: ${r2.headers.get('x-request-id')}`)
    return 'propio respetado; inválido reemplazado por UUID'
  })

  await test('A02', 'Login fallido queda en la bitácora con IP, motivo y sin la contraseña', 'V10 / ASVS 7.2.1', async () => {
    const email = `fantasma.${RUN}@governex.test`
    const r = await call('POST', '/api/auth/login', { body: { email, password: 'ClaveSecreta-NoDebeAparecer-9' } })
    expectStatus(r, 401, 'login fallido')
    const ev = (await eventosPorCid(r.headers.get('x-request-id')))[0]
    expect(ev && ev.accion === 'login' && ev.resultado === 'fallo' && ev.actor_tipo === 'anonimo', `evento: ${JSON.stringify(ev)}`)
    expect(ev.detalle.motivo === 'usuario_inexistente' && ev.ip, 'falta motivo o IP')
    expect(!JSON.stringify(ev).includes('ClaveSecreta'), 'la contraseña quedó en la bitácora')
    return `evento #${ev.id}: fallo / usuario_inexistente / IP ${ev.ip}`
  })

  await test('A03', 'Login exitoso queda en la bitácora con el mismo ID de correlación', 'V10', async () => {
    const ag = new Agente('a03')
    const r = await call('POST', '/api/auth/login', { token: ag, body: { email: 'gestion.b@governex.test', password: PASS } })
    expectStatus(r, 200, 'login')
    const ev = (await eventosPorCid(r.headers.get('x-request-id'))).find((e) => e.accion === 'login')
    expect(ev && ev.resultado === 'exito' && ev.actor_tipo === 'usuario' && ev.tenant_id === tenantB, `evento: ${JSON.stringify(ev)}`)
    return `evento #${ev.id}`
  })

  await test('A04', 'Acceso denegado por RBAC queda registrado', 'V10 / ASVS 7.2.2', async () => {
    // Sesión nueva: S10 desactiva a este usuario y revoca sus sesiones anteriores.
    const r = await call('GET', '/api/proveedores', { token: await login('limitado.a@governex.test') })
    expectStatus(r, 403, 'GET proveedores sin permiso')
    const ev = (await eventosPorCid(r.headers.get('x-request-id')))[0]
    expect(ev && ev.categoria === 'acceso' && ev.accion === 'permiso_denegado' && ev.resultado === 'denegado', `evento: ${JSON.stringify(ev)}`)
    expect(ev.detalle.permiso === 'proveedores:leer', `permiso: ${ev.detalle.permiso}`)
    return 'acceso / permiso_denegado / proveedores:leer'
  })

  await test('A05', 'Intento de enlazar datos de otra empresa queda registrado', 'V10 / V05', async () => {
    const otro = (await db.query('SELECT id FROM procesos WHERE tenant_id = $1 LIMIT 1', [tenantB])).rows[0]
    const pid = otro ? otro.id : 999999
    const r = await call('POST', '/api/indicadores', { token: superA, body: { codigo: `IA5-${RUN}`, titulo: 'x', proceso_id: pid, frecuencia: 'Mensual', meta: '1' } })
    expectStatus(r, 400, 'indicador con proceso ajeno')
    const ev = (await eventosPorCid(r.headers.get('x-request-id')))[0]
    expect(ev && ev.categoria === 'seguridad' && ev.accion === 'referencia_otra_empresa', `evento: ${JSON.stringify(ev)}`)
    return 'seguridad / referencia_otra_empresa'
  })

  await test('A06', 'Bitácoras de solo inserción: UPDATE, DELETE y TRUNCATE rechazados', 'V10 / ASVS 7.3.3', async () => {
    const intentos = ['UPDATE auditoria_eventos SET accion = \'x\' WHERE id = (SELECT max(id) FROM auditoria_eventos)',
      'DELETE FROM auditoria_eventos WHERE id = (SELECT max(id) FROM auditoria_eventos)', 'TRUNCATE auditoria_eventos',
      'DELETE FROM logs_actividad WHERE id = (SELECT max(id) FROM logs_actividad)', 'UPDATE platform_admin_audit_log SET accion = \'x\'']
    const permitidos = []
    for (const q of intentos) { try { await db.query(q); permitidos.push(q) } catch { /* rechazado: correcto */ } }
    expect(permitidos.length === 0, `se permitió: ${permitidos.join(' | ')}`)
    return `${intentos.length} intentos rechazados`
  })

  await test('A07', 'Escrituras de datos quedan en la bitácora inmutable', 'V10', async () => {
    const r = await call('POST', '/api/riesgos', { token: superA, body: { codigo: `RA7-${RUN}`, descripcion: 'x', probabilidad: 1, impacto: 1 } })
    expectStatus(r, 201, 'crear riesgo')
    await esperar(300) // el registro se escribe al terminar la respuesta
    const ev = (await eventosPorCid(r.headers.get('x-request-id'))).find((e) => e.categoria === 'datos')
    await db.query('DELETE FROM riesgos WHERE codigo = $1', [`RA7-${RUN}`])
    expect(ev && ev.accion === 'crear_riesgos' && ev.detalle.elemento === `RA7-${RUN}`, `evento: ${JSON.stringify(ev)}`)
    return 'datos / crear_riesgos'
  })

  await test('A08', 'Cambio de usuario registra el valor anterior y el nuevo', 'V10 / ASVS 7.2', async () => {
    const u = (await db.query(`SELECT id, nombre, email, rol_id FROM usuarios WHERE email = 'operativo.a@governex.test'`)).rows[0]
    const body = (nombre) => ({ nombre, email: u.email, rol_id: u.rol_id, activo: true })
    const r = await call('PUT', `/api/auth/users/${u.id}`, { token: superA, body: body(`${u.nombre} X`) })
    await call('PUT', `/api/auth/users/${u.id}`, { token: superA, body: body(u.nombre) })
    expectStatus(r, 200, 'editar')
    const ev = (await eventosPorCid(r.headers.get('x-request-id'))).find((e) => e.accion === 'usuario_modificado')
    const c = ev && ev.detalle.cambios && ev.detalle.cambios.nombre
    expect(c && c.antes === u.nombre && c.despues === `${u.nombre} X`, `evento: ${JSON.stringify(ev && ev.detalle)}`)
    return 'usuarios / usuario_modificado con antes → después'
  })

  await test('A09', 'El código MFA nunca queda en las bitácoras', 'V10 / ASVS 7.1.1', async () => {
    const codigo = await codigoFresco('super.a@governex.test')
    const r = await call('POST', '/api/auth/mfa/codigos-recuperacion', { token: superA, body: { codigo } })
    expectStatus(r, 200, 'regenerar códigos')
    superA.codigosRecuperacion = r.data.codigosRecuperacion
    await esperar(300)
    const a = (await db.query('SELECT count(*)::int n FROM auditoria_eventos WHERE detalle::text LIKE $1', [`%${codigo}%`])).rows[0].n
    const l = (await db.query('SELECT count(*)::int n FROM logs_actividad WHERE detalle LIKE $1', [`%${codigo}%`])).rows[0].n
    const rec = (await db.query('SELECT count(*)::int n FROM auditoria_eventos WHERE detalle::text LIKE $1', [`%${r.data.codigosRecuperacion[0]}%`])).rows[0].n
    expect(a === 0 && l === 0 && rec === 0, `apariciones: auditoría ${a}, actividad ${l}, códigos recuperación ${rec}`)
    return 'ni el TOTP ni los códigos de recuperación aparecen'
  })

  await test('A10', 'Suplantación: exige motivo, queda registrada y la empresa la ve', 'V19', async () => {
    const u = (await db.query(`SELECT id FROM usuarios WHERE email = 'gestion.a@governex.test'`)).rows[0]
    const sin = await call('POST', `/api/platform-admin/tenants/${tenantA}/impersonate`, { token: plat.clon('s'), body: { usuarioId: u.id } })
    expectStatus(sin, 400, 'sin motivo')
    const motivo = `Ticket #${RUN} - prueba de soporte`
    const imp = plat.clon('imp')
    const r = await call('POST', `/api/platform-admin/tenants/${tenantA}/impersonate`, { token: imp, body: { usuarioId: u.id, motivo } })
    expectStatus(r, 200, 'con motivo')
    const ev = (await eventosPorCid(r.headers.get('x-request-id'))).find((e) => e.accion === 'impersonar_usuario')
    expect(ev && ev.detalle.motivo === motivo && ev.tenant_id === tenantA, `evento: ${JSON.stringify(ev)}`)
    const visible = (await db.query(`SELECT 1 FROM logs_actividad WHERE tenant_id = $1 AND accion = 'Acceso de soporte' AND detalle LIKE $2`, [tenantA, `%${motivo}%`])).rowCount
    expect(visible === 1, 'la empresa no ve el acceso de soporte en su bitácora')
    const w = await call('POST', '/api/riesgos', { token: imp, body: { codigo: `RA10-${RUN}`, descripcion: 'x', probabilidad: 1, impacto: 1 } })
    expectStatus(w, 201, 'escritura suplantada')
    await esperar(300)
    const marca = (await db.query('SELECT suplantado_por_admin FROM logs_actividad WHERE correlation_id = $1', [w.headers.get('x-request-id')])).rows[0]
    await db.query('DELETE FROM riesgos WHERE codigo = $1', [`RA10-${RUN}`])
    expect(marca && marca.suplantado_por_admin, 'la escritura suplantada no quedó marcada')
    return 'motivo obligatorio, visible para la empresa, acciones marcadas'
  })

  await test('A11', 'Separación de funciones: un operador no puede crear administradores', 'V20', async () => {
    const email = `oper.${RUN}@governex.test`
    // Contraseña propia (no LOCAL_SEED_PASSWORD): la política rechaza contraseñas
    // que contienen el nombre, y la de CI ("Ci-Prueba-…") contenía "Prueba".
    const temporal = `Zq7-${RUN}-Kw!x`
    const c = await call('POST', '/api/platform-admin/platform-admins', { token: plat, body: { nombre: 'Operador Soporte', email, password: temporal, rol: 'operador' } })
    expectStatus(c, 201, 'crear operador')
    const op = await login(email, temporal, { plataforma: true })
    expectStatus(await call('POST', '/api/platform-admin/password', { token: op, body: { actual: temporal, nueva: `Op3-${RUN}-Nueva!` } }), 200, 'cambiar temporal')
    expectStatus(await call('GET', '/api/platform-admin/tenants', { token: op }), 200, 'operador lista empresas')
    const r = await call('POST', '/api/platform-admin/platform-admins', { token: op, body: { nombre: 'X', email: `x2.${RUN}@governex.test`, password: PASS } })
    await db.query('UPDATE platform_admins SET activo = false WHERE email = $1', [email])
    expectStatus(r, 403, 'operador crea admin')
    const ev = (await eventosPorCid(r.headers.get('x-request-id')))[0]
    expect(ev && ev.accion === 'rol_plataforma_insuficiente', `evento: ${JSON.stringify(ev)}`)
    return 'operador → 403 registrado; propietario sí puede'
  })

  await test('A12', 'Integridad: la cadena verifica y una alteración directa se detecta', 'V10 / ASVS 7.3.4', async () => {
    expect((await db.query('SELECT * FROM gx_auditoria_verificar()')).rowCount === 0, 'la cadena ya estaba rota')
    const { id, accion } = (await db.query('SELECT id, accion FROM auditoria_eventos ORDER BY id DESC OFFSET 3 LIMIT 1')).rows[0]
    // Simula un atacante con privilegios de dueño que desactiva la protección.
    await db.query('ALTER TABLE auditoria_eventos DISABLE TRIGGER gx_solo_insercion')
    await db.query('UPDATE auditoria_eventos SET accion = $2 WHERE id = $1', [id, 'alterado'])
    await db.query('ALTER TABLE auditoria_eventos ENABLE TRIGGER gx_solo_insercion')
    const det = (await db.query('SELECT * FROM gx_auditoria_verificar()')).rows
    await db.query('ALTER TABLE auditoria_eventos DISABLE TRIGGER gx_solo_insercion')
    await db.query('UPDATE auditoria_eventos SET accion = $2 WHERE id = $1', [id, accion])
    await db.query('ALTER TABLE auditoria_eventos ENABLE TRIGGER gx_solo_insercion')
    expect(det.some((x) => Number(x.id) === Number(id)), `no detectó la alteración de #${id}: ${JSON.stringify(det)}`)
    expect((await db.query('SELECT * FROM gx_auditoria_verificar()')).rowCount === 0, 'no quedó íntegra tras restaurar')
    return `alteración de #${id} detectada; restaurada`
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
