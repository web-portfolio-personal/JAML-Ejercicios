/**
 * deliverynote.test.js
 *
 * Utiliza jest.unstable_mockModule para reemplazar storage.service.js ANTES
 * de que se cargue app.js (que lo consume de forma transitiva a través del
 * controlador). Esto permite ejercitar el flujo completo de firma sin
 * depender de credenciales reales de Cloudinary en CI/CD.
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// ── Mock de Cloudinary/storage ANTES de importar cualquier consumidor ─────────
jest.unstable_mockModule('../src/services/storage.service.js', () => ({
  uploadImage: jest.fn().mockResolvedValue(
    'https://res.cloudinary.com/mock/signatures/test-sig.webp'
  ),
  uploadPdf: jest.fn().mockResolvedValue(
    'https://res.cloudinary.com/mock/pdfs/test-albaran.pdf'
  ),
}));

// ── Importaciones dinámicas (DESPUÉS del mock) ────────────────────────────────
const { default: request }  = await import('supertest');
const { default: app }      = await import('../src/app.js');
const { connectTestDb, clearDb, disconnectTestDb } = await import('./helpers/db.helper.js');

beforeAll(async () => { await connectTestDb(); });
beforeEach(async () => { await clearDb(); });
afterAll(async () => { await disconnectTestDb(); });

// ── Constantes ────────────────────────────────────────────────────────────────
const API_USER = '/api/user';
const API_DN   = '/api/deliverynote';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Crea un usuario admin verificado con empresa, cliente y proyecto.
 * Devuelve { token, clientId, projectId }.
 */
const fullSetup = async () => {
  const { body: reg } = await request(app)
    .post(`${API_USER}/register`)
    .send({ email: 'admin@bildytest.com', password: 'SecurePass123!' });

  const mongoose = (await import('mongoose')).default;
  const col = mongoose.connection.db.collection('users');
  const doc = await col.findOne(
    { email: 'admin@bildytest.com' },
    { projection: { verificationCode: 1 } }
  );
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

  const { body: clientBody } = await request(app)
    .post('/api/client').set('Authorization', `Bearer ${authToken}`)
    .send({ name: 'Cliente Test', cif: 'A87654321' });

  const { body: projBody } = await request(app)
    .post('/api/project').set('Authorization', `Bearer ${authToken}`)
    .send({ client: clientBody.client._id, name: 'Proyecto Test', projectCode: 'PRJ-001' });

  return {
    token:     authToken,
    clientId:  clientBody.client._id,
    projectId: projBody.project._id,
  };
};

/**
 * Igual que fullSetup pero también devuelve el companyId del admin,
 * necesario para registrar invitados en la misma compañía.
 */
const fullSetupWithCompany = async () => {
  const setup = await fullSetup();
  const mongoose = (await import('mongoose')).default;
  const col = mongoose.connection.db.collection('users');
  const adminDoc = await col.findOne({ email: 'admin@bildytest.com' });
  return { ...setup, companyId: adminDoc.company };
};

/**
 * Registra un segundo usuario con role='guest' en la misma compañía del admin.
 * Inyecta el role y company directamente en MongoDB para evitar el flujo de
 * invitación por e-mail que no es viable en tests.
 * Devuelve el accessToken del guest.
 */
const setupGuest = async (companyId) => {
  const { body: reg } = await request(app)
    .post(`${API_USER}/register`)
    .send({ email: 'guest@bildytest.com', password: 'SecurePass123!' });

  const mongoose = (await import('mongoose')).default;
  const col = mongoose.connection.db.collection('users');
  const doc = await col.findOne(
    { email: 'guest@bildytest.com' },
    { projection: { verificationCode: 1 } }
  );
  await request(app)
    .put(`${API_USER}/validation`)
    .set('Authorization', `Bearer ${reg.accessToken}`)
    .send({ code: doc.verificationCode });

  // Inyectar company y role — simula haber sido invitado por el admin
  await col.updateOne(
    { email: 'guest@bildytest.com' },
    { $set: { role: 'guest', company: companyId } }
  );

  const { body: logged } = await request(app)
    .post(`${API_USER}/login`)
    .send({ email: 'guest@bildytest.com', password: 'SecurePass123!' });

  return logged.accessToken;
};

