import { Router } from 'express';
import {
  getTracks,
  getTrack,
  createTrack,
  updateTrack,
  deleteTrack
} from '../controllers/tracks.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { createTrackSchema, updateTrackSchema, idParamSchema } from '../validators/track.validator.js';
import authMiddleware from '../middleware/session.middleware.js';
import checkRol from '../middleware/rol.middleware.js';

const router = Router();

/**
 * @openapi
 * /api/tracks:
 *   get:
 *     tags:
 *       - Tracks
 *     summary: Obtener todos los tracks
 *     description: Lista todos los tracks de la base de datos
 *     responses:
 *       200:
 *         description: Lista de tracks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Track'
 */
router.get('/', getTracks);

/**
 * @openapi
 * /api/tracks/{id}:
 *   get:
 *     tags:
 *       - Tracks
 *     summary: Obtener track por ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID del track (MongoDB ObjectId)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Track encontrado
 *       404:
 *         description: Track no encontrado
 */
router.get('/:id', validate(idParamSchema), getTrack);

/**
 * @openapi
 * /api/tracks:
 *   post:
 *     tags:
 *       - Tracks
 *     summary: Crear un track
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - duration
 *             properties:
 *               title:
 *                 type: string
 *                 example: Mi Canción
 *               duration:
 *                 type: integer
 *                 example: 180
 *               genres:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["rock", "pop"]
 *     responses:
 *       201:
 *         description: Track creado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos
 */
router.post('/',
  authMiddleware,
  checkRol(['user', 'admin']),
  validate(createTrackSchema),
  createTrack
);

/**
 * @openapi
 * /api/tracks/{id}:
 *   put:
 *     tags:
 *       - Tracks
 *     summary: Actualizar un track
 *     security:
 *       - bearerAuth: []
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
 *               duration:
 *                 type: integer
 *               genres:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Track actualizado
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Track no encontrado
 */
router.put('/:id',
  authMiddleware,
  checkRol(['user', 'admin']),
  validate(idParamSchema),
  validate(updateTrackSchema),
  updateTrack
);

/**
 * @openapi
 * /api/tracks/{id}:
 *   delete:
 *     tags:
 *       - Tracks
 *     summary: Eliminar un track
 *     description: Solo administradores pueden eliminar tracks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Track eliminado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Track no encontrado
 */
router.delete('/:id',
  authMiddleware,
  checkRol(['admin']),
  validate(idParamSchema),
  deleteTrack
);

export default router;
