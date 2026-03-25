import request from 'supertest';
import app from '../src/app.js';

describe('Auth Endpoints', () => {
  let token = '';
  let userId = '';

  const testUser = {
    name: 'Test User',
    email: `test_${Date.now()}@example.com`,
    password: 'TestPassword123'
  };

  describe('POST /api/auth/register', () => {
    it('debería registrar un nuevo usuario', async () => {
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
      userId = res.body.user._id;
    });

    it('debería rechazar email duplicado', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(res.body.error).toBe(true);
    });

    it('debería rechazar datos inválidos', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid' })
        .expect(400);

      expect(res.body.error).toBe(true);
    });
  });

  describe('POST /api/auth/login', () => {
    it('debería hacer login correctamente', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      token = res.body.token;
    });

    it('debería rechazar password incorrecto', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123'
        })
        .expect(401);
    });

    it('debería rechazar usuario inexistente', async () => {
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
    it('debería acceder con token válido', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
    });

    it('debería rechazar sin token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    it('debería rechazar token inválido', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token_invalido')
        .expect(401);
    });
  });
});
