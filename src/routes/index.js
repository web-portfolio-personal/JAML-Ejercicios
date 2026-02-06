// src/routes/index.js
import { Router } from 'express';
import cursosRoutes from './cursos.routes.js';

const router = Router();

router.use('/cursos/programacion', cursosRoutes);

router.get('/', (req, res) => {
    res.json({
        mensaje: 'API de Cursos v1.0',
        endpoints: {
            cursos: '/api/cursos/programacion',
            health: '/health'
        }
    });
});

export default router;