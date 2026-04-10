import { Router } from 'express';
import Room from '../models/room.model.js';
import Message from '../models/message.model.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = Router();

// GET /api/rooms — listar salas (público)
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ data: rooms });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/rooms — crear sala (autenticado)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: true, message: 'name es requerido' });
    }

    const exists = await Room.findOne({ name });
    if (exists) {
      return res.status(409).json({ error: true, message: 'Ya existe una sala con ese nombre' });
    }

    const room = await Room.create({ name, description, createdBy: req.user._id });
    await room.populate('createdBy', 'name email');

    res.status(201).json({ data: room });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// GET /api/rooms/:id/messages — historial de mensajes (autenticado)
// Bonus: ?search=texto  ?page=1  ?limit=50
router.get('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: true, message: 'Sala no encontrada' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search;

    const filter = { room: req.params.id };
    if (search) {
      filter.content = { $regex: search, $options: 'i' };
    }

    const [total, messages] = await Promise.all([
      Message.countDocuments(filter),
      Message.find(filter)
        .populate('user', 'name email')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
    ]);

    res.json({
      data: messages,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// PATCH /api/rooms/:id/messages/:msgId — editar mensaje propio (bonus)
router.patch('/:id/messages/:msgId', authMiddleware, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ error: true, message: 'Mensaje no encontrado' });
    if (msg.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: true, message: 'Solo puedes editar tus propios mensajes' });
    }

    const { content } = req.body;
    if (!content) return res.status(400).json({ error: true, message: 'content es requerido' });

    msg.content = content;
    await msg.save();
    await msg.populate('user', 'name email');

    res.json({ data: msg });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// DELETE /api/rooms/:id/messages/:msgId — borrar mensaje propio (bonus)
router.delete('/:id/messages/:msgId', authMiddleware, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ error: true, message: 'Mensaje no encontrado' });
    if (msg.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: true, message: 'Solo puedes eliminar tus propios mensajes' });
    }

    await msg.deleteOne();
    res.json({ message: 'Mensaje eliminado' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/rooms/:id/messages/:msgId/reactions — añadir/quitar reacción (bonus)
router.post('/:id/messages/:msgId/reactions', authMiddleware, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: true, message: 'emoji es requerido' });

    const msg = await Message.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ error: true, message: 'Mensaje no encontrado' });

    const userId = req.user._id.toString();
    const existingIdx = msg.reactions.findIndex(
      r => r.emoji === emoji && r.user.toString() === userId
    );

    if (existingIdx >= 0) {
      // Toggle off — quitar reacción
      msg.reactions.splice(existingIdx, 1);
    } else {
      msg.reactions.push({ emoji, user: req.user._id });
    }

    await msg.save();
    await msg.populate('user', 'name email');

    res.json({ data: msg });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

export default router;
