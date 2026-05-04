import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import { connectTestDb, clearDb, disconnectTestDb } from './helpers/db.helper.js';

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await connectTestDb();
});

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

// ── Datos de prueba ───────────────────────────────────────────────────────────

const BASE = '/api/user';
const VALID_USER = { email: 'test@bildytest.com', password: 'SecurePass123!' };

// Helpers
const register = (data = VALID_USER) => request(app).post(`${BASE}/register`).send(data);
const login    = (data = VALID_USER) => request(app).post(`${BASE}/login`).send(data);

const verifyAndLogin = async (email = VALID_USER.email, password = VALID_USER.password) => {
  const { body: reg } = await register({ email, password });
  const token = reg.accessToken;

  // Obtener código de verificación de la DB
  const mongoose = (await import('mongoose')).default;
  const col = mongoose.connection.db.collection('users');
  const doc = await col.findOne({ email }, { projection: { verificationCode: 1 } });

  await request(app)
    .put(`${BASE}/validation`)
    .set('Authorization', `Bearer ${token}`)
    .send({ code: doc.verificationCode });

  const { body: logged } = await login({ email, password });
  return logged;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/user/register', () => {
  it('201 — registra usuario y devuelve tokens', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.email).toBe(VALID_USER.email);
    expect(res.body.user.status).toBe('pending');
    expect(res.body.user.role).toBe('admin');
  });

  it('respuesta no incluye la contraseña', async () => {
    const res = await register();
    expect(res.body.user.password).toBeUndefined();
  });

  it('409 — email duplicado', async () => {
    await register();
    const res = await register();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe(true);
  });

  it('400 — email inválido', async () => {
    const res = await register({ email: 'noesmail', password: 'SecurePass123!' });
    expect(res.status).toBe(400);
  });

  it('400 — contraseña sin mayúscula (complejidad)', async () => {
    const res = await register({ email: 'x@test.com', password: 'securepass123!' });
    expect(res.status).toBe(400);
  });

  it('400 — contraseña sin símbolo (complejidad)', async () => {
    const res = await register({ email: 'x@test.com', password: 'SecurePass123' });
    expect(res.status).toBe(400);
  });

  it('400 — contraseña demasiado corta', async () => {
    const res = await register({ email: 'x@test.com', password: 'Ab1!' });
    expect(res.status).toBe(400);
  });

  it('400 — body vacío', async () => {
    const res = await register({});
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/user/validation', () => {
  it('401 — sin token', async () => {
    const res = await request(app).put(`${BASE}/validation`).send({ code: '123456' });
    expect(res.status).toBe(401);
  });

  it('400 — código inválido (no numérico)', async () => {
    const { body: reg } = await register();
    const res = await request(app)
      .put(`${BASE}/validation`)
      .set('Authorization', `Bearer ${reg.accessToken}`)
      .send({ code: 'ABCDEF' });
    expect(res.status).toBe(400);
  });

  it('200 — código correcto verifica el email', async () => {
    const { body: reg } = await register();
    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('users');
    const doc = await col.findOne({ email: VALID_USER.email }, { projection: { verificationCode: 1 } });

    const res = await request(app)
      .put(`${BASE}/validation`)
      .set('Authorization', `Bearer ${reg.accessToken}`)
      .send({ code: doc.verificationCode });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/user/login', () => {
  it('200 — login correcto devuelve tokens', async () => {
    await verifyAndLogin();
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('no expone campos sensibles', async () => {
    await verifyAndLogin();
    const res = await login();
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.refreshToken).toBeUndefined();
    expect(res.body.user.verificationCode).toBeUndefined();
  });

  it('401 — contraseña incorrecta', async () => {
    await register();
    const res = await login({ ...VALID_USER, password: 'WrongPass99!' });
    expect(res.status).toBe(401);
  });

  it('401 — usuario no registrado', async () => {
    const res = await login({ email: 'noexiste@test.com', password: 'SecurePass123!' });
    expect(res.status).toBe(401);
  });

  it('400 — body vacío', async () => {
    const res = await request(app).post(`${BASE}/login`).send({});
    expect(res.status).toBe(400);
  });
});

describe('Rutas protegidas — JWT', () => {
  it('401 — GET /api/user sin token', async () => {
    const res = await request(app).get(`${BASE}/`);
    expect(res.status).toBe(401);
  });

  it('401 — token mal formado', async () => {
    const res = await request(app)
      .get(`${BASE}/`)
      .set('Authorization', 'Bearer esto.no.es.jwt');
    expect(res.status).toBe(401);
  });

  it('401 — token manipulado', async () => {
    const { body: reg } = await register();
    const fakeToken = reg.accessToken.slice(0, -5) + 'XXXXX';
    const res = await request(app)
      .get(`${BASE}/`)
      .set('Authorization', `Bearer ${fakeToken}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/user — datos del usuario', () => {
  it('200 — devuelve usuario autenticado', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app)
      .get(`${BASE}/`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(VALID_USER.email);
  });
});

describe('PUT /api/user/register — datos personales', () => {
  it('200 — actualiza nombre, apellido y NIF', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app)
      .put(`${BASE}/register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Juan', lastName: 'García', nif: '12345678A' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Juan');
    expect(res.body.user.fullName).toBe('Juan García');
  });

  it('400 — falta lastName', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app)
      .put(`${BASE}/register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Juan', nif: '12345678A' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/user/refresh', () => {
  it('200 — rota los tokens', async () => {
    const { accessToken, refreshToken } = await verifyAndLogin();
    const res = await request(app)
      .post(`${BASE}/refresh`)
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).not.toBe(accessToken);
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('401 — refresh token inválido', async () => {
    const res = await request(app)
      .post(`${BASE}/refresh`)
      .send({ refreshToken: 'token.falso.aqui' });
    expect(res.status).toBe(401);
  });
});

describe('GET /health', () => {
  it('200 — status ok con campos requeridos', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeTruthy();
    expect(res.body.uptime).toBeDefined();
    expect(res.body.db).toBeDefined();
  });
});

describe('Seguridad', () => {
  it('Helmet: x-content-type-options presente', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('CORS: header access-control-allow-origin presente', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBeTruthy();
  });

  it('404 — ruta inexistente devuelve error:true', async () => {
    const res = await request(app).get('/api/ruta-que-no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
  });

  it('sanitización NoSQL — claves con $ son eliminadas del body', async () => {
    // El sanitizador borra campos que empiecen por $ antes de llegar al controlador
    // El endpoint de login recibe { email, password, $where } → $where ignorado → 401 normal
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: 'noexiste@test.com', password: 'SecurePass123!', $where: '1=1' });
    // No debe explotar ni dar 500; el campo $where es eliminado silenciosamente
    expect([400, 401]).toContain(res.status);
  });
});

// ── Verificación — casos extra ─────────────────────────────────────────────────

describe('PUT /api/user/validation — casos extra', () => {
  it('400 — email ya verificado', async () => {
    const { body: reg } = await register();
    const token = reg.accessToken;

    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('users');
    const doc = await col.findOne({ email: VALID_USER.email }, { projection: { verificationCode: 1 } });

    // Primera verificación → ok
    await request(app)
      .put(`${BASE}/validation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: doc.verificationCode });

    // Segunda verificación → ya verificado
    const res = await request(app)
      .put(`${BASE}/validation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: doc.verificationCode });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/verificado/i);
  });

  it('429 — intentos de verificación agotados', async () => {
    const { body: reg } = await register();
    const token = reg.accessToken;

    // Enviar 3 códigos incorrectos hasta agotar intentos
    for (let i = 0; i < 3; i++) {
      await request(app)
        .put(`${BASE}/validation`)
        .set('Authorization', `Bearer ${token}`)
        .send({ code: '000000' });
    }

    const res = await request(app)
      .put(`${BASE}/validation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' });

    expect(res.status).toBe(429);
  });
});

// ── Logout ─────────────────────────────────────────────────────────────────────

describe('POST /api/user/logout', () => {
  it('200 — cierra sesión correctamente', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app)
      .post(`${BASE}/logout`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/sesi/i);
  });
});

