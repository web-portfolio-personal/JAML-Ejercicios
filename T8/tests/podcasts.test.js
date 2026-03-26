import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';

const TEST_DB_URI = process.env.MONGODB_TEST_URI;

let userToken = '';
let adminToken = '';
let podcastId = '';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URI);

  // Crear usuario normal
  const userRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Podcast User',
      email: `podcast_user_${Date.now()}@example.com`,
      password: 'TestPassword123'
    });
  userToken = userRes.body.token;

  // Crear usuario admin
  const adminRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Podcast Admin',
      email: `podcast_admin_${Date.now()}@example.com`,
      password: 'TestPassword123',
      role: 'admin'
    });
  adminToken = adminRes.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
});

// ✓ GET /api/podcasts → 200 con array (solo publicados)
describe('GET /api/podcasts', () => {
  it('debería devolver array de podcasts publicados (200)', async () => {
    const res = await request(app)
      .get('/api/podcasts')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });

  it('debería soportar paginación con ?page=1&limit=5 (BONUS)', async () => {
    const res = await request(app)
      .get('/api/podcasts?page=1&limit=5')
      .expect(200);

    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.pagination.page).toBe(1);
  });
});

// ✓ POST /api/podcasts → 201 con podcast creado (requiere token)
describe('POST /api/podcasts', () => {
  it('debería crear un podcast (201)', async () => {
    const podcast = {
      title: 'Test Podcast',
      description: 'Una descripción larga para el podcast de prueba',
      category: 'tech',
      duration: 3600,
      episodes: 3
    };

    const res = await request(app)
      .post('/api/podcasts')
      .set('Authorization', `Bearer ${userToken}`)
      .send(podcast)
      .expect(201);

    expect(res.body.data.title).toBe(podcast.title);
    expect(res.body.data.published).toBe(false);
    podcastId = res.body.data._id;
  });

  // ✓ POST /api/podcasts → 401 sin token
  it('debería rechazar sin autenticación (401)', async () => {
    await request(app)
      .post('/api/podcasts')
      .send({
        title: 'Sin Auth',
        description: 'Descripción sin autenticación'
      })
      .expect(401);
  });
});

describe('GET /api/podcasts/:id', () => {
  it('debería obtener un podcast por ID (200)', async () => {
    const res = await request(app)
      .get(`/api/podcasts/${podcastId}`)
      .expect(200);

    expect(res.body.data._id).toBe(podcastId);
  });
});

describe('PUT /api/podcasts/:id', () => {
  it('debería actualizar el podcast si es el autor (200)', async () => {
    const res = await request(app)
      .put(`/api/podcasts/${podcastId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Podcast Actualizado', description: 'Descripción actualizada del podcast' })
      .expect(200);

    expect(res.body.data.title).toBe('Podcast Actualizado');
  });

  it('debería rechazar si no es el autor (403)', async () => {
    await request(app)
      .put(`/api/podcasts/${podcastId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Intento del admin', description: 'Descripción cambiada por admin' })
      .expect(403);
  });
});

// ✓ GET /api/podcasts/admin/all → 200 solo para admin
describe('GET /api/podcasts/admin/all', () => {
  it('debería devolver todos los podcasts para admin (200)', async () => {
    const res = await request(app)
      .get('/api/podcasts/admin/all')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('debería rechazar para usuario normal (403)', async () => {
    await request(app)
      .get('/api/podcasts/admin/all')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });
});

describe('PATCH /api/podcasts/:id/publish', () => {
  it('debería publicar/despublicar un podcast para admin (200)', async () => {
    const res = await request(app)
      .patch(`/api/podcasts/${podcastId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveProperty('published');
  });
});

// ✓ DELETE /api/podcasts/:id → 403 para user normal
// ✓ DELETE /api/podcasts/:id → 200 solo para admin
describe('DELETE /api/podcasts/:id', () => {
  it('debería rechazar eliminación para usuario normal (403)', async () => {
    await request(app)
      .delete(`/api/podcasts/${podcastId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('debería eliminar el podcast para admin (200)', async () => {
    const res = await request(app)
      .delete(`/api/podcasts/${podcastId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('message');
  });
});
