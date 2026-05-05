import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';
import { connectTestDb, clearDb, disconnectTestDb } from './helpers/db.helper';
import prisma from '../src/lib/prisma';

// Setup

beforeAll(async () => {
  await connectTestDb();
});

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

// Datos de prueba

const BASE = '/api/user';
const VALID_USER = { email: 'test@bildytest.com', password: 'SecurePass123!' };

// Helpers
const register = (data = VALID_USER) => request(app).post(`${BASE}/register`).send(data);
const login    = (data = VALID_USER) => request(app).post(`${BASE}/login`).send(data);

const verifyAndLogin = async (email = VALID_USER.email, password = VALID_USER.password) => {
  const { body: reg } = await register({ email, password });
  const token = reg.accessToken;

  // Obtener codigo de verificacion de la DB via Prisma
  const userRecord = await prisma.user.findUnique({
    where: { email },
    select: { verificationCode: true },
  });

  await request(app)
    .put(`${BASE}/validation`)
    .set('Authorization', `Bearer ${token}`)
    .send({ code: userRecord?.verificationCode });

  const { body: logged } = await login({ email, password });
  return logged;
};

// Tests

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

  it('respuesta no incluye la contrasena', async () => {
    const res = await register();
    expect(res.body.user.password).toBeUndefined();
  });

  it('409 — email duplicado', async () => {
    await register();
    const res = await register();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe(true);
  });

  it('400 — email invalido', async () => {
    const res = await register({ email: 'noesmail', password: 'SecurePass123!' });
    expect(res.status).toBe(400);
  });

  it('400 — contrasena sin mayuscula (complejidad)', async () => {
    const res = await register({ email: 'x@test.com', password: 'securepass123!' });
    expect(res.status).toBe(400);
  });

  it('400 — contrasena sin simbolo (complejidad)', async () => {
    const res = await register({ email: 'x@test.com', password: 'SecurePass123' });
    expect(res.status).toBe(400);
  });

  it('400 — contrasena demasiado corta', async () => {
    const res = await register({ email: 'x@test.com', password: 'Ab1!' });
    expect(res.status).toBe(400);
  });

  it('400 — body vacio', async () => {
    const res = await register({} as typeof VALID_USER);
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/user/validation', () => {
  it('401 — sin token', async () => {
    const res = await request(app).put(`${BASE}/validation`).send({ code: '123456' });
    expect(res.status).toBe(401);
  });

  it('400 — codigo invalido (no numerico)', async () => {
    const { body: reg } = await register();
    const res = await request(app)
      .put(`${BASE}/validation`)
      .set('Authorization', `Bearer ${reg.accessToken}`)
      .send({ code: 'ABCDEF' });
    expect(res.status).toBe(400);
  });

  it('400 — codigo correcto en formato pero incorrecto', async () => {
    const { body: reg } = await register();
    const res = await request(app)
      .put(`${BASE}/validation`)
      .set('Authorization', `Bearer ${reg.accessToken}`)
      .send({ code: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/incorrecto/i);
  });

  it('200 — codigo correcto verifica el email', async () => {
    const { body: reg } = await register();
    const userRecord = await prisma.user.findUnique({
      where: { email: VALID_USER.email },
      select: { verificationCode: true },
    });

    const res = await request(app)
      .put(`${BASE}/validation`)
      .set('Authorization', `Bearer ${reg.accessToken}`)
      .send({ code: userRecord?.verificationCode });

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
    expect(res.body.user.verificationCode).toBeUndefined();
  });

  it('401 — contrasena incorrecta', async () => {
    await register();
    const res = await login({ ...VALID_USER, password: 'WrongPass99!' });
    expect(res.status).toBe(401);
  });

  it('401 — usuario no registrado', async () => {
    const res = await login({ email: 'noexiste@test.com', password: 'SecurePass123!' });
    expect(res.status).toBe(401);
  });

  it('400 — body vacio', async () => {
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
      .send({ name: 'Juan', lastName: 'Garcia', nif: '12345678A' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Juan');
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

  it('401 — refresh token invalido', async () => {
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

  it('sanitizacion NoSQL — claves con $ eliminadas del body', async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: 'noexiste@test.com', password: 'SecurePass123!', $where: '1=1' });
    expect([400, 401]).toContain(res.status);
  });
});

// ── Verificacion — casos extra ─────────────────────────────────────────────────

describe('PUT /api/user/validation — casos extra', () => {
  it('400 — email ya verificado', async () => {
    const { body: reg } = await register();
    const token = reg.accessToken;

    const userRecord = await prisma.user.findUnique({
      where: { email: VALID_USER.email },
      select: { verificationCode: true },
    });

    await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${token}`).send({ code: userRecord?.verificationCode });

    const res = await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${token}`).send({ code: userRecord?.verificationCode });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/verificado/i);
  });

});

// ── Logout ─────────────────────────────────────────────────────────────────────

describe('POST /api/user/logout', () => {
  it('200 — cierra sesion correctamente', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app).post(`${BASE}/logout`).set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/sesi/i);
  });
});

