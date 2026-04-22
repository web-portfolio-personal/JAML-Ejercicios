import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import routes from './routes/index.js';
import swaggerSpecs from './docs/swagger.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';
import prisma from './config/prisma.js';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(isProduction ? 'combined' : 'dev'));
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
app.use('/api', routes);

// Health check — siempre 200 (app viva), estado de BD como información
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: 'unknown',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database = 'connected';
  } catch {
    health.database = 'disconnected';
  }

  res.json(health);
});

app.use(notFound);
app.use(errorHandler);

export default app;
