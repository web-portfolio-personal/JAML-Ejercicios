import { createServer } from 'node:http';
import { join } from 'node:path';
import express, { Request, Response, NextFunction } from 'express';
import { Server as SocketIO } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import routes from './routes/index';
import { notFoundHandler, errorHandler } from './middleware/error-handler';
import { verifyToken } from './utils/jwt';
import { env } from './config/index';
import prisma from './lib/prisma';

const app = express();
const httpServer = createServer(app);

// Socket.IO
const io = new SocketIO(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Autenticacion JWT en Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error('Token requerido'));

  const payload = verifyToken(token, env.JWT_SECRET);
  if (!payload) return next(new Error('Token invalido'));

  const p = payload as unknown as Record<string, unknown>;
  (socket as unknown as Record<string, unknown>).userId    = p['sub'];
  (socket as unknown as Record<string, unknown>).companyId = p['companyId'];
  next();
});

io.on('connection', (socket) => {
  const companyId = (socket as unknown as Record<string, unknown>).companyId as string | undefined;
  if (companyId) {
    socket.join(companyId);
  }
  socket.on('disconnect', () => {});
});

// Exponer io en app para usarlo en controllers
app.set('io', io);

// Seguridad
app.use(helmet());
app.use(cors());

// Sanitizacion NoSQL-like (limpia claves con $ y .)
app.use((req: Request, _res: Response, next: NextFunction) => {
  const sanitize = (obj: unknown): void => {
    if (typeof obj !== 'object' || obj === null) return;
    for (const key of Object.keys(obj as object)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete (obj as Record<string, unknown>)[key];
      } else {
        sanitize((obj as Record<string, unknown>)[key]);
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
    message: { error: true, message: 'Demasiadas solicitudes, intentalo mas tarde' },
  })
);

// Logging HTTP
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Parseo de body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Archivos estaticos (logos locales)
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/health', async (_req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  res.json({
    status:      'ok',
    timestamp:   new Date().toISOString(),
    uptime:      process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    db:          dbStatus,
  });
});

// Rutas de la API
app.use('/api', routes);

// Manejo de errores
app.use(notFoundHandler);
app.use(errorHandler);

export { httpServer };
export default app;
