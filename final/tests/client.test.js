import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import { connectTestDb, clearDb, disconnectTestDb } from './helpers/db.helper.js';

beforeAll(async () => { await connectTestDb(); });
beforeEach(async () => { await clearDb(); });
afterAll(async () => { await disconnectTestDb(); });

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_USER = '/api/user';
const API_CLIENT = '/api/client';

const setupUser = async () => {
  // Registro
  const { body: reg } = await request(app)
    .post(`${API_USER}/register`)
    .send({ email: 'admin@bildytest.com', password: 'SecurePass123!' });

  const token = reg.accessToken;

  // Verificar email
  const mongoose = (await import('mongoose')).default;
  const col = mongoose.connection.db.collection('users');
  const doc = await col.findOne({ email: 'admin@bildytest.com' }, { projection: { verificationCode: 1 } });
  await request(app)
    .put(`${API_USER}/validation`)
    .set('Authorization', `Bearer ${token}`)
    .send({ code: doc.verificationCode });

  // Login para obtener token fresco
  const { body: logged } = await request(app)
    .post(`${API_USER}/login`)
    .send({ email: 'admin@bildytest.com', password: 'SecurePass123!' });

  const freshToken = logged.accessToken;

  // Datos personales
  await request(app)
    .put(`${API_USER}/register`)
    .set('Authorization', `Bearer ${freshToken}`)
    .send({ name: 'Admin', lastName: 'Test', nif: '12345678A' });

  // Crear empresa
  await request(app)
    .patch(`${API_USER}/company`)
    .set('Authorization', `Bearer ${freshToken}`)
    .send({ isFreelance: false, name: 'Test Corp SL', cif: 'B12345678' });

  // Login final
  const { body: final } = await request(app)
    .post(`${API_USER}/login`)
    .send({ email: 'admin@bildytest.com', password: 'SecurePass123!' });

  return final.accessToken;
};

const clientData = {
  name: 'Cliente Demo SL',
  cif:  'A87654321',
  email:'cliente@demo.com',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/client — Crear cliente', () => {
  it('201 — crea cliente correctamente', async () => {
    const token = await setupUser();
    const res = await request(app)
      .post(API_CLIENT)
      .set('Authorization', `Bearer ${token}`)
      .send(clientData);
    expect(res.status).toBe(201);
    expect(res.body.client.name).toBe(clientData.name);
    expect(res.body.client.cif).toBe(clientData.cif);
  });

  it('409 — CIF duplicado', async () => {
    const token = await setupUser();
    await request(app).post(API_CLIENT).set('Authorization', `Bearer ${token}`).send(clientData);
    const res = await request(app).post(API_CLIENT).set('Authorization', `Bearer ${token}`).send(clientData);
    expect(res.status).toBe(409);
  });

  it('400 — falta el campo name', async () => {
    const token = await setupUser();
    const res = await request(app)
      .post(API_CLIENT)
      .set('Authorization', `Bearer ${token}`)
      .send({ cif: 'A11111111' });
    expect(res.status).toBe(400);
  });

  it('401 — sin token', async () => {
    const res = await request(app).post(API_CLIENT).send(clientData);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/client — Listar clientes', () => {
  it('200 — devuelve lista paginada', async () => {
    const token = await setupUser();
    await request(app).post(API_CLIENT).set('Authorization', `Bearer ${token}`).send(clientData);

    const res = await request(app).get(API_CLIENT).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.clients).toHaveLength(1);
    expect(res.body.totalItems).toBe(1);
    expect(res.body.totalPages).toBe(1);
    expect(res.body.currentPage).toBe(1);
  });

  it('200 — filtra por nombre (parcial)', async () => {
    const token = await setupUser();
    await request(app).post(API_CLIENT).set('Authorization', `Bearer ${token}`).send(clientData);
    await request(app).post(API_CLIENT).set('Authorization', `Bearer ${token}`)
      .send({ name: 'Otro Cliente', cif: 'B11111111' });

    const res = await request(app)
      .get(`${API_CLIENT}?name=Demo`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.clients).toHaveLength(1);
  });

  it('200 — paginación funciona', async () => {
    const token = await setupUser();
    for (let i = 0; i < 5; i++) {
      await request(app).post(API_CLIENT).set('Authorization', `Bearer ${token}`)
        .send({ name: `Cliente ${i}`, cif: `C0000000${i}` });
    }

    const res = await request(app)
      .get(`${API_CLIENT}?page=1&limit=2`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.clients).toHaveLength(2);
    expect(res.body.totalItems).toBe(5);
    expect(res.body.totalPages).toBe(3);
  });
});

