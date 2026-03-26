import { Router } from 'express';
import authRoutes from './auth.routes.js';
import podcastsRoutes from './podcasts.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/podcasts', podcastsRoutes);

export default router;