// ── Eliminar usuario ───────────────────────────────────────────────────────────

describe('DELETE /api/user — Eliminar cuenta', () => {
  it('200 — soft delete marca usuario como eliminado', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app)
      .delete(`${BASE}/`)
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ soft: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/soft/i);
  });

  it('200 — hard delete elimina permanentemente', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app)
      .delete(`${BASE}/`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/permanentemente/i);
  });
});

// ── Cambio de contraseña ───────────────────────────────────────────────────────

describe('PUT /api/user/password — Cambiar contraseña', () => {
  it('200 — cambia contraseña correctamente', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app)
      .put(`${BASE}/password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ oldPassword: VALID_USER.password, newPassword: 'NewSecure456@' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/actualizada/i);
  });

  it('401 — contraseña actual incorrecta', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app)
      .put(`${BASE}/password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ oldPassword: 'WrongPass99!', newPassword: 'NewSecure456@' });
    expect(res.status).toBe(401);
  });

  it('400 — nueva contraseña igual a la actual (refine)', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app)
      .put(`${BASE}/password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ oldPassword: VALID_USER.password, newPassword: VALID_USER.password });
    expect(res.status).toBe(400);
  });
});

// ── Auth middleware — usuario eliminado ────────────────────────────────────────

describe('Auth middleware — usuario eliminado tras emitir token', () => {
  it('401 — token válido pero usuario ya no existe en DB', async () => {
    const { accessToken } = await verifyAndLogin();

    // Eliminar el usuario directamente en la DB
    const mongoose = (await import('mongoose')).default;
    await mongoose.connection.db.collection('users').deleteMany({ email: VALID_USER.email });

    const res = await request(app)
      .get(`${BASE}/`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(401);
  });
});

// ── Invitar compañero — checkRole + inviteUser ─────────────────────────────────

describe('POST /api/user/invite — Invitar compañero', () => {
  // Helper: usuario completamente configurado (verificado + empresa)
  const setupFullAdmin = async () => {
    const { body: reg } = await register();
    const token = reg.accessToken;

    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('users');
    const doc = await col.findOne({ email: VALID_USER.email }, { projection: { verificationCode: 1 } });

    await request(app)
      .put(`${BASE}/validation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: doc.verificationCode });

    const { body: logged } = await request(app)
      .post(`${BASE}/login`)
      .send(VALID_USER);
    const freshToken = logged.accessToken;

    await request(app)
      .put(`${BASE}/register`)
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ name: 'Admin', lastName: 'Test', nif: '12345678A' });

    await request(app)
      .patch(`${BASE}/company`)
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ isFreelance: false, name: 'Test Corp SL', cif: 'B12345678' });

    const { body: final } = await request(app).post(`${BASE}/login`).send(VALID_USER);
    return final.accessToken;
  };

  it('201 — admin verificado con empresa puede invitar', async () => {
    const adminToken = await setupFullAdmin();
    const res = await request(app)
      .post(`${BASE}/invite`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'guest@bildytest.com', name: 'Guest', lastName: 'User' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('guest');
  });

  it('403 — usuario no verificado no puede invitar', async () => {
    // Usuario registrado pero NO verificado
    const { body: reg } = await register({ email: 'pending@bildytest.com', password: 'SecurePass123!' });
    const res = await request(app)
      .post(`${BASE}/invite`)
      .set('Authorization', `Bearer ${reg.accessToken}`)
      .send({ email: 'guest@bildytest.com', name: 'Guest', lastName: 'User' });
    expect(res.status).toBe(403);
  });

  it('400 — usuario sin empresa no puede invitar', async () => {
    // Verificado pero sin empresa
    const { body: reg } = await register({ email: 'nocompany@bildytest.com', password: 'SecurePass123!' });
    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('users');
    const doc = await col.findOne({ email: 'nocompany@bildytest.com' }, { projection: { verificationCode: 1 } });
    await request(app)
      .put(`${BASE}/validation`)
      .set('Authorization', `Bearer ${reg.accessToken}`)
      .send({ code: doc.verificationCode });
    const { body: logged } = await request(app)
      .post(`${BASE}/login`)
      .send({ email: 'nocompany@bildytest.com', password: 'SecurePass123!' });
    const res = await request(app)
      .post(`${BASE}/invite`)
      .set('Authorization', `Bearer ${logged.accessToken}`)
      .send({ email: 'guest@bildytest.com', name: 'Guest', lastName: 'User' });
    expect(res.status).toBe(400);
  });

  it('409 — email ya registrado no puede ser invitado', async () => {
    const adminToken = await setupFullAdmin();
    // Registrar otro usuario con ese email
    await register({ email: 'exists@bildytest.com', password: 'SecurePass123!' });
    const res = await request(app)
      .post(`${BASE}/invite`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'exists@bildytest.com', name: 'Guest', lastName: 'User' });
    expect(res.status).toBe(409);
  });

  it('403 — rol guest no puede invitar (checkRole)', async () => {
    const adminToken = await setupFullAdmin();
    // Invitar un guest
    await request(app)
      .post(`${BASE}/invite`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'guest@bildytest.com', name: 'Guest', lastName: 'User' });

    // Hacer login como guest (necesitamos la contraseña temporal → acceso directo a DB)
    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('users');
    const guestDoc = await col.findOne({ email: 'guest@bildytest.com' });

    // Poner contraseña conocida al guest directamente
    const { hashPassword } = await import('../src/utils/password.js');
    const hashed = await hashPassword('GuestPass123!');
    await col.updateOne({ email: 'guest@bildytest.com' }, { $set: { password: hashed } });

    const { body: guestLogin } = await request(app)
      .post(`${BASE}/login`)
      .send({ email: 'guest@bildytest.com', password: 'GuestPass123!' });

    const res = await request(app)
      .post(`${BASE}/invite`)
      .set('Authorization', `Bearer ${guestLogin.accessToken}`)
      .send({ email: 'another@bildytest.com', name: 'Other', lastName: 'User' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(true);
  });

  it('400 — falta el campo name', async () => {
    const adminToken = await setupFullAdmin();
    const res = await request(app)
      .post(`${BASE}/invite`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'guest@bildytest.com', lastName: 'User' });
    expect(res.status).toBe(400);
  });
});

