import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

const BASE = '/api/auth';

const testUser = {
  name: 'Test User',
  email: `testauth_${Date.now()}@test.com`,
  password: 'password123'
};

let token;

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: 'testauth_' } } });
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('201 — registra usuario correctamente', async () => {
    const res = await request(app).post(`${BASE}/register`).send(testUser);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ email: testUser.email, role: 'USER' });
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('400 — email duplicado', async () => {
    const res = await request(app).post(`${BASE}/register`).send(testUser);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('400 — campos requeridos faltantes', async () => {
    const res = await request(app).post(`${BASE}/register`).send({ email: 'x@x.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
  });

  it('201 — registra usuario con rol LIBRARIAN', async () => {
    const res = await request(app).post(`${BASE}/register`).send({
      name: 'Librarian Test',
      email: `testauth_lib_${Date.now()}@test.com`,
      password: 'password123',
      role: 'LIBRARIAN'
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('LIBRARIAN');
  });
});

describe('POST /api/auth/login', () => {
  it('200 — login correcto devuelve token', async () => {
    const res = await request(app).post(`${BASE}/login`).send({
      email: testUser.email,
      password: testUser.password
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    token = res.body.token;
  });

  it('401 — contraseña incorrecta', async () => {
    const res = await request(app).post(`${BASE}/login`).send({
      email: testUser.email,
      password: 'wrongpassword'
    });
    expect(res.status).toBe(401);
  });

  it('404 — usuario no existe', async () => {
    const res = await request(app).post(`${BASE}/login`).send({
      email: 'noexiste@test.com',
      password: 'password123'
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/auth/me', () => {
  it('200 — devuelve perfil con token válido', async () => {
    const res = await request(app)
      .get(`${BASE}/me`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: testUser.email });
  });

  it('401 — sin token', async () => {
    const res = await request(app).get(`${BASE}/me`);
    expect(res.status).toBe(401);
  });

  it('401 — token inválido', async () => {
    const res = await request(app)
      .get(`${BASE}/me`)
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });
});
