import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/stats', () => {
  it('200 — devuelve estadísticas generales', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('general');
    expect(res.body.data.general).toHaveProperty('totalBooks');
    expect(res.body.data.general).toHaveProperty('totalUsers');
    expect(res.body.data.general).toHaveProperty('totalLoans');
    expect(res.body.data.general).toHaveProperty('activeLoans');
    expect(res.body.data.general).toHaveProperty('overdueLoans');
  });

  it('200 — devuelve libros más prestados', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.mostBorrowedBooks)).toBe(true);
  });

  it('200 — devuelve libros mejor valorados', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.bestRatedBooks)).toBe(true);
  });

  it('200 — acepta parámetro limit', async () => {
    const res = await request(app).get('/api/stats?limit=3');
    expect(res.status).toBe(200);
    expect(res.body.data.mostBorrowedBooks.length).toBeLessThanOrEqual(3);
    expect(res.body.data.bestRatedBooks.length).toBeLessThanOrEqual(3);
  });
});
