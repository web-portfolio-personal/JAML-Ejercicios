import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { join } from 'node:path';

import userRoutes from './routes/user.routes.js';
import { notFoundHandler, errorHandler } from './middleware/error-handler.js';

const __dirname = import.meta.dirname;

const app = express();

// ── Seguridad ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
// Sanitización NoSQL — elimina claves con $ y . de req.body y req.params
// (express-mongo-sanitize no es compatible con Express 5; implementación inline)
app.use((req, _res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else {
        sanitize(obj[key]);
      }
    }
  };
  sanitize(req.body);
  sanitize(req.params);
  next();
});

// Rate limiting global: 100 req / 15 min
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, message: 'Demasiadas solicitudes, inténtalo más tarde' },
  })
);

// Rate limiting estricto para auth: 10 req / 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: true, message: 'Demasiados intentos de autenticación' },
});

// ── Parseo de body ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Archivos estáticos (logos) ───────────────────────────────────────────────
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Rutas de la API ──────────────────────────────────────────────────────────
app.use('/api/user/register', authLimiter);
app.use('/api/user/login', authLimiter);
app.use('/api/user', userRoutes);

// ── Manejo de errores ────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
