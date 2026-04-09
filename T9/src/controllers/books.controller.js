import prisma from '../config/prisma.js';
import { handleHttpError } from '../utils/handleError.js';

export const getBooks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.genre) where.genre = { contains: req.query.genre, mode: 'insensitive' };
    if (req.query.author) where.author = { contains: req.query.author, mode: 'insensitive' };
    if (req.query.available === 'true') where.available = { gt: 0 };
    if (req.query.title) where.title = { contains: req.query.title, mode: 'insensitive' };

    const [total, data] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({ where, skip, take: limit, orderBy: { title: 'asc' } })
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
    handleHttpError(res, 'ERROR_GET_BOOKS');
  }
};

export const getBook = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await prisma.book.findUnique({ where: { id } });

    if (!data) {
      return handleHttpError(res, 'BOOK_NOT_FOUND', 404);
    }

    res.json({ data });
  } catch (err) {
    handleHttpError(res, 'ERROR_GET_BOOK');
  }
};

export const createBook = async (req, res) => {
  try {
    const { isbn, title, author, genre, description, publishedYear, copies } = req.body;

    const data = await prisma.book.create({
      data: { isbn, title, author, genre, description, publishedYear, copies, available: copies }
    });

    res.status(201).json({ data });
  } catch (err) {
    if (err.code === 'P2002') {
      return handleHttpError(res, 'ISBN_ALREADY_EXISTS', 409);
    }
    handleHttpError(res, 'ERROR_CREATE_BOOK');
  }
};

export const updateBook = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) {
      return handleHttpError(res, 'BOOK_NOT_FOUND', 404);
    }

    const data = await prisma.book.update({ where: { id }, data: req.body });

    res.json({ data });
  } catch (err) {
    if (err.code === 'P2002') {
      return handleHttpError(res, 'ISBN_ALREADY_EXISTS', 409);
    }
    handleHttpError(res, 'ERROR_UPDATE_BOOK');
  }
};

export const deleteBook = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) {
      return handleHttpError(res, 'BOOK_NOT_FOUND', 404);
    }

    await prisma.book.delete({ where: { id } });

    res.json({ message: 'Libro eliminado' });
  } catch (err) {
    handleHttpError(res, 'ERROR_DELETE_BOOK');
  }
};
