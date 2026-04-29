import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware';
import { getDashboard } from '../controllers/dashboard.controller';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     tags: [Dashboard]
 *     summary: Estadisticas globales de la compania
 *     description: |
 *       Devuelve estadisticas agregadas:
 *       - Total de albaranes por mes (ultimos 12 meses)
 *       - Horas totales por proyecto (top 10)
 *       - Materiales por cliente (top 10)
 *       - Resumen global (totales, firmados, proyectos, clientes)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard con estadisticas
 *       401:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/', getDashboard);

export default router;
