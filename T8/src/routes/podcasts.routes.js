import { Router } from 'express';
import {
  getPodcasts,
  getAllPodcasts,
  getPodcast,
  createPodcast,
  updatePodcast,
  deletePodcast,
  publishPodcast
} from '../controllers/podcasts.controller.js';
import authMiddleware from '../middleware/session.middleware.js';
import checkRol from '../middleware/rol.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createPodcastSchema,
  updatePodcastSchema,
  podcastIdSchema
} from '../validators/podcast.validator.js';

const router = Router();

/**
 * @openapi
 * /api/podcasts:
 *   get:
 *     tags:
 *       - Podcasts
 *     summary: Listar podcasts publicados
 *     description: Devuelve todos los podcasts publicados. Soporta paginación con ?page=1&limit=10
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Resultados por página
 *     responses:
 *       200:
 *         description: Lista de podcasts publicados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Podcast'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     pages:
 *                       type: integer
 */
router.get('/', getPodcasts);

/**
 * @openapi
 * /api/podcasts/admin/all:
 *   get:
 *     tags:
 *       - Podcasts
 *     summary: Listar todos los podcasts (admin)
 *     description: Lista todos los podcasts incluidos los no publicados. Solo administradores.
 *     security:
 *       - BearerToken: []
 *     responses:
 *       200:
 *         description: Lista completa de podcasts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Podcast'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Sólo administradores
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/admin/all', authMiddleware, checkRol(['admin']), getAllPodcasts);

/**
 * @openapi
 * /api/podcasts/{id}:
 *   get:
 *     tags:
 *       - Podcasts
 *     summary: Obtener un podcast por ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del podcast (MongoDB ObjectId)
 *     responses:
 *       200:
 *         description: Podcast encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Podcast'
 *       404:
 *         description: Podcast no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', validate(podcastIdSchema), getPodcast);

/**
 * @openapi
 * /api/podcasts:
 *   post:
 *     tags:
 *       - Podcasts
 *     summary: Crear podcast
 *     description: Crea un nuevo podcast. El autor se asigna automáticamente al usuario autenticado.
 *     security:
 *       - BearerToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *                 example: Mi Podcast de Tech
 *               description:
 *                 type: string
 *                 example: Un podcast sobre las últimas tendencias en tecnología
 *               category:
 *                 type: string
 *                 enum: [tech, science, history, comedy, news]
 *                 example: tech
 *               duration:
 *                 type: integer
 *                 example: 3600
 *               episodes:
 *                 type: integer
 *                 example: 5
 *     responses:
 *       201:
 *         description: Podcast creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Podcast'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authMiddleware, validate(createPodcastSchema), createPodcast);

/**
 * @openapi
 * /api/podcasts/{id}:
 *   put:
 *     tags:
 *       - Podcasts
 *     summary: Actualizar podcast
 *     description: Actualiza un podcast. Solo el autor puede modificar su propio podcast.
 *     security:
 *       - BearerToken: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [tech, science, history, comedy, news]
 *               duration:
 *                 type: integer
 *               episodes:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Podcast actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Podcast'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Solo el autor puede editar este podcast
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Podcast no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', authMiddleware, validate(updatePodcastSchema), updatePodcast);

/**
 * @openapi
 * /api/podcasts/{id}:
 *   delete:
 *     tags:
 *       - Podcasts
 *     summary: Eliminar podcast (admin)
 *     description: Elimina cualquier podcast. Solo administradores.
 *     security:
 *       - BearerToken: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Podcast eliminado
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Solo administradores
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Podcast no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', authMiddleware, checkRol(['admin']), validate(podcastIdSchema), deletePodcast);

/**
 * @openapi
 * /api/podcasts/{id}/publish:
 *   patch:
 *     tags:
 *       - Podcasts
 *     summary: Publicar / despublicar podcast (admin)
 *     description: Alterna el estado publicado de un podcast. Solo administradores.
 *     security:
 *       - BearerToken: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estado de publicación actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Podcast'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Solo administradores
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Podcast no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:id/publish', authMiddleware, checkRol(['admin']), validate(podcastIdSchema), publishPodcast);

export default router;
