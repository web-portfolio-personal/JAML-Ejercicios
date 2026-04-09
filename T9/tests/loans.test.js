import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { encrypt } from '../src/utils/handlePassword.js';
import { tokenSign } from '../src/utils/handleJwt.js';

const LOANS_BASE = '/api/loans';
const BOOKS_BASE = '/api/books';

let userToken;
let librarianToken;
let userId;
let bookId;
let loanId;

beforeAll(async () => {
  const hash = await encrypt('password123');

  const user = await prisma.user.create({
    data: { name: 'Loans User', email: `loansuser_${Date.now()}@test.com`, password: hash, role: 'USER' }
  });
  const librarian = await prisma.user.create({
    data: { name: 'Loans Lib', email: `loanslib_${Date.now()}@test.com`, password: hash, role: 'LIBRARIAN' }
  });

  userId = user.id;
  userToken = tokenSign(user);
  librarianToken = tokenSign(librarian);

  const book = await prisma.book.create({
    data: {
      isbn: `LOAN-ISBN-${Date.now()}`,
      title: 'Loan Test Book',
      author: 'Author',
      genre: 'Fiction',
      publishedYear: 2020,
      copies: 2,
      available: 2
    }
  });
  bookId = book.id;
});

afterAll(async () => {
  await prisma.loan.deleteMany({ where: { bookId } });
  await prisma.book.deleteMany({ where: { id: bookId } });
  await prisma.user.deleteMany({ where: { email: { contains: 'loans' } } });
  await prisma.$disconnect();
});

describe('POST /api/loans', () => {
  it('401 — sin token', async () => {
    const res = await request(app).post(LOANS_BASE).send({ bookId });
    expect(res.status).toBe(401);
  });

  it('201 — crea préstamo correctamente', async () => {
    const res = await request(app)
      .post(LOANS_BASE)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bookId });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ userId, bookId, status: 'ACTIVE' });
    expect(res.body.data).toHaveProperty('dueDate');
    loanId = res.body.data.id;
  });

  it('400 — no puede pedir el mismo libro dos veces', async () => {
    const res = await request(app)
      .post(LOANS_BASE)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bookId });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('BOOK_ALREADY_ON_LOAN');
  });

  it('404 — libro no existe', async () => {
    const res = await request(app)
      .post(LOANS_BASE)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bookId: 999999 });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/loans', () => {
  it('200 — obtiene mis préstamos', async () => {
    const res = await request(app)
      .get(LOANS_BASE)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('401 — sin token', async () => {
    const res = await request(app).get(LOANS_BASE);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/loans/all', () => {
  it('200 — librarian obtiene todos los préstamos', async () => {
    const res = await request(app)
      .get(`${LOANS_BASE}/all`)
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('403 — usuario normal no puede ver todos los préstamos', async () => {
    const res = await request(app)
      .get(`${LOANS_BASE}/all`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/loans/:id/return', () => {
  it('200 — devuelve libro correctamente y sube available', async () => {
    const bookBefore = await prisma.book.findUnique({ where: { id: bookId } });

    const res = await request(app)
      .put(`${LOANS_BASE}/${loanId}/return`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RETURNED');
    expect(res.body.data.returnDate).not.toBeNull();

    const bookAfter = await prisma.book.findUnique({ where: { id: bookId } });
    expect(bookAfter.available).toBe(bookBefore.available + 1);
  });

  it('400 — préstamo ya devuelto', async () => {
    const res = await request(app)
      .put(`${LOANS_BASE}/${loanId}/return`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('LOAN_ALREADY_RETURNED');
  });

  it('404 — préstamo no existe', async () => {
    const res = await request(app)
      .put(`${LOANS_BASE}/999999/return`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(404);
  });
});
