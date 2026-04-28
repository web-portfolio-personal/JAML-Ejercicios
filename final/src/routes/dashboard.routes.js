import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import { getDashboard } from '../controllers/dashboard.controller.js';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     tags: [Dashboard]
 *     summary: Estadísticas globales de la compañía
 *     description: |
 *       Devuelve estadísticas agregadas usando aggregation pipeline de Mongoose:
 *       - Total de albaranes por mes (últimos 12 meses)
 *       - Horas totales por proyecto (top 10)
 *       - Materiales por cliente (top 10)
 *       - Resumen global (totales, firmados, proyectos, clientes)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard con estadísticas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalNotes:    { type: integer }
 *                     signedNotes:   { type: integer }
 *                     unsignedNotes: { type: integer }
 *                     hourNotes:     { type: integer }
 *                     materialNotes: { type: integer }
 *                     totalProjects: { type: integer }
 *                     totalClients:  { type: integer }
 *                 notesByMonth:
 *                   type: array
 *                 hoursByProject:
 *                   type: array
 *                 materialsByClient:
 *                   type: array
 *       401:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/', getDashboard);

export default router;
