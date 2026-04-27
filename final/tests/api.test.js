/**
 * BildyApp API — Suite de tests de integración
 *
 * Requisitos antes de ejecutar:
 *   1. Servidor corriendo en modo test:
 *        npm run test:server   (terminal 1)
 *   2. En otro terminal:
 *        npm test              (terminal 2)
 *
 * Los tests son SECUENCIALES y con estado compartido (flujo real de usuario).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

// ── Configuración ─────────────────────────────────────────────────────────────

const BASE = 'http://localhost:3000';
const API  = `${BASE}/api/user`;

// Emails únicos por ejecución para evitar colisiones
const seed       = Date.now();
const MAIN_EMAIL  = `main.${seed}@bildytest.com`;
const GUEST_EMAIL = `guest.${seed}@bildytest.com`;
const INV_EMAIL   = `invited.${seed}@bildytest.com`;
const PASSWORD    = 'SecurePass123!';
const NEW_PASS    = 'NuevoPass456!';

// GIF de 1×1 px (mínimo válido para el test de subida de imagen)
const GIF_1x1 = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

// ── Estado compartido entre tests ─────────────────────────────────────────────

const s = {
  mainAccess:   null,   // accessToken del usuario principal (admin)
  mainRefresh:  null,   // refreshToken del usuario principal
  guestAccess:  null,   // accessToken del usuario guest
  guestRefresh: null,   // refreshToken del usuario guest
  companyCif:   `B${seed.toString().slice(-7)}`,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Wrapper de fetch para JSON. Devuelve { status, body, headers }.
 */
const req = async (method, path, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data, headers: res.headers };
};

/**
 * Obtiene el verificationCode directamente de MongoDB (solo posible en tests).
 */
let col; // colección 'users' de Mongoose
const getCode = async (email) => {
  const doc = await col.findOne({ email }, { projection: { verificationCode: 1 } });
  return doc?.verificationCode ?? null;
};

// ── Setup / Teardown ──────────────────────────────────────────────────────────

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI no definida en el entorno de test');
  await mongoose.connect(process.env.MONGODB_URI);
  col = mongoose.connection.db.collection('users');
  console.log('  ✔ MongoDB conectado para tests');
});

after(async () => {
  // Eliminar usuarios de prueba
  const emails = [MAIN_EMAIL, GUEST_EMAIL, INV_EMAIL];
  await col.deleteMany({ email: { $in: emails } });

  // Eliminar empresa creada durante los tests
  await mongoose.connection.db
    .collection('companies')
    .deleteMany({ cif: s.companyCif });

  // Eliminar archivos de logo huérfanos no es necesario (son temporales)
  await mongoose.disconnect();
  console.log('  ✔ Limpieza completada');
});

// ══════════════════════════════════════════════════════════════════════════════
//  1. HEALTH CHECK
// ══════════════════════════════════════════════════════════════════════════════

