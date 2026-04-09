import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { encrypt } from '../src/utils/handlePassword.js';
import { tokenSign } from '../src/utils/handleJwt.js';

let librarianToken;
let librarianId;
let userToken;

beforeAll(async () => {
  const hash = await encrypt('password123');

  const librarian = await prisma.user.create({
    data: { name: 'Stats Lib', email: `statslib_${Date.now()}@test.com`, password: hash, role: 'LIBRARIAN' }
  });
  librarianId = librarian.id;
  librarianToken = tokenSign(librarian);

  const user = await prisma.user.create({
    data: { name: 'Stats User', email: `statsuser_${Date.now()}@test.com`, password: hash, role: 'USER' }
  });
  userToken = tokenSign(user);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: librarianId } });
  await prisma.$disconnect();
});

describe('GET /api/stats', () => {
  it('401 — sin token', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(401);
  });

  it('403 — usuario normal no puede ver stats', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('200 — devuelve estadísticas generales', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('general');
    expect(res.body.data.general).toHaveProperty('totalBooks');
    expect(res.body.data.general).toHaveProperty('totalUsers');
    expect(res.body.data.general).toHaveProperty('totalLoans');
    expect(res.body.data.general).toHaveProperty('activeLoans');
    expect(res.body.data.general).toHaveProperty('overdueLoans');
  });

  it('200 — devuelve libros más prestados', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.mostBorrowedBooks)).toBe(true);
  });

  it('200 — devuelve libros mejor valorados', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.bestRatedBooks)).toBe(true);
  });

  it('200 — acepta parámetro limit', async () => {
    const res = await request(app)
      .get('/api/stats?limit=3')
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.mostBorrowedBooks.length).toBeLessThanOrEqual(3);
    expect(res.body.data.bestRatedBooks.length).toBeLessThanOrEqual(3);
  });
});
