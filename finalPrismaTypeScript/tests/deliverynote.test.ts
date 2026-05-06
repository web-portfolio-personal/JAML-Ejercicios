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

  it('400 — albaran de horas con workers vacio', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const res = await request(app)
      .post(API_DN)
      .set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', workers: [], workDate: '2025-06-15' });
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

  it('400 — no se puede eliminar un albaran firmado', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    // Marcar como firmado directamente en DB
    await prisma.deliveryNote.update({
      where: { id: body.note.id },
      data: { signed: true, signedAt: new Date() },
    });

    const res = await request(app)
      .delete(`${API_DN}/${body.note.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/firmado/i);
  });
});

// Helper: usuario verificado SIN empresa
const setupNoCompany = async (): Promise<string> => {
  const email = `nocomp${Date.now()}@bildytest.com`;
  const { body: reg } = await request(app)
    .post('/api/user/register')
    .send({ email, password: 'SecurePass123!' });
  const userRecord = await prisma.user.findUnique({
    where: { email },
    select: { verificationCode: true },
  });
  await request(app).put('/api/user/validation')
    .set('Authorization', `Bearer ${reg.accessToken}`)
    .send({ code: userRecord?.verificationCode });
  const { body: logged } = await request(app).post('/api/user/login').send({ email, password: 'SecurePass123!' });
  return logged.accessToken;
};

describe('Guardia sin empresa — deliverynote', () => {
  it('400 — crear albaran sin empresa', async () => {
    const token = await setupNoCompany();
    const res = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: 'x', project: 'x', format: 'hours', hours: 4, workDate: '2025-06-15' });
    expect(res.status).toBe(400);
  });

  it('400 — listar albaranes sin empresa', async () => {
    const token = await setupNoCompany();
    const res = await request(app).get(API_DN).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/deliverynote — Validaciones extra', () => {
  it('400 — proyecto no pertenece al cliente indicado', async () => {
    const { token, projectId } = await fullSetup();

    // Crear un segundo cliente
    const { body: c2 } = await request(app).post('/api/client')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Otro Cliente', cif: 'Z99999999' });

    const res = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({
        client:  c2.client.id,
        project: projectId,
        format:  'hours',
        hours:   4,
        workDate: '2025-06-15',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/proyecto no pertenece/i);
  });
});

describe('GET /api/deliverynote — Filtros avanzados', () => {
  it('200 — filtra por signed=true', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });
    await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'material', material: 'Cemento', quantity: 10, unit: 'kg', workDate: '2025-06-16' });

    await prisma.deliveryNote.update({
      where: { id: body.note.id },
      data: { signed: true, signedAt: new Date() },
    });

    const res = await request(app).get(`${API_DN}?signed=true`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].signed).toBe(true);
  });

  it('200 — filtra por rango de fechas (from/to)', async () => {
    const { token, clientId, projectId } = await fullSetup();
    await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-01-10' });
    await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 8, workDate: '2025-06-15' });

    const res = await request(app)
      .get(`${API_DN}?from=2025-06-01&to=2025-06-30`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(1);
  });
});

describe('PATCH /api/deliverynote/:id/sign — firmar albaran (error paths)', () => {
  it('404 — albaran no encontrado', async () => {
    const { token } = await fullSetup();
    const res = await request(app)
      .patch(`${API_DN}/nonexistent-id-xyz/sign`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('400 — albaran ya firmado', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    await prisma.deliveryNote.update({
      where: { id: body.note.id },
      data: { signed: true, signedAt: new Date() },
    });

    const res = await request(app)
      .patch(`${API_DN}/${body.note.id}/sign`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400 — sin imagen de firma (no file attached)', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    const res = await request(app)
      .patch(`${API_DN}/${body.note.id}/sign`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/deliverynote/pdf/:id — PDF de albaran firmado', () => {
  it('302 — redirige cuando el albaran ya tiene pdfUrl', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    await prisma.deliveryNote.update({
      where: { id: body.note.id },
      data: { signed: true, signedAt: new Date(), pdfUrl: 'https://example.com/signed.pdf' },
    });

    const res = await request(app)
      .get(`${API_DN}/pdf/${body.note.id}`)
      .set('Authorization', `Bearer ${token}`)
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com/signed.pdf');
  });
});
