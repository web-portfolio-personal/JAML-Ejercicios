import { Router } from 'express';
import userRoutes         from './user.routes';
import clientRoutes       from './client.routes';
import projectRoutes      from './project.routes';
import deliveryNoteRoutes from './deliverynote.routes';
import dashboardRoutes    from './dashboard.routes';

const router = Router();

router.use('/user',         userRoutes);
router.use('/client',       clientRoutes);
router.use('/project',      projectRoutes);
router.use('/deliverynote', deliveryNoteRoutes);
router.use('/dashboard',    dashboardRoutes);

export default router;
