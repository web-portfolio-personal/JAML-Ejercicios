import request from 'supertest';
import app from '../src/app.js';

describe('Tracks Endpoints', () => {
  let token = '';
  let trackId = '';

  beforeAll(async () => {
    const user = {
      name: 'Track Tester',
      email: `tracks_${Date.now()}@example.com`,
      password: 'TestPassword123'
    };

    const res = await request(app)
      .post('/api/auth/register')
      .send(user);

    token = res.body.token;
  });

  describe('GET /api/tracks', () => {
    it('debería obtener lista de tracks', async () => {
      const res = await request(app)
        .get('/api/tracks')
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/tracks', () => {
    it('debería crear un track', async () => {
      const track = {
        title: 'Test Track',
        duration: 180,
        genres: ['rock']
      };

      const res = await request(app)
        .post('/api/tracks')
        .set('Authorization', `Bearer ${token}`)
        .send(track)
        .expect(201);

      expect(res.body.data.title).toBe(track.title);
      trackId = res.body.data._id;
    });

    it('debería rechazar sin autenticación', async () => {
      await request(app)
        .post('/api/tracks')
        .send({ title: 'Sin Auth', duration: 100 })
        .expect(401);
    });
  });

  describe('GET /api/tracks/:id', () => {
    it('debería obtener un track por ID', async () => {
      const res = await request(app)
        .get(`/api/tracks/${trackId}`)
        .expect(200);

      expect(res.body.data._id).toBe(trackId);
    });

    it('debería devolver 404 para ID inexistente', async () => {
      await request(app)
        .get('/api/tracks/65f8b3a2c9d1e20012345678')
        .expect(404);
    });
  });

  describe('PUT /api/tracks/:id', () => {
    it('debería actualizar un track', async () => {
      const res = await request(app)
        .put(`/api/tracks/${trackId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Track Actualizado' })
        .expect(200);

      expect(res.body.data.title).toBe('Track Actualizado');
    });
  });

  describe('DELETE /api/tracks/:id', () => {
    it('debería rechazar para rol user (solo admin)', async () => {
      await request(app)
        .delete(`/api/tracks/${trackId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
