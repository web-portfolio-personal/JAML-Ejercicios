import { Router } from 'express';
import { getStats } from '../controllers/stats.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import checkRol from '../middleware/rol.middleware.js';

const router = Router();

/**
 * @openapi
 * /api/stats:
 *   get:
 *     tags: [Stats]
 *     summary: Estadísticas de la biblioteca (Librarian/Admin)
 *     security:
 *       - BearerToken: []
 *     description: Devuelve los libros más prestados, mejor valorados y contadores generales
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 5 }
 *         description: Número de resultados en cada ranking
 *     responses:
 *       200:
 *         description: Estadísticas de la biblioteca
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     general:
 *                       type: object
 *                       properties:
 *                         totalBooks: { type: integer }
 *                         totalUsers: { type: integer }
 *                         totalLoans: { type: integer }
 *                         activeLoans: { type: integer }
 *                         overdueLoans: { type: integer }
 *                     mostBorrowedBooks:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/Book'
 *                           - type: object
 *                             properties:
 *                               totalLoans: { type: integer }
 *                     bestRatedBooks:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/Book'
 *                           - type: object
 *                             properties:
 *                               avgRating: { type: number }
 *                               totalReviews: { type: integer }
 */
router.get('/', authMiddleware, checkRol(['LIBRARIAN', 'ADMIN']), getStats);

export default router;
