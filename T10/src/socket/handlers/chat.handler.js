import Message from '../../models/message.model.js';
import User from '../../models/user.model.js';

export const registerChatHandlers = (io, socket) => {
  const user = socket.user;

  // chat:message — enviar mensaje a sala
  socket.on('chat:message', async ({ roomId, content }, callback) => {
    if (!roomId || !content?.trim()) {
      return callback?.({ error: true, message: 'roomId y content son requeridos' });
    }

    try {
      const msg = await Message.create({ room: roomId, user: user._id, content: content.trim() });
      await msg.populate('user', 'name email');

      const payload = {
        id: msg._id,
        user: { id: user._id, name: user.name },
        content: msg.content,
        reactions: [],
        timestamp: msg.createdAt
      };

      // Emitir a todos en la sala (incluido emisor)
      io.to(roomId).emit('chat:message', payload);

      callback?.({ error: false, messageId: msg._id });
    } catch (err) {
      callback?.({ error: true, message: err.message });
    }
  });

  // chat:typing — indicador escribiendo
  socket.on('chat:typing', ({ roomId }) => {
    socket.to(roomId).emit('chat:typing', {
      user: { id: user._id, name: user.name }
    });
  });

  // chat:private — mensaje privado 1 a 1 (bonus)
  socket.on('chat:private', async ({ toUserId, content }, callback) => {
    if (!toUserId || !content?.trim()) {
      return callback?.({ error: true, message: 'toUserId y content son requeridos' });
    }

    try {
      const recipient = await User.findById(toUserId).select('name email');
      if (!recipient) {
        return callback?.({ error: true, message: 'Usuario destinatario no encontrado' });
      }

      const payload = {
        from: { id: user._id, name: user.name },
        to: { id: recipient._id, name: recipient.name },
        content: content.trim(),
        timestamp: new Date()
      };

      // Enviar a todos los sockets del destinatario
      const recipientSockets = [...(socket.nsp.sockets.values())]
        .filter(s => s.user?._id.toString() === toUserId);

      recipientSockets.forEach(s => s.emit('chat:private', payload));

      // Confirmar al emisor
      callback?.({ error: false, delivered: recipientSockets.length > 0 });
    } catch (err) {
      callback?.({ error: true, message: err.message });
    }
  });

  // chat:reaction — reacción emoji en tiempo real (bonus)
  socket.on('chat:reaction', async ({ roomId, messageId, emoji }, callback) => {
    if (!roomId || !messageId || !emoji) {
      return callback?.({ error: true, message: 'roomId, messageId y emoji son requeridos' });
    }

    try {
      const msg = await Message.findById(messageId);
      if (!msg) return callback?.({ error: true, message: 'Mensaje no encontrado' });

      const userId = user._id.toString();
      const existingIdx = msg.reactions.findIndex(
        r => r.emoji === emoji && r.user.toString() === userId
      );

      if (existingIdx >= 0) {
        msg.reactions.splice(existingIdx, 1);
      } else {
        msg.reactions.push({ emoji, user: user._id });
      }

      await msg.save();

      // Notificar a todos en la sala las reacciones actualizadas
      io.to(roomId).emit('chat:reaction', {
        messageId,
        reactions: msg.reactions,
        updatedBy: { id: user._id, name: user.name }
      });

      callback?.({ error: false });
    } catch (err) {
      callback?.({ error: true, message: err.message });
    }
  });
};
