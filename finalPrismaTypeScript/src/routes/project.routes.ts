import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  createProjectSchema,
  updateProjectSchema,
  idParamSchema,
  listProjectSchema,
} from '../validators/project.validator';
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  listArchivedProjects,
  restoreProject,
} from '../controllers/project.controller';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Gestión de proyectos
 */

/**
 * @swagger
 * /api/project:
 *   post:
 *     tags: [Projects]
 *     summary: Crear un proyecto
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProjectInput'
 *     responses:
 *       201:
 *         description: Proyecto creado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         description: Error de validación
 *       409:
 *         description: Código de proyecto duplicado en la compañía
 */
router.post('/', validate(createProjectSchema), createProject);

/**
 * @swagger
 * /api/project:
 *   get:
 *     tags: [Projects]
 *     summary: Listar proyectos activos con paginación y filtros
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
 *         description: Filtro parcial por nombre
 *       - in: query
 *         name: client
 *         schema: { type: string }
 *         description: Filtrar por ID de cliente
 *       - in: query
 *         name: active
 *         schema: { type: boolean }
 *         description: Filtrar por estado activo/inactivo
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: '-createdAt' }
 *     responses:
 *       200:
 *         description: Lista paginada de proyectos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *                 total: { type: integer }
 *                 page:  { type: integer }
 *                 limit: { type: integer }
 *                 pages: { type: integer }
 */
router.get('/', validate(listProjectSchema), listProjects);

/**
 * @swagger
 * /api/project/archived:
 *   get:
 *     tags: [Projects]
 *     summary: Listar proyectos archivados (soft-deleted)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de proyectos archivados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Project'
 */
router.get('/archived', listArchivedProjects);

/**
 * @swagger
 * /api/project/{id}:
 *   get:
 *     tags: [Projects]
 *     summary: Obtener un proyecto por ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Datos del proyecto
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       404:
 *         description: Proyecto no encontrado
 */
router.get('/:id', validate(idParamSchema), getProject);

/**
 * @swagger
 * /api/project/{id}:
 *   put:
 *     tags: [Projects]
 *     summary: Actualizar un proyecto
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProjectInput'
 *     responses:
 *       200:
 *         description: Proyecto actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       404:
 *         description: Proyecto no encontrado
 *       409:
 *         description: Código de proyecto duplicado
 */
router.put('/:id', validate(updateProjectSchema), updateProject);

/**
 * @swagger
 * /api/project/{id}:
 *   delete:
 *     tags: [Projects]
 *     summary: Eliminar un proyecto (soft o hard delete)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: soft
 *         schema: { type: boolean, default: true }
 *         description: "true = archivar, false = eliminar permanentemente"
 *     responses:
 *       200:
 *         description: Proyecto archivado
 *       204:
 *         description: Proyecto eliminado permanentemente
 *       404:
 *         description: Proyecto no encontrado
 */
router.delete('/:id', validate(idParamSchema), deleteProject);

/**
 * @swagger
 * /api/project/{id}/restore:
 *   patch:
 *     tags: [Projects]
 *     summary: Restaurar un proyecto archivado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Proyecto restaurado correctamente
 *       404:
 *         description: Proyecto no encontrado o no está archivado
 */
router.patch('/:id/restore', validate(idParamSchema), restoreProject);

export default router;
