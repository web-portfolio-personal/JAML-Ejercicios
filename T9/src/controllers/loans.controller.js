import prisma from '../config/prisma.js';
import { handleHttpError } from '../utils/handleError.js';

export const getMyLoans = async (req, res) => {
  try {
    const data = await prisma.loan.findMany({
      where: { userId: req.user.id },
      include: {
        book: { select: { id: true, title: true, author: true, isbn: true } }
      },
      orderBy: { loanDate: 'desc' }
    });

    res.json({ data });
  } catch (err) {
    handleHttpError(res, 'ERROR_GET_LOANS');
  }
};

export const getAllLoans = async (req, res) => {
  try {
    const data = await prisma.loan.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        book: { select: { id: true, title: true, author: true, isbn: true } }
      },
      orderBy: { loanDate: 'desc' }
    });

    res.json({ data });
  } catch (err) {
    handleHttpError(res, 'ERROR_GET_ALL_LOANS');
  }
};

export const createLoan = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookId } = req.body;

    // Check book exists and has copies available
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) {
      return handleHttpError(res, 'BOOK_NOT_FOUND', 404);
    }
    if (book.available <= 0) {
      return handleHttpError(res, 'NO_COPIES_AVAILABLE', 400);
    }

    // Max 3 active loans per user
    const activeLoans = await prisma.loan.count({
      where: { userId, status: 'ACTIVE' }
    });
    if (activeLoans >= 3) {
      return handleHttpError(res, 'MAX_ACTIVE_LOANS_REACHED', 400);
    }

    // Cannot borrow same book twice simultaneously
    const duplicate = await prisma.loan.findFirst({
      where: { userId, bookId, status: 'ACTIVE' }
    });
    if (duplicate) {
      return handleHttpError(res, 'BOOK_ALREADY_ON_LOAN', 400);
    }

    const loanDate = new Date();
    const dueDate = new Date(loanDate);
    dueDate.setDate(dueDate.getDate() + 14);

    const [data] = await prisma.$transaction([
      prisma.loan.create({
        data: { userId, bookId, loanDate, dueDate, status: 'ACTIVE' },
        include: {
          book: { select: { id: true, title: true, author: true, isbn: true } }
        }
      }),
      prisma.book.update({
        where: { id: bookId },
        data: { available: { decrement: 1 } }
      })
    ]);

    res.status(201).json({ data });
  } catch (err) {
    handleHttpError(res, 'ERROR_CREATE_LOAN');
  }
};

export const returnLoan = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user.id;

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { book: true }
    });

    if (!loan) {
      return handleHttpError(res, 'LOAN_NOT_FOUND', 404);
    }

    // Only the owner can return (or Librarian/Admin)
    const isPrivileged = ['LIBRARIAN', 'ADMIN'].includes(req.user.role);
    if (loan.userId !== userId && !isPrivileged) {
      return handleHttpError(res, 'NOT_ALLOWED', 403);
    }

    if (loan.status === 'RETURNED') {
      return handleHttpError(res, 'LOAN_ALREADY_RETURNED', 400);
    }

    const returnDate = new Date();
    const [data] = await prisma.$transaction([
      prisma.loan.update({
        where: { id },
        data: { returnDate, status: 'RETURNED' },
        include: {
          book: { select: { id: true, title: true, author: true, isbn: true } }
        }
      }),
      prisma.book.update({
        where: { id: loan.bookId },
        data: { available: { increment: 1 } }
      })
    ]);

    res.json({ data });
  } catch (err) {
    handleHttpError(res, 'ERROR_RETURN_LOAN');
  }
};
