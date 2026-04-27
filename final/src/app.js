import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server as SocketIO } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error-handler.js';
import { verifyToken } from './utils/jwt.js';
import { env } from './config/index.js';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app = express();
const httpServer = createServer(app);

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Autenticación JWT en Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token requerido'));

  const payload = verifyToken(token, env.JWT_SECRET);
  if (!payload) return next(new Error('Token inválido'));

  socket.userId    = payload._id;
  socket.companyId = payload.company;
  next();
});

io.on('connection', (socket) => {
  // Unir al usuario a la sala de su compañía
  if (socket.companyId) {
    socket.join(socket.companyId.toString());
  }

  socket.on('disconnect', () => {});
});

// Exponer io en app para usarlo en controllers
app.set('io', io);

// ── Seguridad ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());

// Sanitización NoSQL — elimina claves con $ y . del body y params
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

// Rate limiting global
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 10_000 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, message: 'Demasiadas solicitudes, inténtalo más tarde' },
  })
);

// ── Logging HTTP ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Parseo de body ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Archivos estáticos (logos locales) ───────────────────────────────────────
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// ── Swagger UI ────────────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const health = {
    status:      'ok',
    timestamp:   new Date().toISOString(),
    uptime:      process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    db:          'disconnected',
  };

  try {
    if (mongoose.connection.readyState === 1) {
      health.db = 'connected';
    }
  } catch {
    health.db = 'disconnected';
  }

  res.json(health);
});

// ── Rutas de la API ───────────────────────────────────────────────────────────
app.use('/api', routes);

// ── Manejo de errores ─────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export { httpServer };
export default app;
