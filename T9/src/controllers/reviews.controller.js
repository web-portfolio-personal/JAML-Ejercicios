import prisma from '../config/prisma.js';
import { handleHttpError } from '../utils/handleError.js';

export const getBookReviews = async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) {
      return handleHttpError(res, 'BOOK_NOT_FOUND', 404);
    }

    const [total, data] = await Promise.all([
      prisma.review.count({ where: { bookId } }),
      prisma.review.findMany({
        where: { bookId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    res.json({
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    handleHttpError(res, 'ERROR_GET_REVIEWS');
  }
};

export const createReview = async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    const userId = req.user.id;
    const { rating, comment } = req.body;

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) {
      return handleHttpError(res, 'BOOK_NOT_FOUND', 404);
    }

    // Only users with a returned loan on this book can review
    const returnedLoan = await prisma.loan.findFirst({
      where: { userId, bookId, status: 'RETURNED' }
    });
    if (!returnedLoan) {
      return handleHttpError(res, 'MUST_HAVE_RETURNED_LOAN_TO_REVIEW', 403);
    }

    // Only 1 review per user per book
    const existing = await prisma.review.findUnique({
      where: { userId_bookId: { userId, bookId } }
    });
    if (existing) {
      return handleHttpError(res, 'REVIEW_ALREADY_EXISTS', 409);
    }

    const data = await prisma.review.create({
      data: { userId, bookId, rating, comment },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    res.status(201).json({ data });
  } catch (err) {
    handleHttpError(res, 'ERROR_CREATE_REVIEW');
  }
};

export const deleteReview = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user.id;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return handleHttpError(res, 'REVIEW_NOT_FOUND', 404);
    }

    // Only the owner or admin can delete
    const isAdmin = req.user.role === 'ADMIN';
    if (review.userId !== userId && !isAdmin) {
      return handleHttpError(res, 'NOT_ALLOWED', 403);
    }

    await prisma.review.delete({ where: { id } });

    res.json({ message: 'Reseña eliminada' });
  } catch (err) {
    handleHttpError(res, 'ERROR_DELETE_REVIEW');
  }
};
