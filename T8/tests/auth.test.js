import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';

const TEST_DB_URI = process.env.MONGODB_TEST_URI;

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URI);
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Auth Endpoints', () => {
  let token = '';

  const testUser = {
    name: 'Test User',
    email: `auth_${Date.now()}@example.com`,
    password: 'TestPassword123'
  };

  // ✓ POST /api/auth/register → 201 con usuario creado
  describe('POST /api/auth/register', () => {
    it('debería registrar un nuevo usuario (201)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.role).toBe('user');
      expect(res.body.user).not.toHaveProperty('password');

      token = res.body.token;
    });

    // ✓ POST /api/auth/register → 400 si email duplicado
    it('debería rechazar email duplicado (400)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(400);

      expect(res.body.error).toBe(true);
    });

    // ✓ POST /api/auth/register → 400 si faltan campos
    it('debería rechazar si faltan campos obligatorios (400)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid' })
        .expect(400);

      expect(res.body.error).toBe(true);
    });

    it('debería registrar un admin y notificar Slack (BONUS)', async () => {
      const adminUser = {
        name: 'Admin Test',
        email: `admin_slack_${Date.now()}@example.com`,
        password: 'AdminPass123',
        role: 'admin'
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(adminUser)
        .expect(201);

      expect(res.body.user.role).toBe('admin');
    });
  });

  // ✓ POST /api/auth/login → 201 con token cuando credenciales válidas
  describe('POST /api/auth/login', () => {
    it('debería hacer login correctamente (201)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(201);

      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      token = res.body.token;
    });

    // ✓ POST /api/auth/login → 401 si contraseña incorrecta
    it('debería rechazar contraseña incorrecta (401)', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123'
        })
        .expect(401);
    });

    it('debería rechazar usuario inexistente (404)', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'noexiste@example.com',
          password: 'TestPassword123'
        })
        .expect(404);
    });
  });

  describe('GET /api/auth/me', () => {
    // ✓ GET /api/auth/me → 200 con datos del usuario (requiere token)
    it('debería devolver datos del usuario autenticado (200)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.user.email).toBe(testUser.email);
    });

    // ✓ GET /api/auth/me → 401 sin token
    it('debería rechazar sin token (401)', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    it('debería rechazar token inválido (401)', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token_invalido')
        .expect(401);
    });
  });

  // BONUS: PATCH /api/auth/change-password
  describe('PATCH /api/auth/change-password (BONUS)', () => {
    it('debería cambiar la contraseña correctamente (200)', async () => {
      const res = await request(app)
        .patch('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'NuevaPassword456'
        })
        .expect(200);

      expect(res.body).toHaveProperty('message');
    });

    it('debería rechazar si la contraseña actual es incorrecta (401)', async () => {
      await request(app)
        .patch('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'contrasenaMal',
          newPassword: 'OtraPassword789'
        })
        .expect(401);
    });

    it('debería rechazar sin token (401)', async () => {
      await request(app)
        .patch('/api/auth/change-password')
        .send({
          currentPassword: 'TestPassword123',
          newPassword: 'NuevaPassword456'
        })
        .expect(401);
    });

    it('debería rechazar sin body requerido (400)', async () => {
      await request(app)
        .patch('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });
  });

  describe('Rutas no existentes', () => {
    it('debería devolver 404 para ruta inexistente', async () => {
      const res = await request(app)
        .get('/api/ruta-que-no-existe')
        .expect(404);

      expect(res.body.error).toBe(true);
    });
  });
});
