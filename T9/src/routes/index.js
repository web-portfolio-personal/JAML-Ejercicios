import { Router } from 'express';
import authRoutes from './auth.routes.js';
import booksRoutes from './books.routes.js';
import loansRoutes from './loans.routes.js';
import reviewsRoutes from './reviews.routes.js';
import reviewsDeleteRoutes from './reviewsDelete.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/books', booksRoutes);
router.use('/books', reviewsRoutes);
router.use('/loans', loansRoutes);
router.use('/reviews', reviewsDeleteRoutes);

export default router;
