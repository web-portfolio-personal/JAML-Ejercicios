import prisma from '../config/prisma.js';
import { handleHttpError } from '../utils/handleError.js';

export const getStats = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    // Most borrowed books
    const mostBorrowed = await prisma.loan.groupBy({
      by: ['bookId'],
      _count: { bookId: true },
      orderBy: { _count: { bookId: 'desc' } },
      take: limit
    });

    const mostBorrowedBooks = await Promise.all(
      mostBorrowed.map(async (entry) => {
        const book = await prisma.book.findUnique({
          where: { id: entry.bookId },
          select: { id: true, title: true, author: true, genre: true, isbn: true }
        });
        return { ...book, totalLoans: entry._count.bookId };
      })
    );

    // Best rated books (with at least 1 review)
    const bestRated = await prisma.review.groupBy({
      by: ['bookId'],
      _avg: { rating: true },
      _count: { rating: true },
      orderBy: { _avg: { rating: 'desc' } },
      take: limit
    });

    const bestRatedBooks = await Promise.all(
      bestRated.map(async (entry) => {
        const book = await prisma.book.findUnique({
          where: { id: entry.bookId },
          select: { id: true, title: true, author: true, genre: true, isbn: true }
        });
        return {
          ...book,
          avgRating: Math.round(entry._avg.rating * 100) / 100,
          totalReviews: entry._count.rating
        };
      })
    );

    // General stats
    const [totalBooks, totalUsers, totalLoans, activeLoans, overdueLoans] = await Promise.all([
      prisma.book.count(),
      prisma.user.count(),
      prisma.loan.count(),
      prisma.loan.count({ where: { status: 'ACTIVE' } }),
      prisma.loan.count({ where: { status: 'OVERDUE' } })
    ]);

    res.json({
      data: {
        general: {
          totalBooks,
          totalUsers,
          totalLoans,
          activeLoans,
          overdueLoans
        },
        mostBorrowedBooks,
        bestRatedBooks
      }
    });
  } catch (err) {
    handleHttpError(res, 'ERROR_GET_STATS');
  }
};
