import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import { connectTestDb, clearDb, disconnectTestDb } from './helpers/db.helper.js';

beforeAll(async () => { await connectTestDb(); });
beforeEach(async () => { await clearDb(); });
afterAll(async () => { await disconnectTestDb(); });

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_USER  = '/api/user';
const API_DN    = '/api/deliverynote';

const fullSetup = async () => {
  // Registro y verificación
  const { body: reg } = await request(app)
    .post(`${API_USER}/register`)
    .send({ email: 'admin@bildytest.com', password: 'SecurePass123!' });

  const mongoose = (await import('mongoose')).default;
  const col = mongoose.connection.db.collection('users');
  const doc = await col.findOne({ email: 'admin@bildytest.com' }, { projection: { verificationCode: 1 } });
  await request(app)
    .put(`${API_USER}/validation`)
    .set('Authorization', `Bearer ${reg.accessToken}`)
    .send({ code: doc.verificationCode });

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

  // Crear cliente
  const { body: clientBody } = await request(app)
    .post('/api/client').set('Authorization', `Bearer ${authToken}`)
    .send({ name: 'Cliente Test', cif: 'A87654321' });

  // Crear proyecto
  const { body: projBody } = await request(app)
    .post('/api/project').set('Authorization', `Bearer ${authToken}`)
    .send({ client: clientBody.client._id, name: 'Proyecto Test', projectCode: 'PRJ-001' });

  return {
    token:     authToken,
    clientId:  clientBody.client._id,
    projectId: projBody.project._id,
  };
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/deliverynote — Crear albarán', () => {
  it('201 — crea albarán de tipo horas', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const res = await request(app)
      .post(API_DN)
      .set('Authorization', `Bearer ${token}`)
      .send({
        client:  clientId,
        project: projectId,
        format:  'hours',
        hours:   8,
        workDate:'2025-06-15',
        description: 'Jornada completa',
      });
    expect(res.status).toBe(201);
    expect(res.body.note.format).toBe('hours');
    expect(res.body.note.signed).toBe(false);
  });

  it('201 — crea albarán de tipo material', async () => {
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

  it('400 — albarán de horas sin horas ni workers', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const res = await request(app)
      .post(API_DN)
      .set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', workDate: '2025-06-15' });
    expect(res.status).toBe(400);
  });

  it('400 — albarán de material sin campo material', async () => {
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
      .send({ client: clientId, project: '64f1234567890123456789ab', format: 'hours', hours: 4, workDate: '2025-06-15' });
    expect(res.status).toBe(404);
  });

  it('401 — sin token', async () => {
    const res = await request(app).post(API_DN).send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /api/deliverynote — Listar albaranes', () => {
  it('200 — lista con paginación', async () => {
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

describe('GET /api/deliverynote/:id — Obtener albarán', () => {
  it('200 — devuelve con populate completo', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    const res = await request(app)
      .get(`${API_DN}/${body.note._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.note.client).toBeTruthy();
    expect(res.body.note.project).toBeTruthy();
  });

  it('404 — ID inexistente', async () => {
    const { token } = await fullSetup();
    const res = await request(app)
      .get(`${API_DN}/64f1234567890123456789ab`)
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
      .get(`${API_DN}/pdf/${body.note._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
  });
});

describe('DELETE /api/deliverynote/:id — Eliminar albarán', () => {
  it('200 — elimina albarán no firmado', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    const res = await request(app)
      .delete(`${API_DN}/${body.note._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('404 — ya no existe tras borrar', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    await request(app).delete(`${API_DN}/${body.note._id}`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get(`${API_DN}/${body.note._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('400 — no se puede eliminar un albarán firmado', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    // Marcar como firmado directamente en DB
    const mongoose = (await import('mongoose')).default;
    await mongoose.connection.db.collection('deliverynotes').updateOne(
      { _id: new (await import('mongoose')).default.Types.ObjectId(body.note._id) },
      { $set: { signed: true, signedAt: new Date() } }
    );

    const res = await request(app)
      .delete(`${API_DN}/${body.note._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/firmado/i);
  });
});

describe('GET /api/deliverynote — Filtros avanzados', () => {
  it('200 — filtra por signed=true', async () => {
    const { token, clientId, projectId } = await fullSetup();
    await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('deliverynotes');
    const note = await col.findOne({});
    await col.updateOne({ _id: note._id }, { $set: { signed: true } });

    const res = await request(app)
      .get(`${API_DN}?signed=true`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.notes.every((n) => n.signed === true)).toBe(true);
  });

  it('200 — filtra por rango de fechas (from/to)', async () => {
    const { token, clientId, projectId } = await fullSetup();
    await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-01-10' });
    await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 2, workDate: '2025-06-20' });

    const res = await request(app)
      .get(`${API_DN}?from=2025-06-01&to=2025-06-30`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].hours).toBe(2);
  });
});

describe('GET /api/deliverynote/pdf/:id — PDF de albarán firmado', () => {
  it('302 — redirige al pdfUrl cuando el albarán está firmado y tiene URL en nube', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    // Simular firma con pdfUrl directamente en DB
    const mongoose = (await import('mongoose')).default;
    await mongoose.connection.db.collection('deliverynotes').updateOne(
      { _id: new mongoose.Types.ObjectId(body.note._id) },
      { $set: { signed: true, signedAt: new Date(), pdfUrl: 'https://example.com/fake.pdf' } }
    );

    const res = await request(app)
      .get(`${API_DN}/pdf/${body.note._id}`)
      .set('Authorization', `Bearer ${token}`)
      .redirects(0); // no seguir el redirect
    expect(res.status).toBe(302);
  });
});

describe('Guardia sin empresa — deliverynote', () => {
  // Helper: usuario verificado sin empresa
  const setupNoCompany = async () => {
    const { body: reg } = await request(app)
      .post(`${API_USER}/register`)
      .send({ email: 'nocomp3@bildytest.com', password: 'SecurePass123!' });
    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('users');
    const doc = await col.findOne({ email: 'nocomp3@bildytest.com' }, { projection: { verificationCode: 1 } });
    await request(app).put(`${API_USER}/validation`).set('Authorization', `Bearer ${reg.accessToken}`).send({ code: doc.verificationCode });
    const { body: logged } = await request(app).post(`${API_USER}/login`).send({ email: 'nocomp3@bildytest.com', password: 'SecurePass123!' });
    return logged.accessToken;
  };

  it('400 — crear albarán sin empresa', async () => {
    const token = await setupNoCompany();
    const res = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`).send({});
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
    const { token, clientId } = await fullSetup();

    // Crear segundo cliente
    const { body: client2Body } = await request(app)
      .post('/api/client')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Otro Cliente SL', cif: 'B99999999' });

    // Crear proyecto para el segundo cliente
    const { body: proj2Body } = await request(app)
      .post('/api/project')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client2Body.client._id, name: 'Proj Otro', projectCode: 'PRJ-OTR' });

    // Intentar crear albarán combinando clientId del primero con proyecto del segundo
    const res = await request(app)
      .post(API_DN)
      .set('Authorization', `Bearer ${token}`)
      .send({
        client:  clientId,
        project: proj2Body.project._id,
        format:  'hours',
        hours:   4,
        workDate: '2025-06-15',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no pertenece/i);
  });
});
