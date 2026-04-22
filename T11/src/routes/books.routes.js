import { Router } from 'express';
import {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook
} from '../controllers/books.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import checkRol from '../middleware/rol.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createBookSchema, updateBookSchema, bookIdSchema } from '../validators/books.validator.js';

const router = Router();

/**
 * @openapi
 * /api/books:
 *   get:
 *     tags: [Books]
 *     summary: Listar libros con filtros opcionales
 *     parameters:
 *       - in: query
 *         name: genre
 *         schema: { type: string }
 *       - in: query
 *         name: author
 *         schema: { type: string }
 *       - in: query
 *         name: title
 *         schema: { type: string }
 *       - in: query
 *         name: available
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Lista de libros con paginación
 */
router.get('/', getBooks);

/**
 * @openapi
 * /api/books/{id}:
 *   get:
 *     tags: [Books]
 *     summary: Obtener libro por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Libro encontrado
 *       404:
 *         $ref: '#/components/responses/Error'
 */
router.get('/:id', validate(bookIdSchema), getBook);

/**
 * @openapi
 * /api/books:
 *   post:
 *     tags: [Books]
 *     summary: Crear libro (Librarian/Admin)
 *     security:
 *       - BearerToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookInput'
 *     responses:
 *       201:
 *         description: Libro creado
 *       401:
 *         $ref: '#/components/responses/Error'
 *       403:
 *         $ref: '#/components/responses/Error'
 */
router.post('/', authMiddleware, checkRol(['LIBRARIAN', 'ADMIN']), validate(createBookSchema), createBook);

/**
 * @openapi
 * /api/books/{id}:
 *   put:
 *     tags: [Books]
 *     summary: Actualizar libro (Librarian/Admin)
 *     security:
 *       - BearerToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Libro actualizado
 *       401:
 *         $ref: '#/components/responses/Error'
 *       403:
 *         $ref: '#/components/responses/Error'
 *       404:
 *         $ref: '#/components/responses/Error'
 */
router.put('/:id', authMiddleware, checkRol(['LIBRARIAN', 'ADMIN']), validate(updateBookSchema), updateBook);

/**
 * @openapi
 * /api/books/{id}:
 *   delete:
 *     tags: [Books]
 *     summary: Eliminar libro (Admin)
 *     security:
 *       - BearerToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Libro eliminado
 *       401:
 *         $ref: '#/components/responses/Error'
 *       403:
 *         $ref: '#/components/responses/Error'
 *       404:
 *         $ref: '#/components/responses/Error'
 */
router.delete('/:id', authMiddleware, checkRol(['ADMIN']), validate(bookIdSchema), deleteBook);

export default router;
