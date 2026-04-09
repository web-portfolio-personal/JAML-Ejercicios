import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { encrypt } from '../src/utils/handlePassword.js';
import { tokenSign } from '../src/utils/handleJwt.js';

const BASE = '/api/books';

let userToken;
let librarianToken;
let adminToken;
let createdBookId;

const testIsbn = `TEST-${Date.now()}`;

beforeAll(async () => {
  const hash = await encrypt('password123');

  const user = await prisma.user.create({
    data: { name: 'Books User', email: `booksuser_${Date.now()}@test.com`, password: hash, role: 'USER' }
  });
  const librarian = await prisma.user.create({
    data: { name: 'Books Lib', email: `bookslib_${Date.now()}@test.com`, password: hash, role: 'LIBRARIAN' }
  });
  const admin = await prisma.user.create({
    data: { name: 'Books Admin', email: `booksadmin_${Date.now()}@test.com`, password: hash, role: 'ADMIN' }
  });

  userToken = tokenSign(user);
  librarianToken = tokenSign(librarian);
  adminToken = tokenSign(admin);
});

afterAll(async () => {
  if (createdBookId) {
    await prisma.loan.deleteMany({ where: { bookId: createdBookId } });
    await prisma.review.deleteMany({ where: { bookId: createdBookId } });
    await prisma.book.deleteMany({ where: { id: createdBookId } });
  }
  await prisma.user.deleteMany({ where: { email: { contains: 'books' } } });
  await prisma.$disconnect();
});

describe('GET /api/books', () => {
  it('200 — lista libros (público)', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('200 — acepta parámetros de paginación', async () => {
    const res = await request(app).get(`${BASE}?page=1&limit=5`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(5);
  });

  it('200 — filtra por disponibilidad', async () => {
    const res = await request(app).get(`${BASE}?available=true`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/books', () => {
  it('401 — sin token', async () => {
    const res = await request(app).post(BASE).send({
      isbn: testIsbn, title: 'Test Book', author: 'Author', genre: 'Fiction', publishedYear: 2020, copies: 3
    });
    expect(res.status).toBe(401);
  });

  it('403 — usuario normal no puede crear libros', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isbn: testIsbn, title: 'Test Book', author: 'Author', genre: 'Fiction', publishedYear: 2020, copies: 3 });
    expect(res.status).toBe(403);
  });

  it('201 — librarian crea libro', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ isbn: testIsbn, title: 'Test Book', author: 'Author Test', genre: 'Fiction', publishedYear: 2020, copies: 3 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ isbn: testIsbn, copies: 3, available: 3 });
    createdBookId = res.body.data.id;
  });

  it('409 — ISBN duplicado', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ isbn: testIsbn, title: 'Dup', author: 'Dup', genre: 'Fiction', publishedYear: 2020, copies: 1 });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/books/:id', () => {
  it('200 — obtiene libro por ID', async () => {
    const res = await request(app).get(`${BASE}/${createdBookId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdBookId);
  });

  it('404 — libro no encontrado', async () => {
    const res = await request(app).get(`${BASE}/999999`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/books/:id', () => {
  it('200 — librarian actualiza libro', async () => {
    const res = await request(app)
      .put(`${BASE}/${createdBookId}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ title: 'Updated Title' });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
  });

  it('403 — usuario normal no puede actualizar', async () => {
    const res = await request(app)
      .put(`${BASE}/${createdBookId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Hack' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/books/:id', () => {
  it('403 — librarian no puede eliminar', async () => {
    const res = await request(app)
      .delete(`${BASE}/${createdBookId}`)
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(res.status).toBe(403);
  });

  it('200 — admin elimina libro', async () => {
    const res = await request(app)
      .delete(`${BASE}/${createdBookId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    createdBookId = null;
  });
});
