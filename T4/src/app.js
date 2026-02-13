// src/app.js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { loggingMiddleware } from './middleware/logging.js';
import { rateLimiter } from './middleware/rateLimiter.js';

const app = express();

// Seguridad
app.use(helmet());
app.use(cors());

// Rate limiting (BONUS: máx 100 req/min)
app.use(rateLimiter);

// Logging middleware con timestamps
app.use(loggingMiddleware);

// Parseo de body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rutas de la API
app.use('/api', routes);

// Manejo de errores
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
