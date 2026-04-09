import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { encrypt } from '../src/utils/handlePassword.js';
import { tokenSign } from '../src/utils/handleJwt.js';

let userToken;
let otherUserToken;
let userId;
let bookId;
let reviewId;

beforeAll(async () => {
  const hash = await encrypt('password123');

  const user = await prisma.user.create({
    data: { name: 'Reviews User', email: `revuser_${Date.now()}@test.com`, password: hash, role: 'USER' }
  });
  const other = await prisma.user.create({
    data: { name: 'Other User', email: `revother_${Date.now()}@test.com`, password: hash, role: 'USER' }
  });

  userId = user.id;
  userToken = tokenSign(user);
  otherUserToken = tokenSign(other);

  const book = await prisma.book.create({
    data: {
      isbn: `REV-ISBN-${Date.now()}`,
      title: 'Review Test Book',
      author: 'Author',
      genre: 'Fiction',
      publishedYear: 2020,
      copies: 2,
      available: 2
    }
  });
  bookId = book.id;

  // Create a returned loan so user can review
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  await prisma.loan.create({
    data: {
      userId,
      bookId,
      loanDate: new Date(),
      dueDate,
      returnDate: new Date(),
      status: 'RETURNED'
    }
  });
});

afterAll(async () => {
  const revUsers = await prisma.user.findMany({ where: { email: { contains: 'rev' } } });
  const revUserIds = revUsers.map(u => u.id);
  // Delete all reviews and loans for these users (catches leftovers from prior runs)
  await prisma.review.deleteMany({ where: { userId: { in: revUserIds } } });
  await prisma.loan.deleteMany({ where: { userId: { in: revUserIds } } });
  await prisma.book.deleteMany({ where: { id: bookId } });
  await prisma.user.deleteMany({ where: { id: { in: revUserIds } } });
  await prisma.$disconnect();
});

describe('GET /api/books/:id/reviews', () => {
  it('200 — lista reseñas (público)', async () => {
    const res = await request(app).get(`/api/books/${bookId}/reviews`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('404 — libro no existe', async () => {
    const res = await request(app).get('/api/books/999999/reviews');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/books/:id/reviews', () => {
  it('401 — sin token', async () => {
    const res = await request(app)
      .post(`/api/books/${bookId}/reviews`)
      .send({ rating: 4 });
    expect(res.status).toBe(401);
  });

  it('403 — usuario sin préstamo devuelto no puede reseñar', async () => {
    const res = await request(app)
      .post(`/api/books/${bookId}/reviews`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ rating: 3 });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('MUST_HAVE_RETURNED_LOAN_TO_REVIEW');
  });

  it('400 — rating inválido (fuera de 1-5)', async () => {
    const res = await request(app)
      .post(`/api/books/${bookId}/reviews`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ rating: 6 });
    expect(res.status).toBe(400);
  });

  it('201 — crea reseña correctamente', async () => {
    const res = await request(app)
      .post(`/api/books/${bookId}/reviews`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ rating: 5, comment: 'Excelente libro' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ rating: 5, comment: 'Excelente libro' });
    reviewId = res.body.data.id;
  });

  it('409 — no puede reseñar el mismo libro dos veces', async () => {
    const res = await request(app)
      .post(`/api/books/${bookId}/reviews`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ rating: 3 });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('REVIEW_ALREADY_EXISTS');
  });
});

describe('DELETE /api/reviews/:id', () => {
  it('403 — otro usuario no puede eliminar la reseña', async () => {
    const res = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${otherUserToken}`);
    expect(res.status).toBe(403);
  });

  it('200 — el dueño elimina su reseña', async () => {
    const res = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
  });

  it('404 — reseña no existe', async () => {
    const res = await request(app)
      .delete('/api/reviews/999999')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(404);
  });
});