// ── Eliminar usuario ───────────────────────────────────────────────────────────

describe('DELETE /api/user — Eliminar cuenta', () => {
  it('200 — soft delete marca usuario como eliminado', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app).delete(`${BASE}/`).set('Authorization', `Bearer ${accessToken}`).query({ soft: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/soft/i);
  });

  it('200 — hard delete elimina permanentemente', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app).delete(`${BASE}/`).set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/permanentemente/i);
  });
});

// ── Cambio de contrasena ───────────────────────────────────────────────────────

describe('PUT /api/user/password — Cambiar contrasena', () => {
  it('200 — cambia contrasena correctamente', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app).put(`${BASE}/password`).set('Authorization', `Bearer ${accessToken}`)
      .send({ oldPassword: VALID_USER.password, newPassword: 'NewSecure456@' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/actualizada/i);
  });

  it('401 — contrasena actual incorrecta', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app).put(`${BASE}/password`).set('Authorization', `Bearer ${accessToken}`)
      .send({ oldPassword: 'WrongPass99!', newPassword: 'NewSecure456@' });
    expect(res.status).toBe(401);
  });

  it('400 — nueva contrasena igual a la actual (refine)', async () => {
    const { accessToken } = await verifyAndLogin();
    const res = await request(app).put(`${BASE}/password`).set('Authorization', `Bearer ${accessToken}`)
      .send({ oldPassword: VALID_USER.password, newPassword: VALID_USER.password });
    expect(res.status).toBe(400);
  });
});

// ── Auth middleware — usuario eliminado ────────────────────────────────────────

describe('Auth middleware — usuario eliminado tras emitir token', () => {
  it('401 — token valido pero usuario ya no existe en DB', async () => {
    const { accessToken } = await verifyAndLogin();

    await prisma.user.deleteMany({ where: { email: VALID_USER.email } });

    const res = await request(app).get(`${BASE}/`).set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
  });
});

// ── Refresh token — token rotado ───────────────────────────────────────────────

describe('POST /api/user/refresh — token rotado no puede reutilizarse', () => {
  it('401 — refresh token valido JWT pero ya rotado en DB', async () => {
    const { refreshToken } = await verifyAndLogin();
    await request(app).post(`${BASE}/refresh`).send({ refreshToken });
    const res = await request(app).post(`${BASE}/refresh`).send({ refreshToken });
    expect(res.status).toBe(401);
  });
});

// ── Onboarding empresa ─────────────────────────────────────────────────────────

