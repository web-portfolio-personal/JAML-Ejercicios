import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploadSignature } from '../middleware/upload.js';
import {
  createDeliveryNoteSchema,
  idParamSchema,
  listDeliveryNoteSchema,
} from '../validators/deliverynote.validator.js';
import {
  createDeliveryNote,
  listDeliveryNotes,
  getDeliveryNote,
  downloadPdf,
  signDeliveryNote,
  deleteDeliveryNote,
} from '../controllers/deliverynote.controller.js';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: DeliveryNotes
 *   description: Gestión de albaranes de obra
 */

/**
 * @swagger
 * /api/deliverynote:
 *   post:
 *     tags: [DeliveryNotes]
 *     summary: Crear un albarán
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeliveryNoteInput'
 *     responses:
 *       201:
 *         description: Albarán creado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeliveryNote'
 *       400:
 *         description: Error de validación o cliente/proyecto no pertenece a la compañía
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', validate(createDeliveryNoteSchema), createDeliveryNote);

/**
 * @swagger
 * /api/deliverynote:
 *   get:
 *     tags: [DeliveryNotes]
 *     summary: Listar albaranes con paginación y filtros
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
 *         name: project
 *         schema: { type: string }
 *         description: Filtrar por ID de proyecto
 *       - in: query
 *         name: client
 *         schema: { type: string }
 *         description: Filtrar por ID de cliente
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [hours, material] }
 *         description: Filtrar por formato de albarán
 *       - in: query
 *         name: signed
 *         schema: { type: boolean }
 *         description: Filtrar por estado de firma
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Fecha inicio (workDate >=)
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: Fecha fin (workDate <=)
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: '-workDate' }
 *     responses:
 *       200:
 *         description: Lista paginada de albaranes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DeliveryNote'
 *                 total: { type: integer }
 *                 page:  { type: integer }
 *                 limit: { type: integer }
 *                 pages: { type: integer }
 */
router.get('/', validate(listDeliveryNoteSchema), listDeliveryNotes);

/**
 * @swagger
 * /api/deliverynote/pdf/{id}:
 *   get:
 *     tags: [DeliveryNotes]
 *     summary: Descargar o generar el PDF de un albarán
 *     description: |
 *       Si el albarán está firmado y tiene `pdfUrl`, redirige (302) a Cloudinary.
 *       Si no está firmado, genera el PDF al vuelo con pdfkit y lo descarga directamente.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: PDF generado (Content-Type application/pdf)
 *       302:
 *         description: Redirección al PDF firmado en Cloudinary
 *       404:
 *         description: Albarán no encontrado
 */
router.get('/pdf/:id', validate(idParamSchema), downloadPdf);

/**
 * @swagger
 * /api/deliverynote/{id}:
 *   get:
 *     tags: [DeliveryNotes]
 *     summary: Obtener un albarán por ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Datos completos del albarán (populate user, client, project)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeliveryNote'
 *       404:
 *         description: Albarán no encontrado
 */
router.get('/:id', validate(idParamSchema), getDeliveryNote);

/**
 * @swagger
 * /api/deliverynote/{id}/sign:
 *   patch:
 *     tags: [DeliveryNotes]
 *     summary: Firmar un albarán con imagen de firma
 *     description: |
 *       Sube la imagen de firma (multipart/form-data campo "signature").
 *       Sharp redimensiona a max 800px y convierte a WebP.
 *       La imagen se sube a Cloudinary. Se genera un PDF firmado y se sube también a Cloudinary.
 *       El albarán queda marcado como `signed: true`.
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [signature]
 *             properties:
 *               signature:
 *                 type: string
 *                 format: binary
 *                 description: Imagen de la firma (jpg/png/webp, máx 5 MB)
 *     responses:
 *       200:
 *         description: Albarán firmado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeliveryNote'
 *       400:
 *         description: Albarán ya firmado o sin fichero de firma
 *       404:
 *         description: Albarán no encontrado
 */
router.patch('/:id/sign', validate(idParamSchema), uploadSignature.single('signature'), signDeliveryNote);

/**
 * @swagger
 * /api/deliverynote/{id}:
 *   delete:
 *     tags: [DeliveryNotes]
 *     summary: Eliminar un albarán
 *     description: No se puede eliminar un albarán firmado.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Albarán eliminado correctamente
 *       400:
 *         description: No se puede eliminar un albarán firmado
 *       404:
 *         description: Albarán no encontrado
 */
router.delete('/:id', validate(idParamSchema), deleteDeliveryNote);

export default router;
