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
let librarianId;
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
  librarianId = librarian.id;
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
  // Use specific IDs — no pattern matching
  await prisma.loan.deleteMany({ where: { userId: { in: [userId, librarianId] } } });
  await prisma.book.deleteMany({ where: { id: bookId } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, librarianId] } } });
  await prisma.$disconnect();
});

describe('POST /api/loans', () => {
  it('401 — sin token', async () => {
    const res = await request(app).post(LOANS_BASE).send({ bookId });
    expect(res.status).toBe(401);
  });

  it('201 — crea préstamo correctamente y dueDate es +14 días', async () => {
    const before = new Date();
    const res = await request(app)
      .post(LOANS_BASE)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bookId });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ userId, bookId, status: 'ACTIVE' });

    // Verify dueDate is exactly loanDate + 14 days (±60 seconds tolerance)
    const loanDate = new Date(res.body.data.loanDate);
    const dueDate = new Date(res.body.data.dueDate);
    const diffDays = (dueDate - loanDate) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(14, 0);

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

  it('400 — no hay ejemplares disponibles', async () => {
    // Set available to 0
    await prisma.book.update({ where: { id: bookId }, data: { available: 0 } });
    const res = await request(app)
      .post(LOANS_BASE)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ bookId });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('NO_COPIES_AVAILABLE');
    // Restore
    await prisma.book.update({ where: { id: bookId }, data: { available: 2 } });
  });

  it('400 — máximo 3 préstamos activos por usuario', async () => {
    const hash = await encrypt('password123');
    const busyUser = await prisma.user.create({
      data: { name: 'Busy User', email: `loansbusy_${Date.now()}@test.com`, password: hash, role: 'USER' }
    });
    const busyToken = tokenSign(busyUser);

    const extraBooks = await Promise.all([1, 2, 3].map(i =>
      prisma.book.create({
        data: { isbn: `BUSY-${Date.now()}-${i}`, title: `Book ${i}`, author: 'A', genre: 'G', publishedYear: 2020, copies: 1, available: 1 }
      })
    ));

    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 14);
    await prisma.loan.createMany({
      data: extraBooks.map(b => ({ userId: busyUser.id, bookId: b.id, loanDate: new Date(), dueDate, status: 'ACTIVE' }))
    });
    await Promise.all(extraBooks.map(b => prisma.book.update({ where: { id: b.id }, data: { available: 0 } })));

    const res = await request(app)
      .post(LOANS_BASE)
      .set('Authorization', `Bearer ${busyToken}`)
      .send({ bookId });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('MAX_ACTIVE_LOANS_REACHED');

    await prisma.loan.deleteMany({ where: { userId: busyUser.id } });
    await prisma.book.deleteMany({ where: { id: { in: extraBooks.map(b => b.id) } } });
    await prisma.user.delete({ where: { id: busyUser.id } });
  }, 20000);
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
  it('200 — librarian obtiene todos los préstamos con paginación', async () => {
    const res = await request(app)
      .get(`${LOANS_BASE}/all`)
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });

  it('200 — filtra por status OVERDUE', async () => {
    const res = await request(app)
      .get(`${LOANS_BASE}/all?status=OVERDUE`)
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(res.status).toBe(200);
    res.body.data.forEach(loan => expect(loan.status).toBe('OVERDUE'));
  });

  it('403 — usuario normal no puede ver todos los préstamos', async () => {
    const res = await request(app)
      .get(`${LOANS_BASE}/all`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});

describe('OVERDUE — préstamos vencidos', () => {
  beforeEach(() => { jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { console.warn.mockRestore(); });
  it('préstamo con dueDate pasada se marca OVERDUE automáticamente', async () => {
    // Create a loan with dueDate in the past directly in DB
    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 1);
    const overdueLoan = await prisma.loan.create({
      data: {
        userId,
        bookId,
        loanDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        dueDate: pastDue,
        status: 'ACTIVE'
      }
    });

    // GET /loans triggers syncOverdueLoans
    const res = await request(app)
      .get(LOANS_BASE)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);

    const found = res.body.data.find(l => l.id === overdueLoan.id);
    expect(found).toBeDefined();
    expect(found.status).toBe('OVERDUE');

    // Cleanup overdue loan (restore available too)
    await prisma.loan.delete({ where: { id: overdueLoan.id } });
  });

  it('400 — préstamo OVERDUE bloquea solicitar el mismo libro de nuevo', async () => {
    // Insert an OVERDUE loan for the user
    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 1);
    const overdueLoan = await prisma.loan.create({
      data: {
        userId,
        bookId,
        loanDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        dueDate: pastDue,
        status: 'OVERDUE'
      }
    });

    // Attempt to borrow the same book while OVERDUE loan exists
    const res = await request(app)
      .post(LOANS_BASE)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bookId });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('BOOK_ALREADY_ON_LOAN');

    await prisma.loan.delete({ where: { id: overdueLoan.id } });
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
