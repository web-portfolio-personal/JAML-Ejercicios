import { Router } from 'express';
import authRoutes from './auth.routes.js';
import tracksRoutes from './tracks.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/tracks', tracksRoutes);

export default router;
