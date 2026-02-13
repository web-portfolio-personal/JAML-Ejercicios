// src/routes/index.js
import { Router } from 'express';
import todosRoutes from './todos.routes.js';

const router = Router();

router.use('/todos', todosRoutes);

router.get('/', (req, res) => {
    res.json({
        mensaje: 'Todo API v1.0',
        descripcion: 'API de gestión de tareas con validación Zod',
        endpoints: {
            todos: '/api/todos',
            stats: '/api/todos/stats',
            health: '/health'
        },
        filtros: {
            completed: 'true | false',
            priority: 'low | medium | high',
            tag: 'nombre del tag',
            sortBy: 'dueDate | createdAt | priority | title',
            order: 'asc | desc',
            search: 'texto a buscar (fuzzy)'
        }
    });
});

export default router;
