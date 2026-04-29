import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  createClientSchema,
  updateClientSchema,
  idParamSchema,
  listClientSchema,
} from '../validators/client.validator';
import {
  createClient,
  listClients,
  getClient,
  updateClient,
  deleteClient,
  listArchivedClients,
  restoreClient,
} from '../controllers/client.controller';

const router = Router();

// Todas las rutas requieren autenticacion
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Clients
 *   description: Gestion de clientes
 */

/**
 * @swagger
 * /api/client:
 *   post:
 *     tags: [Clients]
 *     summary: Crear un cliente
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClientInput'
 *     responses:
 *       201:
 *         description: Cliente creado
 *       409:
 *         description: CIF duplicado
 */
router.post('/', validate(createClientSchema), createClient);

/**
 * @swagger
 * /api/client:
 *   get:
 *     tags: [Clients]
 *     summary: Listar clientes activos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista paginada de clientes
 */
router.get('/', validate(listClientSchema), listClients);

/**
 * @swagger
 * /api/client/archived:
 *   get:
 *     tags: [Clients]
 *     summary: Listar clientes archivados
 *     security:
 *       - bearerAuth: []
 */
router.get('/archived', listArchivedClients);

/**
 * @swagger
 * /api/client/{id}:
 *   get:
 *     tags: [Clients]
 *     summary: Obtener un cliente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.get('/:id',          validate(idParamSchema), getClient);

/**
 * @swagger
 * /api/client/{id}:
 *   put:
 *     tags: [Clients]
 *     summary: Actualizar un cliente
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id',          validate(updateClientSchema), updateClient);

/**
 * @swagger
 * /api/client/{id}:
 *   delete:
 *     tags: [Clients]
 *     summary: Eliminar o archivar un cliente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: soft
 *         schema: { type: boolean }
 */
router.delete('/:id',       validate(idParamSchema), deleteClient);

/**
 * @swagger
 * /api/client/{id}/restore:
 *   patch:
 *     tags: [Clients]
 *     summary: Restaurar un cliente archivado
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/restore', validate(idParamSchema), restoreClient);

export default router;
