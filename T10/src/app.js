import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.routes.js';
import roomsRoutes from './routes/rooms.routes.js';
import { registerSocketHandlers } from './socket/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// REST routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: true, message: `Ruta ${req.method} ${req.path} no encontrada` });
});

// Socket.IO
registerSocketHandlers(io);

export default httpServer;
