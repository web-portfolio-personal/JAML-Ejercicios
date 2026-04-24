import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  createClientSchema,
  updateClientSchema,
  idParamSchema,
  listClientSchema,
} from '../validators/client.validator.js';
import {
  createClient,
  listClients,
  getClient,
  updateClient,
  deleteClient,
  listArchivedClients,
  restoreClient,
} from '../controllers/client.controller.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Clients
 *   description: Gestión de clientes
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
 *       400:
 *         description: Error de validación
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
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: '-createdAt' }
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
 *     responses:
 *       200:
 *         description: Lista de clientes archivados
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
 *     responses:
 *       200:
 *         description: Datos del cliente
 *       404:
 *         description: Cliente no encontrado
 */
router.get('/:id', validate(idParamSchema), getClient);

/**
 * @swagger
 * /api/client/{id}:
 *   put:
 *     tags: [Clients]
 *     summary: Actualizar un cliente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClientInput'
 *     responses:
 *       200:
 *         description: Cliente actualizado
 */
router.put('/:id', validate(updateClientSchema), updateClient);

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
 *         description: Si es true, realiza soft delete (archivar)
 *     responses:
 *       200:
 *         description: Cliente eliminado o archivado
 */
router.delete('/:id', validate(idParamSchema), deleteClient);

/**
 * @swagger
 * /api/client/{id}/restore:
 *   patch:
 *     tags: [Clients]
 *     summary: Restaurar un cliente archivado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Cliente restaurado
 */
router.patch('/:id/restore', validate(idParamSchema), restoreClient);

export default router;
