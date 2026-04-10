import Room from '../../models/room.model.js';
import Message from '../../models/message.model.js';

// roomId → Set<userId>
const roomUsers = new Map();

export const registerRoomHandlers = (io, socket, onlineUsers) => {
  const user = socket.user;

  // room:join — unirse a sala
  socket.on('room:join', async ({ roomId }, callback) => {
    try {
      const room = await Room.findById(roomId).populate('createdBy', 'name email');
      if (!room) {
        return callback?.({ error: true, message: 'Sala no encontrada' });
      }

      socket.join(roomId);

      // Registrar usuario en sala
      if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
      roomUsers.get(roomId).set(user._id.toString(), {
        id: user._id,
        name: user.name,
        email: user.email
      });

      // Historial de los últimos 50 mensajes
      const history = await Message.find({ room: roomId })
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(50)
        .then(msgs => msgs.reverse());

      const users = [...roomUsers.get(roomId).values()];

      // Evento explícito room:joined al cliente que se une (contrato del enunciado)
      socket.emit('room:joined', { room, users });

      // Confirmación también por acknowledgement para compatibilidad con el frontend
      callback?.({ error: false, room, users, history });

      // Notificar al resto de la sala
      socket.to(roomId).emit('room:user-joined', {
        user: { id: user._id, name: user.name }
      });
    } catch (err) {
      callback?.({ error: true, message: err.message });
    }
  });

  // room:leave — salir de sala
  socket.on('room:leave', ({ roomId }, callback) => {
    socket.leave(roomId);

    if (roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(user._id.toString());
      if (roomUsers.get(roomId).size === 0) roomUsers.delete(roomId);
    }

    socket.to(roomId).emit('room:user-left', {
      user: { id: user._id, name: user.name }
    });

    callback?.({ error: false });
  });

  // Limpiar sala al desconectar
  socket.on('disconnect', () => {
    roomUsers.forEach((users, roomId) => {
      if (users.has(user._id.toString())) {
        users.delete(user._id.toString());
        socket.to(roomId).emit('room:user-left', {
          user: { id: user._id, name: user.name }
        });
        if (users.size === 0) roomUsers.delete(roomId);
      }
    });
  });
};