// ── Onboarding — empresa ───────────────────────────────────────────────────────

describe('PATCH /api/user/company — Onboarding empresa', () => {
  it('200 — crea empresa freelance usando datos personales del usuario', async () => {
    // Registrar, verificar, completar datos personales (incluye NIF), luego freelance
    const { body: reg } = await register({ email: 'freelance@bildytest.com', password: 'SecurePass123!' });
    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('users');
    const doc = await col.findOne({ email: 'freelance@bildytest.com' }, { projection: { verificationCode: 1 } });
    await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${reg.accessToken}`).send({ code: doc.verificationCode });
    const { body: logged } = await request(app).post(`${BASE}/login`).send({ email: 'freelance@bildytest.com', password: 'SecurePass123!' });
    const token = logged.accessToken;

    // Poner nombre y NIF antes del freelance
    await request(app).put(`${BASE}/register`).set('Authorization', `Bearer ${token}`)
      .send({ name: 'Freelancer', lastName: 'García', nif: '99999999X' });

    const res = await request(app).patch(`${BASE}/company`).set('Authorization', `Bearer ${token}`)
      .send({ isFreelance: true });
    expect(res.status).toBe(200);
    expect(res.body.user.company).toBeTruthy();
  });

  it('400 — freelance sin NIF previo en datos personales', async () => {
    // Registrar y verificar pero NO establecer NIF
    const { body: reg } = await register({ email: 'nonif@bildytest.com', password: 'SecurePass123!' });
    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('users');
    const doc = await col.findOne({ email: 'nonif@bildytest.com' }, { projection: { verificationCode: 1 } });
    await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${reg.accessToken}`).send({ code: doc.verificationCode });
    const { body: logged } = await request(app).post(`${BASE}/login`).send({ email: 'nonif@bildytest.com', password: 'SecurePass123!' });

    const res = await request(app).patch(`${BASE}/company`).set('Authorization', `Bearer ${logged.accessToken}`)
      .send({ isFreelance: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/CIF/i);
  });

  it('200 — segundo usuario se une a empresa existente como guest', async () => {
    // Usuario A crea empresa con CIF B12345678
    const { accessToken: tokenA } = await verifyAndLogin();
    await request(app).put(`${BASE}/register`).set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Admin', lastName: 'A', nif: '11111111A' });
    await request(app).patch(`${BASE}/company`).set('Authorization', `Bearer ${tokenA}`)
      .send({ isFreelance: false, name: 'Empresa Compartida SL', cif: 'SHARED001' });

    // Usuario B intenta crear empresa con el mismo CIF → se une como guest
    const { body: regB } = await register({ email: 'guest2@bildytest.com', password: 'SecurePass123!' });
    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('users');
    const docB = await col.findOne({ email: 'guest2@bildytest.com' }, { projection: { verificationCode: 1 } });
    await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${regB.accessToken}`).send({ code: docB.verificationCode });
    const { body: loggedB } = await request(app).post(`${BASE}/login`).send({ email: 'guest2@bildytest.com', password: 'SecurePass123!' });

    await request(app).put(`${BASE}/register`).set('Authorization', `Bearer ${loggedB.accessToken}`)
      .send({ name: 'Guest', lastName: 'B', nif: '22222222B' });
    const resB = await request(app).patch(`${BASE}/company`).set('Authorization', `Bearer ${loggedB.accessToken}`)
      .send({ isFreelance: false, name: 'Empresa Compartida SL', cif: 'SHARED001' });

    expect(resB.status).toBe(200);
    // El usuario B debe ser guest al unirse a empresa existente
    const userBDoc = await col.findOne({ email: 'guest2@bildytest.com' });
    expect(userBDoc.role).toBe('guest');
  });
});

// ── Refresh token — token desactualizado ───────────────────────────────────────

describe('POST /api/user/refresh — token rotado no puede reutilizarse', () => {
  it('401 — refresh token válido JWT pero ya rotado en DB', async () => {
    const { refreshToken } = await verifyAndLogin();
    // Rotar tokens (el refreshToken queda obsoleto en DB)
    await request(app).post(`${BASE}/refresh`).send({ refreshToken });
    // Intentar usar el refresh antiguo
    const res = await request(app).post(`${BASE}/refresh`).send({ refreshToken });
    expect(res.status).toBe(401);
  });
});

// ── Logo de compañía ───────────────────────────────────────────────────────────

describe('PATCH /api/user/logo — Subir logo', () => {
  // Buffer PNG mínimo válido (1x1 pixel)
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const setupUserWithCompany = async () => {
    const email = `logo${Date.now()}@bildytest.com`;
    const { body: reg } = await register({ email, password: 'SecurePass123!' });
    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('users');
    const doc = await col.findOne({ email }, { projection: { verificationCode: 1 } });
    await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${reg.accessToken}`).send({ code: doc.verificationCode });
    const { body: logged } = await request(app).post(`${BASE}/login`).send({ email, password: 'SecurePass123!' });
    const token = logged.accessToken;
    await request(app).put(`${BASE}/register`).set('Authorization', `Bearer ${token}`)
      .send({ name: 'Logo', lastName: 'Test', nif: '12345678A' });
    await request(app).patch(`${BASE}/company`).set('Authorization', `Bearer ${token}`)
      .send({ isFreelance: false, name: 'Logo Corp SL', cif: `LC${Date.now()}` });
    const { body: final } = await request(app).post(`${BASE}/login`).send({ email, password: 'SecurePass123!' });
    return final.accessToken;
  };

  it('200 — sube logo PNG y devuelve URL', async () => {
    const token = await setupUserWithCompany();
    const res = await request(app)
      .patch(`${BASE}/logo`)
      .set('Authorization', `Bearer ${token}`)
      .attach('logo', pngBuffer, { filename: 'logo.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.company.logo).toMatch(/\/uploads\//);
  });

  it('400 — tipo de archivo no permitido (LIMIT_FILE_TYPE)', async () => {
    const token = await setupUserWithCompany();
    const res = await request(app)
      .patch(`${BASE}/logo`)
      .set('Authorization', `Bearer ${token}`)
      .attach('logo', Buffer.from('no soy una imagen'), { filename: 'test.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/imágenes/i);
  });

  it('400 — sin archivo adjunto', async () => {
    const token = await setupUserWithCompany();
    const res = await request(app)
      .patch(`${BASE}/logo`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400 — sin empresa configurada', async () => {
    // Usuario verificado pero sin empresa
    const { body: reg } = await register({ email: 'nocomp2@bildytest.com', password: 'SecurePass123!' });
    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('users');
    const doc = await col.findOne({ email: 'nocomp2@bildytest.com' }, { projection: { verificationCode: 1 } });
    await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${reg.accessToken}`).send({ code: doc.verificationCode });
    const { body: logged } = await request(app).post(`${BASE}/login`).send({ email: 'nocomp2@bildytest.com', password: 'SecurePass123!' });
    const res = await request(app)
      .patch(`${BASE}/logo`)
      .set('Authorization', `Bearer ${logged.accessToken}`)
      .attach('logo', pngBuffer, { filename: 'logo.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });
});
