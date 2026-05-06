import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import { connectTestDb, clearDb, disconnectTestDb } from './helpers/db.helper.js';

beforeAll(async () => { await connectTestDb(); });
beforeEach(async () => { await clearDb(); });
afterAll(async () => { await disconnectTestDb(); });

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_USER    = '/api/user';
const API_CLIENT  = '/api/client';
const API_PROJECT = '/api/project';

const setupUserWithClient = async () => {
  const { body: reg } = await request(app)
    .post(`${API_USER}/register`)
    .send({ email: 'admin@bildytest.com', password: 'SecurePass123!' });

  const token = reg.accessToken;

  const mongoose = (await import('mongoose')).default;
  const col = mongoose.connection.db.collection('users');
  const doc = await col.findOne({ email: 'admin@bildytest.com' }, { projection: { verificationCode: 1 } });
  await request(app)
    .put(`${API_USER}/validation`)
    .set('Authorization', `Bearer ${token}`)
    .send({ code: doc.verificationCode });

  const { body: logged } = await request(app)
    .post(`${API_USER}/login`)
    .send({ email: 'admin@bildytest.com', password: 'SecurePass123!' });

  const freshToken = logged.accessToken;

  await request(app)
    .put(`${API_USER}/register`)
    .set('Authorization', `Bearer ${freshToken}`)
    .send({ name: 'Admin', lastName: 'Test', nif: '12345678A' });

  await request(app)
    .patch(`${API_USER}/company`)
    .set('Authorization', `Bearer ${freshToken}`)
    .send({ isFreelance: false, name: 'Test Corp SL', cif: 'B12345678' });

  const { body: final } = await request(app)
    .post(`${API_USER}/login`)
    .send({ email: 'admin@bildytest.com', password: 'SecurePass123!' });

  const authToken = final.accessToken;

  // Crear cliente
  const { body: clientBody } = await request(app)
    .post(API_CLIENT)
    .set('Authorization', `Bearer ${authToken}`)
    .send({ name: 'Cliente Test SL', cif: 'A87654321' });

  return { token: authToken, clientId: clientBody.client._id };
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/project — Crear proyecto', () => {
  it('201 — crea proyecto correctamente', async () => {
    const { token, clientId } = await setupUserWithClient();
    const res = await request(app)
      .post(API_PROJECT)
      .set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Reforma oficinas', projectCode: 'PRJ-001' });
    expect(res.status).toBe(201);
    expect(res.body.project.name).toBe('Reforma oficinas');
    expect(res.body.project.projectCode).toBe('PRJ-001');
  });

  it('409 — código de proyecto duplicado', async () => {
    const { token, clientId } = await setupUserWithClient();
    await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Proj 1', projectCode: 'PRJ-001' });
    const res = await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Proj 2', projectCode: 'PRJ-001' });
    expect(res.status).toBe(409);
  });

  it('404 — cliente inexistente', async () => {
    const { token } = await setupUserWithClient();
    const res = await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: '64f1234567890123456789ab', name: 'Test', projectCode: 'PRJ-X' });
    expect(res.status).toBe(404);
  });

  it('400 — falta projectCode', async () => {
    const { token, clientId } = await setupUserWithClient();
    const res = await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('401 — sin token', async () => {
    const res = await request(app).post(API_PROJECT).send({ name: 'Test', projectCode: 'PRJ-1' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/project — Listar proyectos', () => {
  it('200 — devuelve lista paginada con populate de cliente', async () => {
    const { token, clientId } = await setupUserWithClient();
    await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Proj 1', projectCode: 'PRJ-001' });

    const res = await request(app).get(API_PROJECT).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].client).toBeTruthy();
  });

  it('200 — filtra por nombre', async () => {
    const { token, clientId } = await setupUserWithClient();
    await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Reforma', projectCode: 'PRJ-001' });
    await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Pintura', projectCode: 'PRJ-002' });

    const res = await request(app)
      .get(`${API_PROJECT}?name=Reforma`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].name).toBe('Reforma');
  });

  it('200 — filtra por active=false (proyectos inactivos)', async () => {
    const { token, clientId } = await setupUserWithClient();
    await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Activo', projectCode: 'PRJ-ACT', active: true });
    await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Inactivo', projectCode: 'PRJ-INA', active: false });

    const res = await request(app)
      .get(`${API_PROJECT}?active=false`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].name).toBe('Inactivo');
  });
});

