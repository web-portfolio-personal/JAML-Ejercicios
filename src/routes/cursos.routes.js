// src/routes/cursos.routes.js
import { Router } from 'express';
import * as cursosController from '../controllers/cursos.controller.js';

const router = Router();

router.get('/', cursosController.getAll);
router.get('/:id', cursosController.getById);
router.post('/', cursosController.create);
router.put('/:id', cursosController.update);
router.patch('/:id', cursosController.partialUpdate);
router.delete('/:id', cursosController.remove);

export default router;