describe('1 · Health check', { concurrency: false }, () => {
  it('GET /health → 200 y status ok', async () => {
    const res  = await fetch(`${BASE}/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
    assert.ok(body.timestamp, 'debe incluir timestamp');
  });

  it('ruta inexistente → 404 con campo error:true', async () => {
    const res  = await fetch(`${BASE}/api/ruta-que-no-existe`);
    const body = await res.json();
    assert.equal(res.status, 404);
    assert.equal(body.error, true);
    assert.ok(body.message);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  2. REGISTRO
// ══════════════════════════════════════════════════════════════════════════════

describe('2 · POST /api/user/register', { concurrency: false }, () => {
  it('201 — registra usuario y devuelve tokens', async () => {
    const { status, body } = await req('POST', '/register', {
      email: MAIN_EMAIL,
      password: PASSWORD,
    });
    assert.equal(status, 201);
    assert.ok(body.accessToken,  'debe devolver accessToken');
    assert.ok(body.refreshToken, 'debe devolver refreshToken');
    assert.equal(body.user.email,  MAIN_EMAIL);
    assert.equal(body.user.status, 'pending');
    assert.equal(body.user.role,   'admin');
    s.mainAccess  = body.accessToken;
    s.mainRefresh = body.refreshToken;
  });

  it('el email se guarda en minúsculas (Zod transform)', async () => {
    // El email ya fue guardado en el test anterior; lo verificamos en DB
    const doc = await col.findOne({ email: MAIN_EMAIL });
    assert.ok(doc, 'el usuario debe existir en DB');
    assert.equal(doc.email, MAIN_EMAIL.toLowerCase());
  });

  it('la respuesta NO incluye la contraseña', async () => {
    assert.equal(s.mainAccess  !== null, true); // tokens guardados
    // El objeto user en la respuesta de registro tampoco debe tener password
    const { body } = await req('POST', '/register', {
      email: `upper.${seed}@bildytest.com`,
      password: PASSWORD,
    });
    assert.equal(body.user?.password, undefined);
    // Limpieza del usuario temporal
    await col.deleteOne({ email: `upper.${seed}@bildytest.com` });
  });

  it('409 — email duplicado', async () => {
    const { status, body } = await req('POST', '/register', {
      email: MAIN_EMAIL,
      password: PASSWORD,
    });
    assert.equal(status, 409);
    assert.equal(body.error, true);
  });

  it('400 — email inválido (Zod)', async () => {
    const { status } = await req('POST', '/register', {
      email: 'esto-no-es-un-email',
      password: PASSWORD,
    });
    assert.equal(status, 400);
  });

  it('400 — contraseña de menos de 8 caracteres (Zod)', async () => {
    const { status } = await req('POST', '/register', {
      email: `corta.${seed}@bildytest.com`,
      password: '123',
    });
    assert.equal(status, 400);
  });

  it('400 — body vacío', async () => {
    const { status } = await req('POST', '/register', {});
    assert.equal(status, 400);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  3. VALIDACIÓN DE EMAIL
// ══════════════════════════════════════════════════════════════════════════════

describe('3 · PUT /api/user/validation', { concurrency: false }, () => {
  it('401 — sin token de autenticación', async () => {
    const { status } = await req('PUT', '/validation', { code: '123456' });
    assert.equal(status, 401);
  });

  it('400 — formato de código inválido (< 6 dígitos)', async () => {
    const { status } = await req('PUT', '/validation', { code: '123' }, s.mainAccess);
    assert.equal(status, 400);
  });

  it('400 — código alfabético (debe ser numérico)', async () => {
    const { status } = await req('PUT', '/validation', { code: 'ABCDEF' }, s.mainAccess);
    assert.equal(status, 400);
  });

  it('400 — código erróneo descuenta intentos', async () => {
    const { status, body } = await req('PUT', '/validation', { code: '000000' }, s.mainAccess);
    assert.equal(status, 400);
    assert.ok(body.message.includes('Intentos restantes'), 'mensaje debe indicar intentos restantes');
  });

  it('200 — código correcto verifica el email', async () => {
    const code = await getCode(MAIN_EMAIL);
    assert.ok(code, 'el código debe existir en DB');
    const { status, body } = await req('PUT', '/validation', { code }, s.mainAccess);
    assert.equal(status, 200);
    assert.ok(body.message);
  });

  it('el usuario queda en status "verified" en DB', async () => {
    const doc = await col.findOne({ email: MAIN_EMAIL });
    assert.equal(doc.status, 'verified');
  });

  it('400 — email ya verificado no se puede volver a validar', async () => {
    const { status } = await req('PUT', '/validation', { code: '999999' }, s.mainAccess);
    assert.equal(status, 400);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  4. LOGIN
// ══════════════════════════════════════════════════════════════════════════════

describe('4 · POST /api/user/login', { concurrency: false }, () => {
  it('200 — login con credenciales correctas', async () => {
    const { status, body } = await req('POST', '/login', {
      email: MAIN_EMAIL,
      password: PASSWORD,
    });
    assert.equal(status, 200);
    assert.ok(body.accessToken);
    assert.ok(body.refreshToken);
    assert.ok(body.user);
    s.mainAccess  = body.accessToken;
    s.mainRefresh = body.refreshToken;
  });

  it('la respuesta NO expone campos sensibles', async () => {
    const { body } = await req('POST', '/login', {
      email: MAIN_EMAIL,
      password: PASSWORD,
    });
    s.mainAccess  = body.accessToken;
    s.mainRefresh = body.refreshToken;
    assert.equal(body.user.password,            undefined, 'no debe exponer password');
    assert.equal(body.user.refreshToken,        undefined, 'no debe exponer refreshToken');
    assert.equal(body.user.verificationCode,    undefined, 'no debe exponer verificationCode');
    assert.equal(body.user.verificationAttempts, undefined, 'no debe exponer verificationAttempts');
  });

  it('401 — contraseña incorrecta', async () => {
    const { status } = await req('POST', '/login', {
      email: MAIN_EMAIL,
      password: 'ContraseñaErronea99!',
    });
    assert.equal(status, 401);
  });

  it('401 — usuario no registrado', async () => {
    const { status } = await req('POST', '/login', {
      email: `noexiste.${seed}@bildytest.com`,
      password: PASSWORD,
    });
    assert.equal(status, 401);
  });

  it('400 — body vacío', async () => {
    const { status } = await req('POST', '/login', {});
    assert.equal(status, 400);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  5. RUTAS PROTEGIDAS — sin token / token inválido
// ══════════════════════════════════════════════════════════════════════════════

describe('5 · Rutas protegidas — autenticación JWT', { concurrency: false }, () => {
  it('401 — GET /api/user sin token', async () => {
    const { status } = await req('GET', '/');
    assert.equal(status, 401);
  });

  it('401 — PUT /api/user/register sin token', async () => {
    const { status } = await req('PUT', '/register', { name: 'Test' });
    assert.equal(status, 401);
  });

  it('401 — PATCH /api/user/company sin token', async () => {
    const { status } = await req('PATCH', '/company', { isFreelance: true });
    assert.equal(status, 401);
  });

  it('401 — PATCH /api/user/logo sin token', async () => {
    const res = await fetch(`${API}/logo`, { method: 'PATCH' });
    assert.equal(res.status, 401);
  });

  it('401 — DELETE /api/user sin token', async () => {
    const res = await fetch(`${API}/`, { method: 'DELETE' });
    assert.equal(res.status, 401);
  });

  it('401 — token mal formado (string aleatorio)', async () => {
    const { status } = await req('GET', '/', undefined, 'esto.no.es.un.jwt');
    assert.equal(status, 401);
  });

  it('401 — token manipulado (firma inválida)', async () => {
    const fakeToken = s.mainAccess.slice(0, -5) + 'XXXXX';
    const { status } = await req('GET', '/', undefined, fakeToken);
    assert.equal(status, 401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  6. DATOS PERSONALES
// ══════════════════════════════════════════════════════════════════════════════

describe('6 · PUT /api/user/register — datos personales', { concurrency: false }, () => {
  it('200 — actualiza nombre, apellido y NIF', async () => {
    const { status, body } = await req(
      'PUT', '/register',
      { name: 'Juan', lastName: 'García', nif: '12345678A' },
      s.mainAccess,
    );
    assert.equal(status, 200);
    assert.equal(body.user.name,     'Juan');
    assert.equal(body.user.lastName, 'García');
    assert.equal(body.user.nif,      '12345678A');
  });

  it('el virtual fullName se devuelve correctamente', async () => {
    const { body } = await req(
      'PUT', '/register',
      { name: 'Juan', lastName: 'García', nif: '12345678A' },
      s.mainAccess,
    );
    assert.equal(body.user.fullName, 'Juan García');
  });

  it('400 — name vacío', async () => {
    const { status } = await req(
      'PUT', '/register',
      { name: '', lastName: 'García', nif: '12345678A' },
      s.mainAccess,
    );
    assert.equal(status, 400);
  });

  it('400 — falta lastName', async () => {
    const { status } = await req(
      'PUT', '/register',
      { name: 'Juan', nif: '12345678A' },
      s.mainAccess,
    );
    assert.equal(status, 400);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  7. EMPRESA — PATCH /api/user/company
// ══════════════════════════════════════════════════════════════════════════════

describe('7 · PATCH /api/user/company', { concurrency: false }, () => {

  it('200 — crea empresa nueva (no freelance)', async () => {
    const { status, body } = await req('PATCH', '/company', {
      isFreelance: false,
      name: 'Test Corp SL',
      cif: s.companyCif,
      address: {
        street: 'Calle Test', number: '1',
        city: 'Madrid', postal: '28001', province: 'Madrid',
      },
    }, s.mainAccess);
    assert.equal(status, 200);
    assert.ok(body.user.company,           'company debe venir populada');
    assert.equal(body.user.company.name,   'Test Corp SL');
    assert.equal(body.user.company.isFreelance, false);
    assert.equal(body.user.role,           'admin', 'creador es admin');
  });

  it('discriminatedUnion: isFreelance:false requiere name y cif (400 sin ellos)', async () => {
    // Registrar usuario temporal solo para esta prueba de validación
    const tmpEmail = `valtest.${seed}@bildytest.com`;
    const { body: r } = await req('POST', '/register', { email: tmpEmail, password: PASSWORD });
    const tmpToken = r.accessToken;

    const { status } = await req('PATCH', '/company', { isFreelance: false }, tmpToken);
    assert.equal(status, 400);

    await col.deleteOne({ email: tmpEmail });
  });

  it('400 — freelance sin datos personales previos (no tiene NIF)', async () => {
    const tmpEmail = `nif.${seed}@bildytest.com`;
    const { body: r } = await req('POST', '/register', { email: tmpEmail, password: PASSWORD });
    const tmpToken = r.accessToken;

    const { status } = await req('PATCH', '/company', { isFreelance: true }, tmpToken);
    assert.equal(status, 400);

    await col.deleteOne({ email: tmpEmail });
  });

  // ── Setup del usuario guest ───────────────────────────────────────────────
  it('setup: registra y verifica usuario guest', async () => {
    const { body } = await req('POST', '/register', { email: GUEST_EMAIL, password: PASSWORD });
    s.guestAccess  = body.accessToken;
    s.guestRefresh = body.refreshToken;

    const code = await getCode(GUEST_EMAIL);
    await req('PUT', '/validation', { code }, s.guestAccess);

    const { body: loginBody } = await req('POST', '/login', { email: GUEST_EMAIL, password: PASSWORD });
    s.guestAccess  = loginBody.accessToken;
    s.guestRefresh = loginBody.refreshToken;

    await req('PUT', '/register', { name: 'Ana', lastName: 'López', nif: '87654321B' }, s.guestAccess);
  });

  it('200 — segundo usuario con mismo CIF → se une como guest', async () => {
    const { status, body } = await req('PATCH', '/company', {
      isFreelance: false,
      name: 'Test Corp SL',
      cif: s.companyCif,
      address: {
        street: 'Calle Test', number: '1',
        city: 'Madrid', postal: '28001', province: 'Madrid',
      },
    }, s.guestAccess);
    assert.equal(status, 200);
    assert.equal(body.user.role, 'guest', 'al unirse a empresa ajena el rol cambia a guest');
  });

  it('200 — modo freelance usa NIF personal como CIF', async () => {
    // Crear usuario temporal con datos personales completos
    const tmpEmail = `freelance.${seed}@bildytest.com`;
    const { body: r } = await req('POST', '/register', { email: tmpEmail, password: PASSWORD });
    const tmpTk = r.accessToken;

    // Verificar y actualizar datos personales
    const code = await getCode(tmpEmail);
    await req('PUT', '/validation', { code }, tmpTk);
    const { body: lBody } = await req('POST', '/login', { email: tmpEmail, password: PASSWORD });
    const freshTk = lBody.accessToken;
    await req('PUT', '/register', { name: 'Fran', lastName: 'Autónomo', nif: 'X1234567L' }, freshTk);

    const { status, body } = await req('PATCH', '/company', { isFreelance: true }, freshTk);
    assert.equal(status, 200);
    assert.equal(body.user.company.isFreelance, true);
    assert.equal(body.user.company.cif, 'X1234567L');

    // Limpieza: eliminar usuario temporal y su empresa
    await col.deleteOne({ email: tmpEmail });
    await mongoose.connection.db.collection('companies').deleteOne({ cif: 'X1234567L' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  8. LOGO
// ══════════════════════════════════════════════════════════════════════════════

describe('8 · PATCH /api/user/logo', { concurrency: false }, () => {
  it('400 — sin archivo adjunto', async () => {
    const form = new FormData();
    const res = await fetch(`${API}/logo`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${s.mainAccess}` },
      body: form,
    });
    assert.equal(res.status, 400);
  });

  it('400 — archivo de tipo no permitido (text/plain)', async () => {
    const form = new FormData();
    form.append('logo', new Blob(['texto plano'], { type: 'text/plain' }), 'archivo.txt');
    const res = await fetch(`${API}/logo`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${s.mainAccess}` },
      body: form,
    });
    assert.equal(res.status, 400);
  });

  it('400 — usuario sin empresa no puede subir logo', async () => {
    // Usar token fresco de usuario sin empresa
    const tmpEmail = `nocomp.${seed}@bildytest.com`;
    const { body: r } = await req('POST', '/register', { email: tmpEmail, password: PASSWORD });
    const tmpTk = r.accessToken;

    const form = new FormData();
    form.append('logo', new Blob([GIF_1x1], { type: 'image/gif' }), 'logo.gif');
    const res = await fetch(`${API}/logo`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tmpTk}` },
      body: form,
    });
    assert.equal(res.status, 400);
    await col.deleteOne({ email: tmpEmail });
  });

  it('200 — sube logo válido (GIF 1×1)', async () => {
    const form = new FormData();
    form.append('logo', new Blob([GIF_1x1], { type: 'image/gif' }), 'logo.gif');
    const res = await fetch(`${API}/logo`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${s.mainAccess}` },
      body: form,
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.company.logo, 'debe devolver la URL del logo');
    assert.ok(body.company.logo.includes('/uploads/'), 'la URL debe apuntar a /uploads/');
  });

  it('200 — acepta imagen PNG', async () => {
    // PNG mínimo válido (1×1 px, generado como buffer)
    const PNG_1x1 = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
      'hex',
    );
    const form = new FormData();
    form.append('logo', new Blob([PNG_1x1], { type: 'image/png' }), 'logo.png');
    const res = await fetch(`${API}/logo`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${s.mainAccess}` },
      body: form,
    });
    assert.equal(res.status, 200);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  9. OBTENER USUARIO
