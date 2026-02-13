// src/routes/todos.routes.js
import { Router } from 'express';
import * as controller from '../controllers/todos.controller.js';
import { validate } from '../middleware/validateRequest.js';
import {
    createTodoSchema,
    updateTodoSchema,
    patchTodoSchema,
    idParamSchema,
    queryTodosSchema
} from '../schemas/todos.schema.js';

const router = Router();

// GET /api/todos - Listar todas (con filtros)
router.get('/', validate(queryTodosSchema), controller.getAll);

// GET /api/todos/stats - BONUS: Estadísticas
router.get('/stats', controller.getStats);

// GET /api/todos/:id - Obtener una tarea
router.get('/:id', validate(idParamSchema), controller.getById);

// POST /api/todos - Crear tarea
router.post('/', validate(createTodoSchema), controller.create);

// PUT /api/todos/:id - Actualizar tarea completa
router.put('/:id', validate(updateTodoSchema), controller.update);

// PATCH /api/todos/:id/toggle - Cambiar estado completada
router.patch('/:id/toggle', validate(idParamSchema), controller.toggle);

// PATCH /api/todos/:id - Actualización parcial
router.patch('/:id', validate(patchTodoSchema), controller.partialUpdate);

// DELETE /api/todos/:id - Eliminar tarea
router.delete('/:id', validate(idParamSchema), controller.remove);

export default router;