describe('GET /api/project/:id — Obtener proyecto', () => {
  it('200 — devuelve proyecto con populate', async () => {
    const { token, clientId } = await setupUserWithClient();
    const { body } = await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Proj 1', projectCode: 'PRJ-001' });

    const res = await request(app)
      .get(`${API_PROJECT}/${body.project._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.project.client).toBeTruthy();
  });

  it('404 — ID inexistente', async () => {
    const { token } = await setupUserWithClient();
    const res = await request(app)
      .get(`${API_PROJECT}/64f1234567890123456789ab`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE + PATCH restore — Proyectos', () => {
  it('200 — soft delete y restaurar', async () => {
    const { token, clientId } = await setupUserWithClient();
    const { body } = await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Proj', projectCode: 'PRJ-001' });

    await request(app)
      .delete(`${API_PROJECT}/${body.project._id}?soft=true`)
      .set('Authorization', `Bearer ${token}`);

    const archRes = await request(app)
      .get(`${API_PROJECT}/archived`)
      .set('Authorization', `Bearer ${token}`);
    expect(archRes.body.projects).toHaveLength(1);

    await request(app)
      .patch(`${API_PROJECT}/${body.project._id}/restore`)
      .set('Authorization', `Bearer ${token}`);

    const archRes2 = await request(app)
      .get(`${API_PROJECT}/archived`)
      .set('Authorization', `Bearer ${token}`);
    expect(archRes2.body.projects).toHaveLength(0);
  });

  it('200 — hard delete elimina permanentemente', async () => {
    const { token, clientId } = await setupUserWithClient();
    const { body } = await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Proj Hard', projectCode: 'PRJ-HD1' });

    const delRes = await request(app)
      .delete(`${API_PROJECT}/${body.project._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.message).toMatch(/permanentemente/i);

    const getRes = await request(app)
      .get(`${API_PROJECT}/${body.project._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });
});

describe('Guardia sin empresa — project', () => {
  const setupNoCompany = async () => {
    const { body: reg } = await request(app)
      .post(`${API_USER}/register`)
      .send({ email: 'nocomp4@bildytest.com', password: 'SecurePass123!' });
    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('users');
    const doc = await col.findOne({ email: 'nocomp4@bildytest.com' }, { projection: { verificationCode: 1 } });
    await request(app).put(`${API_USER}/validation`).set('Authorization', `Bearer ${reg.accessToken}`).send({ code: doc.verificationCode });
    const { body: logged } = await request(app).post(`${API_USER}/login`).send({ email: 'nocomp4@bildytest.com', password: 'SecurePass123!' });
    return logged.accessToken;
  };

  it('400 — crear proyecto sin empresa', async () => {
    const token = await setupNoCompany();
    // Usar ObjectId válido para que Zod no rechace antes de llegar al controlador
    const res = await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test', projectCode: 'PRJ-NC', client: '64f1234567890123456789ab' });
    expect(res.status).toBe(400);
  });

  it('400 — listar proyectos sin empresa', async () => {
    const token = await setupNoCompany();
    const res = await request(app).get(API_PROJECT).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400 — listar archivados sin empresa', async () => {
    const token = await setupNoCompany();
    const res = await request(app).get(`${API_PROJECT}/archived`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/project/:id — Actualizar proyecto', () => {
  it('200 — actualiza nombre del proyecto', async () => {
    const { token, clientId } = await setupUserWithClient();
    const { body } = await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Nombre Original', projectCode: 'PRJ-UP1' });

    const res = await request(app)
      .put(`${API_PROJECT}/${body.project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nombre Actualizado' });
    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('Nombre Actualizado');
  });

  it('409 — projectCode duplicado al actualizar', async () => {
    const { token, clientId } = await setupUserWithClient();
    await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Proj A', projectCode: 'PRJ-A' });
    const { body: projB } = await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Proj B', projectCode: 'PRJ-B' });

    const res = await request(app)
      .put(`${API_PROJECT}/${projB.project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ projectCode: 'PRJ-A' });
    expect(res.status).toBe(409);
  });

  it('404 — proyecto no encontrado', async () => {
    const { token } = await setupUserWithClient();
    const res = await request(app)
      .put(`${API_PROJECT}/64f1234567890123456789ab`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nuevo nombre' });
    expect(res.status).toBe(404);
  });

  it('200 — cambia el cliente del proyecto a otro cliente válido', async () => {
    const { token, clientId } = await setupUserWithClient();
    const { body: proj } = await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Proj Change Client', projectCode: 'PRJ-CC' });

    // Crear segundo cliente
    const { body: c2 } = await request(app).post('/api/client').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Segundo Cliente', cif: 'C22222222' });

    const res = await request(app)
      .put(`${API_PROJECT}/${proj.project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client: c2.client._id });
    expect(res.status).toBe(200);
    expect(res.body.project.client.toString()).toBe(c2.client._id.toString());
  });

  it('404 — cliente inválido al actualizar proyecto', async () => {
    const { token, clientId } = await setupUserWithClient();
    const { body: proj } = await request(app).post(API_PROJECT).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, name: 'Proj Bad Client', projectCode: 'PRJ-BC' });

    const res = await request(app)
      .put(`${API_PROJECT}/${proj.project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client: '64f1234567890123456789ab' });
    expect(res.status).toBe(404);
  });
});
