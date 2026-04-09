import { Router } from 'express';
import {
  getMyLoans,
  getAllLoans,
  createLoan,
  returnLoan
} from '../controllers/loans.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import checkRol from '../middleware/rol.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createLoanSchema, loanIdSchema } from '../validators/loans.validator.js';

const router = Router();

/**
 * @openapi
 * /api/loans:
 *   get:
 *     tags: [Loans]
 *     summary: Mis préstamos
 *     security:
 *       - BearerToken: []
 *     responses:
 *       200:
 *         description: Lista de préstamos del usuario autenticado
 *       401:
 *         $ref: '#/components/responses/Error'
 */
router.get('/', authMiddleware, getMyLoans);

/**
 * @openapi
 * /api/loans/all:
 *   get:
 *     tags: [Loans]
 *     summary: Todos los préstamos (Librarian/Admin)
 *     security:
 *       - BearerToken: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, RETURNED, OVERDUE]
 *         description: Filtrar por estado del préstamo
 *       - in: query
 *         name: userId
 *         schema: { type: integer }
 *         description: Filtrar por ID de usuario
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Resultados por página
 *     responses:
 *       200:
 *         description: Lista completa de préstamos con paginación
 *       401:
 *         $ref: '#/components/responses/Error'
 *       403:
 *         $ref: '#/components/responses/Error'
 */
router.get('/all', authMiddleware, checkRol(['LIBRARIAN', 'ADMIN']), getAllLoans);

/**
 * @openapi
 * /api/loans:
 *   post:
 *     tags: [Loans]
 *     summary: Solicitar préstamo
 *     security:
 *       - BearerToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookId]
 *             properties:
 *               bookId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Préstamo creado
 *       400:
 *         $ref: '#/components/responses/Error'
 *       401:
 *         $ref: '#/components/responses/Error'
 *       404:
 *         $ref: '#/components/responses/Error'
 */
router.post('/', authMiddleware, validate(createLoanSchema), createLoan);

/**
 * @openapi
 * /api/loans/{id}/return:
 *   put:
 *     tags: [Loans]
 *     summary: Devolver libro
 *     security:
 *       - BearerToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Libro devuelto, available++
 *       400:
 *         $ref: '#/components/responses/Error'
 *       401:
 *         $ref: '#/components/responses/Error'
 *       403:
 *         $ref: '#/components/responses/Error'
 *       404:
 *         $ref: '#/components/responses/Error'
 */
router.put('/:id/return', authMiddleware, validate(loanIdSchema), returnLoan);

export default router;
