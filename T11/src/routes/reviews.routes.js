import { Router } from 'express';
import {
  getBookReviews,
  createReview,
  deleteReview
} from '../controllers/reviews.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createReviewSchema, reviewIdSchema } from '../validators/reviews.validator.js';

const router = Router();

/**
 * @openapi
 * /api/books/{id}/reviews:
 *   get:
 *     tags: [Reviews]
 *     summary: Reseñas de un libro
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de reseñas
 *       404:
 *         $ref: '#/components/responses/Error'
 */
router.get('/:id/reviews', getBookReviews);

/**
 * @openapi
 * /api/books/{id}/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: Crear reseña (solo si has devuelto el libro)
 *     security:
 *       - BearerToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 4
 *               comment:
 *                 type: string
 *                 example: Muy buen libro
 *     responses:
 *       201:
 *         description: Reseña creada
 *       400:
 *         $ref: '#/components/responses/Error'
 *       401:
 *         $ref: '#/components/responses/Error'
 *       403:
 *         $ref: '#/components/responses/Error'
 *       409:
 *         $ref: '#/components/responses/Error'
 */
router.post('/:id/reviews', authMiddleware, validate(createReviewSchema), createReview);

export default router;