describe('PATCH /api/user/company — Onboarding empresa', () => {
  it('200 — crea empresa freelance usando datos personales del usuario', async () => {
    const { body: reg } = await register({ email: 'freelance@bildytest.com', password: 'SecurePass123!' });
    const userRecord = await prisma.user.findUnique({ where: { email: 'freelance@bildytest.com' }, select: { verificationCode: true } });
    await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${reg.accessToken}`).send({ code: userRecord?.verificationCode });
    const { body: logged } = await login({ email: 'freelance@bildytest.com', password: 'SecurePass123!' });
    const token = logged.accessToken;

    await request(app).put(`${BASE}/register`).set('Authorization', `Bearer ${token}`)
      .send({ name: 'Freelancer', lastName: 'Garcia', nif: '99999999X' });

    const res = await request(app).patch(`${BASE}/company`).set('Authorization', `Bearer ${token}`)
      .send({ isFreelance: true });
    expect(res.status).toBe(200);
    expect(res.body.user.companyId).toBeTruthy();
  });

  it('400 — freelance sin NIF previo en datos personales', async () => {
    const { body: reg } = await register({ email: 'nonif@bildytest.com', password: 'SecurePass123!' });
    const userRecord = await prisma.user.findUnique({ where: { email: 'nonif@bildytest.com' }, select: { verificationCode: true } });
    await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${reg.accessToken}`).send({ code: userRecord?.verificationCode });
    const { body: logged } = await login({ email: 'nonif@bildytest.com', password: 'SecurePass123!' });

    const res = await request(app).patch(`${BASE}/company`).set('Authorization', `Bearer ${logged.accessToken}`)
      .send({ isFreelance: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/CIF/i);
  });

  it('200 — segundo usuario se une a empresa existente', async () => {
    const { accessToken: tokenA } = await verifyAndLogin();
    await request(app).put(`${BASE}/register`).set('Authorization', `Bearer ${tokenA}`).send({ name: 'Admin', lastName: 'A', nif: '11111111A' });
    await request(app).patch(`${BASE}/company`).set('Authorization', `Bearer ${tokenA}`).send({ isFreelance: false, name: 'Empresa Compartida SL', cif: 'SHARED001' });

    const { body: regB } = await register({ email: 'user2@bildytest.com', password: 'SecurePass123!' });
    const userBRecord = await prisma.user.findUnique({ where: { email: 'user2@bildytest.com' }, select: { verificationCode: true } });
    await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${regB.accessToken}`).send({ code: userBRecord?.verificationCode });
    const { body: loggedB } = await login({ email: 'user2@bildytest.com', password: 'SecurePass123!' });

    await request(app).put(`${BASE}/register`).set('Authorization', `Bearer ${loggedB.accessToken}`).send({ name: 'User', lastName: 'B', nif: '22222222B' });
    const resB = await request(app).patch(`${BASE}/company`).set('Authorization', `Bearer ${loggedB.accessToken}`)
      .send({ isFreelance: false, name: 'Empresa Compartida SL', cif: 'SHARED001' });
    expect(resB.status).toBe(200);

    const userBDoc = await prisma.user.findUnique({ where: { email: 'user2@bildytest.com' } });
    expect(userBDoc?.companyId).toBeTruthy();
  });
});

// ── Invitar companero ──────────────────────────────────────────────────────────

describe('POST /api/user/invite — Invitar companero', () => {
  const setupFullAdmin = async () => {
    const { body: reg } = await register();
    const userRecord = await prisma.user.findUnique({ where: { email: VALID_USER.email }, select: { verificationCode: true } });
    await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${reg.accessToken}`).send({ code: userRecord?.verificationCode });
    const { body: logged } = await login();
    const token = logged.accessToken;
    await request(app).put(`${BASE}/register`).set('Authorization', `Bearer ${token}`).send({ name: 'Admin', lastName: 'Test', nif: '12345678A' });
    await request(app).patch(`${BASE}/company`).set('Authorization', `Bearer ${token}`).send({ isFreelance: false, name: 'Test Corp SL', cif: 'B12345678' });
    const { body: final } = await login();
    return final.accessToken;
  };

  it('201 — admin verificado con empresa puede invitar', async () => {
    const adminToken = await setupFullAdmin();
    const res = await request(app).post(`${BASE}/invite`).set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'guest@bildytest.com', name: 'Guest', lastName: 'User' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('user');
  });

  it('403 — usuario no verificado no puede invitar', async () => {
    const { body: reg } = await register({ email: 'pending@bildytest.com', password: 'SecurePass123!' });
    const res = await request(app).post(`${BASE}/invite`).set('Authorization', `Bearer ${reg.accessToken}`)
      .send({ email: 'guest@bildytest.com', name: 'Guest', lastName: 'User' });
    expect(res.status).toBe(403);
  });

  it('400 — usuario sin empresa no puede invitar', async () => {
    const { body: reg } = await register({ email: 'nocomp@bildytest.com', password: 'SecurePass123!' });
    const userRecord = await prisma.user.findUnique({ where: { email: 'nocomp@bildytest.com' }, select: { verificationCode: true } });
    await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${reg.accessToken}`).send({ code: userRecord?.verificationCode });
    const { body: logged } = await login({ email: 'nocomp@bildytest.com', password: 'SecurePass123!' });
    const res = await request(app).post(`${BASE}/invite`).set('Authorization', `Bearer ${logged.accessToken}`)
      .send({ email: 'guest@bildytest.com', name: 'Guest', lastName: 'User' });
    expect(res.status).toBe(400);
  });

  it('409 — email ya registrado no puede ser invitado', async () => {
    const adminToken = await setupFullAdmin();
    await register({ email: 'exists@bildytest.com', password: 'SecurePass123!' });
    const res = await request(app).post(`${BASE}/invite`).set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'exists@bildytest.com', name: 'Guest', lastName: 'User' });
    expect(res.status).toBe(409);
  });

  it('403 — rol user no puede invitar (checkRole)', async () => {
    const adminToken = await setupFullAdmin();
    // Invitar un usuario
    await request(app).post(`${BASE}/invite`).set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'regular@bildytest.com', name: 'Regular', lastName: 'User' });

    // Cambiar contraseña del usuario invitado directamente via Prisma
    const { hashPassword } = require('../src/utils/password');
    const hashed = await hashPassword('UserPass123!');
    await prisma.user.update({ where: { email: 'regular@bildytest.com' }, data: { password: hashed } });

    const { body: userLogin } = await request(app).post(`${BASE}/login`).send({ email: 'regular@bildytest.com', password: 'UserPass123!' });
    const res = await request(app).post(`${BASE}/invite`).set('Authorization', `Bearer ${userLogin.accessToken}`)
      .send({ email: 'another@bildytest.com', name: 'Another', lastName: 'User' });
    expect(res.status).toBe(403);
  });

  it('400 — falta el campo name', async () => {
    const adminToken = await setupFullAdmin();
    const res = await request(app).post(`${BASE}/invite`).set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'guest@bildytest.com', lastName: 'User' });
    expect(res.status).toBe(400);
  });
});

// ── Logo de compania ───────────────────────────────────────────────────────────

describe('PATCH /api/user/logo — Subir logo', () => {
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const setupUserWithCompany = async () => {
    const email = `logo${Date.now()}@bildytest.com`;
    const { body: reg } = await register({ email, password: 'SecurePass123!' });
    const userRecord = await prisma.user.findUnique({ where: { email }, select: { verificationCode: true } });
    await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${reg.accessToken}`).send({ code: userRecord?.verificationCode });
    const { body: logged } = await login({ email, password: 'SecurePass123!' });
    const token = logged.accessToken;
    await request(app).put(`${BASE}/register`).set('Authorization', `Bearer ${token}`).send({ name: 'Logo', lastName: 'Test', nif: '12345678A' });
    await request(app).patch(`${BASE}/company`).set('Authorization', `Bearer ${token}`).send({ isFreelance: false, name: 'Logo Corp SL', cif: `LC${Date.now()}` });
    const { body: final } = await login({ email, password: 'SecurePass123!' });
    return final.accessToken;
  };

  it('200 — sube logo PNG y devuelve URL', async () => {
    const token = await setupUserWithCompany();
    const res = await request(app).patch(`${BASE}/logo`).set('Authorization', `Bearer ${token}`)
      .attach('logo', pngBuffer, { filename: 'logo.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.company.logoUrl).toMatch(/\/uploads\//);
  });

  it('400 — tipo de archivo no permitido (LIMIT_FILE_TYPE)', async () => {
    const token = await setupUserWithCompany();
    const res = await request(app).patch(`${BASE}/logo`).set('Authorization', `Bearer ${token}`)
      .attach('logo', Buffer.from('no soy una imagen'), { filename: 'test.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/imag/i);
  });

  it('400 — sin archivo adjunto', async () => {
    const token = await setupUserWithCompany();
    const res = await request(app).patch(`${BASE}/logo`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400 — sin empresa configurada', async () => {
    const { body: reg } = await register({ email: 'nocomp2@bildytest.com', password: 'SecurePass123!' });
    const userRecord = await prisma.user.findUnique({ where: { email: 'nocomp2@bildytest.com' }, select: { verificationCode: true } });
    await request(app).put(`${BASE}/validation`).set('Authorization', `Bearer ${reg.accessToken}`).send({ code: userRecord?.verificationCode });
    const { body: logged } = await login({ email: 'nocomp2@bildytest.com', password: 'SecurePass123!' });
    const res = await request(app).patch(`${BASE}/logo`).set('Authorization', `Bearer ${logged.accessToken}`)
      .attach('logo', pngBuffer, { filename: 'logo.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });

  it('400 — archivo demasiado grande (LIMIT_FILE_SIZE)', async () => {
    const token = await setupUserWithCompany();
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 0); // 6 MB
    const res = await request(app).patch(`${BASE}/logo`).set('Authorization', `Bearer ${token}`)
      .attach('logo', bigBuffer, { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/5 MB/i);
  });
});
