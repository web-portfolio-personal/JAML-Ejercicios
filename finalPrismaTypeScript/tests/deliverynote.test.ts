import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';
import { connectTestDb, clearDb, disconnectTestDb } from './helpers/db.helper';
import prisma from '../src/lib/prisma';

beforeAll(async () => { await connectTestDb(); });
beforeEach(async () => { await clearDb(); });
afterAll(async () => { await disconnectTestDb(); });

// Helpers

const API_USER = '/api/user';
const API_DN   = '/api/deliverynote';

const fullSetup = async (): Promise<{ token: string; clientId: string; projectId: string }> => {
  const { body: reg } = await request(app)
    .post(`${API_USER}/register`)
    .send({ email: 'admin@bildytest.com', password: 'SecurePass123!' });

  const userRecord = await prisma.user.findUnique({
    where: { email: 'admin@bildytest.com' },
    select: { verificationCode: true },
  });
  await request(app)
    .put(`${API_USER}/validation`)
    .set('Authorization', `Bearer ${reg.accessToken}`)
    .send({ code: userRecord?.verificationCode });

  const { body: logged } = await request(app)
    .post(`${API_USER}/login`)
    .send({ email: 'admin@bildytest.com', password: 'SecurePass123!' });

  const token = logged.accessToken;

  await request(app).put(`${API_USER}/register`).set('Authorization', `Bearer ${token}`)
    .send({ name: 'Admin', lastName: 'Test', nif: '12345678A' });
  await request(app).patch(`${API_USER}/company`).set('Authorization', `Bearer ${token}`)
    .send({ isFreelance: false, name: 'Test Corp SL', cif: 'B12345678' });

  const { body: final } = await request(app)
    .post(`${API_USER}/login`)
    .send({ email: 'admin@bildytest.com', password: 'SecurePass123!' });

  const authToken = final.accessToken;

  const { body: clientBody } = await request(app)
    .post('/api/client').set('Authorization', `Bearer ${authToken}`)
    .send({ name: 'Cliente Test', cif: 'A87654321' });

  const { body: projBody } = await request(app)
    .post('/api/project').set('Authorization', `Bearer ${authToken}`)
    .send({ client: clientBody.client.id, name: 'Proyecto Test', projectCode: 'PRJ-001' });

  return {
    token:     authToken,
    clientId:  clientBody.client.id,
    projectId: projBody.project.id,
  };
};

// Tests

describe('POST /api/deliverynote — Crear albaran', () => {
  it('201 — crea albaran de tipo horas', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const res = await request(app)
      .post(API_DN)
      .set('Authorization', `Bearer ${token}`)
      .send({
        client:      clientId,
        project:     projectId,
        format:      'hours',
        hours:       8,
        workDate:    '2025-06-15',
        description: 'Jornada completa',
      });
    expect(res.status).toBe(201);
    expect(res.body.note.format).toBe('hours');
    expect(res.body.note.signed).toBe(false);
  });

  it('201 — crea albaran de tipo material', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const res = await request(app)
      .post(API_DN)
      .set('Authorization', `Bearer ${token}`)
      .send({
        client:   clientId,
        project:  projectId,
        format:   'material',
        material: 'Cemento Portland',
        quantity: 50,
        unit:     'kg',
        workDate: '2025-06-15',
      });
    expect(res.status).toBe(201);
    expect(res.body.note.format).toBe('material');
  });

  it('400 — albaran de horas sin horas ni workers', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const res = await request(app)
      .post(API_DN)
      .set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', workDate: '2025-06-15' });
    expect(res.status).toBe(400);
  });

  it('400 — albaran de material sin campo material', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const res = await request(app)
      .post(API_DN)
      .set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'material', quantity: 5, workDate: '2025-06-15' });
    expect(res.status).toBe(400);
  });

  it('404 — proyecto inexistente', async () => {
    const { token, clientId } = await fullSetup();
    const res = await request(app)
      .post(API_DN)
      .set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: 'clxxxxxxxxxxxxxxxxxxxxxxxx', format: 'hours', hours: 4, workDate: '2025-06-15' });
    expect(res.status).toBe(404);
  });

  it('401 — sin token', async () => {
    const res = await request(app).post(API_DN).send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /api/deliverynote — Listar albaranes', () => {
  it('200 — lista con paginacion', async () => {
    const { token, clientId, projectId } = await fullSetup();
    await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });
    await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'material', material: 'Ladrillo', quantity: 100, unit: 'ud', workDate: '2025-06-16' });

    const res = await request(app).get(API_DN).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(2);
    expect(res.body.totalItems).toBe(2);
  });

  it('200 — filtra por format', async () => {
    const { token, clientId, projectId } = await fullSetup();
    await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });
    await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'material', material: 'Ladrillo', quantity: 10, unit: 'ud', workDate: '2025-06-16' });

    const res = await request(app)
      .get(`${API_DN}?format=hours`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].format).toBe('hours');
  });

  it('200 — filtra por proyecto', async () => {
    const { token, clientId, projectId } = await fullSetup();
    await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    const res = await request(app)
      .get(`${API_DN}?project=${projectId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.notes).toHaveLength(1);
  });
});

describe('GET /api/deliverynote/:id — Obtener albaran', () => {
  it('200 — devuelve con populate completo', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    const res = await request(app)
      .get(`${API_DN}/${body.note.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.note.client).toBeTruthy();
    expect(res.body.note.project).toBeTruthy();
  });

  it('404 — ID inexistente', async () => {
    const { token } = await fullSetup();
    const res = await request(app)
      .get(`${API_DN}/clxxxxxxxxxxxxxxxxxxxxxxxx`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/deliverynote/pdf/:id — Descargar PDF', () => {
  it('200 — genera PDF al vuelo (Content-Type application/pdf)', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15', description: 'Test' });

    const res = await request(app)
      .get(`${API_DN}/pdf/${body.note.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
  });
});

describe('DELETE /api/deliverynote/:id — Eliminar albaran', () => {
  it('200 — elimina albaran no firmado', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    const res = await request(app)
      .delete(`${API_DN}/${body.note.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('404 — ya no existe tras borrar', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    await request(app).delete(`${API_DN}/${body.note.id}`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get(`${API_DN}/${body.note.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
