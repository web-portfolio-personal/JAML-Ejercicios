import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';
import { connectTestDb, clearDb, disconnectTestDb } from './helpers/db.helper';
import prisma from '../src/lib/prisma';

beforeAll(async () => { await connectTestDb(); });
beforeEach(async () => { await clearDb(); });
afterAll(async () => { await disconnectTestDb(); });

const API_USER      = '/api/user';
const API_DASHBOARD = '/api/dashboard';

const fullSetup = async (): Promise<string> => {
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

  return final.accessToken;
};

describe('GET /api/dashboard — Dashboard con aggregation', () => {
  it('401 — sin token', async () => {
    const res = await request(app).get(API_DASHBOARD);
    expect(res.status).toBe(401);
  });

  it('200 — devuelve estructura completa del dashboard', async () => {
    const token = await fullSetup();
    const res = await request(app)
      .get(API_DASHBOARD)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.notesByMonth).toBeDefined();
    expect(res.body.hoursByProject).toBeDefined();
    expect(res.body.materialsByClient).toBeDefined();
  });

  it('200 — summary tiene todos los campos requeridos', async () => {
    const token = await fullSetup();
    const res = await request(app)
      .get(API_DASHBOARD)
      .set('Authorization', `Bearer ${token}`);

    const { summary } = res.body;
    expect(typeof summary.totalNotes).toBe('number');
    expect(typeof summary.signedNotes).toBe('number');
    expect(typeof summary.unsignedNotes).toBe('number');
    expect(typeof summary.totalProjects).toBe('number');
    expect(typeof summary.totalClients).toBe('number');
  });

  it('200 — con datos reales, notesByMonth incluye los albaranes creados', async () => {
    const token = await fullSetup();

    const { body: cl } = await request(app).post('/api/client')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cliente Test', cif: 'A87654321' });

    const { body: pr } = await request(app).post('/api/project')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: cl.client.id, name: 'Proyecto Test', projectCode: 'PRJ-001' });

    await request(app).post('/api/deliverynote')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client:  cl.client.id,
        project: pr.project.id,
        format:  'hours',
        hours:   8,
        workDate: new Date().toISOString().split('T')[0],
      });

    const res = await request(app)
      .get(API_DASHBOARD)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.totalNotes).toBe(1);
    expect(res.body.summary.hourNotes).toBe(1);
    expect(res.body.hoursByProject.length).toBeGreaterThan(0);
    expect(res.body.hoursByProject[0].totalHours).toBe(8);
  });
});
