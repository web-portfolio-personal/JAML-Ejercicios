// src/routes/usuarios.routes.js
import { Router } from 'express';
import * as controller from '../controllers/usuarios.controller.js';
import { validate } from '../middleware/validateRequest.js';
import { createUsuarioSchema, updateUsuarioSchema } from '../schemas/usuarios.schema.js';

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', validate(createUsuarioSchema), controller.create);
router.put('/:id', validate(updateUsuarioSchema), controller.update);
router.patch('/:id', validate(updateUsuarioSchema), controller.partialUpdate);
router.delete('/:id', controller.remove);

export default router;
