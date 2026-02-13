// src/routes/cursos.routes.js
import { Router } from 'express';
import * as controller from '../controllers/cursos.controller.js';
import { validate } from '../middleware/validateRequest.js';
import { createCursoSchema, updateCursoSchema } from '../schemas/cursos.schema.js';

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', validate(createCursoSchema), controller.create);
router.put('/:id', validate(updateCursoSchema), controller.update);
router.patch('/:id', validate(updateCursoSchema), controller.partialUpdate);
router.delete('/:id', controller.remove);

export default router;