// ── Tests existentes ──────────────────────────────────────────────────────────

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

  it('400 — albarán de horas con workers vacío', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const res = await request(app)
      .post(API_DN)
      .set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', workers: [], workDate: '2025-06-15' });
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

    const mongoose = (await import('mongoose')).default;
    await mongoose.connection.db.collection('deliverynotes').updateOne(
      { _id: new mongoose.Types.ObjectId(body.note._id) },
      { $set: { signed: true, signedAt: new Date(), pdfUrl: 'https://example.com/fake.pdf' } }
    );

    const res = await request(app)
      .get(`${API_DN}/pdf/${body.note._id}`)
      .set('Authorization', `Bearer ${token}`)
      .redirects(0);
    expect(res.status).toBe(302);
  });
});

describe('Guardia sin empresa — deliverynote', () => {
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
    const res = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: '64f1234567890123456789ab', project: '64f1234567890123456789ab', format: 'hours', hours: 4, workDate: '2025-06-15' });
    expect(res.status).toBe(400);
  });

  it('400 — listar albaranes sin empresa', async () => {
    const token = await setupNoCompany();
    const res = await request(app).get(API_DN).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/deliverynote/:id/sign — Firmar albarán (rutas de error)', () => {
  it('404 — albarán inexistente', async () => {
    const { token } = await fullSetup();
    const res = await request(app)
      .patch(`${API_DN}/64f1234567890123456789ab/sign`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('400 — albarán ya está firmado (vía DB)', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    const mongoose = (await import('mongoose')).default;
    await mongoose.connection.db.collection('deliverynotes').updateOne(
      { _id: new mongoose.Types.ObjectId(body.note._id) },
      { $set: { signed: true, signedAt: new Date() } }
    );

    const res = await request(app)
      .patch(`${API_DN}/${body.note._id}/sign`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/firmado/i);
  });

  it('400 — no se adjunta fichero de firma', async () => {
    const { token, clientId, projectId } = await fullSetup();
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });

    const res = await request(app)
      .patch(`${API_DN}/${body.note._id}/sign`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/firma/i);
  });
});

describe('POST /api/deliverynote — Validaciones extra', () => {
  it('400 — proyecto no pertenece al cliente indicado', async () => {
    const { token, clientId } = await fullSetup();

    const { body: client2Body } = await request(app)
      .post('/api/client')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Otro Cliente SL', cif: 'B99999999' });

    const { body: proj2Body } = await request(app)
      .post('/api/project')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client2Body.client._id, name: 'Proj Otro', projectCode: 'PRJ-OTR' });

    const res = await request(app)
      .post(API_DN)
      .set('Authorization', `Bearer ${token}`)
      .send({
        client:   clientId,
        project:  proj2Body.project._id,
        format:   'hours',
        hours:    4,
        workDate: '2025-06-15',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no pertenece/i);
  });
});

// ── Invariantes documentados con jest.unstable_mockModule ────────────────────

describe('INVARIANTE 1 — El estado de firma es permanente e irreversible', () => {
  it('400 — un albarán firmado no puede firmarse de nuevo', async () => {
    const { token, clientId, projectId } = await fullSetup();

    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });
    const noteId = body.note._id;

    // Primera firma — el mock resuelve uploadImage/uploadPdf sin Cloudinary real
    const first = await request(app)
      .patch(`${API_DN}/${noteId}/sign`)
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', Buffer.from('fake-image-data'), { filename: 'sig.png', contentType: 'image/png' });
    expect(first.status).toBe(200);

    // Segunda firma — debe rechazarse: el estado `signed: true` es permanente
    const second = await request(app)
      .patch(`${API_DN}/${noteId}/sign`)
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', Buffer.from('fake-image-data'), { filename: 'sig.png', contentType: 'image/png' });
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/firmado/i);
  });
});

