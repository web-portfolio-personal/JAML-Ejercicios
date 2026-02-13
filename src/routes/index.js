// src/routes/index.js
import { Router } from 'express';
import cursosRoutes from './cursos.routes.js';
import usuariosRoutes from './usuarios.routes.js';

const router = Router();

router.use('/cursos/programacion', cursosRoutes);
router.use('/usuarios', usuariosRoutes);

router.get('/', (req, res) => {
    res.json({
        mensaje: 'API de Cursos v1.0',
        endpoints: {
            cursos: '/api/cursos/programacion',
            usuarios: '/api/usuarios',
            health: '/health'
        }
    });
});

export default router;