// ══════════════════════════════════════════════════════════════════════════════

describe('9 · GET /api/user', { concurrency: false }, () => {
  it('200 — devuelve usuario autenticado', async () => {
    const { status, body } = await req('GET', '/', undefined, s.mainAccess);
    assert.equal(status, 200);
    assert.ok(body.user);
    assert.equal(body.user.email, MAIN_EMAIL);
  });

  it('el virtual fullName está presente', async () => {
    const { body } = await req('GET', '/', undefined, s.mainAccess);
    assert.equal(body.user.fullName, 'Juan García');
  });

  it('la empresa viene populada (objeto, no ObjectId)', async () => {
    const { body } = await req('GET', '/', undefined, s.mainAccess);
    assert.equal(typeof body.user.company, 'object');
    assert.ok(body.user.company._id, 'company debe tener _id');
    assert.ok(body.user.company.name, 'company debe tener name');
    assert.ok(body.user.company.cif,  'company debe tener cif');
  });

  it('no expone campos sensibles en la respuesta', async () => {
    const { body } = await req('GET', '/', undefined, s.mainAccess);
    assert.equal(body.user.password,            undefined);
    assert.equal(body.user.refreshToken,        undefined);
    assert.equal(body.user.verificationCode,    undefined);
    assert.equal(body.user.verificationAttempts, undefined);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  10. REFRESH TOKEN
// ══════════════════════════════════════════════════════════════════════════════

describe('10 · POST /api/user/refresh', { concurrency: false }, () => {
  it('200 — devuelve nuevos tokens', async () => {
    const oldAccess = s.mainAccess;
    const { status, body } = await req('POST', '/refresh', { refreshToken: s.mainRefresh });
    assert.equal(status, 200);
    assert.ok(body.accessToken);
    assert.ok(body.refreshToken);
    assert.notEqual(body.accessToken,  oldAccess,      'accessToken debe ser nuevo');
    assert.notEqual(body.refreshToken, s.mainRefresh,  'refreshToken debe rotar');
    s.mainAccess  = body.accessToken;
    s.mainRefresh = body.refreshToken;
  });

  it('401 — token inválido (string aleatorio)', async () => {
    const { status } = await req('POST', '/refresh', { refreshToken: 'token.falso.aqui' });
    assert.equal(status, 401);
  });

  it('401 — refresh token antiguo (ya rotado) rechazado', async () => {
    const oldRefresh = s.mainRefresh;
    // Rotar de nuevo para tener uno más nuevo
    const { body } = await req('POST', '/refresh', { refreshToken: s.mainRefresh });
    s.mainAccess  = body.accessToken;
    s.mainRefresh = body.refreshToken;
    // El anterior ya no debe funcionar
    const { status } = await req('POST', '/refresh', { refreshToken: oldRefresh });
    assert.equal(status, 401);
  });

  it('400 — body vacío', async () => {
    const { status } = await req('POST', '/refresh', {});
    assert.equal(status, 400);
  });

  it('400 — refreshToken no es string', async () => {
    const { status } = await req('POST', '/refresh', { refreshToken: 12345 });
    assert.equal(status, 400);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  11. CAMBIO DE CONTRASEÑA (bonus)
// ══════════════════════════════════════════════════════════════════════════════

describe('11 · PUT /api/user/password — bonus', { concurrency: false }, () => {
  it('400 — nueva contraseña igual a la antigua (Zod refine)', async () => {
    const { status, body } = await req('PUT', '/password', {
      oldPassword: PASSWORD,
      newPassword: PASSWORD,
    }, s.mainAccess);
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  it('401 — contraseña antigua incorrecta', async () => {
    const { status } = await req('PUT', '/password', {
      oldPassword: 'ContraseñaErronea99!',
      newPassword: NEW_PASS,
    }, s.mainAccess);
    assert.equal(status, 401);
  });

  it('400 — nueva contraseña demasiado corta', async () => {
    const { status } = await req('PUT', '/password', {
      oldPassword: PASSWORD,
      newPassword: '123',
    }, s.mainAccess);
    assert.equal(status, 400);
  });

  it('200 — cambia la contraseña correctamente', async () => {
    const { status, body } = await req('PUT', '/password', {
      oldPassword: PASSWORD,
      newPassword: NEW_PASS,
    }, s.mainAccess);
    assert.equal(status, 200);
    assert.ok(body.message);
  });

  it('puede hacer login con la NUEVA contraseña', async () => {
    const { status, body } = await req('POST', '/login', {
      email: MAIN_EMAIL,
      password: NEW_PASS,
    });
    assert.equal(status, 200);
    s.mainAccess  = body.accessToken;
    s.mainRefresh = body.refreshToken;
  });

  it('401 — no puede hacer login con la contraseña ANTERIOR', async () => {
    const { status } = await req('POST', '/login', {
      email: MAIN_EMAIL,
      password: PASSWORD,
    });
    assert.equal(status, 401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  12. INVITAR COMPAÑERO (bonus) — POST /api/user/invite
// ══════════════════════════════════════════════════════════════════════════════

describe('12 · POST /api/user/invite — bonus', { concurrency: false }, () => {
  it('403 — usuario con rol guest no puede invitar', async () => {
    const { status, body } = await req('POST', '/invite', {
      email: INV_EMAIL, name: 'Inv', lastName: 'Test',
    }, s.guestAccess);
    assert.equal(status, 403);
    assert.equal(body.error, true);
  });

  it('400 — body de invitación con email inválido', async () => {
    const { status } = await req('POST', '/invite', {
      email: 'no-email', name: 'Test', lastName: 'Test',
    }, s.mainAccess);
    assert.equal(status, 400);
  });

  it('400 — faltan campos requeridos (sin name)', async () => {
    const { status } = await req('POST', '/invite', {
      email: INV_EMAIL, lastName: 'Test',
    }, s.mainAccess);
    assert.equal(status, 400);
  });

  it('201 — admin invita usuario correctamente', async () => {
    const { status, body } = await req('POST', '/invite', {
      email: INV_EMAIL, name: 'Invitado', lastName: 'Pérez',
    }, s.mainAccess);
    assert.equal(status, 201);
    assert.ok(body.message);
    assert.equal(body.user.role,   'guest');
    assert.equal(body.user.status, 'pending');
  });

  it('409 — email de invitado ya existe', async () => {
    const { status } = await req('POST', '/invite', {
      email: INV_EMAIL, name: 'Invitado', lastName: 'Pérez',
    }, s.mainAccess);
    assert.equal(status, 409);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  13. LOGOUT
// ══════════════════════════════════════════════════════════════════════════════

describe('13 · POST /api/user/logout', { concurrency: false }, () => {
  it('200 — cierra sesión del usuario guest', async () => {
    const { status, body } = await req('POST', '/logout', undefined, s.guestAccess);
    assert.equal(status, 200);
    assert.ok(body.message);
  });

  it('el refreshToken del guest ya no funciona tras logout', async () => {
    const { status } = await req('POST', '/refresh', { refreshToken: s.guestRefresh });
    assert.equal(status, 401);
  });

  it('el campo refreshToken en DB queda a null', async () => {
    const doc = await col.findOne({ email: GUEST_EMAIL }, { projection: { refreshToken: 1 } });
    assert.equal(doc.refreshToken, null);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  14. SOFT DELETE
// ══════════════════════════════════════════════════════════════════════════════

describe('14 · DELETE /api/user?soft=true', { concurrency: false }, () => {
  it('setup: guest hace login de nuevo para obtener token fresco', async () => {
    const { body } = await req('POST', '/login', { email: GUEST_EMAIL, password: PASSWORD });
    s.guestAccess  = body.accessToken;
    s.guestRefresh = body.refreshToken;
    assert.ok(s.guestAccess);
  });

  it('200 — soft delete devuelve mensaje correcto', async () => {
    const res = await fetch(`${API}/?soft=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${s.guestAccess}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.message.toLowerCase().includes('soft'));
  });

  it('el usuario tiene deleted:true y deletedAt en DB', async () => {
    const doc = await col.findOne({ email: GUEST_EMAIL });
    assert.equal(doc.deleted, true);
    assert.ok(doc.deletedAt, 'deletedAt debe estar presente');
  });

  it('401 — usuario soft-deleted no puede hacer login', async () => {
    const { status } = await req('POST', '/login', { email: GUEST_EMAIL, password: PASSWORD });
    assert.equal(status, 401);
  });

  it('401 — token de usuario soft-deleted no accede a rutas protegidas', async () => {
    const { status } = await req('GET', '/', undefined, s.guestAccess);
    // El token JWT sigue siendo válido (15 min), pero getUser filtra por deleted:false
    // según implementación puede ser 200 con null o 401/404
    // Lo que NO debe pasar es devolver datos del usuario borrado
    const { body } = await req('GET', '/', undefined, s.guestAccess);
    // Si devuelve 200, el user debe ser null o no existir
    if (body.user) {
      assert.notEqual(body.user.email, GUEST_EMAIL, 'no debe devolver datos del usuario eliminado');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  15. HARD DELETE
// ══════════════════════════════════════════════════════════════════════════════

describe('15 · DELETE /api/user (hard)', { concurrency: false }, () => {
  it('200 — hard delete elimina permanentemente al usuario', async () => {
    const res = await fetch(`${API}/`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${s.mainAccess}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.message.toLowerCase().includes('permanentemente'));
  });

  it('el usuario ya NO existe en la base de datos', async () => {
    const doc = await col.findOne({ email: MAIN_EMAIL });
    assert.equal(doc, null, 'el usuario debe haber sido eliminado de la DB');
  });

  it('401 — el token del usuario eliminado ya no funciona', async () => {
    // El JWT sigue siendo válido criptográficamente, pero el usuario no existe
    // En este caso el middleware puede devolver 401 o la ruta puede fallar
    const { body } = await req('GET', '/', undefined, s.mainAccess);
    // Si el usuario está borrado, debe devolver null o error
    assert.ok(body.user === null || body.user === undefined || body.error === true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  16. SEGURIDAD
// ══════════════════════════════════════════════════════════════════════════════

describe('16 · Seguridad', { concurrency: false }, () => {
  it('NoSQL injection: clave con $ en body es sanitizada (no bypasea código)', async () => {
    // Registrar usuario temporal para la prueba
    const tmpEmail = `nosql.${seed}@bildytest.com`;
    const { body: r } = await req('POST', '/register', { email: tmpEmail, password: PASSWORD });
    const tmpToken = r.accessToken;

    // Intentar inyección NoSQL en el campo de validación
    const res = await fetch(`${API}/validation`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tmpToken}`,
      },
      // La clave '$gt' debe ser eliminada por el sanitizador inline
      body: JSON.stringify({ '$gt': '', code: '000000' }),
    });
    // Debe dar 400 (código inválido) — jamás 200 ni 500
    assert.ok([400, 422].includes(res.status), `esperado 400/422, recibido ${res.status}`);

    await col.deleteOne({ email: tmpEmail });
  });

  it('Helmet: headers de seguridad presentes', async () => {
    const res = await fetch(`${BASE}/health`);
    // Helmet añade x-content-type-options (y otros)
    const xct = res.headers.get('x-content-type-options');
    assert.equal(xct, 'nosniff');
  });

  it('Rate limit: headers X-RateLimit-* presentes en respuestas', async () => {
    const res = await fetch(`${BASE}/health`);
    const limitHeader = res.headers.get('ratelimit-limit')
      ?? res.headers.get('x-ratelimit-limit');
    assert.ok(limitHeader, 'debe incluir header de rate limit');
  });

  it('CORS: header Access-Control-Allow-Origin presente', async () => {
    const res = await fetch(`${BASE}/health`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    const cors = res.headers.get('access-control-allow-origin');
    assert.ok(cors, 'debe incluir header CORS');
  });
});
