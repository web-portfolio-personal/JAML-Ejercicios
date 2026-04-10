import request from 'supertest';
import mongoose from 'mongoose';
import { connectTestDB, startServer, stopServer } from './helpers/setup.js';
import User from '../src/models/user.model.js';

let server, url;

beforeAll(async () => {
  await connectTestDB();
  ({ server, url } = await startServer());
  // Limpiar usuarios de test previos
  await User.deleteMany({ email: /@authtest\.com$/ });
});

afterAll(async () => {
  await User.deleteMany({ email: /@authtest\.com$/ });
  await stopServer(server);
});

const BASE = () => `${url}/api/auth`;

describe('POST /api/auth/register', () => {
  it('201 — registra usuario y devuelve token', async () => {
    const res = await request(url)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'user1@authtest.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).toMatchObject({ name: 'Test User', email: 'user1@authtest.com' });
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('400 — email duplicado', async () => {
    const res = await request(url)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: 'user1@authtest.com', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/registrado/i);
  });

  it('400 — campos requeridos faltantes', async () => {
    const res = await request(url)
      .post('/api/auth/register')
      .send({ email: 'nopass@authtest.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('200 — login correcto devuelve token', async () => {
    const res = await request(url)
      .post('/api/auth/login')
      .send({ email: 'user1@authtest.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
    expect(typeof res.body.data.token).toBe('string');
  });

  it('401 — contraseña incorrecta', async () => {
    const res = await request(url)
      .post('/api/auth/login')
      .send({ email: 'user1@authtest.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('404 — usuario no existe', async () => {
    const res = await request(url)
      .post('/api/auth/login')
      .send({ email: 'nobody@authtest.com', password: 'password123' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/auth/me', () => {
  let token;

  beforeAll(async () => {
    const res = await request(url)
      .post('/api/auth/login')
      .send({ email: 'user1@authtest.com', password: 'password123' });
    token = res.body.data.token;
  });

  it('200 — devuelve perfil con token válido', async () => {
    const res = await request(url)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: 'user1@authtest.com' });
    expect(res.body.data).not.toHaveProperty('password');
  });

  it('401 — sin token', async () => {
    const res = await request(url).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('401 — token inválido', async () => {
    const res = await request(url)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer tokeninvalido');
    expect(res.status).toBe(401);
  });
});
