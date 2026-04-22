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

    const mostBorrowedIds = mostBorrowed.map(e => e.bookId);
    const mostBorrowedRaw = await prisma.book.findMany({
      where: { id: { in: mostBorrowedIds } },
      select: { id: true, title: true, author: true, genre: true, isbn: true }
    });
    const mostBorrowedBooks = mostBorrowedIds.map(id => {
      const book = mostBorrowedRaw.find(b => b.id === id);
      const entry = mostBorrowed.find(e => e.bookId === id);
      return { ...book, totalLoans: entry._count.bookId };
    });

    // Best rated books (with at least 1 review)
    const bestRated = await prisma.review.groupBy({
      by: ['bookId'],
      _avg: { rating: true },
      _count: { rating: true },
      orderBy: { _avg: { rating: 'desc' } },
      take: limit
    });

    const bestRatedIds = bestRated.map(e => e.bookId);
    const bestRatedRaw = await prisma.book.findMany({
      where: { id: { in: bestRatedIds } },
      select: { id: true, title: true, author: true, genre: true, isbn: true }
    });
    const bestRatedBooks = bestRatedIds.map(id => {
      const book = bestRatedRaw.find(b => b.id === id);
      const entry = bestRated.find(e => e.bookId === id);
      return {
        ...book,
        avgRating: Math.round(entry._avg.rating * 100) / 100,
        totalReviews: entry._count.rating
      };
    });

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
