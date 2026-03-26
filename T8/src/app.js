import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import morganBody from 'morgan-body';
import routes from './routes/index.js';
import swaggerSpecs from './docs/swagger.js';
import { loggerStream } from './utils/handleLogger.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Logger para Slack (solo errores >= 400)
morganBody(app, {
  noColors: true,
  skip: (req, res) => res.statusCode < 400,
  stream: loggerStream
});

// Swagger Docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
