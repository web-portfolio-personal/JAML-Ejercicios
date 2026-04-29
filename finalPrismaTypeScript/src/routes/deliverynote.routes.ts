import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { uploadSignature } from '../middleware/upload';
import {
  createDeliveryNoteSchema,
  idParamSchema,
  listDeliveryNoteSchema,
} from '../validators/deliverynote.validator';
import {
  createDeliveryNote,
  listDeliveryNotes,
  getDeliveryNote,
  downloadPdf,
  signDeliveryNote,
  deleteDeliveryNote,
} from '../controllers/deliverynote.controller';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: DeliveryNotes
 *   description: Gestion de albaranes
 */

router.post('/',           validate(createDeliveryNoteSchema), createDeliveryNote);
router.get('/',            validate(listDeliveryNoteSchema),   listDeliveryNotes);
router.get('/pdf/:id',     validate(idParamSchema),            downloadPdf);
router.get('/:id',         validate(idParamSchema),            getDeliveryNote);
router.patch('/:id/sign',  validate(idParamSchema),            uploadSignature.single('signature'), signDeliveryNote);
router.delete('/:id',      validate(idParamSchema),            deleteDeliveryNote);

export default router;
