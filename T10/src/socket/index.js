import { verifyToken } from '../utils/jwt.js';
import User from '../models/user.model.js';
import { registerRoomHandlers } from './handlers/room.handler.js';
import { registerChatHandlers } from './handlers/chat.handler.js';

// userId → Set<socketId>  (un usuario puede tener varias pestañas)
const onlineUsers = new Map();

export const registerSocketHandlers = (io) => {
  // Auth middleware — verifica JWT en handshake
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token no proporcionado'));

    try {
      const { userId } = verifyToken(token);
      const user = await User.findById(userId).select('-password');
      if (!user) return next(new Error('Usuario no encontrado'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    const userName = socket.user.name;

    // Presencia — registrar online
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Notificar a todos que este usuario está online
    socket.broadcast.emit('user:online', {
      userId,
      name: userName
    });

    // Registrar handlers de sala y chat
    registerRoomHandlers(io, socket, onlineUsers);
    registerChatHandlers(io, socket);

    // Desconexión — presencia offline
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user:offline', { userId, name: userName });
        }
      }
    });
  });
};

// Helper — obtener socketId activo de un usuario (para mensajes privados)
export const getSocketIds = (onlineUsers, userId) =>
  [...(onlineUsers.get(userId) || [])];
