// src/app.js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dbConnect from './config/db.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { loggingMiddleware } from './middleware/logging.middleware.js';

const app = express();

// Seguridad
app.use(helmet());
app.use(cors());

// Logging middleware con timestamps
app.use(loggingMiddleware);

// Parseo de body (limitar tamaño para prevenir ataques de payload)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos
app.use('/uploads', express.static('storage'));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// Rutas de la API
app.use('/api', routes);

// Manejo de errores (siempre al final)
app.use(notFound);
app.use(errorHandler);

// Iniciar servidor
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    await dbConnect();
    app.listen(PORT, () => {
        console.log(`🚀 Servidor en http://localhost:${PORT}`);
        console.log(`📝 Entorno: ${process.env.NODE_ENV || 'development'}`);
    });
};

startServer().catch((error) => {
    console.error('💥 Error fatal al iniciar el servidor:', error.message);
    process.exit(1);
});