describe('GET /api/client/:id — Obtener cliente', () => {
  it('200 — devuelve cliente por ID', async () => {
    const token = await setupUser();
    const { body } = await request(app)
      .post(API_CLIENT).set('Authorization', `Bearer ${token}`).send(clientData);

    const res = await request(app)
      .get(`${API_CLIENT}/${body.client._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.client._id).toBe(body.client._id);
  });

  it('404 — ID inexistente', async () => {
    const token = await setupUser();
    const res = await request(app)
      .get(`${API_CLIENT}/64f1234567890123456789ab`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('400 — ID con formato inválido', async () => {
    const token = await setupUser();
    const res = await request(app)
      .get(`${API_CLIENT}/id-invalido`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/client/:id — Actualizar cliente', () => {
  it('200 — actualiza nombre', async () => {
    const token = await setupUser();
    const { body } = await request(app)
      .post(API_CLIENT).set('Authorization', `Bearer ${token}`).send(clientData);

    const res = await request(app)
      .put(`${API_CLIENT}/${body.client._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nuevo Nombre SL' });
    expect(res.status).toBe(200);
    expect(res.body.client.name).toBe('Nuevo Nombre SL');
  });
});

describe('DELETE /api/client/:id — Eliminar/archivar', () => {
  it('200 — soft delete archiva el cliente', async () => {
    const token = await setupUser();
    const { body } = await request(app)
      .post(API_CLIENT).set('Authorization', `Bearer ${token}`).send(clientData);

    const res = await request(app)
      .delete(`${API_CLIENT}/${body.client._id}?soft=true`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/soft/i);
  });

  it('200 — hard delete elimina permanentemente', async () => {
    const token = await setupUser();
    const { body } = await request(app)
      .post(API_CLIENT).set('Authorization', `Bearer ${token}`).send(clientData);

    const delRes = await request(app)
      .delete(`${API_CLIENT}/${body.client._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);

    // Ya no debe existir
    const getRes = await request(app)
      .get(`${API_CLIENT}/${body.client._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });
});

describe('GET /api/client/archived + PATCH /api/client/:id/restore', () => {
  it('200 — lista archivados y restaura correctamente', async () => {
    const token = await setupUser();
    const { body } = await request(app)
      .post(API_CLIENT).set('Authorization', `Bearer ${token}`).send(clientData);

    // Archivar
    await request(app)
      .delete(`${API_CLIENT}/${body.client._id}?soft=true`)
      .set('Authorization', `Bearer ${token}`);

    // Listar archivados
    const archRes = await request(app)
      .get(`${API_CLIENT}/archived`)
      .set('Authorization', `Bearer ${token}`);
    expect(archRes.status).toBe(200);
    expect(archRes.body.clients).toHaveLength(1);

    // Restaurar
    const restoreRes = await request(app)
      .patch(`${API_CLIENT}/${body.client._id}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(restoreRes.status).toBe(200);

    // Ya no debe estar en archivados
    const archRes2 = await request(app)
      .get(`${API_CLIENT}/archived`)
      .set('Authorization', `Bearer ${token}`);
    expect(archRes2.body.clients).toHaveLength(0);
  });
});

// ── Guardia sin empresa ────────────────────────────────────────────────────────
// Cubre las ramas `if (!req.user.company)` en client.controller.js

describe('Guardia sin empresa — usuario sin company', () => {
  // Helper: usuario verificado pero SIN empresa
  const setupVerifiedNoCompany = async () => {
    const { body: reg } = await request(app)
      .post(`${API_USER}/register`)
      .send({ email: 'nocompany@bildytest.com', password: 'SecurePass123!' });

    const mongoose = (await import('mongoose')).default;
    const col = mongoose.connection.db.collection('users');
    const doc = await col.findOne({ email: 'nocompany@bildytest.com' }, { projection: { verificationCode: 1 } });
    await request(app)
      .put(`${API_USER}/validation`)
      .set('Authorization', `Bearer ${reg.accessToken}`)
      .send({ code: doc.verificationCode });

    const { body: logged } = await request(app)
      .post(`${API_USER}/login`)
      .send({ email: 'nocompany@bildytest.com', password: 'SecurePass123!' });

    return logged.accessToken;
  };

  it('400 — crear cliente sin empresa', async () => {
    const token = await setupVerifiedNoCompany();
    const res = await request(app)
      .post(API_CLIENT)
      .set('Authorization', `Bearer ${token}`)
      .send(clientData);
    expect(res.status).toBe(400);
  });

  it('400 — listar clientes sin empresa', async () => {
    const token = await setupVerifiedNoCompany();
    const res = await request(app)
      .get(API_CLIENT)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400 — listar archivados sin empresa', async () => {
    const token = await setupVerifiedNoCompany();
    const res = await request(app)
      .get(`${API_CLIENT}/archived`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

// ── Update cliente — CIF duplicado ────────────────────────────────────────────

describe('PUT /api/client/:id — CIF duplicado al actualizar', () => {
  it('409 — CIF ya usado por otro cliente', async () => {
    const token = await setupUser();
    await request(app).post(API_CLIENT).set('Authorization', `Bearer ${token}`).send(clientData);
    const { body: c2 } = await request(app).post(API_CLIENT).set('Authorization', `Bearer ${token}`)
      .send({ name: 'Segundo Cliente', cif: 'B11111111' });

    const res = await request(app)
      .put(`${API_CLIENT}/${c2.client._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cif: clientData.cif });
    expect(res.status).toBe(409);
  });
});
