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
});