describe('INVARIANTE 2 — Un albarán firmado no puede eliminarse', () => {
  it('400 — un albarán firmado no puede eliminarse aunque el solicitante sea su creador', async () => {
    const { token, clientId, projectId } = await fullSetup();

    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });
    const noteId = body.note._id;

    // Firmar usando el flujo real (mock evita dependencia de Cloudinary)
    const signRes = await request(app)
      .patch(`${API_DN}/${noteId}/sign`)
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', Buffer.from('fake-image-data'), { filename: 'sig.png', contentType: 'image/png' });
    expect(signRes.status).toBe(200);

    // El creador intenta eliminar su propio albarán ya firmado → rechazado
    const del = await request(app)
      .delete(`${API_DN}/${noteId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(400);
    expect(del.body.message).toMatch(/firmado/i);
  });
});

describe('INVARIANTE 3 — Control de acceso owner-or-guest (GET albarán)', () => {
  it('403 — un guest no puede ver albaranes de otro usuario aunque compartan la misma compañía', async () => {
    const { token, clientId, projectId, companyId } = await fullSetupWithCompany();

    // El admin crea un albarán
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });
    const noteId = body.note._id;

    // El guest es inyectado en la misma compañía vía MongoDB
    const guestToken = await setupGuest(companyId);

    // El guest intenta acceder al albarán del admin → 403
    const res = await request(app)
      .get(`${API_DN}/${noteId}`)
      .set('Authorization', `Bearer ${guestToken}`);
    expect(res.status).toBe(403);
  });
});

describe('INVARIANTE 4 — Control de acceso owner-or-guest (PDF)', () => {
  it('403 — un guest no puede descargar el PDF de un albarán que no le pertenece', async () => {
    const { token, clientId, projectId, companyId } = await fullSetupWithCompany();

    // El admin crea un albarán
    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });
    const noteId = body.note._id;

    // Guest en la misma compañía
    const guestToken = await setupGuest(companyId);

    // El guest intenta descargar el PDF del albarán del admin → 403
    const res = await request(app)
      .get(`${API_DN}/pdf/${noteId}`)
      .set('Authorization', `Bearer ${guestToken}`);
    expect(res.status).toBe(403);
  });
});

describe('INVARIANTE 5 — La firma persiste las URLs de Cloudinary en base de datos', () => {
  it('200 — la firma almacena signatureUrl y pdfUrl del mock y bloquea cualquier modificación posterior', async () => {
    const { token, clientId, projectId } = await fullSetup();

    const { body } = await request(app).post(API_DN).set('Authorization', `Bearer ${token}`)
      .send({ client: clientId, project: projectId, format: 'hours', hours: 4, workDate: '2025-06-15' });
    const noteId = body.note._id;

    // Firmar: el mock inyecta URLs deterministas sin necesidad de Cloudinary
    const res = await request(app)
      .patch(`${API_DN}/${noteId}/sign`)
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', Buffer.from('fake-image-data'), { filename: 'sig.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.note.signed).toBe(true);
    expect(res.body.note.signatureUrl).toBe(
      'https://res.cloudinary.com/mock/signatures/test-sig.webp'
    );
    expect(res.body.note.pdfUrl).toBe(
      'https://res.cloudinary.com/mock/pdfs/test-albaran.pdf'
    );

    // Verificar que el estado firmado es persistente y bloquea re-firma
    const reSign = await request(app)
      .patch(`${API_DN}/${noteId}/sign`)
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', Buffer.from('fake-image-data'), { filename: 'sig.png', contentType: 'image/png' });
    expect(reSign.status).toBe(400);
  });
});
