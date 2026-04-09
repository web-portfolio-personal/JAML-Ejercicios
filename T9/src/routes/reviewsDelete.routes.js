import { Router } from 'express';
import { deleteReview } from '../controllers/reviews.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { reviewIdSchema } from '../validators/reviews.validator.js';

const router = Router();

/**
 * @openapi
 * /api/reviews/{id}:
 *   delete:
 *     tags: [Reviews]
 *     summary: Eliminar reseña propia (o Admin)
 *     security:
 *       - BearerToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Reseña eliminada
 *       401:
 *         $ref: '#/components/responses/Error'
 *       403:
 *         $ref: '#/components/responses/Error'
 *       404:
 *         $ref: '#/components/responses/Error'
 */
router.delete('/:id', authMiddleware, validate(reviewIdSchema), deleteReview);

export default router;
